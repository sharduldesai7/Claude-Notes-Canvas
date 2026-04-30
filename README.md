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
- **AI Auto-organize** — one click repositions all nodes into a clean, readable grid layout ordered by Claude
- **Configurable model** — choose Claude Sonnet, Opus, or Haiku; bring your own API key + base URL if needed
- **Shareable maps** — generate view-only or edit-access links; share with anyone, no account required
- **Real-time collaboration** — live cursors and instant data sync via WebSocket; changes appear for all editors immediately
- **Guest sessions** — try the full app without signing in; 30-minute sessions with up to 2 maps, full sidebar, and a non-threatening countdown timer
- **Onboarding** — five-step guided tour on first sign-in (also shown fresh for each new guest session)
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
│   │       ├── routes/      # thoughtMaps, guestSessions, storage,
│   │       │                #   userSettings, shared
│   │       ├── lib/         # objectStorage, objectAcl
│   │       ├── middlewares/ # auth (Clerk + guest), clerkProxy
│   │       └── ws-rooms.ts  # WebSocket room management
│   └── thought-maps/        # React + Vite frontend
│       └── src/
│           ├── components/  # Canvas, NodeCard, AIChatNode, MapSidebar,
│           │                #   GuestSessionBanner, OnboardingModal, …
│           ├── hooks/       # use-nodes, use-chat-stream, use-ask-claude,
│           │                #   use-guest-session, use-realtime-sync, …
│           └── pages/       # ThoughtMapPage, GuestMapPage, SettingsPage
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

guest_sessions id, token, expiresAt, createdAt
```

- `nodeType` is `"note"` (standard card) or `"ai_chat"` (Claude conversation card)
- `imageUrl` stores the GCS object path (e.g. `/objects/uploads/<uuid>`) for the node's attached image
- `chatHistory` is a JSON array of `{ role, text, imageUrl? }` entries
- `guest_sessions.token` is a 48-character random string sent as `X-Guest-Token` on every API request; guest maps are stored with `userId = "guest_<token>"`

---

## API overview

Most thought-map routes accept either a valid Clerk session **or** a valid `X-Guest-Token` header. Settings and share-management routes require a Clerk session.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/healthz` | None | Health check |
| POST | `/api/guest-sessions` | None | Create a 30-min guest session |
| DELETE | `/api/guest-sessions/:token` | None | Delete a guest session and its data |
| POST | `/api/guest-sessions/:token/cleanup` | None | Same as DELETE — used by `sendBeacon` on tab close |
| GET | `/api/thought-maps` | Clerk or Guest | List user's maps |
| POST | `/api/thought-maps` | Clerk or Guest | Create a map (guests limited to 2) |
| GET | `/api/thought-maps/:id` | Clerk or Guest | Full map with nodes + connections |
| PATCH | `/api/thought-maps/:id` | Clerk or Guest | Rename a map |
| DELETE | `/api/thought-maps/:id` | Clerk or Guest | Delete a map |
| GET | `/api/thought-maps/:mapId/nodes` | Clerk or Guest | List nodes |
| POST | `/api/thought-maps/:mapId/nodes` | Clerk or Guest | Create node (auto-connects) |
| PATCH | `/api/thought-maps/:mapId/nodes/:nodeId` | Clerk or Guest | Update node |
| DELETE | `/api/thought-maps/:mapId/nodes/:nodeId` | Clerk or Guest | Delete node |
| POST | `/api/thought-maps/:mapId/nodes/:nodeId/chat` | Clerk or Guest | **SSE** — AI chat stream (vision-aware) |
| POST | `/api/thought-maps/:mapId/nodes/:nodeId/ask-claude` | Clerk or Guest | **SSE** — Ask Claude about a note |
| GET | `/api/thought-maps/:mapId/connections` | Clerk or Guest | List connections |
| POST | `/api/thought-maps/:mapId/connections` | Clerk or Guest | Create connection |
| DELETE | `/api/thought-maps/:mapId/connections/:id` | Clerk or Guest | Delete connection |
| POST | `/api/thought-maps/:mapId/organize` | Clerk or Guest | AI auto-organize all nodes |
| GET | `/api/thought-maps/:mapId/shares` | Clerk | List share links |
| POST | `/api/thought-maps/:mapId/shares` | Clerk | Create share link |
| DELETE | `/api/thought-maps/:mapId/shares/:shareId` | Clerk | Revoke share link |
| GET | `/api/shared/:token` | None | Resolve share token → map data |
| GET | `/api/user/settings` | Clerk | Get AI preferences |
| PUT | `/api/user/settings` | Clerk | Update AI preferences |
| POST | `/api/storage/uploads/request-url` | Clerk or Guest | Get presigned PUT URL for upload |
| GET | `/api/storage/objects/*` | None | Serve uploaded files |
| GET | `/api/storage/public-objects/*` | None | Serve public files |

### Guest session lifecycle

1. Client calls `POST /api/guest-sessions` → receives `{ token, expiresAt }` (30-minute TTL)
2. Token is stored in `sessionStorage` (auto-cleared on tab close) and attached to every request as `X-Guest-Token`
3. Guest maps are stored with `userId = "guest_<token>"`
4. On tab close, `sendBeacon` fires `POST /api/guest-sessions/:token/cleanup` to remove data immediately
5. A server-side job runs every 2 minutes to delete any remaining expired sessions and their data

### Image upload flow

1. Client calls `POST /api/storage/uploads/request-url` with `{ name, size, contentType }`
2. Server returns `{ uploadURL, objectPath }` — a short-lived GCS presigned PUT URL
3. Client PUTs the file directly to GCS at `uploadURL`
4. Client stores `objectPath` (e.g. `/objects/uploads/<uuid>`) — this is what gets saved to the node
5. To display: `<img src={"/api/storage" + objectPath} />`

### WebSocket

Connect to `ws://<host>/ws?mapId=<id>` (optionally `&token=<shareToken>` for shared maps, or `&guestToken=<guestToken>` for guest sessions). The server broadcasts the full updated map object after every mutation. Cursor positions are broadcast as `{ type: "cursor", userId, x, y, name, color }` messages.

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
