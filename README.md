# 10 Visits = 1 Tree — Tree-Nation

A real-time visit tracking service that plants a digital tree every N customer visits. Built as a technical assessment for Tree-Nation's migration to Vue 3 + TypeScript.

---

## Reviewer access

| | |
|---|---|
| **Live dashboard** | https://tree-visits-service-production.up.railway.app |
| **Admin secret (production)** | `tree-nation-admin-2026` |
| **Admin secret (local Docker)** | `local-dev-admin-secret` |

> **Note:** credentials are included here exclusively because this is a technical assessment. In any real environment, secrets must never be committed to a repository — they belong in environment variables managed by the hosting platform (e.g. Railway → Variables, GitHub Secrets, or a secrets manager).

The admin secret is needed to use the **Reset data** button on the dashboard (resets all visits and reloads the demo seed). It is also required for `PATCH /api/v1/config` and `POST /api/v1/reset` via the API.

---

## How it works

Each time a customer device sends a visit event, the service atomically increments their visit counter inside a SQLite transaction. When the counter hits the configured threshold (default: **10 visits**), `trees_planted` is incremented in the same transaction — preventing double-planting under concurrent load.

A live Vue 3 dashboard polls the API every 10 seconds. It has two tabs:

- **Demo** — a built-in device simulator that sends visits and shows them in real time, with a multi-range chart (24h / 7d / 30d) and a leaderboard.
- **Live** — tracks real visits opened from a public tracking link, enriched with geo-location (country, city) and browser/OS data. The link can also be shared as a QR code.

---

## Assumptions

- **Customer ID is device-supplied.** The physical device generates a stable unique identifier (e.g., MAC address or UUID). The service trusts it — no token issuance or validation.
- **Every POST counts as a visit.** No deduplication window. If the same device sends two events in quick succession, both are counted. Deduplication belongs in device firmware or an upstream gateway.
- **The threshold is global.** `visits_per_tree` applies equally to every customer — no per-shop or per-customer override.
- **Threshold changes are forward-only.** `PATCH /api/v1/config` affects future visits only. Past earned trees are not recalculated.
- **`last_seen` = most recent visit timestamp.** Stored as the `visited_at` of the most recent visits row for that customer.
- **Single-node deployment.** SQLite's single-writer model is assumed. See [DECISIONS.md](./DECISIONS.md) for the PostgreSQL + Redis migration path.

---

## Architecture

```
Browser
   │
   ▼ :80
┌─────────────────────┐
│   nginx (Alpine)    │  Serves Vue SPA + proxies /api/* → backend
└──────────┬──────────┘
           │ http://backend:3000
           ▼
┌─────────────────────────────────────────┐
│  Fastify (Node 20) · TypeScript strict  │
│  Per-route rate limits (writes only)    │
│  Security headers on every response     │
│  Swagger UI → /docs  (dev only)         │
│  Graceful SIGTERM shutdown              │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────┐
│   SQLite (WAL mode) │  customers · visits · app_config
│   better-sqlite3    │  Auto-created on first start
└─────────────────────┘
           │ async (setImmediate)
           ▼
┌─────────────────────┐
│   ip-api.com        │  Geo enrichment — never blocks response
└─────────────────────┘
```

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| API framework | Fastify + plugins | 4.x |
| Backend runtime | Node.js LTS | 20.x |
| Database | SQLite via better-sqlite3 (WAL) | — |
| Backend language | TypeScript strict | 5.x |
| Tests | Vitest + SQLite `:memory:` | 1.x |
| Frontend framework | Vue 3 Composition API | 3.5 |
| Build tool | Vite + vue-tsc | 5.x |
| Styling | Tailwind CSS (Tree-Nation brand) | 3.x |
| Charts | Chart.js | 4.x |
| QR codes | qrcode | — |
| Celebrations | canvas-confetti | — |
| Container | Docker multi-stage + nginx:alpine | — |

---

## Quick start

### Option A — Docker (zero setup)

```bash
docker compose up --build
```

- Dashboard → **http://localhost:8080**
- API → **http://localhost:3000**

Docker Compose runs the backend with `NODE_ENV=production` and a local fallback `ADMIN_SECRET`. For real deployments, set a strong `ADMIN_SECRET` in the environment instead of relying on the local default.

> **Node 20 LTS required for local dev.** `better-sqlite3` ships prebuilt binaries only for Node 20. Fix: `nvm install 20 && nvm use 20`.

---

### Option B — Local development

**Backend**

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

**Frontend** (new terminal)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Dashboard → **http://localhost:5173**
- Vite proxies `/api/*` to `localhost:3000` — no CORS config needed.

---

