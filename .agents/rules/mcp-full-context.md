---
trigger: always_on
---

# MCP Tool Usage — Mandatory Full-Context Rule

## Core Directive

**You MUST proactively use every connected MCP tool to its fullest capability before writing any code, making any plan, or answering any question that touches this project.**

Never assume, guess, or work from memory when a live data source is available via MCP. Fetching real context is always faster and safer than hallucinating stale state.

---

## Required MCP Behaviors by Tool

### 🔵 Linear (`linear/*`)
- Before working on ANY issue: call `get_issue` with `fields: [title, description, priority, estimate, status, labels, assignee, createdAt, updatedAt]` to get the **complete, untruncated** issue spec.
- Before auditing or planning: call `list_issues` across all relevant states to understand the full backlog.
- After completing work: always call `save_issue` to update `state` (Done / In Progress), set `assignee`, and append implementation notes to the description via `patch`.
- Use `list_issue_statuses` to understand the exact valid state names for the workspace before updating statuses.
- Use `save_comment` to leave implementation summaries on issues for team visibility.

### 🟢 Supabase (`supabase/*`)
- Before writing any backend route, migration, or query: call `list_tables` to inspect the **live schema** for the relevant project.
- Use `execute_sql` to verify column names, constraints, indexes, and existing data before writing DML or DDL.
- Use `list_migrations` to understand what migrations already exist and avoid duplicating schema changes.
- Use `get_project_url` and `get_publishable_keys` to get live connection details rather than assuming .env values.
- Use `query_logs` to investigate runtime errors before guessing at root cause.
- Use `get_advisors` to surface performance and security warnings.

### 🟠 Render (`render/*`)
- Before deploying or touching infra: call `list_services` and `get_service` to understand the live deployment state.
- Use `list_deploys` and `get_deploy` to check whether recent changes are live before debugging.
- Use `list_logs` to read actual runtime logs when diagnosing errors, instead of guessing.
- Use `get_metrics` to understand real CPU/memory usage before recommending infrastructure changes.
- Use `update_environment_variables` when adding new secrets rather than asking the user to do it manually.
- Use `trigger_deploy` after code changes are committed to kick off a fresh deploy.

### 🟣 Postman (`postman-mcp-server/*`)
- Before building a new API route: call `getCollections` and `getCollection` to check for existing documented contracts.
- Use `getSpec` / `getSpecDefinition` to read the OpenAPI spec for the project before implementing clients.
- Use `createCollectionRequest` to document new routes as you implement them.
- Use `runCollection` to validate that existing API contracts still pass after code changes.

### 🔶 Stitch (`stitch/*`)
- Before implementing any UI screen: call `list_screens` and `get_screen` to retrieve the design spec.
- Reference Stitch screen designs for component layout, color tokens, and interaction patterns.
- Use `list_design_systems` and `apply_design_system` to ensure every new component uses the established design system.
- Generate screens from stitch project of this project using tools like generate_screens_from_text or other for a consistent design.

---

## General Rules

1. **Never truncate MCP responses.** If a result says "use `get_issue` for full description", do so before proceeding.
2. **Chain MCP calls in parallel** when the results are independent (e.g., fetch the issue + list the schema simultaneously).
3. **Always close the loop on Linear.** Every issue worked on must have its Linear status updated to reflect actual work state.
4. **Cross-reference across MCPs.** Read the Linear issue → check the Supabase schema → read the Render logs — then implement.
5. **Prefer live data over assumptions.** If a table column, env variable, API route, or design spec can be fetched via MCP, fetch it.
6. **Document as you go.** After implementing, update Postman collections, Linear descriptions, and leave comments so future context fetches are richer.
7. You can use all the tools depending on the task or context you have, because we need to act as a team at a corporate organization or a team of cofounders who can't afford any mistakes.
---

## Codebase Hygiene — Non-Redundancy Rules

### Before Writing Any New Code
1. **Search first.** Use `grep_search` or `list_dir` to check if equivalent logic already exists before implementing anything new. Duplicate utility functions, helpers, middleware, and DB queries are forbidden.
2. **Reuse, don't reinvent.** If a function does 90% of what you need, extend it — do not create a parallel version alongside it.
3. **One source of truth per concern.** Each piece of logic (e.g., anti-passback check, HMAC verification, Supabase client init) must live in exactly one place. If it needs to be used in multiple routes/files, extract it to a shared helper or middleware.

### When Adding to Existing Files
1. **Read the entire file first.** Never add to a file without reading it fully. Adding a function that already exists is a regression.
2. **Consolidate before you add.** If you see near-duplicate code blocks during a read, refactor them into one before adding new functionality.
3. **No copy-paste between routes.** Logic duplicated across `/unlock` and `/scanner/checkin` (and any future route) must be extracted into a shared helper, not copy-pasted.

### Schema & Migrations
1. **Check `list_tables` and `list_migrations` before any schema change.** A column that already exists must never be re-added.
2. **Migrations are append-only.** Never modify an existing migration file. Always create a new one for changes.
3. **No redundant indexes.** Verify via `execute_sql` that an index does not already exist before creating one.

### Dependencies
1. **Check `package.json` before installing.** Never `npm install` a package that is already listed as a dependency.
2. **Prefer existing packages.** If `node-fetch` is already installed, do not add `axios` to do the same job.

### General Cleanliness
- Dead code (commented-out blocks, unused imports, unreachable branches) must be removed, not left in place.
- Every new function must have a single, clearly named responsibility. No god-functions.
- Constants (e.g., `ANTI_PASSBACK_WINDOW_MS`) must be defined once at module scope, never magic-numbered inline.

---

## Supabase Migrations & Scripts — Execution-Only Policy

### Absolute Rules
1. **Never write migration files to disk.** Do not create `.sql` files, migration scripts, or seed files in the repository. The `supabase/migrations/` directory must remain empty unless a file was placed there by the user directly.
2. **Never write temporary or test scripts to disk.** Do not create `test.js`, `seed.sql`, `fix.sql`, `temp.js`, `debug.js`, or any equivalent one-off script file anywhere in the codebase.
3. **Execute immediately via MCP.** All SQL changes (schema alterations, data fixes, index creation, RLS policies, seed data) must be run live using `supabase/execute_sql` or `supabase/apply_migration` at the time they are needed — not saved for later.

### Why
- Migration files left on disk without being applied create a false sense of progress and cause schema drift.
- Temporary scripts accumulate and pollute the codebase with dead, untested code.
- The Supabase MCP gives direct execution access — there is no reason to write intermediate files.

### Correct Workflow for Schema Changes
```
1. supabase/list_tables        → verify current schema state
2. supabase/list_migrations    → check what has already been applied
3. supabase/execute_sql        → run the change live against the database
4. supabase/execute_sql        → verify the change took effect (SELECT / \d)
```

### Correct Workflow for Data Fixes / Seeds
```
1. supabase/execute_sql  → run INSERT / UPDATE / DELETE directly
2. supabase/execute_sql  → verify rows with a SELECT
```

Never intermediately write these statements to a file. Run them directly.
