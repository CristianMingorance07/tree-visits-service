# Technical Decisions

This document explains the non-obvious choices made while building this service. Not every decision needs justification — some are just the obvious pick. These are the ones where there was a real trade-off or where the reasoning might not be immediately clear from reading the code.

---

## Node.js + TypeScript

Tree-Nation is migrating to Vue 3 + TypeScript on the frontend. Matching the backend language means a single mental model across the stack, shared type definitions between layers, and no context switch when moving between files. That's the main reason.

Node.js itself is a natural fit for this kind of workload — lots of small I/O operations (SQLite reads/writes, occasional geo lookups), nothing CPU-intensive. The event loop handles this well. TypeScript strict mode catches a real class of bugs at compile time, especially around `null`/`undefined` handling, that would otherwise only show up in production.

I looked at Go briefly. It would be faster and the binaries are tiny, but it adds a second language to a stack where TypeScript is already the investment. Not worth it here.

---

## Fastify over Express

I went with Fastify mainly for three reasons:

**Schema-first validation.** You declare the shape of the request body, params, querystring, and response as JSON Schema objects directly on the route. Fastify validates incoming requests automatically and serialises responses via `fast-json-stringify`, which is noticeably faster than `JSON.stringify`. More importantly, it removes a whole category of boilerplate — you don't have to manually validate inputs or write serialisation logic.

**TypeScript integration.** Generic route handlers with typed `request.body`, `request.params`, etc. out of the box, without extra packages. This was genuinely useful — several bugs were caught at compile time that Express would have let through silently.

**Swagger for free.** `@fastify/swagger` generates the OpenAPI spec from the same schema objects already on each route. The docs can't drift from reality because they're derived from the validation layer, not written separately.

The project is currently on Fastify v5 (upgraded from v4 during the dependency audit phase). The main breaking change was the `onSend` hook, which dropped callback-style (`done()`) in favour of async with a return value. Everything else was straightforward.

---

## SQLite as the database

The constraints were: persistence, ACID transactions, and zero external infrastructure (the whole thing needs to start with `docker compose up --build`). SQLite is the only option that satisfies all three without asking the evaluator to spin up a separate Postgres container.

Beyond the setup convenience, SQLite is genuinely a reasonable choice here. The workload is sequential — one Node.js process, one SQLite file, WAL journal mode enabled so reads don't block writes. For a single-store deployment tracking tens of thousands of visits per day, it holds up fine.

WAL mode specifically: without it, any write operation locks the database for both readers and writers. WAL lets reads happen concurrently with writes, which matters when the dashboard is polling six endpoints every ten seconds while visits are also being recorded.

---

## Atomic transactions for visit counting

The core operation — increment visit counter, check if it crossed a milestone, maybe increment tree counter — has to be atomic. If it isn't, two concurrent requests for the same customer can both read `total_visits = 9`, both write `10`, and both plant a tree. The customer ends up with two trees for one milestone.

`db.transaction()` in better-sqlite3 wraps the whole thing in a single SQLite write transaction. The key detail is that better-sqlite3 is synchronous — there's no `await` inside the transaction, which means the event loop can't interleave another operation mid-write. The milestone check and the counter increment happen atomically, every time.

This is the most important correctness property in the codebase. It's not complicated, but it's the one thing that would silently double-count trees if it were missing.

---

## Hot-reloadable threshold (PATCH /api/v1/config)

The threshold (`visits_per_tree`) could have been env-var only. The problem is that changing an env var requires a container restart, which means downtime. Instead the value lives in the `app_config` table and is read on every visit.

`PATCH /api/v1/config` updates the DB row and the new threshold takes effect on the very next request — no restart, no downtime. The env var `VISITS_PER_TREE` seeds the initial value on first start, but after that the DB is the source of truth.

The endpoint is protected by `ADMIN_SECRET` so it can't be triggered by anyone who stumbles across the API docs.

---

