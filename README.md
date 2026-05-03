# Tree-Nation — Visit Tracker

[![CI](https://github.com/CristianMingorance07/tree-visits-service/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/CristianMingorance07/tree-visits-service/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x_strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org)
[![Fastify](https://img.shields.io/badge/Fastify-5.x-000000?logo=fastify&logoColor=white)](https://fastify.dev)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](./docker-compose.yml)
[![Railway](https://img.shields.io/badge/Railway-deployed-7B2FBE?logo=railway&logoColor=white)](https://tree-visits-service-production.up.railway.app)

Every N visits from a customer device plants a tree. This service tracks those visits, counts the milestones, and shows everything in a real-time dashboard. Built as a technical assessment for Tree-Nation's migration to Vue 3 + TypeScript.

**[→ Live demo](https://tree-visits-service-production.up.railway.app)**

---

## Table of contents

- [Reviewer access](#reviewer-access)
- [What it does](#what-it-does)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Running it locally](#running-it-locally)
- [Tests](#tests)
- [API reference](#api-reference)
- [Environment variables](#environment-variables)
- [Project structure](#project-structure)
- [Contributing](#contributing)
- [Design decisions](#design-decisions)

---

## Reviewer access

> Credentials are included here only because this is a technical assessment. In any real project, secrets belong in the platform's environment variable manager — never in a repository.

| | |
|---|---|
| **Live dashboard** | https://tree-visits-service-production.up.railway.app |
| **Admin secret (production)** | `tree-nation-admin-2026` |
| **Admin secret (local Docker)** | `local-dev-admin-secret` |
| **Swagger UI (local dev only)** | http://localhost:3000/docs |

The admin secret unlocks the **Reset data** button on the dashboard (wipes all visits and reloads the demo seed) and the `PATCH /api/v1/config` endpoint for changing the threshold at runtime.

---

## What it does

A physical store device (POS terminal, kiosk, tablet) sends a `POST` to the API each time a customer visits. The service increments that customer's visit counter inside an atomic SQLite transaction. When the counter hits the threshold — default is 10 — `trees_planted` is incremented in the same transaction. No double-planting is possible under concurrent load because the check and the increment are a single write.

The dashboard has two tabs:

**Demo** — a set of simulated store devices with a built-in EventSimulator. Fire visits individually or in bursts, watch the chart update, and see which devices are closest to their next tree. Demo data is seeded on startup and can be reset from the UI without touching live data.

**Live** — real visits coming in through the public tracking link, the same URL shown as a QR code in the Track page. Each visit is enriched asynchronously with geo data (country, city) and browser/OS fingerprint. The enrichment happens after the response is sent, so it never adds latency to the tracked page load.

---

## Architecture

```
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                        INCOMING TRAFFIC                          ║
  ╠════════════════════════╦══════════════════════════════════════════╣
  ║  📱 Store device / POS ║  🌐 Browser · QR code scan              ║
  ║  POST /api/v1/visits   ║  GET /api/v1/visits/track/:customerId   ║
  ║  (programmatic)        ║  (public link — no auth required)       ║
  ╚═══════════╤════════════╩═══════════════╤══════════════════════════╝
              │                            │
              │   ┌─── LOCAL ONLY ───────┐ │
              │   │  nginx :80 · Alpine  │ │
              │   │  SPA + /api/* proxy  │ │
              │   └──────────┬───────────┘ │
              └──────────────▼─────────────┘
                             │
  ╔══════════════════════════▼════════════════════════════════════════╗
  ║             FASTIFY 5 · NODE 20 · TYPESCRIPT STRICT              ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║  ┌─────────────────────────────────────────────────────────────┐ ║
  ║  │                    Anti-bot pipeline                        │ ║
  ║  │  1 · ID format check  →  2 · Honeypot keywords             │ ║
  ║  │  3 · Known bot UA     →  4 · Rapid-fire sliding window     │ ║
  ║  └─────────────────────────────────────────────────────────────┘ ║
  ║                                                                   ║
  ║  JSON Schema validation on every route                            ║
  ║  Per-route rate limits (writes only) · Security headers           ║
  ║  Swagger UI at /docs (dev only) · Graceful SIGTERM shutdown       ║
  ╚═══════════════════════════╤═══════════════════════════════════════╝
                              │  db.transaction() — atomic milestone check
                              ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║              SQLite · WAL mode · better-sqlite3                  ║
  ╠══════════════════╦═════════════════════╦═════════════════════════╣
  ║    customers     ║       visits        ║      app_config         ║
  ║  id              ║  id · customer_id   ║  visits_per_tree        ║
  ║  total_visits    ║  visited_at         ║  (hot-reload via PATCH) ║
  ║  trees_planted   ║  user_agent · ip    ║                         ║
  ║  last_seen       ║  country · city     ║                         ║
  ╚══════════════════╩══════════╤══════════╩═════════════════════════╝
                                │  setImmediate — after response is sent
                                ▼
               ┌────────────────────────────┐
               │        ip-api.com          │
               │  Async geo enrichment      │
               │  country · city · language │
               │  Skipped for private IPs   │
               └────────────────────────────┘

  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
  📊  Vue 3 dashboard polls 6 endpoints in parallel every 10 s
      No WebSocket state · works through any proxy · auto-cleanup
  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
```

The dashboard polls six endpoints every 10 seconds. WebSockets would feel snappier but would add server-side connection state, sticky-session requirements, and proxy configuration overhead. For a dashboard where the meaningful metric is visits-per-hour, 10-second polling is indistinguishable from real-time and significantly simpler to operate.

---

## Tech stack

| Layer | Technology |
|---|---|
| **API framework** | [Fastify 5](https://fastify.dev) + TypeScript strict |
| **Runtime** | [Node.js 20 LTS](https://nodejs.org) |
| **Database** | [SQLite](https://sqlite.org) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (WAL mode) |
| **Frontend** | [Vue 3](https://vuejs.org) Composition API · [Vite](https://vite.dev) · [Tailwind CSS 3](https://tailwindcss.com) |
| **Charts** | [Chart.js 4](https://www.chartjs.org) |
| **Tests** | [Vitest 3](https://vitest.dev) · SQLite `:memory:` |
| **Containers** | Docker multi-stage · nginx:alpine |
| **CI** | [GitHub Actions](./.github/workflows/ci.yml) |
| **Hosting** | [Railway](https://railway.app) |

---

## Running it locally

### Option A — Docker (recommended, zero setup)

```bash
docker compose up --build
```

| | URL |
|---|---|
| Dashboard | http://localhost |
| API | http://localhost:3000 |

The compose file uses `local-dev-admin-secret` as the default `ADMIN_SECRET`. If port 80 is already in use, change `"80:80"` to `"8080:80"` in `docker-compose.yml`.

### Option B — Local dev (hot reload)

`better-sqlite3` ships prebuilt binaries only for Node 20. Make sure you're on the right version:

```bash
nvm install 20 && nvm use 20
```

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npm run dev        # tsx watch — restarts on save
```

**Frontend** (new terminal):
```bash
cd frontend
cp .env.example .env
npm install
npm run dev        # Vite at localhost:5173, proxies /api/* to :3000
```

No CORS configuration needed — Vite's dev proxy handles it.

> Swagger UI is available at **http://localhost:3000/docs** in development mode. It's generated directly from the same JSON Schema objects used for request validation, so it always reflects the actual API.

---

## Tests

```bash
cd backend && npm test
```

84 tests across 5 suites. Each suite gets a fresh in-memory SQLite database — no shared state, no cleanup, no external dependencies. Total runtime under 2 seconds.

| Suite | Coverage |
|---|---|
| [`visitService.test.ts`](./backend/tests/visitService.test.ts) | First visit · counter accumulation · milestone detection · tree increment · post-milestone reset · config changes |
| [`customerValidation.test.ts`](./backend/tests/customerValidation.test.ts) | ID format validation · honeypot keyword detection · bot user-agent matching |
| [`antiBotTrack.test.ts`](./backend/tests/antiBotTrack.test.ts) | Full tracking endpoint — legitimate visits, honeypot IDs, bot UAs, rapid-fire sliding window |
| [`visitsRoutes.test.ts`](./backend/tests/visitsRoutes.test.ts) | Public tracking endpoint happy path |
| [`adminRoutes.test.ts`](./backend/tests/adminRoutes.test.ts) | Config updates and reset — with/without/wrong admin secret |

---

## API reference

All endpoints are under `/api/v1`. In Docker and production the frontend proxies `/api/*` through nginx — you can also call the backend directly on port 3000.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/visits` | — | Record a device visit |
| `GET` | `/api/v1/visits/track/:customerId` | — | Record a visit via tracking link (browser / QR code) |
| `GET` | `/api/v1/visits/recent` | — | Recent visits — `?filter=real` or `?filter=demo` |
| `GET` | `/api/v1/visits/chart` | — | Chart data — `?range=24h\|7d\|30d` · `?filter=all\|real` |
| `GET` | `/api/v1/customers` | — | All customers, ranked by trees then visit progress |
| `GET` | `/api/v1/customers/:id` | — | Single customer stats |
| `GET` | `/api/v1/stats` | — | Aggregate totals across all visits |
| `GET` | `/api/v1/stats/live` | — | Totals for tracking-link visits only |
| `GET` | `/api/v1/config` | — | Current threshold (`visits_per_tree`) |
| `PATCH` | `/api/v1/config` | `x-admin-secret` | Update threshold — takes effect immediately, no restart needed |
| `POST` | `/api/v1/reset` | `x-admin-secret` | Wipe all visits and reload the demo seed |
| `GET` | `/health` | — | Health check — no DB dependency |

The tracking endpoint has a four-layer anti-bot filter: ID format validation → honeypot keyword detection → known bot UA matching → sliding-window rapid-fire limiter (3 hits / 30 s / IP+customer pair). Filtered requests are silently swallowed with a 200 or 201 — no error is returned that would reveal the filter exists.

### Examples

**Record a device visit**
```bash
curl -X POST http://localhost:3000/api/v1/visits \
  -H "Content-Type: application/json" \
  -d '{"customerId": "device-abc123"}'
```
```json
{
  "customerId": "device-abc123",
  "totalVisits": 10,
  "treesPlanted": 1,
  "treeEarned": true,
  "lastSeen": "2026-05-01T08:41:00.000Z"
}
```

**Update the threshold at runtime**
```bash
curl -X PATCH http://localhost:3000/api/v1/config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: local-dev-admin-secret" \
  -d '{"visitsPerTree": 5}'
```
Takes effect on the very next visit. Past earned trees are not recalculated.

**Reset all data and reload the demo seed**
```bash
curl -X POST http://localhost:3000/api/v1/reset \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: local-dev-admin-secret"
```

---

## Environment variables

### Backend (`backend/.env`)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `NODE_ENV` | `development` | Swagger UI is disabled when set to `production` |
| `VISITS_PER_TREE` | `10` | Seeds the initial threshold on first start |
| `DB_PATH` | `./data/visits.db` | Directory is created automatically |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8080` | Comma-separated list of allowed origins |
| `ADMIN_SECRET` | `local-dev-admin-secret` (Docker) / _(empty)_ (bare dev) | **Required in production** — server won't start without it. Production value: `tree-nation-admin-2026` |
| `RAPID_FIRE_MAX_HITS` | `3` | Max requests allowed from the same IP + device ID within 30 seconds before the anti-bot filter silently drops them. Raise this in demo environments so the tracking page can be refreshed freely |

### Frontend (`frontend/.env`)

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | _(empty)_ | Leave empty when nginx proxies `/api/*`. Set to the full backend URL for standalone deployments |

---

## Project structure

```
.
├── .github/
│   └── workflows/
│       └── ci.yml              # Type check + 84 tests on every push and PR
│
├── backend/
│   ├── src/
│   │   ├── config/             # Single config object built from env vars
│   │   ├── db/                 # SQLite setup — WAL mode, migrations, seed data
│   │   ├── repositories/       # Data-access layer — SQL stays here, out of routes
│   │   ├── routes/             # Fastify route handlers (visits, customers, config)
│   │   ├── services/           # visitService — the atomic transaction logic
│   │   └── utils/
│   │       ├── customerValidation.ts   # ID format, honeypot, bot UA checks
│   │       ├── rapidFire.ts            # Sliding-window rate limiter
│   │       ├── geo.ts                  # ip-api.com lookup + language parsing
│   │       └── date.ts
│   ├── tests/                  # Vitest suites — fresh SQLite :memory: per file
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/         # StatsCard, VisitsChart, CustomerLeaderboard,
│   │   │                       # EventSimulator, LiveDashboard, GrowingTree,
│   │   │                       # LiveIndicator, ConfirmModal, SkeletonCard
│   │   ├── composables/        # useVisitsData — polling, reactive state, cleanup
│   │   ├── lib/                # apiFetch — typed wrapper + error normalisation
│   │   ├── types/              # API response interfaces shared across components
│   │   └── views/              # Dashboard.vue (Demo + Live tabs) · TrackView.vue
│   └── .env.example
│
├── docker-compose.yml
├── DECISIONS.md                # Why each non-obvious choice was made
└── README.md
```

---

## Contributing

The project follows a simple branching strategy:

```
main          ← production (Railway auto-deploys on merge)
  └── develop ← integration branch
        └── feat/* · fix/* · chore/*  ← short-lived feature branches
```

**Workflow:**

```bash
# 1. Branch off develop
git checkout develop && git pull origin develop
git checkout -b feat/your-feature

# 2. Work, commit, push
git push origin feat/your-feature

# 3. Open a PR → develop on GitHub
# CI runs automatically (type check + 84 tests)

# 4. After review, merge to develop
# When ready to ship → PR from develop → main → Railway deploys
```

CI runs on every push to `main` and `develop` and on every pull request targeting either branch. A PR cannot be merged if CI fails.

---

## Design decisions

The reasoning behind the main technical choices — SQLite over Postgres, why atomic transactions matter for milestone counting, polling over WebSockets, the anti-bot strategy, rate limiting scope, the dependency upgrade approach, and what the architecture would look like at 10M+ visits/day — is all in [`DECISIONS.md`](./DECISIONS.md).

---

*Node.js 20 · Fastify 5 · Vue 3 · SQLite · Docker · Railway*
