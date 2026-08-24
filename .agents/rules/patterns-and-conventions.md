# GymPartner — Patterns, Conventions & Anti-Patterns
> Codified learnings from production. Every rule here exists because the wrong approach was tried.

---

## Backend Patterns

### Authentication
- **Always use** `src/backend/authMiddleware.js` for route-level auth.
- It extracts the Bearer token from the `Authorization` header and validates via `supabase.auth.getUser(token)`.
- Never re-implement inline token validation in individual route files.
```js
// Correct
const authMiddleware = require('./authMiddleware');
router.post('/my-route', authMiddleware, async (req, res) => { ... });

// Wrong — never do this inline
const token = req.headers.authorization?.replace('Bearer ', '');
const { data: { user } } = await supabase.auth.getUser(token); // duplicated logic
```

### Async Tasks & Event Queue
- Use `gymEmitter` (Node.js EventEmitter in `src/backend/events.js`) pushing to the `notification_queue` Supabase table.
- The existing cron engine in `src/backend/cron.js` processes the queue.
- **Never** introduce Redis, BullMQ, or any external queue service — this violates the two-Render-deployment architecture and adds cost.

### CORS
- Allowed origin is controlled by the `FRONTEND_URL` environment variable in the backend.
- Never hardcode frontend URLs. Use `render/update_environment_variables` if this needs updating in production.

### Idempotency in SQL
```sql
-- Always prefer
INSERT INTO table (...) VALUES (...) ON CONFLICT (id) DO NOTHING;
-- Over a blind INSERT that will error on duplicate
```

---

## Frontend Patterns

### API Calls
- All `fetch` calls to the backend live in `src/frontend/src/lib/api/` — never inline in components.
- Always send `null` (not `undefined`) for empty nullable fields in API payloads:
```ts
// Correct — backend receives explicit null
body: JSON.stringify({ end_date: value || null })

// Wrong — undefined is stripped by JSON.stringify, backend never sees it
body: JSON.stringify({ end_date: undefined })
```

### FormData & TypeScript Strictness
- Provide string fallbacks when appending nullable values to FormData:
```ts
formData.append('field', value || '');  // Correct
formData.append('field', value);        // Wrong if value can be null/undefined
```

### Boolean Feature Toggles
- When reading boolean feature flags from the `tenants` Supabase table, always coerce nulls:
```ts
const isEnabled = data?.staff_roster_enabled ?? true;  // Correct — null → default on
const isEnabled = data?.staff_roster_enabled;          // Wrong — null silently disables feature
```
- Feature toggles are stored as boolean columns directly on the `tenants` table (e.g., `staff_roster_enabled`).
- Never use a separate feature-flags table or external service.

### Supabase Client (Frontend)
- `src/lib/supabase.ts` must provide a safe non-routable fallback for `NEXT_PUBLIC_SUPABASE_URL` at build time:
```ts
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
// At runtime, throw if missing — never silently route to the fallback
if (typeof window !== 'undefined' && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
}
```

### State Management
- **Zustand** for global app state, combined with a hybrid React Context pattern for global tenant scoping.
- The `tenant_id` of the authenticated user must be available globally via context — never passed as props through 3+ levels.
- Server state (Supabase query results) lives in component state or Server Components — not in Zustand.

### Component Library
- **shadcn/ui** is the component library. Before creating a new UI primitive, check `src/frontend/src/components/ui/` first.
- Never install a new component library — extend shadcn/ui components instead.

### Next.js Static Export Rules
- `output: 'export'` is set in `next.config.js`. This is non-negotiable.
- Never add Next.js API routes (`/app/api/`) for anything that could go in the Express backend.
- Use `'use client'` only when browser APIs or interactivity are strictly required.
- Use `next/dynamic` for heavy components to keep initial bundle small.
- Use `<Image>` from `next/image` — never `<img>`.
- ESLint config is FlatConfig (`eslint.config.mjs`) — never create `.eslintrc.json`.

---

## Database Patterns

### Schema Verification (Required before any DDL)
```sql
-- Always filter by specific table/column to avoid truncation
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'check_ins'
  AND column_name IN ('id', 'tenant_id', 'profile_id', 'status', 'created_at');
```

### Multi-Tenancy (Non-Negotiable)
- `tenants` is the root table. Every other table has `tenant_id` (UUID FK).
- `branches` supports hierarchical locations under a tenant.
- Every SELECT, INSERT, UPDATE, DELETE MUST filter by `tenant_id`.
- Every new table MUST have RLS enabled with a `tenant_id`-based policy.

### No Migration Files
- Apply all schema changes directly via `supabase/execute_sql`.
- The `supabase/migrations/` directory must remain empty.
- Always verify the change with a follow-up `execute_sql` SELECT.

---

## UI Design System

### Typography
- **Manrope** — headings
- **Inter** — body text

### Design Tokens
- Colors, spacing, and animation must use Tailwind CSS v4 tokens from `components.json`.
- No arbitrary values, no hardcoded hex colors, no inline `style={{}}` attributes.

### Stitch Workflow (Mandatory for New Screens)
1. Call `stitch/list_screens` to find if a screen spec already exists.
2. If not, call `stitch/generate_screen_from_text` to generate it.
3. **Wait for generation to fully complete** before writing any integration code.
4. Call `stitch/get_screen` to retrieve the final spec.
5. Implement strictly to spec — do not invent UI not in the design.

---

## Testing & Temporary Files

### Frontend Visual Testing (Playwright)
- Write Playwright scripts in Python for UI screenshot/video capture against the locally served static export.
- Target `.html` files explicitly: `http://localhost:3000/members.html`
- **Before any commit:** delete ALL temporary test scripts, log files, and mock data.
- Temporary files must NEVER appear in a PR diff. Verify with `git status` before committing.

### Backend Testing
- Jest + supertest (installed in `src/backend/`).
- Run via `cd src/backend && npm run test`.
- No build or lint scripts exist in backend `package.json` — do not assume they do.

---

## Linear Issue Lifecycle (Strict)

- Mark issue `In Progress` when work starts.
- Mark issue `Done` ONLY when ALL layers are complete: database schema, backend route, frontend UI.
- If only the database layer is done, status stays `In Progress`.
- Always leave a `save_comment` with: files changed, what was implemented, and how to verify.
- Use `gitBranchName` from `get_issue` response to set the correct branch name.

---

## Agent Role & Mindset

- Act as a **high-agency Technical Co-Founder and Lead Systems Architect**.
- Prioritize: capital efficiency ($7/month target) · real-time socket stability · pixel-perfect corporate SaaS UI · zero CORS issues.
- Be **proactive and autonomous** — use MCP tools without waiting to be told.
- Never use mock data or fake implementations. Always wire to real Supabase.
- Never introduce external paid services without explicit discussion.
- Long-term robustness over quick fixes, always.
