# Tree-Nation — Visit Tracker

Every N visits from a customer device plants a tree. This service tracks those visits, counts the milestones, and shows everything in a real-time dashboard. Built as a technical assessment for Tree-Nation's migration to Vue 3 + TypeScript.

**Live demo →** https://tree-visits-service-production.up.railway.app

---

## Reviewer access

> Credentials are included here only because this is a technical assessment. In any real project, secrets belong in the platform's environment variable manager — never in a repository.

| | |
|---|---|
| **Admin secret (production)** | `tree-nation-admin-2026` |
| **Admin secret (local Docker)** | `local-dev-admin-secret` |

The admin secret unlocks the **Reset data** button on the dashboard (wipes all visits and reloads the demo seed) and the `PATCH /api/v1/config` endpoint for changing the threshold at runtime.

---

## What it does

A physical store device (POS terminal, kiosk, tablet) sends a `POST` to the API each time a customer visits. The service increments that customer's visit counter inside an atomic SQLite transaction. When the counter hits the threshold — default is 10 — `trees_planted` is incremented in the same transaction. No double-planting is possible under concurrent load because the check and the increment are a single write.

The dashboard has two tabs:

**Demo** shows a set of simulated store devices. You can fire visits individually or in a burst using the built-in EventSimulator, watch the chart update, and see which devices are closest to their next tree. The demo data is seeded fresh on startup and can be reset from the UI.

**Live** shows real visits coming in through the public tracking link — the same URL that appears on the QR code in the Track page. Each visit is enriched asynchronously with geo data (country, city) and browser/OS information. The enrichment happens after the response is sent, so it never adds latency to the tracked page load.

---

## Architecture

```
Browser / Device
      │
      ▼ :80
┌─────────────────────┐
│   nginx (Alpine)    │  Serves the Vue SPA · proxies /api/* → backend
└──────────┬──────────┘
           │ http://backend:3000
           ▼
┌──────────────────────────────────────────┐
│  Fastify 5 · Node 20 · TypeScript strict │
│  Schema validation on every route        │
│  Per-route rate limits (writes only)     │
│  Anti-bot layer on tracking endpoint     │
│  Security headers on every response      │
│  Swagger UI at /docs (dev only)          │
│  Graceful SIGTERM shutdown               │
└──────────┬───────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│   SQLite (WAL mode) │  customers · visits · app_config
│   better-sqlite3    │  Auto-created on first start
└─────────────────────┘
           │ setImmediate (non-blocking)
           ▼
┌─────────────────────┐
│   ip-api.com        │  Geo lookup — never blocks the visit response
└─────────────────────┘
```

The dashboard itself polls six endpoints every 10 seconds. WebSockets would feel snappier but would add server-side connection state, sticky-session requirements, and proxy configuration. For a dashboard where the meaningful metric is visits-per-hour, 10-second polling is indistinguishable from real-time and significantly simpler to operate.

---

## Tech stack

| | |
|---|---|
| **API** | Fastify 5 + TypeScript strict |
| **Database** | SQLite via better-sqlite3 (WAL mode) |
| **Runtime** | Node.js 20 LTS |
| **Tests** | Vitest 3 · SQLite `:memory:` |
| **Frontend** | Vue 3 Composition API · Vite · Tailwind CSS 3 |
| **Charts** | Chart.js 4 |
| **Containers** | Docker multi-stage · nginx:alpine |
| **Hosting** | Railway |

---

## Running it locally

### Docker — zero setup

```bash
docker compose up --build
```

Dashboard → http://localhost  
API → http://localhost:3000 (also exposed directly for testing)

The compose file maps port 80 for the frontend and 3000 for the backend. If port 80 is taken, edit the `ports` entry in `docker-compose.yml` to something like `"8080:80"`.

### Local dev (hot reload)

You'll need Node 20 — `better-sqlite3` ships prebuilt binaries only for that ABI. If you're on a different version: `nvm install 20 && nvm use 20`.

**Backend:**
```bash
cd backend
cp .env.example .env
npm install
npm run dev        # tsx watch, restarts on save
```

**Frontend** (separate terminal):
```bash
cd frontend
cp .env.example .env
npm install
npm run dev        # Vite at localhost:5173, proxies /api/* to :3000
```

No CORS configuration needed in dev — Vite's proxy handles it.

---

## Tests

```bash
cd backend && npm test
```

84 tests across 5 suites, runs in under 2 seconds:

| Suite | What it covers |
|---|---|
| `visitService.test.ts` | First visit, counter accumulation, milestone detection, tree increment, post-milestone reset, config changes |
| `customerValidation.test.ts` | ID format validation, honeypot detection, bot user-agent patterns |
| `antiBotTrack.test.ts` | Full tracking endpoint integration — legitimate visits, honeypot IDs, bot UAs, rapid-fire rate limiting |
| `visitsRoutes.test.ts` | Public tracking endpoint happy path |
| `adminRoutes.test.ts` | Config updates and reset — with and without the admin secret |

