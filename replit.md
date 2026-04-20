# Synaptica

## Overview

Synaptica is a mind-map style note-taking web app with an infinite canvas, AI integration via a bottom chat bar that creates WhatsApp-style "AI chat nodes", a collapsible sidebar for managing multiple "Thought Maps" (canvases), and Clerk Google auth. Notes have user-selectable colors, editable titles (defaulting to "Untitled N"), auto-connect when created, and users can configure their preferred LLM model in profile settings.

Maps can be shared via links with view-only or edit permission. Real-time collaboration is supported — multiple users on the same map see each other's changes instantly via WebSocket push (the server broadcasts the full updated map after every mutation).

**Guest sessions**: Visitors can try the app without signing in. A 30-minute guest session is created, stored in `sessionStorage`, and attached to every API request via the `X-Guest-Token` header. Guests get a full infinite canvas with a non-threatening countdown banner (neutral → amber at 5 min → red at 1 min). Data is cleaned up on tab close (via `sendBeacon`) or by a server-side cleanup job that runs every 2 minutes.

pnpm workspace monorepo using TypeScript.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)
- **AI**: Anthropic Claude via Replit AI Integrations (default), or user-supplied API key
- **Auth**: Clerk (with Google OAuth)

## Artifacts

### Thought Maps (artifacts/thought-maps)
The primary React + Vite web application.

- **Landing page**: `/` — "Think Freely" landing with Get Started / Sign In / "Try without signing in"
- **App**: `/m` and `/m/:mapId` — sidebar + infinite canvas
- **Settings**: `/settings` — AI model preferences, profile

### API Server (artifacts/api-server)
Express API backend.

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   └── thought-maps/       # React + Vite frontend
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   ├── db/                 # Drizzle ORM schema + DB connection
│   └── integrations-anthropic-ai/  # Anthropic AI client
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- **thought_maps** — canvas pages (id, title, userId, createdAt, updatedAt)
- **nodes** — note/AI chat cards on a canvas (id, mapId, title, nodeType ["note"|"ai_chat"], content, positionX, positionY, width, height, color, imageUrl, claudeResponse, chatHistory, isProcessing, createdAt, updatedAt)
- **connections** — arrows linking nodes (id, mapId, fromNodeId, toNodeId, createdAt)
- **user_settings** — per-user AI preferences (userId, preferredModel, customApiKey, customBaseUrl, updatedAt)
- **map_shares** — share tokens for maps (id, mapId, token, permission, createdBy, createdAt)

## API Routes (all require Clerk auth except /health)

- `GET /api/thought-maps` — list user's maps
- `POST /api/thought-maps` — create map
- `GET /api/thought-maps/:id` — get full map (with nodes + connections)
- `PATCH /api/thought-maps/:id` — update map
- `DELETE /api/thought-maps/:id` — delete map
- `GET/POST /api/thought-maps/:mapId/nodes` — list/create nodes (POST auto-connects to all existing nodes)
- `PATCH/DELETE /api/thought-maps/:mapId/nodes/:nodeId` — update/delete node
- `GET/POST /api/thought-maps/:mapId/connections` — list/create connections
- `DELETE /api/thought-maps/:mapId/connections/:connectionId` — delete connection
- `POST /api/thought-maps/:mapId/nodes/:nodeId/ask-claude` — SSE streaming Claude response (vision-aware: uses node.imageUrl if set)
- `POST /api/thought-maps/:mapId/nodes/:nodeId/chat` — SSE streaming AI chat (accepts optional imageObjectPath for vision)
- `GET /api/user/settings` — get user AI settings
- `PUT /api/user/settings` — update user AI settings
- `POST /api/storage/uploads/request-url` — get GCS presigned PUT URL for image uploads
- `GET /api/storage/objects/*` — serve uploaded objects from Replit Object Storage
- `GET /api/storage/public-objects/*` — serve public objects

## Key Frontend Components

- `Canvas.tsx` — infinite pan/zoom canvas, double-click to create nodes, SVG bezier arrow connections
- `NodeCard.tsx` — draggable note card with color picker (8 colors), image attachment, Ask Claude with vision
- `AIChatNode.tsx` — AI chat card with streaming responses, image attachment per message
- `MapSidebar.tsx` — left panel with map list, user profile footer, settings/logout buttons
- `SettingsPage.tsx` — AI model selection (Sonnet/Opus/Haiku/Custom), custom API key support

## Image Feature

- Notes (NodeCard) support a single image attachment stored as `imageUrl` (GCS object path) in the node
- Image attachment button in the node header; clicking opens a file picker
- Attached image is displayed in the note card; can be removed with the X button
- When "Ask Claude" is triggered on a note with an image, the server fetches the image and sends it to Claude as a vision content block
- AI Chat (AIChatNode) supports per-message image attachments (paperclip button)
- Images are uploaded to Replit Object Storage (GCS) via presigned PUT URLs
- Frontend uses `use-image-upload.ts` hook: gets presigned URL from `/api/storage/uploads/request-url`, PUTs file directly to GCS
- Images are served via `/api/storage/objects/*` — no auth required (UUID paths)
- Image history is stored in `chatHistory` JSON with `imageUrl` field per message entry

## Development

- `pnpm run typecheck` — runs full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes

## Environment Variables

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (auto-provisioned)
- `CLERK_SECRET_KEY` — Clerk secret key (auto-provisioned)
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` / `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Replit Anthropic integration
- `DATABASE_URL` — PostgreSQL connection string
