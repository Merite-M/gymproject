# GymPartner — Agent Governance Framework

> Applies to all AI agents working on this codebase.
> Stack: Node.js (Express 5) backend · Next.js 16 / React 19 / TypeScript 5 frontend · Supabase (PostgreSQL + Realtime + Storage) · Render (single Web Service + Static Site) · Tailwind CSS v4 · shadcn/ui · Zustand

---

## 0. Adaptation & Capability Override Protocol

### 0.1 Prompt Priority
**Direct User Prompts always take absolute precedence over these rules.** If the user explicitly directs you to violate a rule (e.g., leaving a temporary test script, writing a migration file, introducing a new library, or bypassing standard patterns), you must follow the user's prompt immediately.

### 0.2 Adaptability to Model Capabilities
- Do not bottleneck your capabilities. If a model in a session has a more optimal, clean, or modern way of executing a task than what is outlined here, it should use its advanced reasoning to adapt.
- Rules are intended as **guardrails for system stability, safety (RLS/Multi-tenancy), and cost control ($7/mo target)**, not as a straightjacket that forces obsolete patterns.
- If a rule limits performance or security under the current context, the agent must proactively propose the better path to the user or execute it autonomously if it is clearly superior and safe.

### 0.3 Evolving Knowledge
- If you discover during execution that a rule is outdated, contradictory, or can be improved, update these rule files directly or suggest an update. Keep the rules living, practical, and optimized for maximum development velocity.

---

## 1. Deterministic Execution & Tool-First Discovery

### 1.1 Always Query Before You Code
Before generating any code, agents MUST confirm live state via MCP tools:

| Need to know | Required MCP call |
|---|---|
| What tables/columns exist | `supabase/list_tables` + `supabase/execute_sql` |
| What packages are installed | Read `src/backend/package.json` or `src/frontend/package.json` |
| What routes already exist | `grep_search` for `router.` in `src/backend/` |
| What components already exist | `list_dir` on `src/frontend/src/components/` |
| What issues are in scope | `linear/get_issue` (full fields, never truncated) |
| Current deployment state | `render/list_services` + `render/get_service` |
| Latest build logs | `render/list_logs` |

### 1.2 Pre-Execution Input Validation
Before calling any destructive tool (SQL write, file delete, Render env update):
1. Log the exact payload that will be sent.
2. Confirm the target is the correct Supabase project or Render service.
3. Never run destructive SQL (`DROP`, `TRUNCATE`, `DELETE` without `WHERE`) without quoting the exact statement first and receiving implicit confirmation from the user.

### 1.3 Idempotency Mandate
Every backend route, migration, and script must be safe to execute multiple times:
- SQL inserts must use `ON CONFLICT DO NOTHING` or `ON CONFLICT DO UPDATE` where applicable.
- API handlers must return the same deterministic response when called with identical inputs.
- State changes must be guarded by existence checks (e.g., check if a row exists before inserting).

### 1.4 Mandatory Failure Handling
Every `async` Express route and Next.js Server Action MUST have:
```js
// Backend (Express 5 — errors propagate automatically, but still handle explicitly)
try { ... } catch (error) {
  console.error('[route-name] error:', error);
  res.status(500).json({ error: 'Internal server error' });
}
```
```ts
// Frontend fetch calls
const res = await fetch(url, options);
if (!res.ok) throw new Error(`[api-name] ${res.status}: ${await res.text()}`);
```
No silent failures. No swallowed `catch` blocks. No `.catch(() => {})`.

---

## 2. Code Quality & Anti-Boilerplate

### 2.1 Search Before Writing
Before writing ANY new function, helper, type, or component:
1. Run `grep_search` for similar logic in `src/backend/` and `src/frontend/src/`.
2. Run `list_dir` on the relevant component or utility folder.
3. If an equivalent exists, extend or reuse it. Do NOT create a parallel version.

**Known shared utilities to always reuse:**
- Supabase client → only initialized once per file from env vars; never re-create inline.
- `gymEmitter` (`src/backend/events.js`) → all event emissions go through this singleton.
- `getSafeIpAndHost()` (`src/backend/iot.js`) → the SSRF validator; do not rewrite inline.
- `checkAntiPassback()` (`src/backend/iot.js`) → the anti-passback helper; do not duplicate.

### 2.2 Zero Boilerplate
- **Backend:** Never write raw SQL strings inline in route handlers. Extract complex queries to a named function.
- **Frontend:** Never write raw `fetch` calls inline in components. All API calls go through a dedicated service file in `src/frontend/src/lib/api/`.
- **No repeated Supabase client init.** Each file inits its own client from env vars — that is the established pattern. Do not centralize unless the user asks.
- **No inline styles.** All styling uses Tailwind CSS v4 utility classes and existing design tokens from `components.json`.
- **No hardcoded colors or spacing.** Use Tailwind tokens only.

