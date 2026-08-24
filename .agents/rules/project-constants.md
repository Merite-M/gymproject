# GymPartner — Project Constants & IDs
> Hard reference values for all agents. Never guess these. Always use these exact values.

---

## Service & Project IDs

| Service | ID |
|---|---|
| **Supabase Project ID** | `omufxcaifzqepvqbgghc` |
| **Linear Team ID** (GymPartner) | `c197d0a6-735c-42f8-b79f-49da27c8d063` |
| **Render Backend Service ID** (`gym-backend-core`) | `srv-d9the17avr4c73bro63g` |
| **Render Frontend Service ID** (`gym-frontend-app`) | `srv-d9theku5djic739sq62g` |
| **Render Workspace ID** (`My Workspace`) | `tea-d9q4k2flk1mc73eir7u0` |
| **Stitch Project ID** (`GymPartner — Operations Console`) | `16498663316307719095` |

---

## Repository Layout

```
gymproject/                         ← monorepo root
├── src/
│   ├── backend/                    ← Node.js / Express 5 (Render Web Service)
│   │   ├── index.js                ← Express app entry point
│   │   ├── authMiddleware.js       ← Centralized Bearer token auth
│   │   ├── events.js               ← gymEmitter singleton (EventEmitter)
│   │   ├── iot.js                  ← IoT unlock + scanner routes
│   │   ├── payments.js             ← Paypack / MTN MoMo webhooks
│   │   ├── cron.js                 ← Dunning, billing, churn cron jobs
│   │   └── ...                     ← Other route modules
│   └── frontend/                   ← Next.js 16 static export (Render Static Site)
│       ├── src/app/                ← App Router pages
│       ├── src/components/         ← shadcn/ui + custom components
│       └── src/lib/api/            ← All fetch calls to backend (no inline fetch)
├── supabase/migrations/            ← MUST remain empty (apply via MCP only)
├── render.yaml                     ← Exactly 2 services: 1 web + 1 static
└── .agents/rules/                  ← Agent governance rules (this directory)
```

---

## Standard Commands

### Frontend
```bash
cd src/frontend
npm run lint          # ESLint FlatConfig (eslint.config.mjs) — run before every PR
npm run build         # Produces static export to src/frontend/out/
```

### Serving Static Export Locally
```bash
# NOT npm run start — the app is a static export
npx serve@latest src/frontend/out -l 3000
# When writing Playwright tests, target .html files explicitly:
# http://localhost:3000/members.html  (NOT http://localhost:3000/members)
```

### Backend
```bash
cd src/backend
node index.js         # Start the Express server
npm run test          # Jest tests (supertest installed)
# Note: no lint or build scripts exist in backend package.json
```

---

## Key Environment Variables

| Variable | Used in | Purpose |
|---|---|---|
| `SUPABASE_URL` | backend | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | backend | Service role key (never expose to frontend) |
| `FRONTEND_URL` | backend | Allowed CORS origin |
| `JWT_SECRET` | backend | HMAC signing for access tokens |
| `NEXT_PUBLIC_SUPABASE_URL` | frontend | Must have safe fallback `http://127.0.0.1:54321` at build time; throw hard error at runtime if missing |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | frontend | Public anon key |

---

## Architecture: Why Two Render Deployments (Non-Negotiable)

This is intentional. Never collapse into one service or add a third.

### Render Web Service (`gym-backend-core`) — $7/month
- Always-on Express 5 server: handles IoT door unlock (<100ms), WebSocket streams, payment webhooks, background cron dunning, CRDT sync
- Cannot be serverless — Shelly relay cold-starts would block members at the door for 10–50 seconds
- Holds all secrets (Paypack, MTN MoMo, SMS gateway) — never exposed to browser

### Render Static Site (`gym-frontend-app`) — $0/month
- Next.js compiled as a pure static SPA (`output: 'export'`)
- Hosted on Render CDN with unlimited bandwidth, white-labeled for 100+ gyms at $0
- Has NO backend logic — all API calls go to the Express backend
- Uses WASM SQLite (sql.js) in IndexedDB for offline-first operation in low-connectivity markets

### Why Express + Supabase (not just Supabase PostgREST)
- Paypack / MTN MoMo webhooks require HMAC signature verification in server middleware — Supabase cannot intercept third-party webhook headers
- Payment gateway routing (Paypack RW → Flutterwave NG → Stripe EU) requires a strategy pattern in Express
- Service role key must never reach the browser — Express acts as the secure firewall

### Why WASM SQLite + Supabase (not just Supabase)
- East African connectivity: power cuts and fiber drops are frequent
- Local SQLite (sql.js in IndexedDB) commits check-ins with zero network latency
- CRDT sync engine pushes compressed packets to Express → Supabase when connectivity restores

---

## Payment Architecture

| Gateway | Fee | Use Case |
|---|---|---|
| **Paypack** (aggregator) | ~2.36% | Small gyms, fast onboarding, unified MTN + Airtel API |
| **Direct MTN MoMo** | ~1.77% | High-volume enterprise gyms (e.g., Kigali Serena) |

Both must be supported. Never remove either gateway path.
