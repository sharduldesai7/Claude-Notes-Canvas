# Synaptica

> An infinite canvas for your thoughts — create notes, connect ideas, and think alongside AI.

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6) ![License](https://img.shields.io/badge/license-MIT-green)

---

## What it is

Synaptica is a mind-mapping web app built around an infinite canvas. Each "Thought Map" is a spatial workspace where ideas live as draggable cards that you can connect, color, and chat with using AI.

**Core features:**

- **Infinite canvas** — pan, zoom, and place notes anywhere; double-click to create a new one
- **Note cards** — editable title and body, 8 color themes, resizable, auto-connected to every other node on creation
- **Image attachments** — attach an image to any note; AI can see and reason about it when you ask
- **AI Chat nodes** — a bottom chat bar spawns a dedicated AI conversation node wired into your canvas context
- **Ask AI** — one-click AI analysis of any note, with streaming response shown inline
- **AI Auto-organize** — one click repositions all nodes into a clean, readable grid layout
- **Configurable AI** — uses Gemini by default (free tier); bring your own API key to override
- **Shareable maps** — generate view-only or edit-access links; share with anyone, no account required
- **Real-time collaboration** — live cursors and instant data sync via WebSocket
- **Guest sessions** — try the full app without signing in; 30-minute sessions with up to 2 maps
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
| AI | Google Gemini (default) — SSE streaming; user-configurable API key |
| Auth | Clerk (Google OAuth) |
| Real-time | WebSockets (ws) |
| Animations | Framer Motion |
| Gestures | @use-gesture/react |

---

## Solution architecture

```mermaid
flowchart TD
    User(["User"])

    subgraph Browser
        FE["Frontend\nReact + Vite\nInfinite canvas · Sidebar · Settings · Auth UI"]
    end

    subgraph Server
        API["API Server\nExpress 5 + Node 24\nREST routes · SSE streaming · WebSocket rooms"]
    end

    subgraph External Services
        DB[("PostgreSQL\nDrizzle ORM · Neon")]
        AI["Google Gemini API\nStreaming · SSE · Vision"]
        Auth["Clerk Auth\nGoogle OAuth · JWT"]
        Storage["Object Storage\nGCS · Image uploads"]
    end

    User -->|"HTTPS"| FE
    FE -->|"HTTP + WebSocket"| API
    API -->|"Drizzle ORM"| DB
    API -->|"SSE streaming"| AI
    API -->|"JWT verification"| Auth
    API -->|"Presigned URLs"| Storage
    FE -->|"Auth UI"| Auth
```

---

## Project structure

```
Claude-Notes-Canvas/
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
│           ├── components/  # Canvas, NodeCard, AIChatNode, MapSidebar, ...
│           ├── hooks/        # use-chat-stream, use-ask-claude, use-thought-maps, ...
│           └── pages/        # ThoughtMapPage, GuestMapPage, SettingsPage, ...
├── lib/
│   ├── api-spec/            # OpenAPI spec + Orval codegen config
│   ├── api-client-react/    # Generated React Query hooks
│   ├── api-zod/             # Generated Zod schemas from OpenAPI
│   ├── db/                  # Drizzle ORM schema + DB connection
│   └── integrations-anthropic-ai/  # Legacy Anthropic client (unused)
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

---

## Local development setup

### Prerequisites

- Node 24 (use nvm: `nvm install 24 && nvm use 24`)
- pnpm 11+ (`npm install -g pnpm`)
- PostgreSQL (local or cloud — Neon/Supabase free tier works)
- A [Clerk](https://clerk.com) account (free) with Google OAuth enabled
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (free tier)

### 1. Clone and install

```bash
git clone https://github.com/sharduldesai7/Claude-Notes-Canvas.git
cd Claude-Notes-Canvas
pnpm install
```

> Note: if the preinstall script blocks you, rename `"preinstall"` to `"_preinstall"` in the root `package.json` and run again.

### 2. Environment files

**`artifacts/api-server/.env`**
```env
PORT=8080
NODE_ENV=development

CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

DATABASE_URL=postgresql://user:password@localhost:5432/synaptica

GEMINI_API_KEY=your_gemini_key_here

# Leave these as placeholders if not using image uploads
DEFAULT_OBJECT_STORAGE_BUCKET_ID=local-placeholder
PUBLIC_OBJECT_SEARCH_PATHS=gs://placeholder/public
PRIVATE_OBJECT_DIR=gs://placeholder/objects
```

**`artifacts/thought-maps/.env`**
```env
PORT=5173
BASE_PATH=/
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 3. Database setup

```bash
# Create DB and user in psql
CREATE USER synaptica WITH PASSWORD 'yourpassword';
CREATE DATABASE synaptica OWNER synaptica;

# Push schema
pnpm --filter @workspace/db run push
```

### 4. Start servers

Open two terminals:

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 5173)
pnpm --filter @workspace/thought-maps run dev
```

Open `http://localhost:5173`.

---

## AI configuration

By default Synaptica uses **Google Gemini** (`gemini-2.5-flash`) via the `GEMINI_API_KEY` in the server `.env`. Users can override this in Settings by entering their own API key — leave it blank to revert to the default.

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

- `nodeType` is `"note"` or `"ai_chat"`
- `chatHistory` is a JSON array of `{ role, text, imageUrl? }` entries
- Guest maps are stored with `userId = "guest_<token>"`

---

## API overview

All thought-map routes accept either a valid Clerk session or a valid `X-Guest-Token` header. Settings and share-management routes require a Clerk session.

| Method | Route | Description |
|---|---|---|
| GET | `/api/thought-maps` | List user's maps |
| POST | `/api/thought-maps` | Create map |
| GET | `/api/thought-maps/:id` | Get full map (nodes + connections) |
| PATCH | `/api/thought-maps/:id` | Update map |
| DELETE | `/api/thought-maps/:id` | Delete map |
| GET/POST | `/api/thought-maps/:mapId/nodes` | List/create nodes |
| PATCH/DELETE | `/api/thought-maps/:mapId/nodes/:nodeId` | Update/delete node |
| POST | `/api/thought-maps/:mapId/nodes/:nodeId/chat` | SSE AI chat stream |
| POST | `/api/thought-maps/:mapId/nodes/:nodeId/ask-claude` | SSE AI analysis stream |
| POST | `/api/thought-maps/:mapId/organize` | AI auto-arrange nodes |
| GET/POST | `/api/thought-maps/:mapId/shares` | List/create share links |
| DELETE | `/api/thought-maps/:mapId/shares/:shareId` | Revoke share link |
| GET/PUT | `/api/user/settings` | Get/update AI settings |

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