### 2.3 Lint Compliance
Before finalizing any frontend code, it must comply with [`eslint.config.mjs`](file:///e:/GymProject/gymproject/src/frontend/eslint.config.mjs):
- `react-hooks/rules-of-hooks` → **error** — never violate hook call order.
- `@next/next/no-img-element` → use `<Image>` from `next/image` instead of `<img>`.
- Run `npm run lint` in `src/frontend/` to verify before considering frontend work done.

### 2.4 TypeScript Type Safety
- `tsconfig.json` has `"strict": true`. All generated TypeScript must honor it.
- **No `any` types.** The current ESLint config has `no-explicit-any: off` as a temporary workaround — do NOT exploit this. Write proper types.
- All Supabase query results must be typed. Use `supabase/generate_typescript_types` to get the live schema types when needed.
- All props interfaces, API response shapes, and Zustand store slices must have explicit type definitions.

### 2.5 Self-Documentation
- Every new Express route must have a JSDoc comment with: method, path, required body fields, and response shape.
- Every new React component must have a JSDoc comment describing its purpose and props.
- Every exported utility function must have a single-line JSDoc summary.

---

## 3. Risk Mitigation & Zero-Mistake Guardrails

### 3.1 Never Push to Main Directly
- All code changes must be made on the branch specified in the Linear issue (`gitBranchName` field from `linear/get_issue`).
- The branch naming convention is already set by Linear: `meritemucyo25ba/gym-XX-...`.
- Never commit directly to `main`. Always work on the feature branch.

### 3.2 Supabase Schema Safety
- **Read before write:** Always `supabase/list_tables` + `supabase/execute_sql` to inspect schema before any DDL.
- **No migration files on disk.** (See `mcp-full-context.md`.) All schema changes run live via `supabase/execute_sql`.
- **RLS on every table.** Any new table created must have Row-Level Security enabled and tenant isolation via `tenant_id`.
- **Always verify after applying:** Run a `SELECT` to confirm the change took effect.

### 3.3 Secrets & Security
- **No secrets in code.** All credentials live in `.env` (backend) or `.env.local` (frontend). Never hardcode API keys, JWT secrets, or Supabase URLs.
- **HMAC webhook endpoints** must verify signatures before processing. See `src/backend/payments.js` for the pattern (GYM-36 tracks the fix).
- **All IoT endpoints** must pass the `getSafeIpAndHost()` SSRF check before making outbound HTTP requests.
- **Anti-passback** must remain in both `/unlock` and `/scanner/checkin`. Do not remove it.

### 3.4 Multi-Tenant Isolation
This is a multi-tenant SaaS. Every single database query — reads and writes — MUST filter by `tenant_id`. Failure to do so is a critical security regression. No exceptions.

---

## 4. Frontend & UI Realization

### 4.1 Design System Compliance
- **Component library:** shadcn/ui components (already installed). Use existing components from `src/frontend/src/components/` before creating new ones.
- **Stitch first:** Before implementing any new screen, call `stitch/list_screens` and `stitch/get_screen` to retrieve the design spec.
- **Design tokens:** Use the tokens defined in `components.json` and Tailwind config. Never use arbitrary color values.
- **Typography:** Manrope for headings, Inter for body text — as specified in the GymPartner Operations design system.
- **Touch targets:** Minimum 44px for all primary interactive elements.

### 4.2 Next.js 16 Specific Rules
- Read `node_modules/next/dist/docs/` (or the AGENTS.md note in `src/frontend/`) before using any Next.js API — this version has breaking changes from training data.
- Use `<Image>` from `next/image`, never `<img>`.
- Use App Router conventions (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`).
- All data fetching in Server Components where possible; use `'use client'` only when interactivity requires it.
- API routes belong in `src/frontend/src/app/api/` only when they cannot go to the backend.

### 4.3 State Management
- Global state lives in Zustand stores (already installed).
- Server state (API data) is not put in Zustand — fetch it in Server Components or use React state locally.
- No prop drilling more than 2 levels deep — extract to Zustand or context.

### 4.4 Responsiveness & Accessibility
- All new UI must be tested at: mobile (375px), tablet (768px), desktop (1280px).
- Every interactive element must be keyboard-navigable.
- Color contrast must meet WCAG 2.2 AA minimum (4.5:1 for normal text, 3:1 for large text).
- All `<img>` / `<Image>` tags must have descriptive `alt` text.
- Form inputs must have associated `<label>` elements.

### 4.5 Performance
- No new `npm` packages that replicate functionality of already-installed packages.
- Lazy-load heavy components with `next/dynamic`.
- No unoptimized images — always use `next/image` with explicit `width` and `height`.

---

## 5. Linear Issue Lifecycle (Mandatory)

Every piece of work tied to a Linear issue MUST follow this sequence:

```
1. linear/get_issue          → Read full spec (never truncated)
2. [Research & implement]    → Using all relevant MCP tools
3. linear/save_issue         → state: "In Progress" at start
4. [Complete implementation]
5. linear/save_comment       → Leave implementation summary
6. linear/save_issue         → state: "Done", assignee: "me"
```

Never close an issue without a comment documenting what was changed and where.

---

## 6. Render Deployment Protocol

After any backend code change:
```
1. render/list_services      → confirm service ID
2. render/get_service        → confirm current deploy status
3. [git commit on feature branch]
4. render/trigger_deploy     → kick off new deploy
5. render/list_deploys       → monitor deploy status
6. render/list_logs          → verify no runtime errors post-deploy
```

Environment variables are managed via `render/update_environment_variables`, never by asking the user to do it manually in the dashboard.
