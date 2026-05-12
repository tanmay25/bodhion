'use client';

import { useRef, useEffect, useState, useCallback } from 'react';

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, X, AlertTriangle, RefreshCw, MessageSquareDashed, MessageSquare, SlidersHorizontal, Save, FileIcon, Loader2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { MessageBubble } from './MessageBubble';
import { FilePreviewModal } from './FilePreviewModal';
import { PromptInput, type AttachableItem } from './PromptInput';
import { ModelSelector } from './ModelSelector';
import { ChatControlsPanel } from './ChatControlsPanel';
import { useStreamingResponse } from '@/hooks/useStreamingResponse';
import { useSocket } from '@/providers/SocketProvider';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useChatStore } from '@/store/chatStore';
import { getToken } from '@/lib/auth/session';
import {
  createNewChat,
  updateChatById,
  getChatById,
  getChatList,
  getPinnedChats,
} from '@/lib/api/chats';
import { uploadFile } from '@/lib/api/files';
import { fetchFollowUpSuggestions } from '@/lib/api/ai';
import type { ChatMessage, ChatFile, FullChatResponse, MessageContentPart, PipelineStep } from '@/types/chat';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttachedFile {
  id: string;
  name: string;
  /** Raw file ID — the backend uses this to look up the collection / build download URLs */
  url?: string;
  /** Object URL from URL.createObjectURL() for instant local preview; revoke on remove */
  localUrl?: string;
  collection_name?: string;
  /** Semantic type for backend routing: 'file' for documents, 'image' for vision */
  type: 'file' | 'image' | 'note' | 'collection' | 'knowledge_file' | 'chat';
  /** MIME type (e.g. 'image/png') — used only on the client for preview logic */
  mimeType?: string;
  size?: number;
  description?: string;
}

export interface ChatWindowProps {
  chatId?: string;
}

// ── Multimodal message helpers ────────────────────────────────────────────────

/**
 * Build the `messages` array for the chat completion payload.
 * For the message identified by `imageMessageId`, image files are embedded
 * directly in the content array as { type: 'image_url' } parts so vision
 * models receive them correctly. All other messages keep plain string content.
 */
function buildMessagesPayload(
  messages: ChatMessage[],
  imageFiles: AttachedFile[],
  imageMessageId: string,
): Array<{ role: string; content: string | MessageContentPart[] }> {
  return messages.map((m) => {
    if (m.id === imageMessageId && imageFiles.length > 0) {
      const parts: MessageContentPart[] = [
        { type: 'text', text: m.content },
        ...imageFiles.map((f) => ({
          type: 'image_url' as const,
          image_url: { url: `/api/v1/files/${f.url}/content` },
        })),
      ];
      return { role: m.role, content: parts };
    }
    return { role: m.role, content: m.content };
  });
}

// ── History helpers ───────────────────────────────────────────────────────────

/** Convert a flat message array to the Svelte-compatible history tree format. */
function buildHistory(messages: ChatMessage[]) {
  const treeMessages: Record<
    string,
    {
      id: string;
      parentId: string | null;
      childrenIds: string[];
      role: string;
      content: string;
      model?: string;
      timestamp: number;
      files?: ChatFile[];
      followUps?: string[];
      done?: boolean;
    }
  > = {};

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const parentId = i > 0 ? messages[i - 1].id : null;
    const childId = i < messages.length - 1 ? messages[i + 1].id : null;
    treeMessages[msg.id] = {
      id: msg.id,
      parentId,
      childrenIds: childId ? [childId] : [],
      role: msg.role,
      content: msg.content,
      model: msg.model,
      timestamp: (() => {
        const ts = typeof msg.timestamp === 'number' ? msg.timestamp : Date.now();
        return ts > 10_000_000_000 ? Math.floor(ts / 1000) : ts;
      })(),
      files: msg.files,
      followUps: msg.followUps,
      ...(msg.citations && msg.citations.length > 0 ? { citations: msg.citations } : {}),
      done: true,
    };
  }

  return {
    messages: treeMessages,
    currentId: messages.length > 0 ? messages[messages.length - 1].id : null,
  };
}