## API reference

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/visits` | — | Record a device visit — returns milestone status |
| `GET` | `/api/v1/visits/track/:customerId` | — | Record a visit via public tracking link — enriches with geo + UA |
| `GET` | `/api/v1/visits/recent` | — | Recent visits (`?filter=real` or `?filter=demo`) |
| `GET` | `/api/v1/visits/chart` | — | Chart data (`?range=24h\|7d\|30d&filter=all\|real`) |
| `GET` | `/api/v1/visits/hourly` | — | Hourly counts for the last 24 h |
| `GET` | `/api/v1/customers` | — | All customers, sorted by trees then visit progress |
| `GET` | `/api/v1/customers/:id` | — | Per-customer stats |
| `GET` | `/api/v1/stats` | — | Aggregate totals (all visits) |
| `GET` | `/api/v1/stats/live` | — | Aggregate totals (real tracking-link visits only) |
| `GET` | `/api/v1/config` | — | Current `visits_per_tree` |
| `PATCH` | `/api/v1/config` | `ADMIN_SECRET` | Update threshold at runtime |
| `POST` | `/api/v1/reset` | `ADMIN_SECRET` | Reset and reseed demo data |
| `GET` | `/health` | — | Health check — no DB dependency |

> The dashboard and read-only statistics are public. Only destructive/admin actions are protected. In production, `ADMIN_SECRET` is required and protected endpoints require the header `x-admin-secret: <secret>`. In local development, leaving it empty keeps admin actions frictionless.

### Request / response examples

**Record a visit**

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

**Look up a customer**

```bash
curl http://localhost:3000/api/v1/customers/device-abc123
```

```json
{
  "customerId": "device-abc123",
  "totalVisits": 10,
  "treesPlanted": 1,
  "lastSeen": "2026-05-01T08:41:00.000Z",
  "visitsUntilNextTree": 10
}
```

**Change the threshold at runtime**

```bash
curl -X PATCH http://localhost:3000/api/v1/config \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: your-secret" \
  -d '{"visitsPerTree": 5}'
```

The new value takes effect on the very next visit — no container restart required.

---

## Environment variables

### Backend (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `VISITS_PER_TREE` | `10` | Initial visits needed to earn a tree |
| `DB_PATH` | `./data/visits.db` | SQLite file path (directory auto-created) |
| `NODE_ENV` | `development` | Disables Swagger UI when `production` |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins |
| `ADMIN_SECRET` | `local-dev-admin-secret` (Docker) / _(empty)_ (bare dev) | **Required in production.** Protects `PATCH /config` and `POST /reset`. Send as the `x-admin-secret` request header. The dashboard reset dialog asks for this value — in production, set it in your hosting platform's environment variables (e.g. Railway → Variables). |

### Frontend (`.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | _(empty)_ | API base URL. Empty = relative paths, nginx handles the proxy |

---

## Running tests

```bash
cd backend
npm test
```

9 unit tests covering: first visit, counter accumulation, milestone detection, `trees_planted` increment, post-milestone reset, and config changes. Each test uses a fresh SQLite `:memory:` instance — no state leaks, runs in ~400 ms.

---

## Troubleshooting

### `better-sqlite3` fails to install

This package uses native bindings compiled for a specific Node.js ABI. **Only Node 20 LTS has prebuilt binaries.**

```bash
nvm install 20 && nvm use 20
cd backend && npm install
```

### Docker port 80 already in use

```yaml
# docker-compose.yml
ports:
  - "8080:80"
```

Then access the dashboard at `http://localhost:8080`.

### Dashboard shows "Cannot reach the API"

```bash
docker compose ps
docker compose logs backend
```

In local dev, confirm the backend is on port 3000 and the Vite proxy is configured (`vite.config.ts`).

### SQLite `SQLITE_CANTOPEN` in local dev

The `data/` directory is created automatically on startup. If the error persists, check write permissions on the project directory.

---

## Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/        # Env-backed config object
│   │   ├── db/            # SQLite singleton, WAL setup, migrations, seed
│   │   ├── repositories/  # Small data-access functions; SQL stays out of routes/services
│   │   ├── routes/        # visits, customers, config (Fastify route handlers)
│   │   ├── services/      # visitService — atomic transaction business logic
│   │   └── utils/         # date.ts, geo.ts (ip-api lookup + language parsing)
│   └── tests/             # Vitest unit tests (SQLite :memory:)
│
├── frontend/
│   └── src/
│       ├── components/    # StatsCard, VisitsChart, CustomerLeaderboard,
│       │                  # EventSimulator, LiveDashboard, GrowingTree,
│       │                  # LiveIndicator, SkeletonCard
│       ├── composables/   # useVisitsData — polling, state, cleanup
│       ├── lib/           # apiFetch — typed fetch wrapper + ApiError
│       ├── types/         # Shared API response interfaces
│       └── views/         # Dashboard.vue (Demo + Live tabs), TrackView.vue
│
├── frontend/public/       # Static assets (Tree-Nation logo)
├── docker-compose.yml
├── DECISIONS.md           # Architecture and technology rationale
└── README.md
```

---

## Key design decisions

Full rationale for every major choice is in [`DECISIONS.md`](./DECISIONS.md):

- Why SQLite over PostgreSQL for this use case
- Why `db.transaction()` is critical for correct milestone counting
- Why polling instead of WebSockets
- Rate limiting strategy — why only write endpoints are limited
- Security headers and the `ADMIN_SECRET` protection pattern
- Async geo enrichment — why it never blocks the visit response
- What would change at 10M+ visits/day

---

*Built with Node.js 20 · Fastify · Vue 3 · SQLite · Docker*
