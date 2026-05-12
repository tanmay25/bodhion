import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Produce a self-contained build under .next/standalone for Docker (nginx pattern).
  // The standalone output bundles only the required node_modules, keeping image size minimal.
  output: 'standalone',

  // Serve the Next.js app at the root; the FastAPI backend is proxied separately.
  // In production, both are served from the same host/port via a reverse proxy.

  // Forward /api, /ollama, /openai, /ws requests to the FastAPI backend during dev.
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    return [
      { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
      { source: '/ollama/:path*', destination: `${apiUrl}/ollama/:path*` },
      { source: '/openai/:path*', destination: `${apiUrl}/openai/:path*` },
      { source: '/ws/:path*', destination: `${apiUrl}/ws/:path*` },
      { source: '/oauth/:path*', destination: `${apiUrl}/oauth/:path*` },
    ];
  },

  images: {
    remotePatterns: [
      // Allow profile images served by the backend
      { protocol: 'http', hostname: 'localhost', port: '8080' },
      { protocol: 'https', hostname: '**' },
    ],
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Hide the floating Next.js dev indicator badge.
  devIndicators: false,

  // Allow importing WASM/worker files
  webpack(config) {
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'asset/resource',
    });
    return config;
  },
};

export default nextConfig;
