'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

function WatchContent() {
  const searchParams = useSearchParams();
  const src = searchParams.get('src');

  if (!src) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">No source provided.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black">
      <video
        src={src}
        controls
        autoPlay
        className="max-h-screen max-w-full"
      />
    </div>
  );
}

export default function WatchPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullPage />}>
      <WatchContent />
    </Suspense>
  );
}
