'use client';

import { use } from 'react';
import { Shell } from '@/components/layout/Shell';
import { ChatWindow } from '@/components/ai/ChatWindow';

interface Props {
  params: Promise<{ id: string }>;
}

export default function ChatPage({ params }: Props) {
  const { id } = use(params);

  return (
    <Shell withChatSidebar>
      <div className="flex h-full flex-col overflow-hidden">
        <ChatWindow key={id} chatId={id} />
      </div>
    </Shell>
  );
}
