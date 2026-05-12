'use client';

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Something went wrong</h2>
      <pre
        style={{
          fontSize: '0.75rem',
          color: '#666',
          whiteSpace: 'pre-wrap',
          maxWidth: '600px',
          background: '#f5f5f5',
          padding: '1rem',
          borderRadius: '6px',
        }}
      >
        {error?.message ?? 'Unknown error'}
        {error?.digest ? `\nDigest: ${error.digest}` : ''}
      </pre>
      <button
        onClick={reset}
        style={{
          padding: '0.5rem 1.5rem',
          background: '#1d4ed8',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  );
}
