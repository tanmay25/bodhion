'use client';

import { useRouter } from 'next/navigation';
import { PencilLine, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/Tooltip';
import { useUIStore } from '@/store/uiStore';

interface HeaderProps {
  title?: string;
  showNewChat?: boolean;
}

export function Header({ title, showNewChat = false }: HeaderProps) {
  const router = useRouter();
  const { showSidebar, setShowSidebar } = useUIStore();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Toggle sidebar"
                onClick={() => setShowSidebar(!showSidebar)}
              >
                <PanelLeft className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{showSidebar ? 'Close sidebar' : 'Open sidebar'}</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {title && <h1 className="text-sm font-semibold">{title}</h1>}
      </div>

      {showNewChat && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="New chat"
                onClick={() => router.push('/chat-engine')}
              >
                <PencilLine className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </header>
  );
}

export default Header;
