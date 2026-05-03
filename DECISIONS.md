# Technical Decisions

## Why Node.js + TypeScript over other backend options

Tree-Nation is migrating from PHP/Laravel to a Vue 3 + TypeScript frontend. Keeping the backend in TypeScript means a single language across the stack, shared type definitions if a monorepo evolves further, and no context-switching for developers. Node.js is well-suited here: the workload is I/O-bound (SQLite reads/writes) with no CPU-heavy computation, so the event loop is a natural fit. TypeScript's strict mode catches an entire class of bugs at compile time that would otherwise surface only in production.

Alternatives considered:
- **Go** — excellent performance, but adds a second language to the stack when the team is already investing in TypeScript.
- **Python/FastAPI** — popular for data tasks but slower cold-start and no type-sharing advantage here.

---

## Why Fastify over Express

Fastify offers:
1. **Schema-first validation** — route schemas (body, params, response) are declared as JSON Schema objects. Fastify validates inputs automatically and serialises outputs up to 2× faster than `JSON.stringify` via `fast-json-stringify`. This removes a whole category of boilerplate validation code.
2. **First-class TypeScript support** — generic route handlers and typed request/reply objects with zero extra packages.
3. **Built-in Swagger integration** via `@fastify/swagger` + `@fastify/swagger-ui` — API docs are generated directly from the same schema objects used for validation, so docs can never drift from reality.
4. **Better performance** — consistently ~20–30% higher req/s than Express in benchmarks, relevant at scale.

Express would have worked, but the extra setup cost (express-validator, manual serialisation, separate OpenAPI tooling) yields no offsetting benefit.

---

## Why SQLite over in-memory storage or PostgreSQL

| Concern | In-memory | SQLite | PostgreSQL |
|---|---|---|---|
| Persistence | ✗ | ✓ | ✓ |
| External infra | — | none | container/server |
| ACID transactions | — | ✓ (WAL) | ✓ |
| Setup effort | trivial | trivial | non-trivial |
| Scale ceiling | single-process | ~100k writes/day | unlimited |

For a technical assessment that must run with `docker compose up --build` and no external services, SQLite is the only choice that satisfies all three constraints (persistence, ACID, zero infra). WAL journal mode is enabled so reads don't block writes, giving good concurrent performance for this workload.

---

## Why atomic SQLite transactions for visit counting

The core operation — increment visit counter, check milestone, maybe increment tree counter — must be atomic. Without a transaction:

1. Process A reads `total_visits = 9`
2. Process B reads `total_visits = 9`
3. Process A writes `total_visits = 10`, plants a tree
4. Process B writes `total_visits = 10`, plants a second tree → **double plant**

`db.transaction()` in better-sqlite3 wraps the entire operation in a single SQLite transaction. Because better-sqlite3 is synchronous (no async/await), there is no opportunity for the event loop to interleave operations mid-transaction. The result is correctly serialised visit counting even under concurrent HTTP requests hitting the same Node.js process.

---

## Why hot-reloadable config (PATCH /api/v1/config)

The spec states the threshold must be "configurable". There are two implementation choices:
- **Env-var only** — requires a container restart to change; downtime for a live deployment.
- **DB-backed + PATCH endpoint** — the value is read from `app_config` on every visit. A `PATCH /api/v1/config` call updates the DB row and takes effect immediately on the next visit, with no restart.

The DB-backed approach also survives restarts automatically (the last configured value persists). The env var `VISITS_PER_TREE` seeds the default via the Docker Compose environment block, but the live value is always the one in `app_config`.

---

## Why Vue 3 + TypeScript for the frontend

Tree-Nation is explicitly migrating to Vue 3 + TypeScript. This dashboard is therefore both a working deliverable and a proof of fit within that migration direction. Specific choices:

- **Composition API (`<script setup>`)** — functions, computed values, and lifecycle hooks are plain TypeScript with no special framework concepts. This is idiomatic Vue 3 and aligns with the migration target.
- **Composables** — `useVisitsData` encapsulates data fetching, polling, and cleanup. It is a thin, testable unit with a clear contract (reactive refs + `isLoading` + `error`), following the same pattern as Vue 3's own composables.
- **Chart.js** — the most widely used charting library in the Vue ecosystem, with first-class TypeScript types and a simple imperative API that integrates cleanly with `onMounted`/`onUnmounted`.
- **Tailwind CSS** (PostCSS, not CDN) — processed at build time so unused classes are purged.

