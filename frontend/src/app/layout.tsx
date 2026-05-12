import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { AuthProvider } from '@/providers/AuthProvider';
import { QueryProvider } from '@/providers/QueryProvider';
import { SplashScreen } from '@/components/ui/SplashScreen';
import './globals.css';
import '@/styles/sidebar.css';

export const metadata: Metadata = {
  title: 'Bodhion',
  description: 'Bodhion Hub — AI-powered services and chat engine',
  icons: {
    icon: [
      { url: '/static/favicon.png', type: 'image/png' },
      { url: '/static/bodhion_icon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/static/favicon.png',
    apple: '/static/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Instant theme detection — runs before first paint to avoid FOUC */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(()=>{try{const t=localStorage.getItem('theme')||'system';const d=window.matchMedia('(prefers-color-scheme: dark)').matches;const r=t==='system'?(d?'dark':'bodhion-light'):t;document.documentElement.classList.add(r);}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              {/* Splash screen — React-controlled, fades out when auth bootstrap completes */}
              <SplashScreen />
              {children}
              <Toaster richColors position="top-right" closeButton />
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
