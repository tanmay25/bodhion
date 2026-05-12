'use client';

// Reusable model editor form — used by both /workspace/models/edit (page) and
// the admin ModelEditorDrawer. Accepts modelId as a prop; calls onSaved / onClose
// instead of router.push so it works inside a drawer.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Globe, Lock, Plus, Upload, X, Search, Database, FileText,
  ScanSearch, AlignJustify,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/Modal';
import { useAuthStore } from '@/store/authStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { getToken } from '@/lib/auth/session';
import {
  getModelById, getModels, updateModel, updateModelAccessGrants,
  type WorkspaceModelItem,
} from '@/lib/api/models';
import {
  type AccessGrant,
  getFunctions, getKnowledgeCollections, getWorkspaceGroupInfoById,
  getWorkspaceGroups, getWorkspaceUserInfoById, searchKnowledgeBases,
  getSkills, getTools, searchKnowledgeFiles,
  type WorkspaceGroupInfo, type WorkspaceUserInfo, type KnowledgeFileItem,
} from '@/lib/api/workspace';
import { searchUsers as searchUsersApi } from '@/lib/api/users';
import { uploadFile } from '@/lib/api/files';
import type { FunctionItem, KnowledgeCollection, Skill, Tool } from '@/types/api';
import { v4 as uuidv4 } from 'uuid';

// ── Types ─────────────────────────────────────────────────────────────────────
type EditableModel = WorkspaceModelItem & { base_model_id?: string | null; access_grants?: unknown[] };
type SuggestionPrompt = { content: string; title: [string, string] };
type AdvParams = {
  stream_response?: boolean | null; function_calling?: string | null;
  reasoning_tags?: boolean | string[] | null; seed?: number | null;
  stop?: string | null; temperature?: number | null; reasoning_effort?: string | null;
  logit_bias?: string | null; max_tokens?: number | null; top_k?: number | null;
  top_p?: number | null; min_p?: number | null; frequency_penalty?: number | null;
  presence_penalty?: number | null; mirostat?: number | null; mirostat_eta?: number | null;
  mirostat_tau?: number | null; repeat_last_n?: number | null; tfs_z?: number | null;
  repeat_penalty?: number | null; use_mmap?: boolean | null; use_mlock?: boolean | null;
  num_ctx?: number | null; num_keep?: number | null; num_batch?: number | null;
  keep_alive?: string | null; num_thread?: number | null; num_gpu?: number | null;
};
type KnowledgeItem = {
  id: string; name: string; type: 'collection' | 'file';
  collection_name?: string; status?: 'uploading' | 'uploaded'; itemId?: string;
  file?: unknown; context?: 'full';
};