Each test spins up a fresh in-memory SQLite database. No shared state, no cleanup required, no external dependencies.

---

## API reference

All endpoints are relative to the API base. In Docker or production, the frontend proxies `/api/*` through nginx — you can also hit the backend directly on port 3000.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/visits` | — | Record a device visit |
| `GET` | `/api/v1/visits/track/:customerId` | — | Record a visit via tracking link (browser / QR code) |
| `GET` | `/api/v1/visits/recent` | — | Recent visits — `?filter=real` or `?filter=demo` |
| `GET` | `/api/v1/visits/chart` | — | Chart data — `?range=24h\|7d\|30d` and `?filter=all\|real` |
| `GET` | `/api/v1/customers` | — | All customers, ranked by trees then progress |
| `GET` | `/api/v1/customers/:id` | — | Single customer stats |
| `GET` | `/api/v1/stats` | — | Aggregate totals across all visits |
| `GET` | `/api/v1/stats/live` | — | Totals for tracking-link visits only |
| `GET` | `/api/v1/config` | — | Current threshold |
| `PATCH` | `/api/v1/config` | `x-admin-secret` | Update threshold — takes effect immediately |
| `POST` | `/api/v1/reset` | `x-admin-secret` | Wipe all visits and reload the demo seed |
| `GET` | `/health` | — | Health check (no DB dependency) |

The tracking endpoint (`/track/:customerId`) has a four-layer anti-bot filter: ID format validation, honeypot keyword detection, known bot user-agent matching, and a sliding-window rapid-fire limiter (3 hits per 30 seconds per IP + customer ID pair). Filtered requests are silently swallowed — no error is returned that would reveal the filter exists.

### Examples

**Record a device visit:**
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

**Update the threshold at runtime:**
```bash
curl -X PATCH http://localhost:3000/api/v1/config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: local-dev-admin-secret" \
  -d '{"visitsPerTree": 5}'
```
Takes effect on the very next visit. The previous threshold is not applied retroactively.

**Reset all data and reload the demo seed:**
```bash
curl -X POST http://localhost:3000/api/v1/reset \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: local-dev-admin-secret"
```

---

## Environment variables

### Backend

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | |
| `NODE_ENV` | `development` | Swagger UI is only served outside of `production` |
| `VISITS_PER_TREE` | `10` | Seeds the initial threshold on first start |
| `DB_PATH` | `./data/visits.db` | Directory is created automatically |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:8080` | Comma-separated |
| `ADMIN_SECRET` | `local-dev-admin-secret` (Docker) / _(empty)_ (bare dev) | Required in production — server won't start without it |

### Frontend

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | _(empty)_ | Leave empty when nginx proxies `/api/*`. Set to the full backend URL for standalone frontend deployments |

---

## Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/          # Single config object built from env vars
│   │   ├── db/              # SQLite setup (WAL, migrations, seed data)
│   │   ├── repositories/    # Data-access layer — SQL stays here, out of routes
│   │   ├── routes/          # Fastify route handlers (visits, customers, config)
│   │   ├── services/        # visitService — the atomic transaction logic
│   │   └── utils/
│   │       ├── customerValidation.ts  # ID format, honeypot, bot UA checks
│   │       ├── rapidFire.ts           # Sliding-window rate limiter
│   │       ├── geo.ts                 # ip-api.com lookup + language parsing
│   │       └── date.ts
│   └── tests/               # Vitest suites — SQLite :memory: per test file
│
├── frontend/
│   └── src/
│       ├── components/      # StatsCard, VisitsChart, CustomerLeaderboard,
│       │                    # EventSimulator, LiveDashboard, GrowingTree,
│       │                    # LiveIndicator, ConfirmModal, SkeletonCard
│       ├── composables/     # useVisitsData — polling, reactive state, cleanup
│       ├── lib/             # apiFetch — typed wrapper, error normalisation
│       ├── types/           # API response interfaces shared across components
│       └── views/           # Dashboard.vue (Demo + Live tabs) · TrackView.vue
│
├── frontend/public/         # Static assets
├── docker-compose.yml
├── DECISIONS.md             # Why each non-obvious choice was made
└── README.md
```

---

## Design decisions

The reasoning behind the main technical choices — SQLite over Postgres, atomic transactions, polling over WebSockets, the anti-bot strategy, the dependency upgrade approach, and what would change at 10M+ visits/day — is documented in [`DECISIONS.md`](./DECISIONS.md).

---

*Node.js 20 · Fastify 5 · Vue 3 · SQLite · Docker · Railway*
