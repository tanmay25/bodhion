'use client';

import { Shell } from '@/components/layout/Shell';
import { ChatWindow } from '@/components/ai/ChatWindow';

export default function ChatEnginePage() {
  return (
    <Shell withChatSidebar>
      <div className="flex h-full flex-col overflow-hidden">
        <ChatWindow />
      </div>
    </Shell>
  );
}