// ── Constants ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'prompting', label: 'Prompting' },
  { id: 'resources', label: 'Resources' },
  { id: 'capabilities', label: 'Capabilities' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const ALL_CAPABILITIES = [
  ['vision', 'Vision', 'Model accepts image inputs'],
  ['file_upload', 'File Upload', 'Model accepts file inputs'],
  ['file_context', 'File Context', 'Inject file content into conversation context'],
  ['web_search', 'Web Search', 'Model can search the web for information'],
  ['image_generation', 'Image Generation', 'Model can generate images based on text prompts'],
  ['code_interpreter', 'Code Interpreter', 'Model can execute code and perform calculations'],
  ['usage', 'Usage', 'Sends stream_options: { include_usage: true } in the request.'],
  ['citations', 'Citations', 'Displays citations in the response'],
  ['status_updates', 'Status Updates', 'Displays status updates in the response'],
  ['builtin_tools', 'Builtin Tools', 'Automatically inject system tools in native function calling mode'],
] as const;

const FEATURE_CAPABILITIES = [
  ['web_search', 'Web Search', 'Model can search the web for information'],
  ['image_generation', 'Image Generation', 'Model can generate images based on text prompts'],
  ['code_interpreter', 'Code Interpreter', 'Model can execute code and perform calculations'],
] as const;

const BUILTIN_TOOLS = [
  ['time', 'Time & Calculation', 'Get current time and perform date/time calculations'],
  ['memory', 'Memory', 'Search and manage user memories'],
  ['chats', 'Chat History', 'Search and view user chat history'],
  ['notes', 'Notes', 'Search, view, and manage user notes'],
  ['knowledge', 'Knowledge Base', 'Browse and query knowledge bases'],
  ['channels', 'Channels', 'Search channels and channel messages'],
  ['web_search', 'Web Search', 'Search the web and fetch URLs'],
  ['image_generation', 'Image Generation', 'Generate and edit images'],
  ['code_interpreter', 'Code Interpreter', 'Execute code'],
] as const;

const PARAM_TIPS: Record<string, string> = {
  stream_response: 'When enabled, the model will respond in real-time, generating a response as the user sends a message.',
  function_calling: "Default works with more models. Native uses the model's built-in tool-calling capabilities.",
  reasoning_tags: "Enable, disable, or customize reasoning tags. 'Enabled' uses defaults, 'Disabled' turns off, 'Custom' lets you specify tags.",
  seed: 'Sets the random seed for generation. Same seed = same output for same prompt.',
  stop: 'Stop sequences — when encountered the LLM stops. Comma-separated.',
  temperature: 'The temperature. Higher = more creative.',
  reasoning_effort: 'Constrains effort on reasoning. Only applicable to reasoning models that support this.',
  logit_bias: 'Boost or penalize specific tokens. Bias values clamped -100 to 100.',
  max_tokens: 'Maximum tokens the model can generate in its response.',
  top_k: 'Reduces nonsense probability. Higher = more diverse.',
  top_p: 'Works with top_k. Higher = more diverse text.',
  min_p: 'Alternative to top_p. Balance of quality and variety.',
  frequency_penalty: 'Penalizes repetitions based on how many times they have appeared.',
  presence_penalty: 'Flat bias against tokens that have appeared at least once.',
  mirostat: 'Enable Mirostat sampling for controlling perplexity.',
  mirostat_eta: 'Mirostat learning rate.',
  mirostat_tau: 'Controls balance between coherence and diversity.',
  repeat_last_n: 'How far back the model looks to prevent repetition.',
  tfs_z: 'Tail free sampling. Higher reduces impact of less probable tokens.',
  repeat_penalty: 'Penalize repetition of token sequences.',
  use_mmap: 'Enable Memory Mapping to load model data.',
  use_mlock: "Lock model data in RAM to prevent swapping.",
  num_ctx: 'Size of the context window.',
  num_keep: 'How many tokens are preserved when refreshing context.',
  num_batch: 'Batch size for text requests.',
  keep_alive: 'How long model stays loaded after request (e.g. 5m, -1).',
  num_thread: 'Number of worker threads for computation.',
  num_gpu: 'Number of layers to offload to GPU.',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const arrStr = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

const tagsToInput = (meta: Record<string, unknown>) =>
  (Array.isArray(meta.tags) ? meta.tags : [])
    .map((t) => (typeof t === 'string' ? t : (t as { name?: string })?.name || ''))
    .filter(Boolean)
    .join(', ');

function resizeImageToWebP(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const SIZE = 250;
      const canvas = document.createElement('canvas');
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      const ar = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (ar > 1) { sx = (img.width - img.height) / 2; sw = img.height; }
      else { sy = (img.height - img.width) / 2; sh = img.width; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SIZE, SIZE);
      resolve(canvas.toDataURL('image/webp'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

const normalizeAccessGrants = (value: unknown): AccessGrant[] => {
  if (value === null) return [{ principal_type: 'user', principal_id: '*', permission: 'read' }];
  if (!Array.isArray(value)) return [];
  const grants: AccessGrant[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Partial<AccessGrant>;
    if ((g.principal_type === 'user' || g.principal_type === 'group') &&
      typeof g.principal_id === 'string' &&
      (g.permission === 'read' || g.permission === 'write')) {
      grants.push({ id: g.id, principal_type: g.principal_type, principal_id: g.principal_id, permission: g.permission });
    }
  }
  const map = new Map<string, AccessGrant>();
  for (const g of grants) map.set(`${g.principal_type}:${g.principal_id}:${g.permission}`, g);
  return Array.from(map.values());
};

const hasPublicReadGrant = (grants: AccessGrant[]) =>
  grants.some((g) => g.principal_type === 'user' && g.principal_id === '*' && g.permission === 'read');

const getPrincipalIdsByPermission = (grants: AccessGrant[], pt: 'user' | 'group', perm: 'read' | 'write') =>
  Array.from(new Set(grants.filter((g) => g.principal_type === pt && g.permission === perm).map((g) => g.principal_id)));

const hasPrincipalGrant = (grants: AccessGrant[], pt: 'user' | 'group', pid: string, perm: 'read' | 'write') =>
  grants.some((g) => g.principal_type === pt && g.principal_id === pid && g.permission === perm);

const upsertPrincipalGrant = (grants: AccessGrant[], pt: 'user' | 'group', pid: string, perm: 'read' | 'write') => {
  if (hasPrincipalGrant(grants, pt, pid, perm)) return grants;
  return [...grants, { principal_type: pt, principal_id: pid, permission: perm }];
};

const removePrincipalGrant = (grants: AccessGrant[], pt: 'user' | 'group', pid: string, perm: 'read' | 'write') =>
  grants.filter((g) => !(g.principal_type === pt && g.principal_id === pid && g.permission === perm));

const removePrincipal = (grants: AccessGrant[], pt: 'user' | 'group', pid: string) => {
  const next = removePrincipalGrant(grants, pt, pid, 'read');
  return removePrincipalGrant(next, pt, pid, 'write');
};

const togglePrincipalWrite = (grants: AccessGrant[], pt: 'user' | 'group', pid: string) => {
  const hasWrite = hasPrincipalGrant(grants, pt, pid, 'write');
  if (hasWrite) return removePrincipalGrant(grants, pt, pid, 'write');
  const next = upsertPrincipalGrant(grants, pt, pid, 'read');
  return upsertPrincipalGrant(next, pt, pid, 'write');
};

const setPublic = (grants: AccessGrant[], isPublic: boolean) => {
  const filtered = grants.filter((g) => !(g.principal_type === 'user' && g.principal_id === '*' && g.permission === 'read'));
  if (!isPublic) return filtered;
  return [...filtered, { principal_type: 'user' as const, principal_id: '*', permission: 'read' as const }];
};

// ── Props ─────────────────────────────────────────────────────────────────────
export interface ModelEditorPanelProps {
  modelId: string;
  /** Called after a successful save */
  onSaved?: () => void;
  /** Called when Cancel / back is clicked */
  onClose?: () => void;
  /** Show a header with title & back button (default true) */
  showHeader?: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function ModelEditorPanel({ modelId, onSaved, onClose, showHeader = true }: ModelEditorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const knowledgeFileInputRef = useRef<HTMLInputElement | null>(null);

  const config = useAuthStore((s) => s.config);
  const user = useAuthStore((s) => s.user);
  const { settings } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState<EditableModel | null>(null);
  const [baseChoices, setBaseChoices] = useState<Array<{ id: string; name: string }>>([]);
  const [knowledgeChoices, setKnowledgeChoices] = useState<KnowledgeCollection[]>([]);
  const [knowledgeFileChoices, setKnowledgeFileChoices] = useState<KnowledgeFileItem[]>([]);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [toolChoices, setToolChoices] = useState<Tool[]>([]);
  const [skillChoices, setSkillChoices] = useState<Skill[]>([]);
  const [functionChoices, setFunctionChoices] = useState<FunctionItem[]>([]);

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [baseModelId, setBaseModelId] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('/static/favicon.png');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedParams, setAdvancedParams] = useState<AdvParams>({});
  const [customPrompts, setCustomPrompts] = useState(false);
  const [prompts, setPrompts] = useState<SuggestionPrompt[]>([{ content: '', title: ['', ''] }]);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([]);
  const [showKnowledgeSelector, setShowKnowledgeSelector] = useState(false);
  const [toolIds, setToolIds] = useState<string[]>([]);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [filterIds, setFilterIds] = useState<string[]>([]);
  const [actionIds, setActionIds] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [defaultFeatures, setDefaultFeatures] = useState<string[]>([]);
  const [builtinTools, setBuiltinTools] = useState<Record<string, boolean>>({});
  const [ttsVoice, setTtsVoice] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showAddAccessModal, setShowAddAccessModal] = useState(false);
  const [draftAccessGrants, setDraftAccessGrants] = useState<AccessGrant[]>([]);
  const [groupById, setGroupById] = useState<Record<string, WorkspaceGroupInfo>>({});
  const [userById, setUserById] = useState<Record<string, WorkspaceUserInfo>>({});
  const [availableGroups, setAvailableGroups] = useState<WorkspaceGroupInfo[]>([]);
  const [availableUsers, setAvailableUsers] = useState<WorkspaceUserInfo[]>([]);
  const [addAccessQuery, setAddAccessQuery] = useState('');
  const [selectedAddGroupIds, setSelectedAddGroupIds] = useState<string[]>([]);
  const [selectedAddUserIds, setSelectedAddUserIds] = useState<string[]>([]);
  const [loadingAddAccessUsers, setLoadingAddAccessUsers] = useState(false);
  const [loadingAccessMeta, setLoadingAccessMeta] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);

  const filterFunctions = useMemo(() => functionChoices.filter((x) => x.type === 'filter'), [functionChoices]);
  const actionFunctions = useMemo(() => functionChoices.filter((x) => x.type === 'action'), [functionChoices]);
  const availableFeatures = useMemo(() => FEATURE_CAPABILITIES.filter(([f]) => capabilities[f]), [capabilities]);
  const visibleCapabilities = useMemo(
    () => ALL_CAPABILITIES.filter(([k]) => !(k === 'file_context' && !capabilities.file_upload)),
    [capabilities],
  );

  const canUploadFiles = user?.role === 'admin' || (user?.permissions?.chat?.file_upload ?? true);
  const canSharePublicModel =
    user?.role === 'admin' ||
    Boolean((user?.permissions as { sharing?: { public_models?: boolean } } | undefined)?.sharing?.public_models);

  const readGroupIds = useMemo(() => getPrincipalIdsByPermission(draftAccessGrants, 'group', 'read'), [draftAccessGrants]);
  const writeGroupIds = useMemo(() => getPrincipalIdsByPermission(draftAccessGrants, 'group', 'write'), [draftAccessGrants]);
  const readUserIds = useMemo(() => getPrincipalIdsByPermission(draftAccessGrants, 'user', 'read').filter((p) => p !== '*'), [draftAccessGrants]);
  const writeUserIds = useMemo(() => getPrincipalIdsByPermission(draftAccessGrants, 'user', 'write').filter((p) => p !== '*'), [draftAccessGrants]);

  const accessGroups = useMemo(() => {
    const ids = Array.from(new Set([...readGroupIds, ...writeGroupIds]));
    return ids.map((pid) => groupById[pid] ?? { id: pid, name: pid }).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [groupById, readGroupIds, writeGroupIds]);

  const accessUsers = useMemo(() => {
    const ids = Array.from(new Set([...readUserIds, ...writeUserIds]));
    return ids.map((pid) => userById[pid] ?? { id: pid, name: pid }).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
  }, [readUserIds, userById, writeUserIds]);

  const isPublic = useMemo(() => hasPublicReadGrant(draftAccessGrants), [draftAccessGrants]);
  const addAccessQueryLower = useMemo(() => addAccessQuery.trim().toLowerCase(), [addAccessQuery]);
  const filteredAddGroups = useMemo(() => {
    const list = availableGroups.slice().sort((a, b) => a.name.localeCompare(b.name));
    if (!addAccessQueryLower) return list;
    return list.filter((g) => g.name.toLowerCase().includes(addAccessQueryLower));
  }, [availableGroups, addAccessQueryLower]);
  const filteredAddUsers = useMemo(() => {
    const list = availableUsers.slice().sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
    if (!addAccessQueryLower) return list;
    return list.filter((u) => `${u.name ?? ''} ${u.email ?? ''} ${u.id}`.toLowerCase().includes(addAccessQueryLower));
  }, [availableUsers, addAccessQueryLower]);

  // ── Load model ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const token = getToken();
      if (!token || !modelId) { onClose?.(); return; }
      try {
        const [m, models, knowledges, tools, skills, functions] = await Promise.all([
          getModelById(token, modelId),
          getModels(
            token,
            config?.features?.enable_direct_connections && settings?.directConnections ? settings.directConnections : null,
          ),
          getKnowledgeCollections(token).then((r) => Array.isArray(r) ? r : []).catch(() => []),
          getTools(token).catch(() => []),
          getSkills(token).catch(() => []),
          getFunctions(token).catch(() => []),
        ]);
        const editable = m as EditableModel;
        if (!editable || editable.write_access === false) {
          toast.error('You do not have permission to edit this model');
          onClose?.();
          return;
        }
        const meta = ((editable.meta as Record<string, unknown> | undefined) ?? {});
        const params = ((editable.params as Record<string, unknown> | undefined) ?? {});
        setModel(editable);
        setBaseChoices(models.map((x) => ({ id: x.id, name: x.name || x.id })));
        setKnowledgeChoices(knowledges);
        setToolChoices(tools);
        setSkillChoices(skills);
        setFunctionChoices(functions);
        setId(editable.id || modelId);
        setName(editable.name || editable.id || modelId);
        setBaseModelId(typeof editable.base_model_id === 'string' ? editable.base_model_id : '');
        setDescription(String(meta.description ?? ''));
        setTags(tagsToInput(meta));
        setProfileImageUrl(typeof meta.profile_image_url === 'string' && meta.profile_image_url ? meta.profile_image_url : '/static/favicon.png');
        setSystemPrompt(typeof params.system === 'string' ? params.system : '');
        setAdvancedParams({
          temperature: typeof params.temperature === 'number' ? params.temperature : null,
          top_p: typeof params.top_p === 'number' ? params.top_p : null,
          top_k: typeof params.top_k === 'number' ? params.top_k : null,
          max_tokens: typeof params.max_tokens === 'number' ? params.max_tokens : typeof params.num_predict === 'number' ? params.num_predict : null,
          stop: Array.isArray(params.stop) ? (params.stop as string[]).join(', ') : typeof params.stop === 'string' ? params.stop : null,
          seed: typeof params.seed === 'number' ? params.seed : null,
          min_p: typeof params.min_p === 'number' ? params.min_p : null,
          frequency_penalty: typeof params.frequency_penalty === 'number' ? params.frequency_penalty : null,
          presence_penalty: typeof params.presence_penalty === 'number' ? params.presence_penalty : null,
          repeat_penalty: typeof params.repeat_penalty === 'number' ? params.repeat_penalty : null,
          repeat_last_n: typeof params.repeat_last_n === 'number' ? params.repeat_last_n : null,
          mirostat: typeof params.mirostat === 'number' ? params.mirostat : null,
          mirostat_eta: typeof params.mirostat_eta === 'number' ? params.mirostat_eta : null,
          mirostat_tau: typeof params.mirostat_tau === 'number' ? params.mirostat_tau : null,
          tfs_z: typeof params.tfs_z === 'number' ? params.tfs_z : null,
          stream_response: typeof params.stream_response === 'boolean' ? params.stream_response : null,
          function_calling: typeof params.function_calling === 'string' ? params.function_calling : null,
          reasoning_tags: params.reasoning_tags !== undefined ? (params.reasoning_tags as boolean | string[] | null) : null,
          reasoning_effort: typeof params.reasoning_effort === 'string' ? params.reasoning_effort : null,
          logit_bias: typeof params.logit_bias === 'string' ? params.logit_bias : null,
          num_ctx: typeof params.num_ctx === 'number' ? params.num_ctx : null,
          num_keep: typeof params.num_keep === 'number' ? params.num_keep : null,
          num_batch: typeof params.num_batch === 'number' ? params.num_batch : null,
          keep_alive: typeof params.keep_alive === 'string' ? params.keep_alive : null,
          use_mmap: typeof params.use_mmap === 'boolean' ? params.use_mmap : null,
          use_mlock: typeof params.use_mlock === 'boolean' ? params.use_mlock : null,
          num_thread: typeof params.num_thread === 'number' ? params.num_thread : null,
          num_gpu: typeof params.num_gpu === 'number' ? params.num_gpu : null,
        });
        const sp = Array.isArray(meta.suggestion_prompts) ? (meta.suggestion_prompts as SuggestionPrompt[]) : [];
        setCustomPrompts(sp.length > 0);
        setPrompts(sp.length > 0 ? sp : [{ content: '', title: ['', ''] }]);
        const rawK = Array.isArray(meta.knowledge) ? meta.knowledge as Array<Record<string, unknown>> : [];
        const loadedKnowledge: KnowledgeItem[] = rawK.map((item) => {
          if (typeof item === 'string') {
            const found = knowledges.find((k) => k.id === item);
            return { id: item, name: found?.name || item, type: 'collection' as const, collection_name: item };
          }
          if (item.collection_name && item.type !== 'file') {
            return { id: String(item.collection_name), name: String(item.name || item.collection_name), type: 'collection' as const, collection_name: String(item.collection_name) };
          }
          return {
            id: String(item.id || item.collection_name || ''),
            name: String(item.name || item.id || ''),
            type: (item.type as 'collection' | 'file') || 'collection',
            collection_name: item.collection_name ? String(item.collection_name) : undefined,
            status: 'uploaded' as const,
            ...(item.context === 'full' ? { context: 'full' as const } : {}),
          };
        }).filter((k) => k.id);
        setKnowledgeItems(loadedKnowledge);
        setToolIds(arrStr(meta.toolIds));
        setSkillIds(arrStr(meta.skillIds));
        setFilterIds(arrStr(meta.filterIds));
        setActionIds(arrStr(meta.actionIds));
        setCapabilities((meta.capabilities as Record<string, boolean>) ?? {});
        setDefaultFeatures(arrStr(meta.defaultFeatureIds));
        setBuiltinTools((meta.builtinTools as Record<string, boolean>) ?? {});
        setTtsVoice(typeof (meta.tts as Record<string, unknown> | undefined)?.voice === 'string' ? String((meta.tts as Record<string, unknown>).voice) : '');
        setDraftAccessGrants(normalizeAccessGrants(Array.isArray(editable.access_grants) ? editable.access_grants : null));
      } catch {
        toast.error('Failed to load model editor');
        onClose?.();
      } finally {
        setLoading(false);
      }
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelId]);

  // ── Knowledge selector search ───────────────────────────────────────────────
  useEffect(() => {
    if (!showKnowledgeSelector) return;
    const token = getToken();
    if (!token) return;
    const timer = window.setTimeout(async () => {
      const [collectionsRes, filesRes] = await Promise.all([
        searchKnowledgeBases(token, { query: knowledgeQuery || undefined, page: 1 })
          .then((r) => Array.isArray(r?.items) ? r.items : []).catch(() => []),
        searchKnowledgeFiles(token, { query: knowledgeQuery || undefined, page: 1 })
          .then((r) => Array.isArray(r?.items) ? r.items : []).catch(() => []),
      ]);
      setKnowledgeChoices(collectionsRes);
      setKnowledgeFileChoices(filesRes);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [showKnowledgeSelector, knowledgeQuery]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const toggle = (value: string, selected: string[], setter: (v: string[]) => void, checked: boolean) =>
    setter(checked ? [...new Set([...selected, value])] : selected.filter((x) => x !== value));

  const handleKnowledgeFileUpload = async (files: FileList) => {
    const token = getToken();
    if (!token) return;
    if (user?.role !== 'admin' && !(user?.permissions?.chat?.file_upload ?? true)) {
      toast.error('You do not have permission to upload files.');
      return;
    }
    const maxMbRaw = (config as { file?: { max_size?: number } } | null)?.file?.max_size;
    const maxBytes = typeof maxMbRaw === 'number' ? maxMbRaw * 1024 * 1024 : null;
    const sttLanguage = (settings?.audio as { stt?: { language?: string } } | undefined)?.stt?.language;

    for (const file of Array.from(files)) {
      if (file.size === 0) { toast.error('You cannot upload an empty file.'); continue; }
      if (maxBytes !== null && file.size > maxBytes) { toast.error(`File size should not exceed ${maxMbRaw} MB.`); continue; }
      if (file.type.startsWith('image/')) { toast.error('Image files are not supported as knowledge files'); continue; }
      const tempId = uuidv4();
      setKnowledgeItems((prev) => [...prev, { id: tempId, name: file.name, type: 'file', status: 'uploading', itemId: tempId }]);
      try {
        const metadata = (file.type.startsWith('audio/') || file.type.startsWith('video/')) && sttLanguage ? { language: sttLanguage } : null;
        const uploaded = await uploadFile(token, file, metadata);
        if (uploaded.error) toast.warning(uploaded.error);
        setKnowledgeItems((prev) => prev.map((item) =>
          item.itemId === tempId
            ? { ...item, id: uploaded.id, name: file.name, status: 'uploaded', collection_name: uploaded.meta?.collection_name || uploaded.collection_name, file: uploaded }
            : item
        ));
      } catch {
        toast.error(`Failed to upload ${file.name}`);
        setKnowledgeItems((prev) => prev.filter((item) => item.itemId !== tempId));
      }
    }
  };

  const payload = useMemo(() => {
    if (!model) return {};
    const meta = ((model.meta as Record<string, unknown> | undefined) ?? {});
    const params = ((model.params as Record<string, unknown> | undefined) ?? {});
    const tagsArr = tags.split(',').map((t) => t.trim()).filter(Boolean).map((n) => ({ name: n }));
    const nextMeta: Record<string, unknown> = {
      ...meta,
      profile_image_url: profileImageUrl,
      description: description.trim() || null,
      tags: tagsArr,
      suggestion_prompts: customPrompts ? prompts.filter((p) => p.content.trim()) : null,
      knowledge: knowledgeItems.filter((item) => item.status !== 'uploading').map((item) => ({
        id: item.id, collection_name: item.collection_name || item.id, name: item.name, type: item.type,
        ...(item.context === 'full' ? { context: 'full' as const } : {}),
        ...(item.type === 'file' && item.file ? { file: item.file } : {}),
      })),
      toolIds, skillIds, filterIds, actionIds, capabilities,
      defaultFeatureIds: defaultFeatures.length > 0 ? defaultFeatures : undefined,
      builtinTools: Object.keys(builtinTools).length > 0 ? builtinTools : undefined,
      tts: ttsVoice.trim() ? { voice: ttsVoice.trim() } : undefined,
    };
    const ap = advancedParams;
    const nextParams: Record<string, unknown> = {
      ...params,
      system: systemPrompt.trim() || null,
      temperature: ap.temperature ?? undefined, top_p: ap.top_p ?? undefined, top_k: ap.top_k ?? undefined,
      max_tokens: ap.max_tokens ?? undefined,
      stop: (ap.stop !== null && ap.stop !== undefined) ? ap.stop.split(',').map((x: string) => x.trim()).filter(Boolean) : undefined,
      seed: ap.seed ?? undefined, min_p: ap.min_p ?? undefined,
      frequency_penalty: ap.frequency_penalty ?? undefined, presence_penalty: ap.presence_penalty ?? undefined,
      repeat_penalty: ap.repeat_penalty ?? undefined, repeat_last_n: ap.repeat_last_n ?? undefined,
      mirostat: ap.mirostat ?? undefined, mirostat_eta: ap.mirostat_eta ?? undefined, mirostat_tau: ap.mirostat_tau ?? undefined,
      tfs_z: ap.tfs_z ?? undefined, stream_response: ap.stream_response ?? undefined,
      function_calling: ap.function_calling ?? undefined, reasoning_tags: ap.reasoning_tags ?? undefined,
      reasoning_effort: ap.reasoning_effort ?? undefined, logit_bias: ap.logit_bias ?? undefined,
      num_ctx: ap.num_ctx ?? undefined, num_keep: ap.num_keep ?? undefined, num_batch: ap.num_batch ?? undefined,
      keep_alive: ap.keep_alive ?? undefined, use_mmap: ap.use_mmap ?? undefined, use_mlock: ap.use_mlock ?? undefined,
      num_thread: ap.num_thread ?? undefined, num_gpu: ap.num_gpu ?? undefined,
    };
    Object.keys(nextParams).forEach((k) => {
      if (nextParams[k] === undefined || nextParams[k] === '' || (Array.isArray(nextParams[k]) && (nextParams[k] as unknown[]).length === 0)) delete nextParams[k];
    });
    return { ...model, id: id.trim(), name: name.trim(), base_model_id: baseModelId || null, meta: nextMeta, params: nextParams };
  }, [model, id, name, baseModelId, description, tags, profileImageUrl, customPrompts, prompts, knowledgeItems, toolIds, skillIds, filterIds, actionIds, capabilities, defaultFeatures, builtinTools, ttsVoice, systemPrompt, advancedParams]);

  // ── Access control ──────────────────────────────────────────────────────────
  const hydrateAccessMetadata = useCallback(async (grants: AccessGrant[]) => {
    const token = getToken();
    if (!token) return;
    setLoadingAccessMeta(true);
    try {
      const groups = await getWorkspaceGroups(token).catch(() => []);
      if (Array.isArray(groups)) {
        const nextGroupMap: Record<string, WorkspaceGroupInfo> = {};
        for (const group of groups) { if (group?.id) nextGroupMap[group.id] = group; }
        setGroupById((prev) => ({ ...prev, ...nextGroupMap }));
        setAvailableGroups(groups);
      }
      const unknownGroupIds = Array.from(new Set(grants.filter((g) => g.principal_type === 'group').map((g) => g.principal_id))).filter((pid) => !groupById[pid]);
      if (unknownGroupIds.length > 0) {
        const resolved = await Promise.all(unknownGroupIds.map((pid) => getWorkspaceGroupInfoById(token, pid).catch(() => null)));
        setGroupById((prev) => { const next = { ...prev }; for (const item of resolved) { if (item?.id) next[item.id] = item; } return next; });
      }
      const unknownUserIds = Array.from(new Set(grants.filter((g) => g.principal_type === 'user' && g.principal_id !== '*').map((g) => g.principal_id))).filter((pid) => !userById[pid]);
      if (unknownUserIds.length > 0) {
        const resolved = await Promise.all(unknownUserIds.map((pid) => getWorkspaceUserInfoById(token, pid).catch(() => null)));
        setUserById((prev) => { const next = { ...prev }; for (const item of resolved) { if (item?.id) next[item.id] = item; } return next; });
      }
    } finally { setLoadingAccessMeta(false); }
  }, [groupById, userById]);

  const fetchUsersForAddAccess = useCallback(async (queryValue: string) => {
    const token = getToken();
    if (!token) return;
    setLoadingAddAccessUsers(true);
    try {
      const response = await searchUsersApi(token, { query: queryValue.trim() || undefined, orderBy: 'name', direction: 'asc', page: 1 }).catch(() => null);
      const list = Array.isArray((response as { users?: unknown[] } | null)?.users) ? ((response as { users: Array<{ id: string; name?: string; email?: string }> }).users ?? []) : [];
      const mappedUsers = list.filter((u) => typeof u?.id === 'string' && u.id.length > 0).filter((u) => u.id !== user?.id).map((u) => ({ id: u.id, name: u.name, email: u.email }));
      setAvailableUsers(mappedUsers);
      setUserById((prev) => { const next = { ...prev }; for (const u of mappedUsers) { next[u.id] = u; } return next; });
    } finally { setLoadingAddAccessUsers(false); }
  }, [user?.id]);

  useEffect(() => {
    if (!showAddAccessModal) return;
    const timer = setTimeout(() => { void fetchUsersForAddAccess(addAccessQuery); }, 220);
    return () => clearTimeout(timer);
  }, [showAddAccessModal, addAccessQuery, fetchUsersForAddAccess]);

  const openAccess = () => {
    setAddAccessQuery(''); setSelectedAddGroupIds([]); setSelectedAddUserIds([]);
    setShowAccessModal(true);
    void hydrateAccessMetadata(draftAccessGrants);
  };

  const commitAddAccess = () => {
    if (selectedAddGroupIds.length === 0 && selectedAddUserIds.length === 0) { toast.error('Select at least one user or group'); return; }
    setDraftAccessGrants((prev) => {
      let next = [...prev];
      for (const groupId of selectedAddGroupIds) next = upsertPrincipalGrant(next, 'group', groupId, 'read');
      for (const userId of selectedAddUserIds) next = upsertPrincipalGrant(next, 'user', userId, 'read');
      return next;
    });
    setShowAddAccessModal(false); setAddAccessQuery(''); setSelectedAddGroupIds([]); setSelectedAddUserIds([]);
  };

  const saveAccess = async () => {
    if (!model) return;
    const token = getToken();
    if (!token) return;
    setSavingAccess(true);
    try {
      await updateModelAccessGrants(token, model.id, model.name ?? name, draftAccessGrants);
      toast.success('Access updated');
      setShowAccessModal(false);
    } catch { toast.error('Failed to save access grants'); }
    finally { setSavingAccess(false); }
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveModel = async () => {
    if (!model) return;
    const token = getToken();
    if (!token) return;
    if (!id.trim() || !name.trim()) { toast.error('Model ID and Name are required'); return; }
    if (knowledgeItems.some((item) => item.status === 'uploading')) { toast.error('Please wait until all files are uploaded'); return; }
    setSaving(true);
    try {
      await updateModel(token, model.id, payload as Partial<WorkspaceModelItem>);
      toast.success('Model updated successfully');
      onSaved?.();
    } catch { toast.error('Failed to update model'); }
    finally { setSaving(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="mep-loading">Loading model...</div>
  );
  if (!model) return null;

  return (
    <div className="mep-root">
      {showHeader && (
        <div className="mep-header">
          {onClose && (
            <button type="button" className="mep-back" onClick={onClose}>
              ← Back
            </button>
          )}
          <h2 className="mep-title">Edit Model — {name || model.id}</h2>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" hidden accept="image/*"
        onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return; e.target.value = '';
          try { setProfileImageUrl(await resizeImageToWebP(f)); }
          catch { const r = new FileReader(); r.onload = () => typeof r.result === 'string' && setProfileImageUrl(r.result); r.readAsDataURL(f); }
        }}
      />
      <input ref={knowledgeFileInputRef} type="file" hidden multiple
        onChange={async (e) => { if (e.target.files?.length) await handleKnowledgeFileUpload(e.target.files); e.target.value = ''; }}
      />

      <div className="workspace-model-edit-surface">
        {/* Tab bar */}
        <div className="model-editor-tabs">
          {TABS.map((tab) => (
            <button key={tab.id} type="button"
              className={`model-editor-tab${activeTab === tab.id ? ' model-editor-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === 'overview' && (
          <div className="model-editor-overview-grid">
            <div className="model-editor-card model-editor-card--media">
              <div className="model-editor-image-wrap">
                <img src={profileImageUrl} alt={name} className="model-editor-image" />
                <button type="button" className="model-editor-image-upload" onClick={() => fileInputRef.current?.click()} title="Upload photo">
                  <Upload className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" className="model-editor-muted-toggle" onClick={() => setProfileImageUrl('/static/favicon.png')}>
                Reset Image
              </button>
            </div>
            <div className="model-editor-overview-stack">
              <div className="model-editor-card model-editor-card--details">
                <div className="model-editor-topline">
                  <div>
                    <div className="model-editor-name">{name || model.id}</div>
                    <div className="model-editor-subid">{id || model.id}</div>
                  </div>
                  <button type="button" className="model-editor-pill-button" onClick={openAccess}>
                    <Lock className="h-3.5 w-3.5" />Access
                  </button>
                </div>
                <div>
                  <label className="model-editor-label">Base Model (From)</label>
                  <select className="model-editor-select" value={baseModelId} onChange={(e) => setBaseModelId(e.target.value)}>
                    <option value="">None</option>
                    {baseChoices.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="model-editor-grid-two">
                  <div>
                    <label className="model-editor-label">Model ID</label>
                    <Input value={id} onChange={(e) => setId(e.target.value)} />
                  </div>
                  <div>
                    <label className="model-editor-label">Name</label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="model-editor-card">
                <div className="model-editor-topline">
                  <label className="model-editor-label">Description</label>
                  <button type="button" className="model-editor-muted-toggle" onClick={() => setDescription('')}>Custom</button>
                </div>
                <textarea className="model-editor-textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this model..." />
                <div>
                  <label className="model-editor-label">Tags</label>
                  <Input placeholder="Add tags, comma separated..." value={tags} onChange={(e) => setTags(e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROMPTING ── */}
        {activeTab === 'prompting' && (
          <div className="model-editor-prompt-grid">
            <div className="model-editor-card">
              <div className="model-editor-label-lg">Model Params</div>
              <label className="model-editor-label">System Prompt</label>
              <textarea className="model-editor-textarea model-editor-fixed-textarea" value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} placeholder="Write your model system prompt content here" />
              <button type="button" className="model-editor-muted-toggle" onClick={() => setShowAdvanced((v) => !v)}>
                Advanced Params {showAdvanced ? '▲ Hide' : '▼ Show'}
              </button>
              {showAdvanced && (
                <div className="adv-params-list">
                  {/* stream_response */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.stream_response}>Stream Response</span>
                    <button type="button" className="adv-param-toggle" onClick={() => { const c = advancedParams.stream_response ?? null; setAdvancedParams(p => ({ ...p, stream_response: c === null ? true : c === true ? false : null })); }}>
                      {advancedParams.stream_response === true ? 'On' : advancedParams.stream_response === false ? 'Off' : 'Default'}
                    </button>
                  </div>
                  {/* function_calling */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.function_calling}>Function Calling</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, function_calling: (p.function_calling ?? null) === null ? 'native' : null }))}>
                      {(advancedParams.function_calling ?? null) === null ? 'Default' : 'Native'}
                    </button>
                  </div>
                  {/* temperature */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.temperature}>Temperature</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, temperature: (p.temperature ?? null) === null ? 0.8 : null }))}>
                      {(advancedParams.temperature ?? null) === null ? 'Default' : 'Custom'}
                    </button>
                  </div>
                  {(advancedParams.temperature ?? null) !== null && (
                    <div className="adv-param-control adv-slider-wrap">
                      <input type="range" min="0" max="2" step="0.05" value={advancedParams.temperature ?? 0.8} onChange={(e) => setAdvancedParams(p => ({ ...p, temperature: Number(e.target.value) }))} />
                      <input className="adv-number-input" type="number" min="0" max="2" step="0.05" value={advancedParams.temperature ?? 0.8} onChange={(e) => setAdvancedParams(p => ({ ...p, temperature: Number(e.target.value) }))} />
                    </div>
                  )}
                  {/* max_tokens */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.max_tokens}>max_tokens</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, max_tokens: (p.max_tokens ?? null) === null ? 128 : null }))}>
                      {(advancedParams.max_tokens ?? null) === null ? 'Default' : 'Custom'}
                    </button>
                  </div>
                  {(advancedParams.max_tokens ?? null) !== null && (
                    <div className="adv-param-control adv-slider-wrap">
                      <input type="range" min="-2" max="131072" step="1" value={advancedParams.max_tokens ?? 128} onChange={(e) => setAdvancedParams(p => ({ ...p, max_tokens: Number(e.target.value) }))} />
                      <input className="adv-number-input" type="number" min="-2" step="1" value={advancedParams.max_tokens ?? 128} onChange={(e) => setAdvancedParams(p => ({ ...p, max_tokens: Number(e.target.value) }))} />
                    </div>
                  )}
                  {/* top_p */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.top_p}>top_p</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, top_p: (p.top_p ?? null) === null ? 0.9 : null }))}>
                      {(advancedParams.top_p ?? null) === null ? 'Default' : 'Custom'}
                    </button>
                  </div>
                  {(advancedParams.top_p ?? null) !== null && (
                    <div className="adv-param-control adv-slider-wrap">
                      <input type="range" min="0" max="1" step="0.05" value={advancedParams.top_p ?? 0.9} onChange={(e) => setAdvancedParams(p => ({ ...p, top_p: Number(e.target.value) }))} />
                      <input className="adv-number-input" type="number" min="0" max="1" step="0.05" value={advancedParams.top_p ?? 0.9} onChange={(e) => setAdvancedParams(p => ({ ...p, top_p: Number(e.target.value) }))} />
                    </div>
                  )}
                  {/* top_k */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.top_k}>top_k</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, top_k: (p.top_k ?? null) === null ? 40 : null }))}>
                      {(advancedParams.top_k ?? null) === null ? 'Default' : 'Custom'}
                    </button>
                  </div>
                  {(advancedParams.top_k ?? null) !== null && (
                    <div className="adv-param-control adv-slider-wrap">
                      <input type="range" min="0" max="1000" step="0.5" value={advancedParams.top_k ?? 40} onChange={(e) => setAdvancedParams(p => ({ ...p, top_k: Number(e.target.value) }))} />
                      <input className="adv-number-input" type="number" min="0" max="1000" step="0.5" value={advancedParams.top_k ?? 40} onChange={(e) => setAdvancedParams(p => ({ ...p, top_k: Number(e.target.value) }))} />
                    </div>
                  )}
                  {/* stop */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.stop}>Stop Sequence</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, stop: (p.stop ?? null) === null ? '' : null }))}>
                      {(advancedParams.stop ?? null) === null ? 'Default' : 'Custom'}
                    </button>
                  </div>
                  {(advancedParams.stop ?? null) !== null && (
                    <div className="adv-param-control">
                      <input className="adv-text-input" type="text" placeholder="Comma-separated stop sequences" value={advancedParams.stop ?? ''} onChange={(e) => setAdvancedParams(p => ({ ...p, stop: e.target.value }))} />
                    </div>
                  )}
                  {/* seed */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.seed}>Seed</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, seed: (p.seed ?? null) === null ? 0 : null }))}>
                      {(advancedParams.seed ?? null) === null ? 'Default' : 'Custom'}
                    </button>
                  </div>
                  {(advancedParams.seed ?? null) !== null && (
                    <div className="adv-param-control">
                      <input className="adv-number-input" type="number" min="0" value={advancedParams.seed ?? 0} onChange={(e) => setAdvancedParams(p => ({ ...p, seed: Number(e.target.value) }))} />
                    </div>
                  )}
                  {/* num_ctx */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.num_ctx}>num_ctx</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, num_ctx: (p.num_ctx ?? null) === null ? 2048 : null }))}>
                      {(advancedParams.num_ctx ?? null) === null ? 'Default' : 'Custom'}
                    </button>
                  </div>
                  {(advancedParams.num_ctx ?? null) !== null && (
                    <div className="adv-param-control">
                      <input className="adv-number-input" type="number" min="-1" value={advancedParams.num_ctx ?? 2048} onChange={(e) => setAdvancedParams(p => ({ ...p, num_ctx: Number(e.target.value) }))} />
                    </div>
                  )}
                  {/* keep_alive */}
                  <div className="adv-param-row">
                    <span className="adv-param-label" data-tooltip={PARAM_TIPS.keep_alive}>keep_alive</span>
                    <button type="button" className="adv-param-toggle" onClick={() => setAdvancedParams(p => ({ ...p, keep_alive: (p.keep_alive ?? null) === null ? '5m' : null }))}>
                      {(advancedParams.keep_alive ?? null) === null ? 'Default' : 'Custom'}
                    </button>
                  </div>
                  {(advancedParams.keep_alive ?? null) !== null && (
                    <div className="adv-param-control">
                      <input className="adv-text-input" type="text" placeholder="e.g. 5m, -1, 0" value={advancedParams.keep_alive ?? ''} onChange={(e) => setAdvancedParams(p => ({ ...p, keep_alive: e.target.value }))} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="model-editor-card">
              <div className="model-editor-topline">
                <div className="model-editor-label-lg">Prompt Suggestions</div>
                <button type="button" className="model-editor-muted-toggle" onClick={() => setCustomPrompts((v) => !v)}>
                  {customPrompts ? 'Custom ✓' : 'Default'}
                </button>
              </div>
              {customPrompts ? (
                <div className="model-editor-stack">
                  {prompts.map((p, i) => (
                    <div className="model-editor-subcard" key={i}>
                      <Input placeholder="Prompt title" value={p.title?.[0] ?? ''} onChange={(e) => { const n = [...prompts]; n[i] = { ...n[i], title: [e.target.value, n[i].title?.[1] ?? ''] }; setPrompts(n); }} />
                      <textarea className="model-editor-textarea" rows={3} placeholder="Prompt content" value={p.content} onChange={(e) => { const n = [...prompts]; n[i] = { ...n[i], content: e.target.value }; setPrompts(n); }} />
                    </div>
                  ))}
                  <Button type="button" variant="outline" onClick={() => setPrompts((prev) => [...prev, { content: '', title: ['', ''] }])}>Add Prompt</Button>
                </div>
              ) : (
                <p style={{ fontSize: '0.84rem', color: '#8fa9bd' }}>Using default suggestion prompts. Toggle to Custom to add your own.</p>
              )}
            </div>
          </div>
        )}

        {/* ── RESOURCES ── */}
        {activeTab === 'resources' && (
          <div className="model-editor-stack">
            <div className="model-editor-card">
              <div className="model-editor-label-lg">Knowledge</div>
              <div className="resource-panel__content">
                <div className="resource-panel__body">
                  {knowledgeItems.length > 0 && (
                    <div className="resource-panel__chips">
                      {knowledgeItems.map((item, idx) => (
                        <div key={item.itemId || item.id || idx} className={`resource-panel__chip${item.status === 'uploading' ? ' resource-panel__chip--uploading' : ''}`}>
                          <span className="resource-panel__chip-name">{item.name}</span>
                          <span className="resource-panel__chip-badge">{item.type === 'file' ? 'file' : 'collection'}</span>
                          {item.status === 'uploading' && <span className="resource-panel__chip-status">uploading…</span>}
                          {item.status !== 'uploading' && (
                            <>
                              <button type="button" className={`resource-panel__chip-retrieval${item.context === 'full' ? ' resource-panel__chip-retrieval--full' : ''}`}
                                onClick={() => setKnowledgeItems((prev) => prev.map((k, i) => i === idx ? { ...k, context: k.context === 'full' ? undefined : 'full' } : k))}>
                                {item.context === 'full' ? <AlignJustify className="h-3 w-3" /> : <ScanSearch className="h-3 w-3" />}
                                <span className="resource-panel__chip-retrieval-label">{item.context === 'full' ? 'Full Doc' : 'Focused'}</span>
                              </button>
                              <button type="button" className="resource-panel__chip-dismiss" onClick={() => setKnowledgeItems((prev) => prev.filter((_, i) => i !== idx))}>
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="resource-panel__actions">
                    <div style={{ position: 'relative' }}>
                      <button type="button" className="resource-panel__button" onClick={() => setShowKnowledgeSelector((v) => !v)}>Select Knowledge</button>
                      {showKnowledgeSelector && (
                        <div className="resource-panel__dropdown">
                          <div className="resource-panel__search-wrap">
                            <Search className="resource-panel__search-icon h-3.5 w-3.5" />
                            <input type="text" className="resource-panel__search-input" placeholder="Search" value={knowledgeQuery} onChange={(e) => setKnowledgeQuery(e.target.value)} />
                          </div>
                          {knowledgeChoices.length === 0 && knowledgeFileChoices.length === 0 ? (
                            <div className="resource-panel__dropdown-empty">No knowledge found</div>
                          ) : (
                            <div className="resource-panel__dropdown-list">
                              {knowledgeChoices.length > 0 && (
                                <>
                                  <div className="resource-panel__dropdown-group">Collections</div>
                                  {knowledgeChoices.map((k) => {
                                    const sel = knowledgeItems.some((item) => item.type === 'collection' && item.id === k.id);
                                    return (
                                      <button key={`c-${k.id}`} type="button" className={`resource-panel__dropdown-item${sel ? ' resource-panel__dropdown-item--selected' : ''}`}
                                        onClick={() => { if (!sel) setKnowledgeItems((prev) => [...prev, { id: k.id, name: k.name, type: 'collection', collection_name: k.id, status: 'uploaded' }]); setShowKnowledgeSelector(false); }}>
                                        <Database className="h-3.5 w-3.5" /><span>{k.name}</span>{sel && <span className="resource-panel__dropdown-tick">Added</span>}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                              {knowledgeFileChoices.length > 0 && (
                                <>
                                  <div className="resource-panel__dropdown-group">Files</div>
                                  {knowledgeFileChoices.map((f) => {
                                    const displayName = f.meta?.name || f.filename || f.id;
                                    const collectionNameRaw = (f.meta as Record<string, unknown> | undefined)?.collection_name;
                                    const collectionName = typeof collectionNameRaw === 'string' ? collectionNameRaw : undefined;
                                    const sel = knowledgeItems.some((item) => item.type === 'file' && item.id === f.id);
                                    return (
                                      <button key={`f-${f.id}`} type="button" className={`resource-panel__dropdown-item${sel ? ' resource-panel__dropdown-item--selected' : ''}`}
                                        onClick={() => { if (!sel) setKnowledgeItems((prev) => [...prev, { id: f.id, name: displayName, type: 'file', collection_name: collectionName, status: 'uploaded' }]); setShowKnowledgeSelector(false); }}>
                                        <FileText className="h-3.5 w-3.5" /><span>{displayName}</span>{sel && <span className="resource-panel__dropdown-tick">Added</span>}
                                      </button>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {canUploadFiles && (
                      <button type="button" className="resource-panel__button" onClick={() => knowledgeFileInputRef.current?.click()}>Upload Files</button>
                    )}
                  </div>
                </div>
                <div className="resource-panel__help">To attach a knowledge base here, add it to the &quot;Knowledge&quot; workspace first.</div>
              </div>
            </div>

            <div className="model-editor-card">
              <div className="model-editor-label-lg">Tools</div>
              {toolChoices.length === 0 ? <p style={{ fontSize: '0.84rem', color: '#8fa9bd' }}>No tools available.</p> : (
                <div className="model-editor-choice-grid">
                  {toolChoices.map((x) => (
                    <label key={x.id} className="model-editor-choice-pill">
                      <input type="checkbox" checked={toolIds.includes(x.id)} onChange={(e) => toggle(x.id, toolIds, setToolIds, e.target.checked)} />
                      <span>{x.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="model-editor-card">
              <div className="model-editor-label-lg">Skills</div>
              {skillChoices.length === 0 ? (
                <p style={{ fontSize: '0.84rem', color: '#8fa9bd' }}>No skills available.</p>
              ) : (() => {
                const pythonSkills   = skillChoices.filter(s => (s.content_type ?? 'python') !== 'markdown');
                const markdownSkills = skillChoices.filter(s => s.content_type === 'markdown');
                return (
                  <>
                    {pythonSkills.length > 0 && (
                      <div className="skill-group">
                        <div className="skill-group-label">
                          <span className="skill-type-badge python">Python</span>
                        </div>
                        <div className="model-editor-choice-grid">
                          {pythonSkills.map((x) => (
                            <label key={x.id} className="model-editor-choice-pill">
                              <input type="checkbox" checked={skillIds.includes(x.id)} onChange={(e) => toggle(x.id, skillIds, setSkillIds, e.target.checked)} />
                              <span>{x.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {markdownSkills.length > 0 && (
                      <div className="skill-group">
                        <div className="skill-group-label">
                          <span className="skill-type-badge markdown">SKILL.md</span>
                          <span className="skill-group-hint">auto-injected when active</span>
                        </div>
                        <div className="model-editor-choice-grid">
                          {markdownSkills.map((x) => (
                            <label key={x.id} className="model-editor-choice-pill">
                              <input type="checkbox" checked={skillIds.includes(x.id)} onChange={(e) => toggle(x.id, skillIds, setSkillIds, e.target.checked)} />
                              <span>{x.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {filterFunctions.length > 0 && (
              <div className="model-editor-card">
                <div className="model-editor-label-lg">Filters</div>
                <div className="model-editor-choice-grid">
                  {filterFunctions.map((x) => (
                    <label key={x.id} className="model-editor-choice-pill">
                      <input type="checkbox" checked={filterIds.includes(x.id)} onChange={(e) => toggle(x.id, filterIds, setFilterIds, e.target.checked)} />
                      <span>{x.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {actionFunctions.length > 0 && (
              <div className="model-editor-card">
                <div className="model-editor-label-lg">Actions</div>
                <div className="model-editor-choice-grid">
                  {actionFunctions.map((x) => (
                    <label key={x.id} className="model-editor-choice-pill">
                      <input type="checkbox" checked={actionIds.includes(x.id)} onChange={(e) => toggle(x.id, actionIds, setActionIds, e.target.checked)} />
                      <span>{x.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CAPABILITIES ── */}
        {activeTab === 'capabilities' && (
          <div className="model-editor-stack">
            <div className="model-editor-card">
              <div className="model-editor-label-lg">Capabilities</div>
              <div className="model-editor-capability-grid">
                {visibleCapabilities.map(([k, l, d]) => (
                  <button key={k} type="button" className={`capability-card${capabilities[k] ? ' capability-card--active' : ''}`} onClick={() => setCapabilities((p) => ({ ...p, [k]: !p[k] }))}>
                    <input type="checkbox" checked={Boolean(capabilities[k])} onChange={() => {}} className="capability-card__checkbox" />
                    <div className="capability-card__copy">
                      <div className="capability-card__title">{l}</div>
                      <div className="capability-card__description">{d}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {availableFeatures.length > 0 && (
              <div className="model-editor-card">
                <div className="model-editor-label-lg">Default Features</div>
                <div className="model-editor-capability-grid">
                  {availableFeatures.map(([feature, label, description]) => (
                    <button key={feature} type="button" className={`capability-card${defaultFeatures.includes(feature) ? ' capability-card--active' : ''}`}
                      onClick={() => toggle(feature, defaultFeatures, setDefaultFeatures, !defaultFeatures.includes(feature))}>
                      <input type="checkbox" checked={defaultFeatures.includes(feature)} onChange={() => {}} className="capability-card__checkbox" />
                      <div className="capability-card__copy">
                        <div className="capability-card__title">{label}</div>
                        <div className="capability-card__description">{description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {capabilities.builtin_tools && (
              <div className="model-editor-card">
                <div className="model-editor-label-lg">Builtin Tools</div>
                <div className="model-editor-capability-grid">
                  {BUILTIN_TOOLS.map(([k, l, d]) => (
                    <button key={k} type="button" className={`capability-card${builtinTools[k] !== false ? ' capability-card--active' : ''}`} onClick={() => setBuiltinTools((p) => ({ ...p, [k]: p[k] === false ? true : false }))}>
                      <input type="checkbox" checked={builtinTools[k] !== false} onChange={() => {}} className="capability-card__checkbox" />
                      <div className="capability-card__copy">
                        <div className="capability-card__title">{l}</div>
                        <div className="capability-card__description">{d}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="model-editor-card">
              <label className="model-editor-label">TTS Voice</label>
              <Input value={ttsVoice} onChange={(e) => setTtsVoice(e.target.value)} placeholder="e.g. alloy, echo, shimmer" />
            </div>

            <div className="model-editor-card">
              <div className="model-editor-topline">
                <div className="model-editor-label-lg">JSON Preview</div>
                <button type="button" className="model-editor-muted-toggle" onClick={() => setShowPreview((v) => !v)}>{showPreview ? 'Hide' : 'Show'}</button>
              </div>
              {showPreview && <textarea className="model-editor-textarea" rows={12} value={JSON.stringify(payload, null, 2)} readOnly />}
            </div>
          </div>
        )}

        <button className="model-editor-save-button" type="button" onClick={() => void saveModel()} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Update'}
        </button>
      </div>

      {/* Access Modal */}
      <Dialog open={showAccessModal} onOpenChange={setShowAccessModal}>
        <DialogContent className="workspace-access-modal max-w-xl">
          <DialogHeader>
            <DialogTitle>Access Control</DialogTitle>
            <DialogDescription>Manage who can access {name || model?.id || 'this model'}.</DialogDescription>
          </DialogHeader>
          <div className="workspace-access-privacy">
            <div className="workspace-access-privacy__icon" aria-hidden>
              {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </div>
            <div className="workspace-access-privacy__content">
              <select value={isPublic ? 'public' : 'private'} className="workspace-access-privacy__select" disabled={!canSharePublicModel}
                onChange={(e) => { if (!canSharePublicModel) return; setDraftAccessGrants((prev) => setPublic(prev, e.target.value === 'public')); }}>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <p className="workspace-access-privacy__hint">{isPublic ? 'Accessible to all users' : 'Only selected users and groups can access'}</p>
            </div>
          </div>
          <div className="workspace-access-list">
            <div className="workspace-access-list__header">
              <span>Access List</span>
              <button type="button" className="workspace-access-list__add" onClick={() => { setAddAccessQuery(''); setSelectedAddGroupIds([]); setSelectedAddUserIds([]); setShowAddAccessModal(true); }}>
                <Plus className="h-3.5 w-3.5" />Add Access
              </button>
            </div>
            <div className="workspace-access-list__items">
              {accessGroups.map((group) => {
                const canWriteGroup = writeGroupIds.includes(group.id);
                return (
                  <div key={`g-${group.id}`} className="workspace-access-item">
                    <div className="workspace-access-item__identity">
                      <div className="workspace-access-item__avatar">{(group.name ?? group.id).slice(0, 2).toUpperCase()}</div>
                      <div className="workspace-access-item__text">
                        <div className="workspace-access-item__name">{group.name ?? group.id}</div>
                        {typeof group.member_count === 'number' && <div className="workspace-access-item__meta">{group.member_count} members</div>}
                      </div>
                    </div>
                    <div className="workspace-access-item__actions">
                      <button type="button" className={`workspace-access-badge ${canWriteGroup ? 'workspace-access-badge--write' : 'workspace-access-badge--read'}`}
                        onClick={() => setDraftAccessGrants((prev) => togglePrincipalWrite(prev, 'group', group.id))}>
                        {canWriteGroup ? 'WRITE' : 'READ'}
                      </button>
                      <button type="button" className="workspace-access-remove" onClick={() => setDraftAccessGrants((prev) => removePrincipal(prev, 'group', group.id))}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {accessUsers.map((u) => {
                const canWriteUser = writeUserIds.includes(u.id);
                return (
                  <div key={`u-${u.id}`} className="workspace-access-item">
                    <div className="workspace-access-item__identity">
                      <div className="workspace-access-item__avatar">{(u.name ?? u.id).slice(0, 2).toUpperCase()}</div>
                      <div className="workspace-access-item__text">
                        <div className="workspace-access-item__name">{u.name ?? u.id}</div>
                        {u.email && <div className="workspace-access-item__meta">{u.email}</div>}
                      </div>
                    </div>
                    <div className="workspace-access-item__actions">
                      <button type="button" className={`workspace-access-badge ${canWriteUser ? 'workspace-access-badge--write' : 'workspace-access-badge--read'}`}
                        onClick={() => setDraftAccessGrants((prev) => togglePrincipalWrite(prev, 'user', u.id))}>
                        {canWriteUser ? 'WRITE' : 'READ'}
                      </button>
                      <button type="button" className="workspace-access-remove" onClick={() => setDraftAccessGrants((prev) => removePrincipal(prev, 'user', u.id))}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!isPublic && accessGroups.length === 0 && accessUsers.length === 0 && <div className="workspace-access-empty">No access grants. Private to you.</div>}
              {loadingAccessMeta && <div className="workspace-access-empty">Loading access list details...</div>}
            </div>
          </div>
          <DialogFooter>
            <Button className="workspace-access-save" onClick={() => void saveAccess()} disabled={savingAccess}>
              {savingAccess ? 'Saving...' : 'Save Access'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Access Modal */}
      <Dialog open={showAddAccessModal} onOpenChange={setShowAddAccessModal}>
        <DialogContent className="workspace-add-access-modal max-w-xl">
          <DialogHeader>
            <DialogTitle>Add Access</DialogTitle>
            <DialogDescription>Select users and groups to grant read access.</DialogDescription>
          </DialogHeader>
          <div className="workspace-add-access-search">
            <Search className="h-4 w-4 workspace-add-access-search__icon" />
            <Input value={addAccessQuery} onChange={(e) => setAddAccessQuery(e.target.value)} placeholder="Search" className="workspace-add-access-search__input" />
          </div>
          <div className="workspace-add-access-list">
            <div className="workspace-add-access-section">
              <div className="workspace-add-access-section__title">Groups</div>
              {filteredAddGroups.length === 0 ? <div className="workspace-add-access-empty">No groups found.</div> : filteredAddGroups.map((group) => (
                <label key={`ag-${group.id}`} className="workspace-add-access-item">
                  <div className="workspace-add-access-item__left">
                    <div className="workspace-add-access-avatar">{group.name.slice(0, 2).toUpperCase()}</div>
                    <div className="workspace-add-access-item__text">
                      <div className="workspace-add-access-item__name">{group.name}</div>
                      {typeof group.member_count === 'number' && <div className="workspace-add-access-item__meta">{group.member_count} members</div>}
                    </div>
                  </div>
                  <input type="checkbox" checked={selectedAddGroupIds.includes(group.id)}
                    onChange={(e) => setSelectedAddGroupIds((prev) => e.target.checked ? [...prev, group.id] : prev.filter((id) => id !== group.id))} />
                </label>
              ))}
            </div>
            <div className="workspace-add-access-section">
              <div className="workspace-add-access-section__title">Users</div>
              {loadingAddAccessUsers ? <div className="workspace-add-access-empty">Loading...</div> :
                filteredAddUsers.length === 0 ? <div className="workspace-add-access-empty">No users found.</div> :
                  filteredAddUsers.map((u) => (
                    <label key={`au-${u.id}`} className="workspace-add-access-item">
                      <div className="workspace-add-access-item__left">
                        <div className="workspace-add-access-avatar">{(u.name ?? u.id).slice(0, 2).toUpperCase()}</div>
                        <div className="workspace-add-access-item__text">
                          <div className="workspace-add-access-item__name">{u.name ?? u.id}</div>
                          {u.email && <div className="workspace-add-access-item__meta">{u.email}</div>}
                        </div>
                      </div>
                      <input type="checkbox" checked={selectedAddUserIds.includes(u.id)}
                        onChange={(e) => setSelectedAddUserIds((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))} />
                    </label>
                  ))
              }
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAccessModal(false)}>Cancel</Button>
            <Button onClick={commitAddAccess}>Add Selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .mep-root { display: flex; flex-direction: column; gap: 1rem; }
        .mep-loading { padding: 2rem; text-align: center; color: var(--bodhion-text-secondary); }
        .mep-header { display: flex; align-items: center; gap: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--bodhion-card-border); }
        .mep-back { font-size: 0.82rem; color: var(--bodhion-accent, #25d7ff); background: none; border: none; cursor: pointer; padding: 0; }
        .mep-back:hover { text-decoration: underline; }
        .mep-title { font-size: 1rem; font-weight: 700; color: var(--bodhion-text-primary); }
      `}</style>
    </div>
  );
}

export default ModelEditorPanel;
