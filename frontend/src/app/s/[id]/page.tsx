'use client';

import { use, useEffect, useState } from 'react';
import { MessageBubble } from '@/components/ai/MessageBubble';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { getChatById } from '@/lib/api/chats';
import { getToken } from '@/lib/auth/session';
import type { Chat } from '@/types/chat';

interface Props {
  params: Promise<{ id: string }>;
}

export default function SharedChatPage({ params }: Props) {
  const { id } = use(params);
  const [chat, setChat] = useState<Chat | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const token = getToken();
    getChatById(token ?? '', id)
      .then((c) => {
        if (!c) setNotFound(true);
        else setChat(c);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner fullPage />;

  if (notFound || !chat) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Shared chat not found.</p>
      </div>
    );
  }

  const messages = chat.messages ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 py-8">
      <h1 className="px-4 text-xl font-semibold">{chat.title}</h1>
      <div className="flex-1 overflow-y-auto">
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
      </div>
    </div>
  );
}
