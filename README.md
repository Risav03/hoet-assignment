# CoWork — Collaborative Workspace Platform

A full-stack collaborative document management platform built with Next.js, Prisma, Auth.js, and Tailwind CSS. Teams can create shared workspaces, collaboratively edit documents, propose and vote on changes, and use AI assistance throughout.

---

## Features

- **Workspaces** — Create and manage team workspaces with role-based access (Owner, Editor, Viewer). Invite members and manage permissions.
- **Document Editor** — Rich-text document editing powered by Tiptap with version history, archiving, and tagging.
- **Change Proposals** — Editors can propose document changes that members vote to approve or reject before they are committed (patch-based diffing via `fast-json-patch`).
- **Version History** — Full version timeline for every document with the ability to restore any previous version.
- **AI Assistant** — Per-workspace AI chat and per-document AI tools: summarise, rewrite, suggest tags, extract action items, and explain merge conflicts. Supports Anthropic, OpenAI, and Groq interchangeably.
- **Real-time Events** — Server-Sent Events (SSE) keep clients updated on document and proposal changes without polling.
- **Optimistic Sync** — Offline-capable operation queue with checksum validation and retry logic (`SyncOperation` model).
- **Activity Log** — Audit trail of all workspace and document actions.
- **Authentication** — Email/password auth via Auth.js (NextAuth v5) with bcrypt password hashing and JWT sessions.
- **Rate Limiting** — API-level rate limiting via `rate-limiter-flexible`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL (Neon serverless) |
| ORM | Prisma 7 |
| Auth | Auth.js (NextAuth v5) |
| UI | Tailwind CSS v4, shadcn/ui, Radix UI |
| Rich Text | Tiptap v3 |
| AI | Vercel AI SDK (`ai`) — Anthropic / OpenAI / Groq |
| Forms | React Hook Form + Zod |
| Testing | Vitest (unit), Playwright (e2e) |

---

## Project Structure

```
app/
  (auth)/           # Login & signup pages
  (dashboard)/      # Authenticated app pages
    dashboard/      # Home dashboard
    workspaces/     # Workspace list & detail
    documents/      # Document views
    proposals/      # Change proposals
    settings/       # User / workspace settings
    ai-assistant/   # Workspace AI chat
  api/              # REST API routes
    auth/           # Auth.js handlers + signup
    workspaces/     # Workspace CRUD & member management
    documents/      # Document CRUD & version management
    proposals/      # Proposal creation & voting
    events/         # SSE event stream
    sync/           # Offline sync queue
    ai/             # AI endpoints (chat, summarize, rewrite, …)
components/
  ai/               # AI assistant UI
  document/         # Document-related dialogs & cards
  editor/           # Tiptap document editor
  layout/           # Sidebar, nav, shell
  proposals/        # Proposal cards & vote UI
  versions/         # Version timeline
  workspace/        # Workspace settings & member dialogs
  ui/               # shadcn/ui base components
lib/
  actions/          # Server actions (workspace mutations)
  ai/               # AI provider factory
  dal/              # Data-access layer
  db/               # Prisma client singleton
  hooks/            # Shared React hooks
  sse/              # SSE helpers
  sync/             # Sync queue logic
  validation/       # Zod schemas
prisma/
  schema.prisma     # Database schema
  migrations/       # Prisma migration history
tests/
  unit/             # Vitest unit tests (differ, validation)
  e2e/              # Playwright tests (auth, workspace flows)
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (e.g. [Neon](https://neon.tech) free tier)
- At least one AI provider API key (Anthropic, OpenAI, or Groq)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env` to `.env.local` and fill in your values:

```env
# Database
DATABASE_URL="postgresql://..."

# Auth
SESSION_SECRET="<random 32-byte hex>"
AUTH_SECRET="<random 32-byte hex>"
NEXTAUTH_URL="http://localhost:3000"

# AI Provider — set at least one
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
GROQ_API_KEY=""

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="CoWork"
```

Generate secrets with:

```bash
openssl rand -base64 32
```

### 3. Apply database migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run test` | Run Vitest unit tests |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:e2e:ui` | Open the Playwright UI runner |

---

## AI Provider Selection

The app automatically uses the first configured provider (checked in order):

1. **Anthropic** — `claude-haiku-4-5` (set `ANTHROPIC_API_KEY`)

---

## Database Schema Overview

```
User
 ├── WorkspaceMember  (role: OWNER | EDITOR | VIEWER)
 ├── ChangeProposal   (authored proposals)
 ├── ProposalVote     (APPROVE | REJECT)
 ├── SyncOperation    (offline queue)
 ├── ActivityLog      (audit trail)
 └── DocumentVersion  (version authorship)

Workspace
 ├── Document
 │    ├── DocumentVersion
 │    └── ChangeProposal
 │         └── ProposalVote
 ├── SyncOperation
 └── ActivityLog
```

---

## Deployment

The app is compatible with any Node.js hosting that supports Next.js (Vercel, Railway, Render, etc.). Ensure all environment variables are set in your deployment environment and run `npx prisma migrate deploy` against your production database before starting the server.