## Public tracking endpoint and async geo enrichment

The `GET /api/v1/visits/track/:customerId` endpoint serves a different use case than the device `POST`: it's designed to be opened as a URL — from a browser, QR code, or redirect — rather than called programmatically. The response returns the full visit result as JSON, which the TrackView page uses to show a personalised "you're X visits from a tree" screen.

Geo enrichment happens asynchronously. The response goes out immediately after `registerVisit`, then `setImmediate` kicks off an `ip-api.com` lookup in the background. When it resolves, it writes country, city, and language back to the visit row via an `UPDATE`. The dashboard picks it up on the next poll.

The reason for this separation is latency. Geo lookups add 100–500 ms depending on the region. Waiting for that before sending the response would make every tracked page visit feel slow, which is the opposite of what you want. The slight delay before geo data appears in the dashboard is invisible to the user.

Private and loopback IPs skip the lookup entirely — there's no point sending `127.0.0.1` to a geo API.

---

## Anti-bot layer on the tracking endpoint

The public tracking endpoint is intentionally open (no auth required — it needs to work from a bare browser). That means it's also a target for scrapers, bots, and simple curl loops. Four layers were added to filter noise without breaking legitimate traffic:

1. **ID format validation** — customer IDs must match `^[a-zA-Z0-9_\-.]{1,100}$`. Anything else gets a 400.
2. **Honeypot ID detection** — IDs containing words like `bot`, `crawler`, `admin`, `test` return a silent 200 (no visit recorded, no error). Returning 400 would tell an attacker exactly what to avoid.
3. **Bot User-Agent detection** — known crawler UAs (Googlebot, curl, python-requests, etc.) get a 201 that mimics success. The goal is to look like a normal endpoint to automated scans.
4. **Rapid-fire sliding window** — more than 3 requests from the same IP + customer ID pair within 30 seconds get silently dropped. This catches the simple loop attack without breaking users who open the same link a couple of times.

The 30s/3-hit window was chosen based on what a human could realistically trigger: if someone scans a QR code, the page loads, maybe they reload once — that's 2 hits. Three gives a small buffer; anything over that in 30 seconds is almost certainly not organic.

---

## Demo tab vs Live tab

The dashboard has two modes. Demo uses a set of simulated store devices (`device-store-*`) whose visits are generated by the in-page EventSimulator. Live shows real tracking-link visits from actual browsers.

The split exists because during development and for evaluators, you need to see the full dashboard in action without waiting for real-world traffic. But mixing simulated and real visits in the same chart or leaderboard makes the data meaningless — 119 seeded demo visits would drown out any real visit.

The separation is implemented at the data level: demo visits have customer IDs that start with `device-store-`, real visits come from the tracking endpoint and have non-prefixed IDs. The dashboard filters on this prefix to populate each tab. The VisitsChart component accepts a `filter` prop (`all` or `real`) which maps to the same filter on the backend query.

---

## Unified API wrapper (apiFetch)

All API calls in the frontend go through a single `apiFetch<T>` function in `lib/api.ts`. It handles the base URL, throws typed `ApiError` instances for non-2xx responses (including the error message from the JSON body, not just the status code), and returns typed responses.

The reason this matters: before unifying, several components had their own `fetch` calls with slightly different error handling — some checked `res.ok`, some didn't, some read the JSON body on failure, some didn't. The dashboard was also losing the actual API error message and showing a generic "failed" to the user. `apiFetch` fixes all of this consistently in one place. Adding auth headers, request tracing, or retries later becomes a one-line change.

---

## Polling instead of WebSockets

WebSockets would be the obvious choice if latency mattered — sub-second updates, push from server to client. For a reforestation dashboard where the relevant metric is visits-per-hour, a 10-second poll interval is indistinguishable from real-time in practice, and polling is significantly simpler to operate:

