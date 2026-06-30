# Notion Agent

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
  only when the engine is unreachable, so the UI always renders.
- The engine streams run events to the UI using a shared SSE contract
  (`lib/streaming-contract.ts` on the client, `server/src/streaming/contract.ts`
  on the server).
- Secrets (provider keys and MCP auth) are encrypted with a master key that lives
  only in the environment, never in the database.

### Tech stack

| Layer | Choices |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, TanStack Query |
| Engine | NestJS 11, Vercel AI SDK, Drizzle ORM, postgres.js, BullMQ + ioredis, Zod |
| Data | PostgreSQL (pgvector optional; a JS cosine fallback is used when it is absent) |
| Protocols | Server-Sent Events for streaming, Model Context Protocol for tools |

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
  fixtures.ts            offline fallback data
server/
  src/
    agents/ runtime/     agent config, the run loop, model resolver, web tools
    keys/ models/        provider keys, validation, auto-detect, live model lists
    rag/ connections/    document retrieval, MCP client
    triggers/ usage/     triggers + scheduler, usage rollups
    sessions/ crypto/ db/  sessions, AES-256-GCM, Drizzle schema and connection
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

Fill in `.env`. The important values:

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Where the frontend reaches the engine, for example `http://localhost:4000` |
| `PGHOST` `PGPORT` `PGUSER` `PGPASSWORD` `PGDATABASE` | Postgres connection (or use `DATABASE_URL`) |
| `MASTER_ENCRYPTION_KEY` | 32-byte key for encrypting secrets. Generate with `openssl rand -base64 32` |
| `AUTH_SECRET` | Session signing secret. Generate with `openssl rand -hex 32` |
| `REDIS_URL` | Optional. When reachable, triggers schedule on BullMQ |
| `OLLAMA_BASE_URL` | Optional. Local model server, default `http://localhost:11434` |
| `API_PORT` | Engine port, default `4000` |
| `CORS_ORIGINS` | Comma-separated origins allowed to call the engine |

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

## Security

- Provider keys and MCP auth tokens are encrypted at rest with AES-256-GCM. The
  master key lives only in `MASTER_ENCRYPTION_KEY`, never in the database. Secrets
  are masked in every API response and are never logged.
- The web fetch tool blocks loopback and private network addresses even when Allow
  every URL is on.
- `.env` and `.kiro/` are gitignored so local secrets stay out of the repository.
- This build runs in a single local-user mode. Add authentication before exposing
  the engine on a network.

---

## Scripts

Engine scripts live in `server/scripts` and read the root `.env`:

```bash
node --env-file=.env server/scripts/migrate.mjs          # create or update tables
node --env-file=.env server/scripts/audit-db.mjs         # list tables and row counts
node --env-file=.env server/scripts/verify-audit.mjs     # hello, a tool run, an OpenRouter free run
node --env-file=.env server/scripts/verify-rag.mjs        # upload, retrieve, grounded reply
node --env-file=.env server/scripts/verify-mcp.mjs        # connect an MCP server and call a tool
```

Build and type-check:

```bash
npm run build            # frontend
npm run typecheck        # frontend
cd server && npm run build   # engine
```

---

## Notes and limits

- pgvector is optional; the cosine fallback works without it.
- Trigger scheduling needs Redis; without it triggers persist but stay inactive
  until fired manually.
- With a very large MCP server connected (for example GitHub exposes 40+ tools),
  the tool set is capped and balanced across servers so requests stay lean. A
  smaller, weaker model may answer simple math itself rather than calling a tool.
- Voice uses the browser Web Speech API, so it depends on the browser's support.

---

## License

Released under the MIT License. See [LICENSE](LICENSE).