---

## Why polling over WebSockets for the frontend

WebSockets would be the natural choice if latency mattered (e.g., sub-second live updates). For a reforestation dashboard where the meaningful metric is visits-per-hour, a 10-second polling interval is indistinguishable from real-time and is significantly simpler:

- No server-side connection management or heartbeat logic
- No sticky-session requirement for horizontal scaling
- Composable cleanup (`clearInterval` in `onUnmounted`) is a one-liner
- Works through every proxy, CDN, and firewall with no configuration

The 10-second interval was chosen as the midpoint between "feels live" and "doesn't spam the API". It can be tuned without any architectural change.

---

## Rate limiting — why only write endpoints are limited

`@fastify/rate-limit` is registered with `global: false`, which disables the default blanket limit and requires an explicit `config.rateLimit` on each route. Only mutation endpoints carry a limit:

- `POST /api/v1/visits` — 120 req/min (device events, burst-tolerant)
- `GET /api/v1/visits/scan/:customerId` — 60 req/min (QR scan, human-paced)

Read endpoints (stats, chart, customers) are unrestricted. A global limit would penalise the dashboard's own polling loop: with two self-fetching chart components and a six-endpoint composable poll every 10 seconds, the baseline is ~48 req/min before any user interaction — uncomfortably close to a tight global cap. Targeting only writes avoids this while still protecting against abusive visit injection.

---

## Security headers and the ADMIN_SECRET pattern

Every HTTP response carries three headers added via a Fastify `onSend` hook:

- `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing attacks
- `X-Frame-Options: DENY` — blocks the app from being embedded in iframes (clickjacking)
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage on cross-origin navigations

Destructive endpoints (`POST /api/v1/reset`, `PATCH /api/v1/config`) are protected by an optional `ADMIN_SECRET` environment variable. When set, the server requires the `x-admin-secret` header to match. When unset (local development), the check is skipped entirely — no friction during development, protected in production by setting the env var in the deployment environment. This is intentionally lightweight: the service does not need full authentication, only protection against accidental or malicious reset/reconfiguration in a live environment.

---

## QR scan endpoint and async geo enrichment

`GET /api/v1/visits/scan/:customerId` exists alongside the device `POST /api/v1/visits` to support a different ingestion path: a physical QR code that customers scan with their own phones. The scan endpoint:

1. Calls `registerVisit` synchronously — the 201 response is sent immediately with the visit result.
2. Then, in a `setImmediate` callback (after the response is flushed), fires an async geo lookup against `ip-api.com` using the request's real IP, and enriches the visit row with country, city, and language via a background `UPDATE`.

The `setImmediate` is deliberate: geo lookup adds 100–500 ms of network latency. Doing it in the request path would slow every QR scan. Doing it after the response means the visit is always recorded instantly, and the geo data appears in the dashboard on the next poll cycle. A 1500 ms abort timeout guards against hanging connections to the geo API.

Private and loopback IPs (127.x, 10.x, 192.168.x, etc.) are short-circuited — a regex check skips the geo call entirely since these addresses would return no useful data.

---

## What I would change at scale (10M+ visits/day)

At 10M visits/day (~115 req/s average, with bursty peaks potentially 5–10×):

1. **Migrate from SQLite to PostgreSQL** — SQLite's single-writer model becomes a bottleneck. Postgres supports true concurrent writes and connection pooling via PgBouncer.

2. **Redis INCR for counters** — the visit counter increment (`total_visits + 1`) is a hot write. Redis `INCR` is atomic, in-memory, and handles hundreds of thousands of ops/second. The canonical count can be synced to Postgres on a schedule or on milestone events.

3. **Event sourcing for the visits log** — rather than inserting each visit synchronously in the request path, publish to a message queue (Kafka, SQS). Consumers aggregate into time-series buckets and write to Postgres. The API becomes non-blocking for write acceptance.

4. **Stateless API layer, horizontal scaling** — with Redis handling counters and Postgres for persistence, the Node.js API layer holds no local state. Multiple instances can run behind a load balancer with no sticky sessions.

5. **Read replicas + caching** — the `GET /api/v1/visits/hourly` query runs a `GROUP BY` over a 24h window. At scale, this moves to a Postgres read replica with the result cached in Redis (TTL 30s). The dashboard composable would hit the cache, not the primary DB.
