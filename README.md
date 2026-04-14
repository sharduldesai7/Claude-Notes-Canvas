# Synaptica

> An infinite canvas for your thoughts — create notes, connect ideas, and collaborate with Claude AI.

![Synaptica](https://img.shields.io/badge/version-0.0.1-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What it is

Synaptica is a mind-map style note-taking web app. Each "Thought Map" is an infinite canvas where you can:

- **Create notes** by double-clicking anywhere
- **Organize visually** — drag, resize, and color-code notes freely
- **Chat with Claude AI** via a bottom chat bar that spawns dedicated AI Chat nodes with a WhatsApp-style conversation UI
- **Manage multiple maps** from a collapsible sidebar
- **Sign in with Google** via Clerk auth

---

## Tech stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Language | TypeScript 5.9 |
| Frontend | React 18 + Vite |
| Backend | Express 5 (Node 24) |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| API contract | OpenAPI 3 → Orval codegen |
| AI | Anthropic Claude (SSE streaming) |
| Auth | Clerk (Google OAuth) |
| Animations | Framer Motion |
| Gestures | @use-gesture/react |

---

## Project structure

```
synaptica/
├── artifacts/
│   ├── api-server/          # Express REST + SSE API
│   └── thought-maps/        # React + Vite frontend
│       └── src/
│           ├── components/  # Canvas, NodeCard, AIChatNode, MapSidebar, …
│           ├── hooks/       # use-nodes, use-chat-stream, use-ask-claude, …
│           └── pages/       # LandingPage, ThoughtMapPage, SettingsPage
├── lib/
│   ├── api-spec/            # openapi.yaml + orval.config.ts
│   ├── api-client-react/    # Generated React Query hooks (do not edit)
│   ├── api-zod/             # Generated Zod validators (do not edit)
│   ├── db/                  # Drizzle schema + migration helpers
│   └── integrations-anthropic-ai/  # Anthropic client wrapper
├── scripts/
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Prerequisites

- **Node.js** ≥ 20 (24 recommended)
- **pnpm** ≥ 9
- **PostgreSQL** database
- **Clerk** account (for auth)
- **Anthropic API key** (or use the Replit AI Integrations proxy)

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/your-org/synaptica.git
cd synaptica
pnpm install
```

### 2. Configure environment variables

Create a `.env` file in the repo root (or set these in your hosting environment):

```env
# Clerk — create a project at https://clerk.com
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/synaptica

# Anthropic (only needed if NOT using Replit AI Integrations)
AI_INTEGRATIONS_ANTHROPIC_API_KEY=sk-ant-...
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com
```

> **Running on Replit?** `DATABASE_URL`, `CLERK_*`, and `AI_INTEGRATIONS_*` are provisioned automatically by the platform integrations — no manual setup needed.

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Start development servers

```bash
# API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Frontend (port auto-assigned, check terminal output)
pnpm --filter @workspace/thought-maps run dev
```

Both are hot-reload enabled. The frontend proxies `/api/*` to the API server automatically via the Vite config.

---

## Development workflows

| Command | What it does |
|---|---|
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate React Query hooks and Zod validators from `openapi.yaml` |
| `pnpm --filter @workspace/db run push` | Apply schema changes to the database |
| `pnpm run typecheck` | Full TypeScript check across all packages |

### Changing the API

1. Edit `lib/api-spec/openapi.yaml`
2. Add the route handler in `artifacts/api-server/src/routes/thoughtMaps.ts`
3. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
4. The new React Query hook is immediately available in the frontend

### Adding a new frontend component

Place it under `artifacts/thought-maps/src/components/`. Import shared UI primitives from `@/components/ui/` (shadcn/ui components). Use the `cn()` helper for conditional class merging.

---

## Database schema

```
thought_maps   id, userId, title, createdAt, updatedAt
nodes          id, mapId, title, nodeType, content,
               positionX, positionY, width, height,
               color, claudeResponse, chatHistory,
               isProcessing, createdAt, updatedAt
connections    id, mapId, fromNodeId, toNodeId, createdAt
user_settings  userId, preferredModel, customApiKey,
               customBaseUrl, updatedAt
```

`nodeType` is either `"note"` (standard card) or `"ai_chat"` (Claude conversation card).

---

## API overview

All routes require a valid Clerk session token (`Authorization: Bearer <token>`) except `/api/health`.

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/thought-maps` | List user's maps |
| POST | `/api/thought-maps` | Create a map |
| GET | `/api/thought-maps/:id` | Full map with nodes + connections |
| PATCH | `/api/thought-maps/:id` | Rename a map |
| DELETE | `/api/thought-maps/:id` | Delete a map |
| GET | `/api/thought-maps/:mapId/nodes` | List nodes |
| POST | `/api/thought-maps/:mapId/nodes` | Create node (auto-connects to all existing) |
| PATCH | `/api/thought-maps/:mapId/nodes/:nodeId` | Update node |
| DELETE | `/api/thought-maps/:mapId/nodes/:nodeId` | Delete node |
| POST | `/api/thought-maps/:mapId/nodes/:nodeId/chat` | **SSE** — AI chat stream |
| POST | `/api/thought-maps/:mapId/nodes/:nodeId/ask-claude` | **SSE** — legacy Claude ask |
| GET | `/api/user/settings` | Get AI preferences |
| PUT | `/api/user/settings` | Update AI preferences |

---

## Contributing

1. **Fork** the repo and create a feature branch: `git checkout -b feat/your-feature`
2. **Make changes** — follow the existing patterns (components, hooks, API routes)
3. **Run codegen** if you touched the OpenAPI spec
4. **Test** manually in dev mode
5. **Open a pull request** with a clear description of what changed and why

Please keep PRs focused — one feature or fix per PR. For larger changes, open an issue first to discuss the approach.

---

## License

MIT
