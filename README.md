# Notion Agent

[![CI](https://github.com/devpilotX/Notion-Agent/actions/workflows/ci.yml/badge.svg)](https://github.com/devpilotX/Notion-Agent/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-2ea44f.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%2B-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![Next.js](https://img.shields.io/badge/Next.js-15-000000.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e.svg?logo=nestjs&logoColor=white)](https://nestjs.com)

A self-hosted AI agent workbench with a calm, jungle-themed interface. Build one
agent, give it your own provider keys, connect tools over the Model Context
Protocol (MCP), ground it in your own documents, and chat with it while you watch
each step it takes. Notion is one of the MCP presets, alongside GitHub, Slack,
Google Drive, Linear, Sentry, and more.

The product is two parts that talk over HTTP and Server-Sent Events:

- A Next.js frontend (the **Verdant** design system): a three-pane workspace with
  a sessions sidebar, a chat thread in the center, and a settings panel on the right.
- A NestJS engine: provider keys, model routing, the streaming run loop, tools,
  retrieval, triggers, and MCP connections, backed by PostgreSQL.

> **Single-user, self-hosted.** This build runs in a single local-user mode with no
> login. Add authentication before exposing the engine on a network. See
> [Security](#security).

---

## Table of contents

- [Features](#features)
- [Architecture](#architecture)
  - [Tech stack](#tech-stack)
  - [Request lifecycle](#request-lifecycle)
  - [Data model](#data-model)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Install](#1-install)
  - [2. Configure environment](#2-configure-environment)
  - [3. Create the database and tables](#3-create-the-database-and-tables)
  - [4. Run](#4-run)
  - [One-command supporting stack (optional)](#one-command-supporting-stack-optional)
- [Using the agent](#using-the-agent)
- [API reference](#api-reference)
  - [Conventions](#conventions)
  - [Health](#health)
  - [Agents](#agents)
  - [Keys](#keys)
  - [Models](#models)
  - [Sessions](#sessions)
  - [Documents (retrieval)](#documents-retrieval)
  - [Connections (MCP)](#connections-mcp)
  - [Triggers](#triggers)
  - [Usage](#usage)
  - [Streaming protocol (SSE)](#streaming-protocol-sse)
- [Development](#development)
  - [Scripts](#scripts)
  - [Testing](#testing)
  - [Verification scripts](#verification-scripts)
- [Configuration reference](#configuration-reference)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Bring your own keys.** OpenAI, Anthropic, Google, Groq, Mistral, OpenRouter,
  xAI Grok, DeepSeek, Cohere, Together AI, and local Ollama. Keys are encrypted at
  rest with AES-256-GCM. Paste a key with no provider selected and it auto-detects
  the provider from the key shape, then confirms by listing the provider's models.
- **Live model lists.** Models come from each provider's own API, never hardcoded.
  OpenRouter's full catalog is available, with free models surfaced first.
- **Cost-safe Auto.** The Auto setting prefers a free model when one is available
  (local Ollama, Groq, an OpenRouter `:free` model), and otherwise picks the
  lowest-cost option. The resolved model is shown in the settings panel.
- **Streaming chat with a step trace.** Replies stream token by token over SSE,
  with a live trace of each step: choosing a model, reading your documents,
  calling a tool, and responding.
- **Tool-calling loop.** Built-in web search and web fetch, gated by a Web access
  toggle and a Trusted URLs allowlist, with an Allow every URL override. Private
  and loopback addresses are always blocked.
- **Retrieval over your files.** Upload files or whole folders (text, Markdown,
  CSV, JSON, code, PDF, and zips). Text is extracted, chunked, embedded, and used
  to ground answers with source citations.
- **Real MCP connections.** Add a Model Context Protocol server over a local
  command or a remote URL, with None, Bearer, Basic, or API-key auth. Presets for
  GitHub, Notion, Slack, Figma, Linear, Sentry, Google Drive, Gmail, Google
  Calendar, and Filesystem. Connection secrets are encrypted at rest and never
  returned by the API.
- **Triggers.** Save scheduled, webhook, email, and file triggers to the database.
  Background scheduling runs on BullMQ when Redis is available; without Redis the
  triggers persist and can be fired manually.
- **Self-writing instructions.** Describe the agent in chat and it drafts its own
  system instructions into the settings field. You review and click Save.
- **Voice.** Microphone capture with live transcription that appends to the
  composer, plus text-to-speech playback of replies, using the browser Web Speech
  API. Recording runs until you stop it or a ten minute cap.
- **Light and deep-canopy dark themes**, a custom hand-drawn SVG icon set, and
  organic motion that respects reduced-motion settings.

---

## Architecture

```
Browser ── HTTP + SSE ──> NestJS engine ──> PostgreSQL
                              │
                              ├─ provider APIs (OpenAI, Groq, Google, ...)
                              ├─ MCP servers (stdio or HTTP)
                              └─ Redis (optional, for trigger scheduling)
```

- The frontend reads live data from the engine and falls back to static fixtures
  only when the engine is unreachable, so the UI always renders. When
  `NEXT_PUBLIC_API_URL` is unset, the client runs entirely on fixtures.
- The engine streams run events to the UI using a shared SSE contract
  (`lib/streaming-contract.ts` on the client, `server/src/streaming/contract.ts`
  on the server). Keep the two copies in sync.
- Secrets (provider keys and MCP auth) are encrypted with a master key that lives
  only in the environment, never in the database.

### Tech stack

| Layer | Choices |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, TanStack Query |
| Engine | NestJS 11, Vercel AI SDK (`ai` v7 + `@ai-sdk/*`), Drizzle ORM, postgres.js, BullMQ + ioredis, Zod |
| Data | PostgreSQL (pgvector optional; a JS cosine fallback is used when it is absent) |
| Protocols | Server-Sent Events for streaming, Model Context Protocol (`@modelcontextprotocol/sdk`) for tools |
| Parsing | `pdf-parse` for PDFs, `adm-zip` for archive uploads |

### Request lifecycle

A chat turn flows like this:

1. The UI `POST`s to `/agents/:id/run` with the user message (and an optional
   `sessionId` and `model`).
2. The engine resolves a model (honoring Auto or a manual pick), loads the agent
   config, recent messages, and any retrieved document chunks.
3. It runs the Vercel AI SDK loop: stream tokens, optionally call tools (web
   search/fetch and any connected MCP tools), feed results back, repeat up to the
   agent's `maxSteps`.
4. Each phase is emitted as an SSE event (`run.start`, `step.start`,
   `message.delta`, `tool.call`, `tool.result`, `step.end`, `usage`, `run.done`).
5. The final message, token counts, and cost are persisted, and the stream closes.

### Data model

The schema is defined with Drizzle in `server/src/db/schema.ts`. All primary keys
are UUIDs and most rows are scoped to an agent (and through it, a user). Embedding
columns are `vector(768)` (Google `text-embedding-004`); when pgvector is absent
the migration stores them as `real[]` and similarity is computed in Node.

| Table | Purpose | Notable columns |
| --- | --- | --- |
| `users` | Local user record | `email` (unique), `name`, `password_hash` |
| `api_keys` | Encrypted provider keys | `provider`, `label`, `secret_encrypted`, `base_url`, `status` |
| `agents` | The agent config | `name`, `instructions`, `model_mode` (auto/manual), `model_id`, `max_steps`, `settings_json`, `favorite` |
| `agent_versions` | Saved config snapshots | `config_json` |
| `triggers` | Saved triggers | `type`, `config_json`, `enabled` |
| `connections` | MCP / HTTP connections | `kind` (mcp/http/builtin), `config_json`, `status` |
| `tools` | Per-agent tool toggles | `name`, `enabled`, `config_json` |
| `sessions` | Chat sessions | `title`, `agent_id`, `user_id` |
| `messages` | Chat messages | `role`, `content`, `steps_json`, `tokens`, `cost` |
| `runs` | Run records (incl. triggered) | `status`, `steps_json`, `tokens`, `cost`, `duration_ms` |
| `memories` | Long-term agent memory | `content`, `embedding` (vector 768, HNSW cosine) |
| `documents` | Retrieval chunks | `source`, `chunk`, `embedding` (vector 768, HNSW cosine) |
| `sandboxes` | Reserved for code execution | `container_id`, `status`, `workspace_path` |

---

## Project structure

```
app/                     Next.js routes, global styles, layout
components/
  left/                  sessions sidebar + center chat (header, thread, composer)
  right/                  settings panel: triggers, instructions, tools, keys, advanced, help
  chat/                  shared chat context
  ui/                    buttons, inputs, modal, select, toggle, tooltip, toast, status
  motion/ theme/         ambient background, reveal, vine divider, theme provider
  icons.tsx              custom SVG icon set + provider marks
  brand-logos.tsx        official brand marks for the MCP presets
lib/
  api/                   typed API client and hooks (agent, keys, models, sessions, triggers, documents, connections, usage, run)
  use-voice.ts           speech-to-text and text-to-speech hooks
  mcp-presets.ts         MCP server presets
  streaming-contract.ts  client copy of the SSE event contract
  fixtures.ts            offline fallback data
server/
  src/
    agents/ runtime/     agent config, the run loop, model resolver, web tools
    keys/ models/        provider keys, validation, auto-detect, live model lists
    rag/ connections/    document retrieval, MCP client
    triggers/ usage/     triggers + scheduler, usage rollups
    sessions/ crypto/ db/  sessions, AES-256-GCM, Drizzle schema and connection
    streaming/           the shared SSE event contract
  scripts/               database migration and verification scripts
docker-compose.yml       redis + ollama + litellm + api for a one-command stack
```

---

## Getting started

### Prerequisites

- Node.js 20 or newer
- A PostgreSQL instance you can reach
- Optional: Redis (for background trigger scheduling), Ollama (for free local
  models), Docker (for the bundled stack)

### 1. Install

```bash
npm install            # frontend, in the repo root
cd server && npm install && cd ..
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in `.env`. See the [Configuration reference](#configuration-reference) for
every variable. The minimum to get running locally is a Postgres connection, a
`MASTER_ENCRYPTION_KEY`, and `NEXT_PUBLIC_API_URL`.

Never commit `.env`. It is gitignored.

### 3. Create the database and tables

```sql
CREATE DATABASE verdant;
```

Then run the idempotent migration, which creates every table and enables pgvector
if it is installed:

```bash
node --env-file=.env server/scripts/migrate.mjs
```

pgvector is optional. If the extension is not installed, the migration stores
embeddings in a `real[]` column and retrieval uses a cosine similarity computed in
Node. To switch to native vector indexes later, install pgvector, run
`CREATE EXTENSION vector;` in the database, and run the migration again.

> Drizzle Kit is also wired up if you prefer it: `npm run db:generate`,
> `npm run db:migrate`, and `npm run db:push` in `server/` (see
> `server/drizzle.config.ts`). The `migrate.mjs` script is the simplest path for a
> first run.

### 4. Run

In one terminal, the engine:

```bash
cd server
npm run start:dev        # http://localhost:4000/health
```

In another, the frontend:

```bash
npm run dev              # http://localhost:3000
```

Open `http://localhost:3000`, add a provider key in the Keys card (Groq and
OpenRouter both offer free models), and start chatting.

### One-command supporting stack (optional)

```bash
docker compose up        # redis + ollama + litellm + api
```

Postgres is intentionally not in the compose file; it uses your existing instance.
When the engine runs in Docker, point the database host at `host.docker.internal`.

---

## Using the agent

- **Keys.** Add a provider key, or paste any key and let it auto-detect. A Kiro
  key (prefix `ksk_`) is detected and rejected, since it cannot power models here.
- **Model.** Leave it on Auto for a cost-safe pick, or choose a specific model.
  The choice persists and is used by the next run.
- **Web access and Trusted URLs.** Turn on Web access to let the agent search and
  fetch. Add hosts to Trusted URLs, or turn on Allow every URL. Fetches to private
  or loopback addresses are always blocked.
- **Documents.** Attach files or a folder in the composer. They are indexed and
  used to ground future answers, with source citations.
- **Connections.** Open Add connection, pick a preset or set up your own MCP
  server, connect, and its tools become available to runs.
- **Triggers.** Add scheduled, webhook, email, or file triggers. With Redis they
  run in the background; without it they persist and can be fired manually.
- **Voice.** Use the mic to dictate into the composer, and Play to hear a reply.

---

## API reference

The engine is a REST + SSE API served by NestJS. There is **no global path
prefix**: routes live at the root (for example `GET /health`). The frontend reaches
it at `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`).

### Conventions

- Request and response bodies are JSON, except document upload, which is
  `multipart/form-data`.
- Input is validated with Zod; invalid bodies return `400` with an array of
  messages.
- CORS is restricted to `CORS_ORIGINS` (any `localhost`/`127.0.0.1` port is also
  allowed in development). Requests are made with credentials included.
- Secrets (provider keys, MCP auth) are always masked in responses and never
  returned in full.

All paths below are relative to the engine base URL.

### Health

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness probe. Returns `{ status, service, time }`. |

### Agents

The app is single-agent by default; `GET /agents/current` creates the default
agent on first use.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/agents/current` | Get (or lazily create) the current agent. |
| `GET` | `/agents/:id/export` | Export an agent config as JSON. |
| `PATCH` | `/agents/:id` | Update fields: `name`, `instructions`, `modelMode` (`auto`\|`manual`), `modelId`, `favorite`. |
| `POST` | `/agents/:id/save` | Save the full config: `name`, `description?`, `instructions?`, `modelMode`, `modelId?`, `settings`. |
| `POST` | `/agents/:id/duplicate` | Duplicate the agent. |
| `POST` | `/agents/:id/draft-instructions` | Draft system instructions from `{ description }` (3–2000 chars). |
| `POST` | `/agents/:id/reset` | Reset the agent to defaults. |
| `DELETE` | `/agents/:id` | Delete the agent. |
| `POST` | `/agents/:id/run` | **SSE.** Run a turn. Body `{ message, sessionId?, model? }`. See [Streaming protocol](#streaming-protocol-sse). |

The `settings` object on save is:

```jsonc
{
  "triggers":   { "run": true, "newChat": false, "mention": true },
  "webAccess":  true,
  "trustedUrls": ["example.com"],
  "allowAllUrls": false
}
```

### Keys

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/keys` | List stored keys (secrets masked). |
| `POST` | `/keys` | Add a key: `{ provider, label, secret, baseUrl? }`. |
| `POST` | `/keys/detect` | Auto-detect the provider from `{ secret }`. |
| `POST` | `/keys/:id/validate` | Validate a key by listing the provider's models. |
| `POST` | `/keys/:id/rotate` | Replace the secret: `{ secret }`. |
| `DELETE` | `/keys/:id` | Remove a key. |

`provider` is one of `openai`, `anthropic`, `mistral`, `google`, `groq`,
`openrouter`, `xai`, `deepseek`, `cohere`, `together`. (Ollama is local and needs
no key.)

### Models

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/models` | Live model list, aggregated from configured providers. |
| `GET` | `/models/auto` | The model the Auto setting would currently resolve to. |

### Sessions

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/sessions` | List chat sessions. |
| `POST` | `/sessions` | Create a new session. |
| `GET` | `/sessions/:id/messages` | List messages for a session. |

### Documents (retrieval)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/documents` | List indexed sources. |
| `POST` | `/documents/upload` | `multipart/form-data`, field `files` (up to 20). Extracts, chunks, and embeds. |
| `DELETE` | `/documents/:source` | Remove a source and its chunks (`source` is URL-encoded). |

### Connections (MCP)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/connections` | List connections (secrets masked). |
| `POST` | `/connections` | Create a connection (see body below). |
| `POST` | `/connections/:id/test` | Connect and list the server's tools. |
| `DELETE` | `/connections/:id` | Remove a connection. |

Create body (validated with Zod):

```jsonc
{
  "name": "My server",
  "transport": "http",            // or "stdio"
  "command": "npx",                // stdio: the command to run
  "args": ["-y", "server-name"],   // stdio: arguments
  "env": { "TOKEN": "..." },       // stdio: environment
  "url": "https://example.com/mcp",// http: the endpoint
  "auth": { "type": "bearer", "token": "..." }, // none | bearer | basic | apikey
  "headers": { "X-Extra": "1" },
  "timeoutMs": 30000
}
```

Presets (in `lib/mcp-presets.ts`) prefill this form for GitHub, Notion, Google
Drive, Gmail, Google Calendar, Slack, Figma, Linear, Sentry, Filesystem, and a
blank Custom option.

### Triggers

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/triggers` | List triggers. |
| `POST` | `/triggers` | Create: `{ type, config }`. |
| `PATCH` | `/triggers/:id` | Update: `{ enabled?, config? }`. |
| `DELETE` | `/triggers/:id` | Remove a trigger. |
| `POST` | `/triggers/:id/fire` | Fire a trigger now: `{ message? }`. |
| `POST` | `/triggers/webhook/:token` | Inbound webhook; fire by token: `{ message? }`. |

`type` is one of `scheduled`, `webhook`, `email`, `file`, `manual`, `mention`.
`config` accepts `cron`, `intervalSec`, `path`, `token`, `address`, and `message`
depending on the type.

### Usage

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/usage` | Token and cost rollups. |

### Streaming protocol (SSE)

`POST /agents/:id/run` responds with `text/event-stream`. Each frame is
`data: <json>\n\n`, where the JSON is one of these events (defined in
`server/src/streaming/contract.ts`):

| Event | Shape | Meaning |
| --- | --- | --- |
| `run.start` | `{ runId, sessionId? }` | The run started. |
| `step.start` | `{ stepId, label }` | A step began (e.g. "Choosing a model"). |
| `message.delta` | `{ text }` | A chunk of the assistant's reply. |
| `tool.call` | `{ name, args }` | The model invoked a tool. |
| `tool.result` | `{ name, summary }` | A tool returned. |
| `step.end` | `{ stepId }` | A step finished. |
| `usage` | `{ tokens, cost }` | Token and cost accounting. |
| `run.done` | `{ runId, status }` | The run finished (`ok` \| `error` \| `cancelled`). |
| `error` | `{ message }` | A run-level error. |

Example with `curl`:

```bash
curl -N -X POST http://localhost:4000/agents/AGENT_ID/run \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}'
```

---

## Development

### Scripts

Frontend (repo root, package `verdant-agentforge`):

```bash
npm run dev          # Next dev server (http://localhost:3000)
npm run build        # production build
npm run start        # serve the production build
npm run typecheck    # tsc --noEmit
```

Engine (`server/`, package `verdant-engine`):

```bash
npm run start:dev    # Nest in watch mode
npm run start        # Nest (no watch)
npm run start:prod   # node dist/main.js (after build)
npm run build        # nest build
npm run typecheck    # tsc --noEmit
npm run test         # node --test over src/**/*.spec.ts (via tsx)
npm run db:generate  # drizzle-kit generate
npm run db:migrate   # drizzle-kit migrate
npm run db:push      # drizzle-kit push
```

### Testing

Unit tests run on the Node test runner through `tsx`:

```bash
cd server
npm run test
```

For example, `src/crypto/crypto.service.spec.ts` covers the AES-256-GCM
encrypt/decrypt round trip. Add `*.spec.ts` files alongside the code they test.

### Verification scripts

`server/scripts` holds end-to-end checks that exercise the running engine against
a real database. They read the root `.env`:

```bash
node --env-file=.env server/scripts/migrate.mjs          # create or update tables
node --env-file=.env server/scripts/audit-db.mjs         # list tables and row counts
node --env-file=.env server/scripts/verify-audit.mjs     # hello, a tool run, an OpenRouter free run
node --env-file=.env server/scripts/verify-rag.mjs       # upload, retrieve, grounded reply
node --env-file=.env server/scripts/verify-mcp.mjs       # connect an MCP server and call a tool
```

Alongside these are focused checks for providers, sessions, triggers, usage, the
URL guard, and MCP over stdio/HTTP/filesystem (`verify-providers.mjs`,
`verify-sessions.mjs`, `verify-triggers.mjs`, `verify-usage.mjs`,
`verify-urlguard.mjs`, `verify-mcp-http.mjs`, `verify-mcp-filesystem.mjs`, and
more). There are also two tiny demo MCP servers (`mcp-demo-server.mjs` for stdio
and `mcp-demo-http-server.mjs` for HTTP) used by the MCP checks.

---

## Configuration reference

All variables live in `.env` at the repo root (the engine reads it with
`--env-file`, and Next reads `NEXT_PUBLIC_*`). Copy `.env.example` to start.

| Variable | Required | Default | What it is |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Yes (frontend) | — | Where the frontend reaches the engine, e.g. `http://localhost:4000`. If unset, the UI uses offline fixtures. |
| `PGHOST` | Yes* | `localhost` | Postgres host. |
| `PGPORT` | Yes* | `5432` | Postgres port. |
| `PGUSER` | Yes* | `postgres` | Postgres user. |
| `PGPASSWORD` | Yes* | — | Postgres password. |
| `PGDATABASE` | Yes* | `verdant` | Postgres database name. |
| `DATABASE_URL` | Alt | — | Single connection string; use instead of the `PG*` vars (URL-encode special characters). |
| `MASTER_ENCRYPTION_KEY` | Yes | — | 32-byte key for AES-256-GCM secret encryption. Generate with `openssl rand -base64 32`. |
| `AUTH_SECRET` | Recommended | — | Session/auth signing secret. Generate with `openssl rand -hex 32`. |
| `REDIS_URL` | Optional | — | When reachable, triggers schedule on BullMQ. |
| `LITELLM_BASE_URL` | Optional | `http://localhost:4001` | Model gateway, used by the bundled Docker stack. |
| `OLLAMA_BASE_URL` | Optional | `http://localhost:11434` | Local Ollama server for free local models. |
| `API_PORT` | Optional | `4000` | Engine listen port. |
| `CORS_ORIGINS` | Optional | `http://localhost:3000` | Comma-separated origins allowed to call the engine. |

\* Provide either the discrete `PG*` variables **or** a single `DATABASE_URL`.

---

## Security

- Provider keys and MCP auth tokens are encrypted at rest with AES-256-GCM. The
  master key lives only in `MASTER_ENCRYPTION_KEY`, never in the database. Secrets
  are masked in every API response and are never logged.
- The web fetch tool blocks loopback and private network addresses even when Allow
  every URL is on.
- CORS is restricted to `CORS_ORIGINS` in production (localhost ports are allowed
  in development for convenience).
- `.env` and `.kiro/` are gitignored so local secrets stay out of the repository.
- **No authentication ships in this build.** It runs in a single local-user mode.
  Add authentication and lock down `CORS_ORIGINS` before exposing the engine on a
  network or the public internet.

---

## Troubleshooting

- **The UI shows data but nothing saves / "API base URL is not configured".** Set
  `NEXT_PUBLIC_API_URL` and restart `npm run dev`. Without it, the frontend runs on
  offline fixtures.
- **Requests are blocked by CORS.** Add your frontend origin to `CORS_ORIGINS` and
  restart the engine. In development any `localhost`/`127.0.0.1` port is allowed.
- **`relation "..." does not exist` or vector errors.** Run the migration:
  `node --env-file=.env server/scripts/migrate.mjs`. For native vector indexes,
  install pgvector and `CREATE EXTENSION vector;`, then migrate again. Without
  pgvector the cosine fallback works automatically.
- **Triggers never fire on their own.** Background scheduling needs Redis. Set
  `REDIS_URL`; without it, triggers persist but only fire when you fire them
  manually (or via the webhook endpoint).
- **A key is rejected on add.** Keys are validated against the provider's API. A
  Kiro key (prefix `ksk_`) is intentionally rejected. Use `POST /keys/detect` to
  confirm how a key is being classified.
- **A small model answers math instead of calling a tool.** Expected: weaker
  models sometimes self-answer. With a large MCP server connected, the tool set is
  capped and balanced across servers to keep requests lean.
- **Voice does nothing.** It uses the browser Web Speech API; support varies by
  browser. Recording stops on its own at a ten minute cap.

---

## FAQ

- **Is pgvector required?** No. It is used when present; otherwise embeddings are
  stored in a `real[]` column and similarity is computed in Node.
- **Do I need Redis?** Only for background trigger scheduling. Everything else
  works without it.
- **Where are my keys stored?** Encrypted (AES-256-GCM) in the `api_keys` table.
  The master key never leaves the environment.
- **Can I use local models for free?** Yes. Run Ollama and set `OLLAMA_BASE_URL`,
  or use a provider with a free tier (Groq, OpenRouter `:free` models). Auto
  prefers free options.
- **Multiple agents?** The app is built around one primary agent with a
  duplicate/save/reset workflow; the schema is multi-agent ready.

---

## Contributing

1. Fork and create a feature branch.
2. Install both workspaces (`npm install` in the root and in `server/`).
3. Make your change. Keep the SSE contract in sync across
   `lib/streaming-contract.ts` and `server/src/streaming/contract.ts`.
4. Run `npm run typecheck` in both workspaces and `npm run test` in `server/`.
5. Keep secrets out of commits (`.env` is gitignored) and use the existing code
   style.
6. Open a pull request describing the change and how you verified it. CI runs
   install, type check, and build on each PR.

---

## License

Released under the MIT License. See [LICENSE](LICENSE).
