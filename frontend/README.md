# Bodhion — Frontend

Bodhion is an enterprise AI platform built by Tanmay Mondal. This directory contains the Next.js (App Router) frontend: a React 19 single-page application with streaming chat, real-time messaging via Socket.IO, a full admin panel, workspace management, and optional in-browser Python execution via Pyodide.

---

## Tech Stack

| Concern        | Library / Tool                                      |
|----------------|-----------------------------------------------------|
| Framework      | Next.js 15 (App Router)                             |
| UI             | React 19, Tailwind CSS v3, shadcn/ui (Radix-based)  |
| State          | Zustand 5                                           |
| Server State   | TanStack Query v5                                   |
| Auth           | `localStorage.token` with session helpers           |
| Streaming      | `eventsource-parser`                                |
| Real-time      | Socket.io client                                    |
| Theming        | `next-themes`                                       |
| Notifications  | `sonner`                                            |

---

## Prerequisites

- Node.js 18 or later
- npm 9 or later
- A running backend at `http://localhost:8080` (or configure via `.env.local`)

---

## Installation

```bash
# 1. Navigate to the frontend directory
cd frontend

# 2. Install dependencies
npm install
```

---

## Configuration

Copy the example environment file and update the values:

```bash
cp .env.local.example .env.local
```

Open `.env.local` in your editor and set the variables:

| Variable                    | Default                   | Description                              |
|-----------------------------|---------------------------|------------------------------------------|
| `NEXT_PUBLIC_API_URL`       | `http://localhost:8080`   | Base URL of the backend API              |
| `NEXT_PUBLIC_APP_VERSION`   | `0.8.8`                   | Version string displayed in the UI       |
| `NEXT_PUBLIC_APP_BUILD_HASH`| `dev-build`               | Build hash displayed in settings         |

---

## Running the App

```bash
# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

```bash
# Build for production
npm run build

# Start the production server
npm start
```

---

## Pyodide Setup (Optional)

Pyodide enables in-browser Python code execution. Run this step once to pre-bundle the required Python packages:

```bash
# From inside the frontend/ directory
node --experimental-vm-modules scripts/prepare-pyodide.js
```

This generates files under `public/pyodide/`, which are served at `/pyodide/*` at runtime.

---

## Cleanup

```bash
# Remove installed dependencies
rm -rf node_modules

# Remove the production build output
rm -rf .next

# Remove generated Pyodide assets
rm -rf public/pyodide
```

---

## Project Structure

```
frontend/
├── public/
│   └── static/              # Fonts, emojis, logos, and audio assets
├── scripts/
│   └── prepare-pyodide.js   # Bundles Python packages into public/pyodide/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Login page (no shell layout)
│   │   ├── (app)/           # Protected pages (auth guard in layout.tsx)
│   │   │   ├── page.tsx               # Dashboard home
│   │   │   ├── chat-engine/           # Chat engine + individual chat (/c/[id])
│   │   │   ├── workspace/             # Knowledge, tools, models, prompts
│   │   │   ├── settings/              # User settings
│   │   │   └── admin/                 # Admin panel (role-guarded)
│   │   ├── s/[id]/          # Shared chat viewer (public)
│   │   ├── watch/           # Video watch page (public)
│   │   └── error/           # Generic error page
│   ├── components/
│   │   ├── ai/              # ChatWindow, MessageBubble, StreamingResponse, PromptInput, ModelSelector
│   │   ├── auth/            # LoginForm, PrivilegeGuard, RoleTag, AccessDenied, AccountPending
│   │   ├── dashboard/       # ServiceCard, ServiceGrid, DashboardShell, services.ts
│   │   ├── layout/          # Shell, Sidebar, Header, NavItem, DashboardSidebar
│   │   ├── shared/          # EmptyState, PageHeader, ErrorBoundary, LoadingSpinner
│   │   └── ui/              # Button, Input, Spinner, Badge, Modal, Dropdown, Tooltip, Avatar, Tabs
│   ├── hooks/               # useApi, useAuth, usePermission, useStreamingResponse
│   ├── lib/
│   │   ├── api/             # apiFetch, apiStream, auth, ai, models, chats, workspace helpers
│   │   ├── auth/            # Session (localStorage wrappers), permissions
│   │   ├── constants.ts     # App name, route paths, breakpoints
│   │   └── utils/           # cn, format (dayjs), stream helpers
│   ├── providers/           # AuthProvider, ThemeProvider, SocketProvider, QueryProvider
│   ├── store/               # authStore, uiStore, chatStore, workspaceStore, channelStore, aiStore
│   └── types/               # auth, config, models, chat, api
```

---

## API Proxy

All backend API calls are proxied through Next.js rewrites configured in `next.config.ts`:

| URL Pattern   | Proxied To                          |
|---------------|-------------------------------------|
| `/api/*`      | `NEXT_PUBLIC_API_URL/api/*`         |
| `/ollama/*`   | `NEXT_PUBLIC_API_URL/ollama/*`      |
| `/openai/*`   | `NEXT_PUBLIC_API_URL/openai/*`      |
| `/ws/*`       | `NEXT_PUBLIC_API_URL/ws/*`          |
| `/oauth/*`    | `NEXT_PUBLIC_API_URL/oauth/*`       |

This means you never need to hardcode backend URLs in client code — all requests go through `/api/...` and Next.js handles forwarding.
