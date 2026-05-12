import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils/cn';

interface LoadingSpinnerProps {
  /** Full-page centered overlay */
  fullPage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ fullPage = false, size = 'md', className }: LoadingSpinnerProps) {
  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Spinner size={size} />
      </div>
    );
  }
  return (
    <div className={cn('flex items-center justify-center py-8', className)}>
      <Spinner size={size} />
    </div>
  );
}

export default LoadingSpinner;
