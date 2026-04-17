# Synaptica

> An infinite canvas for your thoughts — create notes, attach images, connect ideas, and think alongside Claude AI.

![Synaptica](https://img.shields.io/badge/version-0.1.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What it is

Synaptica is a mind-mapping web app built around an infinite canvas. Each "Thought Map" is a spatial workspace where ideas live as draggable cards that you can connect, color, and chat with.

**Core features:**

- **Infinite canvas** — pan, zoom, and place notes anywhere; double-click to create a new one
- **Note cards** — editable title and body, 8 color themes, resizable, auto-connected to every other node on creation
- **Image attachments** — attach an image to any note; Claude can see and reason about it when you ask
- **AI Chat nodes** — a bottom chat bar spawns a dedicated Claude conversation node wired into your canvas context; attach images to individual messages for vision-aware replies
- **Ask Claude** — one-click AI analysis of any note, with streaming response shown inline
- **Configurable model** — choose Claude Sonnet, Opus, or Haiku; bring your own API key + base URL if needed
- **Shareable maps** — generate view-only or edit-access links; share with anyone, no account required
- **Real-time collaboration** — live cursors and instant data sync via WebSocket; changes appear for all editors immediately
- **Onboarding** — five-step guided tour on first sign-in
- **Google sign-in** via Clerk auth

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
| AI | Anthropic Claude — SSE streaming, vision |
| Auth | Clerk (Google OAuth) |
| Real-time | WebSockets (ws) |
| File storage | Replit Object Storage (Google Cloud Storage) |
| Animations | Framer Motion |
| Gestures | @use-gesture/react |

---

## Project structure

```
synaptica/
├── artifacts/
│   ├── api-server/          # Express REST + SSE + WebSocket API
│   │   └── src/
│   │       ├── routes/      # thoughtMaps, storage, userSettings, shared
│   │       ├── lib/         # objectStorage, objectAcl
│   │       ├── middlewares/ # Clerk auth, clerkProxy
│   │       └── ws-rooms.ts  # WebSocket room management
│   └── thought-maps/        # React + Vite frontend
│       └── src/
│           ├── components/  # Canvas, NodeCard, AIChatNode, MapSidebar, …
│           ├── hooks/       # use-nodes, use-chat-stream, use-ask-claude,
│           │                #   use-image-upload, use-realtime-sync, …
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
- **Google Cloud Storage bucket** (or use Replit Object Storage — auto-provisioned on Replit)

---

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/your-org/synaptica.git
cd synaptica
pnpm install
```

### 2. Configure environment variables

```env
# Clerk — create a project at https://clerk.com
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/synaptica

# Anthropic (only needed if NOT using Replit AI Integrations)
AI_INTEGRATIONS_ANTHROPIC_API_KEY=sk-ant-...
AI_INTEGRATIONS_ANTHROPIC_BASE_URL=https://api.anthropic.com

# Object Storage (auto-provisioned on Replit via setupObjectStorage())
DEFAULT_OBJECT_STORAGE_BUCKET_ID=replit-objstore-...
PUBLIC_OBJECT_SEARCH_PATHS=gs://replit-objstore-.../public
PRIVATE_OBJECT_DIR=gs://replit-objstore-.../objects
```

> **Running on Replit?** `DATABASE_URL`, `CLERK_*`, `AI_INTEGRATIONS_*`, and object storage vars are all provisioned automatically. No manual setup needed.

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

Both are hot-reload enabled. The frontend proxies `/api/*` to the API server automatically.

---

## Development workflows

| Command | What it does |
|---|---|
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate React Query hooks + Zod validators from `openapi.yaml` |
| `pnpm --filter @workspace/db run push` | Apply schema changes to the database |
| `pnpm run typecheck` | Full TypeScript check across all packages |

### Changing the API

1. Edit `lib/api-spec/openapi.yaml`
2. Add the route handler in `artifacts/api-server/src/routes/`
3. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
4. The new React Query hook is immediately available in the frontend

---

## Database schema

```
thought_maps   id, userId, title, createdAt, updatedAt

nodes          id, mapId, title, nodeType, content,
               positionX, positionY, width, height,
               color, imageUrl,
               claudeResponse, chatHistory,
               isProcessing, createdAt, updatedAt

connections    id, mapId, fromNodeId, toNodeId, createdAt

user_settings  userId, preferredModel, customApiKey,
               customBaseUrl, updatedAt

map_shares     id, mapId, token, permission,
               createdBy, createdAt
```

- `nodeType` is `"note"` (standard card) or `"ai_chat"` (Claude conversation card)
- `imageUrl` stores the GCS object path (e.g. `/objects/uploads/<uuid>`) for the node's attached image
- `chatHistory` is a JSON array of `{ role, text, imageUrl? }` entries

---

## API overview

All routes require a valid Clerk session cookie except `/api/healthz` and the storage serving endpoints.

| Method | Path | Description |
|---|---|---|
| GET | `/api/healthz` | Health check |
| GET | `/api/thought-maps` | List user's maps |
| POST | `/api/thought-maps` | Create a map |
| GET | `/api/thought-maps/:id` | Full map with nodes + connections |
| PATCH | `/api/thought-maps/:id` | Rename a map |
| DELETE | `/api/thought-maps/:id` | Delete a map |
| GET | `/api/thought-maps/:mapId/nodes` | List nodes |
| POST | `/api/thought-maps/:mapId/nodes` | Create node (auto-connects to all existing) |
| PATCH | `/api/thought-maps/:mapId/nodes/:nodeId` | Update node |
| DELETE | `/api/thought-maps/:mapId/nodes/:nodeId` | Delete node |
| POST | `/api/thought-maps/:mapId/nodes/:nodeId/chat` | **SSE** — AI chat stream (vision-aware) |
| POST | `/api/thought-maps/:mapId/nodes/:nodeId/ask-claude` | **SSE** — Ask Claude about a note (vision-aware) |
| GET | `/api/thought-maps/:mapId/connections` | List connections |
| POST | `/api/thought-maps/:mapId/connections` | Create connection |
| DELETE | `/api/thought-maps/:mapId/connections/:id` | Delete connection |
| GET | `/api/thought-maps/:mapId/shares` | List share links |
| POST | `/api/thought-maps/:mapId/shares` | Create share link |
| DELETE | `/api/thought-maps/:mapId/shares/:shareId` | Revoke share link |
| GET | `/api/shared/:token` | Resolve share token → map data |
| GET | `/api/user/settings` | Get AI preferences |
| PUT | `/api/user/settings` | Update AI preferences |
| POST | `/api/storage/uploads/request-url` | Get GCS presigned PUT URL for upload |
| GET | `/api/storage/objects/*` | Serve uploaded files |
| GET | `/api/storage/public-objects/*` | Serve public files |

### Image upload flow

1. Client calls `POST /api/storage/uploads/request-url` with `{ name, size, contentType }`
2. Server returns `{ uploadURL, objectPath }` — a short-lived GCS presigned PUT URL
3. Client PUTs the file directly to GCS at `uploadURL`
4. Client stores `objectPath` (e.g. `/objects/uploads/<uuid>`) — this is what gets saved to the node
5. To display: `<img src={"/api/storage" + objectPath} />`

### WebSocket

Connect to `ws://<host>/ws?mapId=<id>` (optionally `&token=<shareToken>` for shared maps). The server broadcasts the full updated map object after every mutation. Cursor positions are broadcast as `{ type: "cursor", userId, x, y, name, color }` messages.

---

## Contributing

1. **Fork** and create a feature branch: `git checkout -b feat/your-feature`
2. **Make changes** — follow existing patterns in components, hooks, and API routes
3. **Run codegen** if you touched the OpenAPI spec
4. **Push schema** if you changed the database schema
5. **Open a pull request** with a clear description of what changed and why

Keep PRs focused — one feature or fix per PR. For larger changes, open an issue first.

---

## License

MIT
