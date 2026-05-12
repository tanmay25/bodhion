'use client';

import dynamic from 'next/dynamic';
import { Shell } from '@/components/layout/Shell';
import { AdminLoadingSplash } from '@/components/admin/AdminLoadingSplash';

const ChatWindow = dynamic(
  () => import('@/components/ai/ChatWindow').then((m) => ({ default: m.ChatWindow })),
  {
    loading: () => (
      <AdminLoadingSplash
        title="Loading IT Help Desk…"
        subtitle="Preparing your AI assistant"
        minHeight="100%"
      />
    ),
    ssr: false,
  }
);

export default function ItHelpDeskPage() {
  return (
    <Shell withChatSidebar>
      <div className="flex h-full flex-col overflow-hidden">
        <ChatWindow />
      </div>
    </Shell>
  );
}
