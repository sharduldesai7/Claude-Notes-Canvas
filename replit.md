# Synaptica

## Overview

Synaptica is a mind-map style note-taking web app with an infinite canvas, AI integration via Claude (triggered by `/claude` in notes), visual arrow connections between notes, and a sidebar for managing multiple "Thought Maps" (canvases). Users log in with Google via Clerk auth, notes have user-selectable colors, all notes auto-connect when created, and users can configure their own LLM model in profile settings.

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

- **Landing page**: `/` — "Think Freely" landing with Get Started / Sign In
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
- **nodes** — note cards on a canvas (id, mapId, content, positionX, positionY, width, height, color, claudeResponse, isProcessing, createdAt, updatedAt)
- **connections** — arrows linking nodes (id, mapId, fromNodeId, toNodeId, createdAt)
- **user_settings** — per-user AI preferences (userId, preferredModel, customApiKey, customBaseUrl, updatedAt)

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
- `POST /api/thought-maps/:mapId/nodes/:nodeId/ask-claude` — SSE streaming Claude response
- `GET /api/user/settings` — get user AI settings
- `PUT /api/user/settings` — update user AI settings

## Key Frontend Components

- `Canvas.tsx` — infinite pan/zoom canvas, double-click to create nodes, SVG bezier arrow connections
- `NodeCard.tsx` — draggable note card with color picker (8 colors), /claude trigger, streaming AI response
- `MapSidebar.tsx` — left panel with map list, user profile footer, settings/logout buttons
- `SettingsPage.tsx` — AI model selection (Sonnet/Opus/Haiku/Custom), custom API key support

## Development

- `pnpm run typecheck` — runs full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes

## Environment Variables

- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (auto-provisioned)
- `CLERK_SECRET_KEY` — Clerk secret key (auto-provisioned)
- `AI_INTEGRATIONS_ANTHROPIC_API_KEY` / `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` — Replit Anthropic integration
- `DATABASE_URL` — PostgreSQL connection string
