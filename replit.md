# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Anthropic Claude via Replit AI Integrations

## Artifacts

### Thought Maps (artifacts/thought-maps)
The primary React + Vite web application. A mind-map style note-taking app that integrates Claude AI.

- **Features**: Infinite canvas, draggable note cards (nodes), dashed arrow connections between nodes, sidebar for managing multiple Thought Maps
- **Claude Integration**: Type `/claude` in any note to trigger Claude. Claude reads the note content and streams a response inline
- **Backend**: Express API at `/api/thought-maps`

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

- **thought_maps** — canvas pages (id, title, createdAt, updatedAt)
- **nodes** — note cards on a canvas (id, mapId, content, positionX, positionY, width, height, claudeResponse, isProcessing, createdAt, updatedAt)
- **connections** — arrows linking nodes (id, mapId, fromNodeId, toNodeId, createdAt)

## API Routes

- `GET /api/thought-maps` — list all maps
- `POST /api/thought-maps` — create map
- `GET /api/thought-maps/:id` — get full map (with nodes + connections)
- `PATCH /api/thought-maps/:id` — update map
- `DELETE /api/thought-maps/:id` — delete map
- `GET/POST /api/thought-maps/:mapId/nodes` — list/create nodes
- `PATCH/DELETE /api/thought-maps/:mapId/nodes/:nodeId` — update/delete node
- `GET/POST /api/thought-maps/:mapId/connections` — list/create connections
- `DELETE /api/thought-maps/:mapId/connections/:connectionId` — delete connection
- `POST /api/thought-maps/:mapId/nodes/:nodeId/ask-claude` — SSE streaming Claude response

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Development

- `pnpm run typecheck` — runs full typecheck
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
