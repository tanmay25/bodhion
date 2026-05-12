'use client';

import { useEffect, useState } from 'react';
import { useAuthContext } from '@/providers/AuthProvider';

export function SplashScreen() {
  const { isLoaded } = useAuthContext();
  const [fading, setFading] = useState(false);
  const [gone, setGone]     = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    setFading(true);
    const t = setTimeout(() => setGone(true), 380);
    return () => clearTimeout(t);
  }, [isLoaded]);

  if (gone) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, #f9fcff 0%, #eaf4fb 100%)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.38s ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/static/logo-bodhion-light.png"
        alt="Bodhion"
        style={{
          width: 200,
          height: 'auto',
          objectFit: 'contain',
          animation: 'splash-pulse 2s ease-in-out infinite',
        }}
      />
      {/* Spinner ring */}
      <div
        className="animate-spin"
        style={{
          marginTop: 28,
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: '3px solid rgba(34,211,238,0.22)',
          borderTopColor: '#22d3ee',
        }}
      />
      <style>{`
        @keyframes splash-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}

export default SplashScreen;
