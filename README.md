# X Visits = 1 Tree — Tree-Nation

A real-time visit tracking service that plants a digital tree every N customer visits. Built as a technical assessment for Tree-Nation's migration to Vue 3 + TypeScript.

---

## How it works

Each time a customer device sends a visit event, the service atomically increments their visit counter inside a SQLite transaction. When the counter hits the configured threshold (default: **10 visits**), `trees_planted` is incremented in the same transaction — preventing double-planting under concurrent load. A live Vue 3 dashboard polls the API every 10 seconds and displays aggregate stats, an hourly chart, and a per-customer lookup panel.

---

## Assumptions

These are the design boundaries I defined for this implementation:

- **Customer ID is device-supplied.** The physical device (out of scope) generates a stable unique identifier (e.g., MAC address or UUID) and includes it in every visit event. The service does not issue or validate tokens — it trusts the device.
- **Every POST counts as a visit.** No deduplication window is applied. If the same device sends two events in quick succession (e.g., a noisy sensor), both are counted. A deduplication layer would live in the physical device firmware or an upstream gateway, not here.
- **The threshold is global.** The configurable `visits_per_tree` value applies equally to every customer. There is no per-shop or per-customer override.
- **Threshold changes are forward-only.** Updating the threshold via `PATCH /api/v1/config` affects future visits only. Past earned trees are not recalculated. A customer who earned 1 tree at 10 visits retains it if the threshold later changes to 5.
- **`last_seen` = most recent visit timestamp.** The spec asks to "store the last connection time"; this is the `created_at` of the most recent row in the `visits` table for that customer.
- **Hourly aggregation covers a rolling 24-hour window.** The chart shows the last 24 complete-or-partial hours, not a calendar day boundary. Hours with zero visits are included as 0 so the chart shape is always consistent.
- **Single-node deployment.** SQLite's single-writer model is assumed. See [DECISIONS.md](./DECISIONS.md) for the migration path to PostgreSQL + Redis if the load exceeds ~100k writes/day.

---

## Architecture

```
Browser
   │
   ▼ :80
┌─────────────────────┐
│   nginx (Alpine)    │  Serves the Vue SPA
│                     │  Proxies /api/* → backend
└──────────┬──────────┘
           │ http://backend:3000
           ▼
┌─────────────────────┐
│  Fastify (Node 20)  │  REST API
│  TypeScript strict  │  Swagger UI → /docs (dev only)
│  Rate limit 100/min │  Graceful SIGTERM shutdown
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   SQLite (WAL mode) │  customers · visits · app_config
│   better-sqlite3    │  Auto-created on first start
└─────────────────────┘
```

---

## Tech stack

| Layer | Technology | Version |
|---|---|---|
| API framework | Fastify | 4.x |
| Backend runtime | Node.js LTS | 20.x |
| Database | SQLite via better-sqlite3 | WAL mode |
| Backend language | TypeScript strict | 5.x |
| Tests | Vitest + SQLite `:memory:` | 1.x |
| Frontend framework | Vue 3 Composition API | 3.5 |
| Build tool | Vite + vue-tsc | 5.x |
| Styling | Tailwind CSS (Tree-Nation brand tokens) | 3.x |
| Charts | Chart.js | 4.x |
| Container | Docker multi-stage + nginx:alpine | — |

---

## Quick start

### Option A — Docker (zero setup)

```bash
docker-compose up --build
```

- Dashboard → **http://localhost:80**
- API → **http://localhost:3000**

> ⚠️ **Node 20 LTS required.** `better-sqlite3` ships prebuilt binaries only for Node 20.
> Node 22 or 24 will fail at `npm install`. Fix: `nvm install 20 && nvm use 20`.

---

### Option B — Local development

**Backend**

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

- API runs at **http://localhost:3000**
- Swagger UI at **http://localhost:3000/docs**

**Frontend** (new terminal)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

- Dashboard at **http://localhost:5173**

The Vite dev server proxies `/api/*` to `localhost:3000` automatically — no CORS setup needed.

---

## API reference

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/visits` | Record a visit — returns milestone status |
| `GET` | `/api/v1/customers/:id` | Per-customer stats |
| `GET` | `/api/v1/visits/hourly` | Hourly visit counts for the last 24 h |
| `GET` | `/api/v1/stats` | Aggregate totals across all customers |
| `GET` | `/api/v1/config` | Current `visits_per_tree` setting |
| `PATCH` | `/api/v1/config` | Update threshold at runtime (no restart needed) |
| `GET` | `/health` | Health check — no DB dependency |

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
| `NODE_ENV` | `development` | Disables Swagger UI when set to `production` |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated list of allowed origins |

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

9 unit tests covering: first visit, counter accumulation, milestone detection, `trees_planted` increment, post-milestone reset, and config changes. Each test gets a fresh SQLite `:memory:` instance — no state leaks, runs in ~400 ms.

---

## Troubleshooting

### `better-sqlite3` fails to install / rebuild error

This package uses native bindings compiled for a specific Node.js ABI. **Only Node 20 LTS has prebuilt binaries.** If you are on Node 22 or 24:

```bash
nvm install 20
nvm use 20
cd backend && npm install
```

If `nvm` is not installed: https://github.com/nvm-sh/nvm

### Docker port 80 is already in use

Edit `docker-compose.yml` and change the host port:

```yaml
ports:
  - "8080:80"   # use any free port
```

Then access the dashboard at `http://localhost:8080`.

### Dashboard shows "Cannot reach the API"

Make sure both services are running. In Docker, check container health:

```bash
docker-compose ps
docker-compose logs backend
```

In local dev, confirm the backend is on port 3000 and the frontend Vite proxy is configured (it is by default in `vite.config.ts`).

### SQLite `SQLITE_CANTOPEN` in local dev

The `data/` directory is created automatically on startup via `fs.mkdirSync`. If you still see this error, check write permissions on the project directory.

---

## Project structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/          # Env-backed config with validation
│   │   ├── db/              # SQLite singleton, WAL setup, migrations
│   │   ├── routes/          # Fastify route handlers (visits, customers, config, stats)
│   │   ├── services/        # visitService — core business logic
│   │   └── utils/           # date.ts — shared SQLite → ISO formatter
│   └── tests/               # Vitest unit tests (SQLite :memory:)
│
├── frontend/
│   └── src/
│       ├── components/      # StatsCard, TreeCounter, VisitsChart, CustomerLookup,
│       │                    # LiveIndicator, SkeletonCard
│       ├── composables/     # useVisitsData (polling + state), useCountUp (animation)
│       ├── lib/             # apiFetch — typed fetch wrapper with ApiError class
│       ├── types/           # Shared API response interfaces
│       └── views/           # Dashboard.vue
│
├── docker-compose.yml
├── DECISIONS.md             # Architecture and technology rationale
└── README.md
```

---

## Key design decisions

A full rationale for every technology choice is in [`DECISIONS.md`](./DECISIONS.md), including:

- Why SQLite over PostgreSQL for this use case
- Why `db.transaction()` is critical for correct milestone counting
- Why polling instead of WebSockets for the dashboard
- What would change at 10M+ visits/day

---

*Built with Node.js 20 · Fastify · Vue 3 · SQLite · Docker*