/** Walk the history tree from currentId to root and return a flat array. */
type HistoryShape = NonNullable<FullChatResponse['chat']>['history'];
function flattenHistory(history: HistoryShape): ChatMessage[] {
  if (!history?.messages || !history.currentId) return [];

  const chain: string[] = [];
  let cur: string | null = history.currentId;
  while (cur && history.messages[cur]) {
    chain.unshift(cur);
    cur = history.messages[cur].parentId;
  }

  return chain.map((id) => {
    const m = history.messages[id];
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      model: m.model,
      timestamp: m.timestamp ?? Date.now(),
      files: m.files,
      followUps: m.followUps,
      citations: m.citations,
    };
  });
}

function makeChatTitle(text: string): string {
  const words = text.trim().split(/\s+/);
  const title = words.slice(0, 8).join(' ');
  return words.length > 8 ? `${title}…` : title;
}

// ── Suggested starters ────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Summarize the key points of a document',
  'Help me write a professional email',
  'Explain a complex concept in simple terms',
  'Review and improve my code',
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ChatWindow({ chatId }: ChatWindowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { models } = useWorkspaceStore();
  const { setChats, setPinnedChats } = useChatStore();
  const temporaryChatEnabled    = useChatStore((s) => s.temporaryChatEnabled);
  const setTemporaryChatEnabled = useChatStore((s) => s.setTemporaryChatEnabled);
  const toggleControls          = useChatStore((s) => s.toggleControls);
  const showControls            = useChatStore((s) => s.showControls);
  const systemPrompt            = useChatStore((s) => s.systemPrompt);
  const advancedParams          = useChatStore((s) => s.advancedParams);
  const { resolvedTheme } = useTheme();
  const modelFromQuery = (searchParams.get('model') ?? '').trim();

  const isLight = resolvedTheme === 'bodhion-light';
  const bodhionIcon = isLight
    ? '/static/bodhion_favicon_light.svg'
    : '/static/bodhion_favicon_dark.svg';

  // ── Core state ─────────────────────────────────────────────────────────────
  const [modelIds, setModelIds] = useState<string[]>(() => models[0] ? [models[0].id] : ['']);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatTitle, setChatTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [inputPreviewFile, setInputPreviewFile] = useState<{ id: string; name: string; mimeType?: string } | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const bottomRef = useRef<HTMLDivElement>(null);
  // Streaming lifecycle
  const wasStreamingRef = useRef(false);
  const pendingMessagesRef = useRef<ChatMessage[]>([]);
  const pendingTitleRef = useRef('');
  const pendingChatIdRef = useRef<string | null>(null);
  const navigateAfterStreamRef = useRef<string | null>(null);
  // Latest content snapshot (avoids stale closure in isStreaming effect)
  const contentRef = useRef('');
  // Latest modelId for saveChat closure (use first slot)
  const modelIdRef = useRef(modelIds[0] ?? '');
  // Tracks the response ID for the in-flight request — used to route socket step events
  const activeResponseIdRef = useRef<string | null>(null);

  const { socket } = useSocket();
  const { content, isStreaming, error, usage: streamUsage, sources: streamSources, steps: streamSteps, start, stop, reset, addStepFromSocket } = useStreamingResponse();

  // ── Keep refs current ──────────────────────────────────────────────────────
  const usageRef        = useRef(streamUsage);
  const sourcesRef      = useRef<unknown[]>(streamSources);
  const activeChatIdRef = useRef(activeChatId);
  const chatTitleRef    = useRef(chatTitle);
  useEffect(() => { contentRef.current = content; }, [content]);
  useEffect(() => { usageRef.current = streamUsage; }, [streamUsage]);
  useEffect(() => { sourcesRef.current = streamSources; }, [streamSources]);
  useEffect(() => { modelIdRef.current = modelIds[0] ?? ''; }, [modelIds]);
  useEffect(() => { activeChatIdRef.current = activeChatId; }, [activeChatId]);
  useEffect(() => { chatTitleRef.current = chatTitle; }, [chatTitle]);

  // ── Sync default model ─────────────────────────────────────────────────────
  useEffect(() => {
    if ((!modelIds[0] || modelIds[0] === '') && models.length > 0) {
      setModelIds([models[0].id]);
    }
  }, [models, modelIds]);

  useEffect(() => {
    if (chatId || !modelFromQuery) return;
    if (!models.some((m) => m.id === modelFromQuery)) return;
    if (modelIds[0] === modelFromQuery) return;
    setModelIds([modelFromQuery]);
  }, [chatId, modelFromQuery, models, modelIds]);

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, content]);

  // ── Cleanup streaming on unmount ───────────────────────────────────────────
  useEffect(() => {
    return () => { stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Socket step events ─────────────────────────────────────────────────────
  // Receives pipeline steps emitted by middleware during RAG/web-search processing
  // before the LLM stream starts, so the UI updates in real time.
  useEffect(() => {
    if (!socket) return;

    const handleEvents = (payload: { message_id?: string; data?: { type?: string; data?: unknown } }) => {
      if (!payload?.data || payload.data.type !== 'chat:step') return;
      if (payload.message_id !== activeResponseIdRef.current) return;
      addStepFromSocket(payload.data.data as PipelineStep);
    };

    socket.on('events', handleEvents);
    return () => { socket.off('events', handleEvents); };
  }, [socket, addStepFromSocket]);

  // ── Load / reset when chatId prop changes ──────────────────────────────────
  useEffect(() => {
    if (!chatId) {
      if (activeChatId !== null) {
        setMessages([]);
        setActiveChatId(null);
        setChatTitle('');
        reset();
      }
    } else if (chatId !== activeChatId) {
      void loadChat(chatId);
    }
    // If chatId === activeChatId: just navigated to the chat we created — keep state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // ── Capture assistant message when streaming ends ──────────────────────────
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
      return;
    }
    if (!wasStreamingRef.current) return;
    wasStreamingRef.current = false;
    activeResponseIdRef.current = null;

    const finalContent = contentRef.current;
    if (!finalContent.trim()) return;

    const assistantMsg: ChatMessage = {
      id: generateId(),
      role: 'assistant',
      content: finalContent,
      model: modelIdRef.current ?? undefined,
      timestamp: Math.floor(Date.now() / 1000),
      usage: usageRef.current ?? undefined,
      ...(sourcesRef.current.length > 0 ? { citations: sourcesRef.current as ChatMessage['citations'] } : {}),
    };
    const updated = [...pendingMessagesRef.current, assistantMsg];
    setMessages(updated);

    void saveChat(updated, pendingTitleRef.current, pendingChatIdRef.current);

    // Capture navigation URL before async work so we don't race
    const navigateUrl = navigateAfterStreamRef.current;
    navigateAfterStreamRef.current = null;

    // Generate follow-ups THEN navigate — avoids the race where router.push
    // remounts the component before setFollowUpQuestions can fire
    const pendingChatId = pendingChatIdRef.current;
    void (async () => {
      await generateFollowUps(updated, pendingChatId);
      if (navigateUrl) {
        router.push(navigateUrl);
      }
    })();

    reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  // ── API helpers ────────────────────────────────────────────────────────────

  const refreshSidebar = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const [chatList, pinned] = await Promise.all([
      getChatList(token).catch(() => [] as Awaited<ReturnType<typeof getChatList>>),
      getPinnedChats(token).catch(() => [] as Awaited<ReturnType<typeof getPinnedChats>>),
    ]);
    setChats(chatList);
    setPinnedChats(pinned);
  }, [setChats, setPinnedChats]);

  const loadChat = useCallback(async (id: string) => {
    const token = getToken();
    if (!token) return;
    setLoading(true);
    try {
      const data = (await getChatById(token, id)) as FullChatResponse;
      setChatTitle(data.title ?? '');
      setActiveChatId(data.id);
      if (data.chat?.history) {
        const flat = flattenHistory(data.chat.history);
        setMessages(flat);

        // Restore follow-up questions from the last assistant message
        const lastAssistant = [...flat].reverse().find((m) => m.role === 'assistant');
        const saved = lastAssistant?.followUps;
        setFollowUpQuestions(Array.isArray(saved) && saved.length > 0 ? saved : []);
      }
      const chatModels = data.chat?.models ?? data.models ?? [];
      const validModels = chatModels.filter((m) => models.some((lm) => lm.id === m));
      if (validModels.length > 0) setModelIds(validModels);
      else if (models.length > 0) setModelIds([models[0].id]);
    } catch {
      toast.error('Failed to load chat');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models]);

  const saveChat = useCallback(async (
    msgs: ChatMessage[],
    title: string,
    currentId: string | null,
  ): Promise<string | null> => {
    const token = getToken();
    if (!token) return currentId;

    const history = buildHistory(msgs);
    const chatPayload = {
      title,
      models: [modelIdRef.current],
      system: '',
      params: {},
      history,
      messages: msgs.map((m) => ({
        id: m.id,
        parentId: history.messages[m.id]?.parentId ?? null,
        childrenIds: history.messages[m.id]?.childrenIds ?? [],
        role: m.role,
        content: m.content,
        model: m.model,
        timestamp: m.timestamp ?? Math.floor(Date.now() / 1000),
        files: m.files ?? [],
        ...(m.followUps ? { followUps: m.followUps } : {}),
        ...(m.citations && m.citations.length > 0 ? { citations: m.citations } : {}),
      })),
      tags: [],
      timestamp: Date.now(),
      files: [],
    };

    try {
      if (!currentId) {
        const created = await createNewChat(token, { chat: chatPayload });
        void refreshSidebar();
        return created.id;
      } else {
        await updateChatById(token, currentId, { chat: chatPayload });
        void refreshSidebar();
        return currentId;
      }
    } catch {
      return currentId;
    }
  }, [refreshSidebar]);

  // ── Follow-up generation ──────────────────────────────────────────────────
  // Uses the dedicated /api/v1/tasks/follow_ups/completions endpoint —
  // the same one the Svelte app's generateFollowUps() calls.

  const generateFollowUps = useCallback(async (msgs: ChatMessage[], chatId: string | null) => {
    const token = getToken();
    if (!token || !modelIdRef.current) {
      return;
    }

    const context = msgs.slice(-6).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const questions = await fetchFollowUpSuggestions(
      modelIdRef.current,
      context,
      chatId,
      token,
    );

    if (questions.length === 0) return;

    setFollowUpQuestions(questions);

    // Persist on last assistant message so history reloads restore them.
    // Avoid setMessages updater form so we can await saveChat before returning
    // (router.push after this function must not race ahead of the DB write).
    const lastIdx = msgs.length - 1;
    if (lastIdx < 0 || msgs[lastIdx].role !== 'assistant') return;
    const updatedMsgs = msgs.map((m, i) =>
      i === lastIdx ? { ...m, followUps: questions } : m,
    );
    setMessages(updatedMsgs);
    await saveChat(updatedMsgs, chatTitleRef.current, chatId ?? activeChatIdRef.current);
  }, [saveChat]);

  // ── Message submission ─────────────────────────────────────────────────────

  const submitMessage = useCallback(async (
    text: string,
    baseMessages: ChatMessage[],
  ) => {
    if (!text.trim() || isStreaming) return;

    // Snapshot currently attached files (images for vision; any new docs for RAG)
    const currentFiles = attachedFiles;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: Math.floor(Date.now() / 1000),
      files: currentFiles.length > 0
        ? currentFiles.map((f) => ({
            id: f.id, name: f.name, url: f.url, collection_name: f.collection_name,
          }))
        : undefined,
    };

    const newMessages = [...baseMessages, userMsg];
    setMessages(newMessages);
    setAttachedFiles([]);
    setFollowUpQuestions([]);
    reset();

    const title = chatTitle || makeChatTitle(text);
    if (!chatTitle) setChatTitle(title);

    pendingMessagesRef.current = newMessages;
    pendingTitleRef.current = title;
    pendingChatIdRef.current = activeChatId;

    // Resolve model + build IDs now (used by both temp and normal paths)
    const modelItem = models.find((m) => m.id === modelIdRef.current) ?? null;
    const responseId = generateId();

    // Strip null advanced params before spreading into payload
    const activeParams = Object.fromEntries(
      Object.entries(advancedParams).filter(([, v]) => v !== null)
    );

    // Images → only from the current message (vision embedding is per-message)
    const imageFiles = currentFiles.filter((f) => f.type === 'image');

    // Build messages with multimodal image_url parts for vision models
    const messagesPayload = buildMessagesPayload(newMessages, imageFiles, userMsg.id);

    // Doc files for RAG → accumulate from ALL user messages in the conversation so
    // the backend queries every uploaded file's vector collection, not only the one
    // attached to the current message. This is what makes follow-up questions and
    // regeneration continue to show the source from a file uploaded earlier.
    const seenRagKeys = new Set<string>();
    const allDocFiles: AttachedFile[] = [];

    for (const msg of newMessages) {
      if (msg.role !== 'user' || !msg.files?.length) continue;
      for (const f of msg.files) {
        // Skip images — they aren't RAG'd
        if (f.type === 'image' || f.mimeType?.startsWith('image/')) continue;
        // Deduplicate by collection_name → url → id (in priority order)
        const key = f.collection_name ?? f.url ?? f.id ?? '';
        if (!key || seenRagKeys.has(key)) continue;
        seenRagKeys.add(key);
        allDocFiles.push({
          id: f.id ?? '',
          name: f.name ?? '',
          url: f.url,
          collection_name: f.collection_name,
          type: (f.type as AttachedFile['type']) ?? 'file',
          mimeType: f.mimeType,
        });
      }
    }

    const docFilePayload = allDocFiles.map((f) => ({
      type: f.type,
      id: f.id,
      name: f.name,
      url: f.url,
      collection_name: f.collection_name,
    }));

    // Temp chat: skip all persistence, stream directly
    activeResponseIdRef.current = responseId;
    if (temporaryChatEnabled) {
      void start({
        model: modelIdRef.current,
        messages: messagesPayload,
        stream: true,
        id: responseId,
        parent_id: userMsg.id,
        parent_message: userMsg,
        ...(systemPrompt ? { system: systemPrompt } : {}),
        ...activeParams,
        ...(modelItem ? { model_item: modelItem } : {}),
        ...(docFilePayload.length > 0 ? { files: docFilePayload } : {}),
        ...(webSearch ? { features: { web_search: true } } : {}),
      });
      return;
    }

    // Normal chat: persist to backend first to obtain a chat ID
    const savedId = await saveChat(newMessages, title, activeChatId);
    if (savedId) {
      pendingChatIdRef.current = savedId;
      if (!activeChatId) {
        setActiveChatId(savedId);
        navigateAfterStreamRef.current = `/chat-engine/c/${savedId}`;
      }
    }

    void start({
      model: modelIdRef.current,
      messages: messagesPayload,
      stream: true,
      chat_id: pendingChatIdRef.current ?? undefined,
      id: responseId,
      parent_id: userMsg.id,
      parent_message: userMsg,
      background_tasks: {
        follow_up_generation: true,
        title_generation: true,
      },
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...activeParams,
      ...(modelItem ? { model_item: modelItem } : {}),
      ...(docFilePayload.length > 0 ? { files: docFilePayload } : {}),
      ...(webSearch ? { features: { web_search: true } } : {}),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming, attachedFiles, chatTitle, activeChatId, modelIds, models, webSearch, start, saveChat, reset]);

  const handleSubmit = useCallback(async () => {
    const text = prompt.trim();
    if (!text) return;
    setPrompt('');
    await submitMessage(text, messages);
  }, [prompt, messages, submitMessage]);

  /** User message edit — re-submits everything after the edited message */
  const handleEditMessage = useCallback(async (messageId: string, newContent: string) => {
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    await submitMessage(newContent, messages.slice(0, idx));
  }, [messages, submitMessage]);

  /** Assistant message edit — updates stored content directly, no re-generation */
  const handleEditAIMessage = useCallback((messageId: string, newContent: string) => {
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.id === messageId ? { ...m, content: newContent } : m
      );
      void saveChat(updated, chatTitle, activeChatId);
      return updated;
    });
  }, [chatTitle, activeChatId, saveChat]);

  const handleRegenerateResponse = useCallback(async () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        await submitMessage(messages[i].content, messages.slice(0, i));
        return;
      }
    }
  }, [messages, submitMessage]);

  const handleContinueResponse = useCallback(async () => {
    await submitMessage('Please continue your previous response.', messages);
  }, [messages, submitMessage]);

  const handleFollowUpClick = useCallback(async (q: string) => {
    setPrompt('');
    await submitMessage(q, messages);
  }, [messages, submitMessage]);

  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx === -1) return prev;
      const updated = prev.slice(0, idx);
      void saveChat(updated, chatTitle, activeChatId);
      return updated;
    });
  }, [chatTitle, activeChatId, saveChat]);

  const handleFileAttach = useCallback(async (file: File) => {
    const token = getToken();
    if (!token) return;

    const MAX_MB = 50;
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`File exceeds ${MAX_MB} MB limit`);
      return;
    }

    // Create a local object URL immediately so the preview thumbnail shows before upload completes
    const localUrl = URL.createObjectURL(file);
    const isImage = file.type.startsWith('image/');

    setUploadingFile(true);
    try {
      const result = await uploadFile(token, file, null);
      setAttachedFiles((prev) => [
        ...prev,
        {
          id: result.id,
          name: result.filename ?? file.name,
          // url must be the raw file ID — the backend reconstructs the download path internally
          url: result.id,
          localUrl,
          collection_name: result.meta?.collection_name ?? result.collection_name,
          // semantic type: 'image' routes through vision pipeline, 'file' routes through RAG
          type: isImage ? 'image' : 'file',
          mimeType: file.type,
          size: file.size,
        },
      ]);
      toast.success('File attached');
    } catch {
      URL.revokeObjectURL(localUrl);
      toast.error('Failed to attach file');
    } finally {
      setUploadingFile(false);
    }
  }, []);

  const handleItemAttach = useCallback((item: AttachableItem) => {
    setAttachedFiles((prev) => {
      if (prev.find((f) => f.id === item.id)) return prev; // no duplicates
      return [...prev, {
        id: item.id,
        name: item.name,
        type: (item.type as AttachedFile['type']) ?? 'file',
        description: item.description,
        // Items from knowledge/notes use their own url/collection_name
        url: item.url ?? item.id,
        collection_name: item.collection_name,
      }];
    });
  }, []);

  const handleNewChat = useCallback(() => {
    stop();
    setMessages([]);
    setActiveChatId(null);
    setChatTitle('');
    setPrompt('');
    setAttachedFiles([]);
    setFollowUpQuestions([]);
    setTemporaryChatEnabled(false);
    navigateAfterStreamRef.current = null;
    reset();
    router.push('/chat-engine');
  }, [stop, reset, router, setTemporaryChatEnabled]);

  // Save a temporary chat to permanent storage
  const handleSaveTempChat = useCallback(async () => {
    const token = getToken();
    if (!token || messages.length === 0) return;
    try {
      const savedId = await saveChat(messages, chatTitle || 'Saved chat', null);
      if (savedId) {
        setTemporaryChatEnabled(false);
        setActiveChatId(savedId);
        await refreshSidebar();
        router.push(`/chat-engine/c/${savedId}`);
        toast.success('Conversation saved successfully');
      }
    } catch {
      toast.error('Failed to save conversation');
    }
  }, [messages, chatTitle, saveChat, refreshSidebar, router, setTemporaryChatEnabled]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Escape → stop streaming
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault();
        stop();
        return;
      }
      // Cmd/Ctrl + Shift + O → new chat
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'o') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isStreaming, stop, handleNewChat]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="cw-root">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="cw-header">
        <div className="cw-header-left">
          {/* Multi-model selectors */}
          <div className="cw-model-row">
            {modelIds.map((mid, idx) => (
              <ModelSelector
                key={idx}
                value={mid}
                onChange={(newId) =>
                  setModelIds((prev) => prev.map((m, i) => (i === idx ? newId : m)))
                }
                onRemove={
                  modelIds.length > 1
                    ? () => setModelIds((prev) => prev.filter((_, i) => i !== idx))
                    : undefined
                }
              />
            ))}
            {/* Add another model slot */}
            <button
              type="button"
              className="cw-add-model-btn"
              onClick={() => setModelIds((prev) => [...prev, ''])}
              title="Add model"
              aria-label="Add model"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {chatTitle && (
            <span className="cw-chat-title" title={chatTitle}>{chatTitle}</span>
          )}
        </div>
        <div className="cw-header-right">
          {/* Temp chat toggle / save */}
          {temporaryChatEnabled && messages.length > 0 ? (
            <button
              type="button"
              className="cw-icon-btn cw-icon-btn--accent"
              onClick={() => void handleSaveTempChat()}
              title="Save conversation to history"
              aria-label="Save chat"
            >
              <Save className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              className={`cw-icon-btn${temporaryChatEnabled ? ' cw-icon-btn--active' : ''}`}
              onClick={() => setTemporaryChatEnabled(!temporaryChatEnabled)}
              title={temporaryChatEnabled ? 'Temporary chat on — click to disable' : 'Enable temporary chat (not saved to history)'}
              aria-label="Toggle temporary chat"
            >
              {temporaryChatEnabled
                ? <MessageSquareDashed className="h-4 w-4" />
                : <MessageSquare className="h-4 w-4" />}
            </button>
          )}

          {/* Controls panel toggle */}
          <button
            type="button"
            className={`cw-icon-btn${showControls ? ' cw-icon-btn--active' : ''}`}
            onClick={toggleControls}
            title="Controls — system prompt & advanced params"
            aria-label="Toggle controls panel"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Temp chat banner ─────────────────────────────────────────────────── */}
      {temporaryChatEnabled && (
        <div className="cw-temp-banner">
          <MessageSquareDashed className="h-3.5 w-3.5 shrink-0" />
          <span>Temporary chat — messages won&apos;t be saved to history</span>
          <button
            type="button"
            className="cw-temp-banner-close"
            onClick={() => setTemporaryChatEnabled(false)}
            aria-label="Disable temporary chat"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── Messages ────────────────────────────────────────────────────────── */}
      <div className="cw-messages">
        {loading ? (
          <div className="cw-loading">
            <div className="cw-spinner" />
            <span>Loading chat…</span>
          </div>
        ) : messages.length === 0 && !isStreaming ? (
          <div className="cw-empty">
            <div className="cw-empty-glow" aria-hidden="true" />
            <div className="cw-empty-icon">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bodhionIcon} alt="Bodhion" className="h-10 w-10 object-contain" />
            </div>
            <h2 className="cw-empty-title">How can I help you today?</h2>
            <p className="cw-empty-sub">
              {models.length === 0
                ? 'No models available — configure one in the workspace first'
                : 'Select a model and start a conversation'}
            </p>
            <div className="cw-suggestions">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="cw-suggestion-btn"
                  onClick={() => setPrompt(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isLastAssistant =
                msg.role === 'assistant' && idx === messages.length - 1 && !isStreaming;
              const activeModel = models.find((m) => m.id === modelIds[0]);
              return (
                <MessageBubble
                  key={msg.id ?? String(idx)}
                  message={msg}
                  model={msg.role === 'assistant' ? activeModel : undefined}
                  sources={msg.citations as unknown[] | undefined}
                  onEdit={
                    msg.role === 'user'
                      ? (nc) => void handleEditMessage(msg.id, nc)
                      : !isStreaming
                        ? (nc) => handleEditAIMessage(msg.id, nc)
                        : undefined
                  }
                  onRegenerate={
                    isLastAssistant
                      ? () => void handleRegenerateResponse()
                      : undefined
                  }
                  onContinue={
                    isLastAssistant
                      ? () => void handleContinueResponse()
                      : undefined
                  }
                  onDelete={!isStreaming ? () => handleDeleteMessage(msg.id) : undefined}
                  followUpQuestions={isLastAssistant ? followUpQuestions : undefined}
                  onFollowUpClick={isLastAssistant ? (q) => void handleFollowUpClick(q) : undefined}
                />
              );
            })}

            {isStreaming && (
              <MessageBubble
                key="streaming-bubble"
                message={{ id: 'streaming', role: 'assistant', content: '' }}
                model={models.find((m) => m.id === modelIds[0])}
                isStreaming
                streamContent={content}
                steps={streamSteps}
                sources={streamSources.length > 0 ? streamSources : undefined}
              />
            )}
          </>
        )}

        {!!error && (
          <div className="cw-error-card">
            <AlertTriangle className="cw-error-icon" />
            <div className="cw-error-body">
              <p className="cw-error-title">Something went wrong</p>
              <p className="cw-error-detail">
                {typeof error === 'object' && error !== null && 'message' in error
                  ? String((error as { message: string }).message)
                  : 'The model failed to respond. Check your connection and try again.'}
              </p>
            </div>
            <button
              type="button"
              className="cw-error-retry"
              onClick={() => void handleRegenerateResponse()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ──────────────────────────────────────────────────────── */}
      <div className="cw-input-area">
        {(attachedFiles.length > 0 || uploadingFile) && (
          <div className="cw-files-row">
            {attachedFiles.map((f) => (
              <div key={f.id} className="cw-file-chip">
                {f.type === 'image' && (f.localUrl ?? f.url) ? (
                  <img
                    src={f.localUrl ?? `/api/v1/files/${f.url}/content`}
                    alt={f.name}
                    className="cw-file-chip-thumb"
                  />
                ) : (
                  /* Clickable icon area opens the preview modal for non-image files */
                  <button
                    type="button"
                    className="cw-file-chip-preview-btn"
                    onClick={() => setInputPreviewFile({ id: f.url ?? f.id, name: f.name, mimeType: f.mimeType })}
                    aria-label={`Preview ${f.name}`}
                  >
                    <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                )}
                <span
                  className={f.type !== 'image' ? 'cw-file-chip-name cw-file-chip-name--clickable' : 'cw-file-chip-name'}
                  onClick={f.type !== 'image' ? () => setInputPreviewFile({ id: f.url ?? f.id, name: f.name, mimeType: f.mimeType }) : undefined}
                  role={f.type !== 'image' ? 'button' : undefined}
                  tabIndex={f.type !== 'image' ? 0 : undefined}
                  onKeyDown={f.type !== 'image' ? (e) => { if (e.key === 'Enter') setInputPreviewFile({ id: f.url ?? f.id, name: f.name, mimeType: f.mimeType }); } : undefined}
                >
                  {f.name}
                </span>
                <button
                  type="button"
                  className="cw-file-chip-remove"
                  onClick={() => {
                    if (f.localUrl) URL.revokeObjectURL(f.localUrl);
                    setAttachedFiles((prev) => prev.filter((x) => x.id !== f.id));
                  }}
                  aria-label={`Remove ${f.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {uploadingFile && (
              <div className="cw-file-chip cw-file-chip--loading">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="cw-file-chip-name">Uploading…</span>
              </div>
            )}
          </div>
        )}

        <PromptInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={() => void handleSubmit()}
          onStop={stop}
          isStreaming={isStreaming}
          disabled={!modelIds[0]}
          placeholder={
            models.find((m) => m.id === modelIds[0])?.name
              ? `Message ${models.find((m) => m.id === modelIds[0])!.name}…`
              : 'Ask anything…'
          }
          webSearch={webSearch}
          onWebSearchToggle={() => setWebSearch((v) => !v)}
          onFileAttach={handleFileAttach}
          onItemAttach={handleItemAttach}
          uploadingFile={uploadingFile}
          activeChatId={activeChatId}
        />
      </div>

      {/* ── Controls panel ──────────────────────────────────────────────────── */}
      <ChatControlsPanel />

      {/* Input-area file preview modal */}
      {inputPreviewFile && inputPreviewFile.id && (
        <FilePreviewModal
          fileId={inputPreviewFile.id}
          fileName={inputPreviewFile.name}
          contentType={inputPreviewFile.mimeType}
          onClose={() => setInputPreviewFile(null)}
        />
      )}
    </div>
  );
}

export default ChatWindow;
