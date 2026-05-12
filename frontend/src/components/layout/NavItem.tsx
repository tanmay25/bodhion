'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/Tooltip';

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  exact?: boolean;
}

export function NavItem({ href, label, icon, exact = false }: NavItemProps) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={href}
            aria-label={label}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-accent',
              isActive && 'rounded-2xl bg-accent text-accent-foreground'
            )}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-lg bg-foreground" />
            )}
            {icon}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default NavItem;