- No server-side connection state or heartbeat logic
- No sticky-session requirement if you ever scale horizontally
- Works through every proxy, CDN, and load balancer without configuration
- Cleanup in the composable is just `clearInterval` in `onUnmounted`

The 10-second interval felt right during testing — the numbers update noticeably but the page doesn't feel jumpy. It's a constant in `useVisitsData` (`POLL_INTERVAL_MS`) so it's easy to change.

---

## Rate limiting — only writes, not reads

`@fastify/rate-limit` is configured with `global: false`, which means no limit by default. Each route that needs one opts in explicitly. Only the write paths carry limits:

- `POST /api/v1/visits` — 120 req/min (device events, expected to burst during store hours)
- `GET /api/v1/visits/track/:customerId` — 60 req/min (human-paced, plus anti-bot layer above)
- `POST /api/v1/reset` — 10 req/min (admin action, should never be rapid-fired)

Read endpoints are unrestricted. A global limit would interfere with the dashboard's own polling — six parallel requests every 10 seconds from the composable, plus chart fetches when the user switches range — easily hitting a tight global cap before any real load appears. Restricting writes specifically protects against visit injection and reset abuse without penalising the dashboard itself.

---

## Security headers

Three headers are added to every response via a Fastify `onSend` hook:

- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-Frame-Options: DENY` — blocks clickjacking via iframe embedding
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage on cross-origin navigations

The `ADMIN_SECRET` pattern is intentionally minimal. The dashboard is public — stats, charts, leaderboards, even the tracking link. The only things that need protection are reset and config changes. Rather than adding a full auth layer (JWT, sessions, refresh tokens) for two endpoints, an env-var secret sent as a custom header is sufficient. The server refuses to start without it in production, so there's no risk of accidentally deploying with no protection.

---

## Dependency upgrade strategy

During the audit phase, not everything was updated to its latest major version — intentionally.

**Updated:** Fastify 4→5 (high severity security fix), all `@fastify/*` plugins to their v5-compatible versions, `vitest` 1→3 (fixes a moderate esbuild dev-server vulnerability in the test chain), `better-sqlite3` 9→12.

**Intentionally kept:** `tailwindcss` at v3, `vite` at v5, `vue-router` at v4.

Tailwind v4 is a complete rewrite — the config format, the utility names, and the PostCSS integration all changed. Migrating would mean rewriting a significant portion of the CSS across every component for no functional benefit. The two remaining moderate vulnerabilities in the frontend audit are both in `esbuild` via `vite`, and they only affect the development server (`npm run dev`). The production build compiles to static files served by nginx — the vulnerable dev server never runs in production.

---

## What I would change at scale (10M+ visits/day)

At ~115 req/s average with bursty peaks potentially 5–10x higher:

**SQLite → PostgreSQL.** The single-writer model becomes the bottleneck first. Postgres with PgBouncer for connection pooling handles concurrent writes and gives you read replicas.

**Redis for counter increments.** The hot path — `total_visits + 1` — is a perfect fit for `INCR`. Redis handles this atomically at hundreds of thousands of ops/second. The canonical count syncs to Postgres on milestones or on a schedule.

**Async visit ingestion.** Rather than inserting each visit synchronously in the request path, publish to a queue (Kafka, SQS). Consumers aggregate into time-series buckets and write to Postgres. The API layer becomes non-blocking for write acceptance.

**Stateless API layer.** With Redis for counters and Postgres for persistence, the Node.js layer holds no local state. Multiple instances can run behind a load balancer with no sticky sessions.

**Cache the aggregate queries.** The chart queries (`GROUP BY` over a 30-day window) move to a read replica and get cached in Redis with a short TTL. The dashboard polls the cache, not the primary DB.

The geo enrichment path (the `setImmediate` + `ip-api.com` call) already handles scale fairly well — it never blocks responses and the abort timeout prevents hanging connections. At high volume you'd replace `ip-api.com` with an on-premise MaxMind database to avoid the rate limits and the external network hop.
