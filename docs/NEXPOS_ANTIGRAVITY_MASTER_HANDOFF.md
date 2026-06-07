# NEXPOS Antigravity Master Handoff

> Handoff date: 2026-06-07
> Branch at time of handoff: `feat/phase-f-operational-modules`
> Author of this handoff: Claude Code (final transcript before subscription pause)
> Intended executor: Google Antigravity agent
> Scope: architecture and execution rules only — no code changes, no commits, no remote DB mutation

---

## 1. Project Identity

### What NEXPOS is

NEXPOS is a **universal commerce / POS operating system** built for Tanzanian SMEs and East African expansion. It targets:

- Physical retail stores (single-branch and multi-branch)
- Wholesalers
- Social sellers (WhatsApp / Instagram / Facebook)
- Hybrid online/offline businesses
- Owner-operated and staff-operated shops

It is operated from desktop (owner / manager) and mobile (cashier / staff / on-the-floor owner).

### Who NEXPOS serves

- **Owners** — strategic oversight, multi-branch view, money flow, staff control
- **Managers** — branch-level oversight, inventory, reconciliation
- **Cashiers / staff** — POS, returns, till, limited customer/credit access
- **Customers (future)** — public catalog browsing via shareable store link, pickup / delivery selection

### What NEXPOS must NOT become

- A shoe-store-specific app. The seed data (Air Force 1, Stan Smith, Timberland, etc.) is **demo only**. Schema, copy, and UI must remain universal.
- A generic SaaS dashboard. NEXPOS is operational, dense, Tanzanian-fintech-flavoured (Selcom / M-Pesa / Tigo Pesa utility tone), not enterprise B2B blue/cyan.
- A consumer e-commerce platform. The shop link is a thin lead-generation layer over the POS, not a Shopify rebuild.
- A "coming soon" demo. Every screen ships with a real production shell — even backend-incomplete screens show honest activation state instead of mock data.

---

## 2. Current Stack and Architecture

### Frontend

- **Next.js 16.2.6 App Router** (webpack mandatory — Turbopack causes compaction crashes on this codebase; never re-enable)
- **TypeScript** strict mode
- **Tailwind CSS** with NEXPOS dark design tokens (`nx-*` namespace)
- **React Server Components** by default, `'use client'` only where state/effects required
- **Server Actions** for mutations (zod-validated, stable result shape)
- `lucide-react` for icons (no emojis)

### Backend

- **Supabase Postgres 17** (project ref `pdubwhohyxcjhuemigne` for the active remote instance the team has been using; secondary remote `wvlvnwyrnrdgysgtvibb.supabase.co` referenced in `.env.local` is a separate test target — confirm with team before touching)
- **`public.ulid` domain type** for all IDs except `auth.users` (uuid)
- **`public.generate_ulid()`** for server-side ID generation
- **SECURITY DEFINER RPCs** for all sensitive multi-step mutations (sales completion, till open/close/review, stock adjustments)
- **Audit log** (`audit.activity_log`) written via `public.write_audit_log()` with swallowed exceptions so audit failures never abort business transactions

### Auth

- **Supabase Auth** with `@supabase/ssr@0.10`
- JWT carries `app_metadata.{tenant_id, role, branch_id}` — **server-controlled, never editable by users**
- Helper SQL functions: `current_tenant()`, `current_user_id()`, `current_role()`, `has_role(VARIADIC)`
- All are `STABLE SECURITY DEFINER SET search_path=''`
- Roles in DB: `owner`, `manager`, `cashier`, `viewer` (viewer not yet used by UI)

### RLS

- All `public.*` business tables enable RLS
- SELECT policies typically `tenant_id = public.current_tenant()` plus role/branch refinements
- Mutations either via RPC (preferred) or via tight WITH CHECK policies that re-derive tenant/role from JWT
- **Service-role bypass is strictly forbidden** for any user-triggered code path. Service role is reserved for: tenant provisioning, the seed-users script, and webhook receivers

### Deployment

- **Target:** Vercel (after local Docker smoke passes)
- Build command: `next build --webpack`
- Production output: `standalone`

### Local development

- **Supabase local stack via Docker** (Supabase CLI)
  - API: `http://127.0.0.1:54321`
  - DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
  - Studio: `http://127.0.0.1:54323`
- `supabase db reset` re-applies all migrations from `supabase/migrations/*.sql` then loads `supabase/seed.sql`
- `npx tsx supabase/seed-users.ts` creates dev auth users (must be re-run if `auth.users` is empty)

### PWA / mobile direction

- Target experience: dense, fast, mobile-first, smooth (Selcom Pesa / Tigo Pesa polish — fintech utility, not consumer)
- Side nav on desktop; bottom or sheet nav on mobile (not yet implemented)
- Offline queue + service worker direction noted but **not active**; do not re-enable the old service worker

---

## 3. Current Branch and Git State

### Branch

`feat/phase-f-operational-modules`

### Latest pushed commits (origin)

- `a93d07c` — feat: phase F2 — replace all ComingSoon workspace stubs
- `9009400` — fix: stabilize cashier routing and POS language

### Local-only commits ahead of origin

- `8769884` — feat: activate till sessions backend (G1.1)

### Working tree at handoff time

```
M  .claude/settings.local.json
?? .claude/agents/
?? supabase/snippets/
```

**None of these should ever be staged.** They are local tooling and DB scratchpads.

### What to do before resuming

1. Confirm the G1.1 commit (`8769884`) is what you expect — `git show 8769884 --stat`
2. Push it: `git push origin feat/phase-f-operational-modules`
3. Open a PR against `main` only after a full local smoke pass

### What NEVER to stage

- `.env.local` (gitignored, contains Supabase URL / keys)
- `.claude/settings.local.json` (local Claude Code permission state)
- `.claude/agents/` (local agent definitions)
- `supabase/snippets/` (local SQL scratchpads)
- Any file under `node_modules/`, `.next/`, `dist/`

---

## 4. Completed Work Summary

### Phase F2 — Workspace stub replacement

- Every `ComingSoon` placeholder under `/app/*` was replaced with a real production shell
- Each shell either renders against real schema or shows an explicit, honest activation state (no fake data, no "coming soon" copy)
- Workspace nav layout stabilised; cashier nav restricted to the universal route set

### Cashier routing and POS language

- Cashier home is `/app/pos`
- `/app/dashboard` and `/app/control-center` redirect cashiers to `/app/pos` (no infinite loop)
- Cashier-allowed routes: `/app/pos`, `/app/orders`, `/app/returns`, `/app/till`, `/app/customers` (`UNIVERSAL_ROUTES` in [lib/auth/permissions.ts](lib/auth/permissions.ts))
- POS copy universalised — English mode no longer mixes Swahili
- **Known carryover:** [lib/auth/permissions.ts:155-194](lib/auth/permissions.ts:155) still emits mixed-language error messages in `validateServerMutation`. Cleanup deferred — see §12.

### G1.1 — Till Sessions backend

- Migration: [supabase/migrations/20260101000018_till_sessions.sql](supabase/migrations/20260101000018_till_sessions.sql)
- Server actions: [lib/actions/till.ts](lib/actions/till.ts)
- Pure math helper: [lib/actions/till-math.ts](lib/actions/till-math.ts)
- Page: [app/(workspace)/app/till/page.tsx](app/(workspace)/app/till/page.tsx)
- Container: [app/(workspace)/app/till/till-container.tsx](app/(workspace)/app/till/till-container.tsx)
- Tests: [tests/till-close-math.test.ts](tests/till-close-math.test.ts) — 5/5 passing
- Open / close / dispute / accept-review flow smoke-tested locally against the seeded TENANT01

---

## 5. G1.1 Till Sessions Technical Notes

### Migration

`public.till_sessions` columns:

| Column | Type | Notes |
|---|---|---|
| `id` | `public.ulid` PK | `DEFAULT public.generate_ulid()` |
| `tenant_id` | `public.ulid` FK → `tenants(id)` | NOT NULL |
| `branch_id` | `public.ulid` FK → `branches(id)` | NOT NULL |
| `cashier_id` | `uuid` FK → `auth.users(id)` | NOT NULL |
| `opening_float` | `numeric(14,2)` | NOT NULL DEFAULT 0, ≥ 0 |
| `opened_at` | `timestamptz` | NOT NULL DEFAULT now() |
| `closed_at` | `timestamptz` | NULL until close |
| `actual_cash_counted` | `numeric(14,2)` | NULL until close, ≥ 0 when set |
| `expected_cash` | `numeric(14,2)` | NULL until close; G1.1 = opening_float |
| `variance` | `numeric(14,2)` | signed, NULL until close |
| `status` | `text` CHECK (`open`, `closed`, `disputed`) | NOT NULL default `open` |
| `close_mode` | `text` CHECK (`normal`, `blind`) | NULL until close |
| `owner_reviewed_at` | `timestamptz` | NULL until reviewed |
| `owner_reviewer_id` | `uuid` FK → `auth.users(id)` ON DELETE SET NULL | |
| `notes` | `text` | cashier close notes |
| `review_notes` | `text` | owner/manager notes — **separate column**, never overwrites cashier notes |
| `created_at` | `timestamptz` | NOT NULL DEFAULT now() |

**No `updated_at`** — would require a trigger to be meaningful; deferred to G1.2.

### Indexes

- `UNIQUE (branch_id, cashier_id) WHERE status='open'` — one open till per cashier per branch
- `(tenant_id, branch_id, opened_at DESC)` for recent-sessions listing
- single-column on `branch_id`, `cashier_id`, `status`

### RLS

- SELECT for owner/manager: `tenant_id = current_tenant() AND has_role('owner','manager')`
- SELECT for cashier: `tenant_id = current_tenant() AND cashier_id = current_user_id()`
- **No INSERT / UPDATE / DELETE policies** — all mutations exclusively via RPCs

### RPCs (SECURITY DEFINER, SET search_path='')

- `open_till_session(p_branch_id, p_opening_float)` — validates branch belongs to tenant, validates cashier branch alignment, enforces single-open invariant via partial unique index
- `close_till_session(p_session_id, p_actual_cash_counted, p_close_mode, p_notes)` — sets `expected_cash = opening_float`, `variance = actual - opening_float`, `status = closed` if variance is 0 else `disputed`
- `review_till_session(p_session_id, p_decision, p_notes)` — owner/manager only, only `p_decision='accept'` supported in G1.1, rejects sessions not in `closed`/`disputed`

All three RPCs write to `audit.activity_log` via `public.write_audit_log()`.

### Variance semantics (critical)

In G1.1 `variance` is **NOT true drawer variance** — it is the **unreconciled difference between counted cash and opening float only**. Cash sales are not yet linked. UI labels this explicitly:

- "Opening Float Only" — not "Expected Cash"
- "Unreconciled Difference" — not "Variance"
- "Cash sale linkage activates in G1.2."

Do not relabel until G1.2 is shipped.

### Local JWT / app_metadata / RLS finding

During local smoke testing the branch selector was empty for the owner. Root cause:

- `current_tenant()` reads JWT `app_metadata.tenant_id`
- The local seeded `auth.users.raw_app_meta_data` for `owner@nexpos.dev` contained only `{provider, providers}` — **no tenant_id, role, or branch_id**
- `current_tenant()` returned NULL, the `branches_select` RLS policy stripped every row, and the page showed "no active branches" misleadingly

Fix applied locally:

```sql
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data
  || jsonb_build_object(
       'tenant_id', '01HZDEV00000000000TENANT01',
       'role',      'owner',
       'branch_id', null
     )
WHERE email = 'owner@nexpos.dev';
```

Plus the page-level code now captures the query error and surfaces a diagnostic message when an authenticated tenant returns zero branches, instead of silently showing the "activate a branch" copy.

**JWT re-login is required** after any `app_metadata` change — the existing session JWT is stale until sign-out/sign-in.

### seed-users.ts follow-up (Antigravity to fix in a small dedicated phase)

`supabase/seed-users.ts` currently calls `ensureProfile()` for existing users but **does not refresh** their `app_metadata`. If the script runs against a DB where the user already exists but the claims drifted, the user is left half-broken. Recommended patch shape (for the future commit, not now):

```ts
if (existing) {
  await supabase.auth.admin.updateUserById(existing.id, {
    app_metadata: {
      tenant_id: user.tenantId,
      role:      user.role,
      branch_id: user.branchId,
    },
  })
  await ensureProfile(existing.id, user)
  continue
}
```

### Why G1.2 must come next

G1.1 ships a real till session lifecycle, but it cannot answer the basic owner question *"is the drawer over / short relative to actual sales?"* until cash sales are linked to the open session. Until G1.2:

- Every closed session with non-zero counted-vs-opening difference is flagged `disputed` even when it represents legitimate sales
- The "Unreconciled Difference" label is the only honest framing
- The audit log records the lifecycle but cannot reconstruct expected cash

G1.2 closes this loop and unlocks credible day-end reporting for owners.

---

## 6. Backend Activation Roadmap

Phases are sequential. **Do not jump ahead.** Each phase ends with build + typecheck + unit test + manual smoke. No phase mutates remote DB without explicit user approval.

### G1.2 — Cash Sales ↔ Till Sessions linkage

- **Goal:** Link every cash sale to the open till session for the cashier-branch pair so `expected_cash` reflects reality.
- **Schema:**
  - Add `till_session_id public.ulid REFERENCES public.till_sessions(id) ON DELETE RESTRICT` to `public.sales` (nullable for non-cash; required for `payment_method='cash'` via deferred constraint or trigger)
  - Optional index: `(till_session_id, completed_at DESC)`
- **RPCs:**
  - Extend `complete_sale()` to resolve the current open till for `(branch_id, cashier_id)` and stamp `till_session_id`; reject if no open till and payment is cash
  - Extend `close_till_session()`: `expected_cash = opening_float + SUM(sales.total FILTER cash + linked to this session) - SUM(refunds linked)`
  - Add `pending_cash_summary(p_session_id)` read-only RPC for the live "drawer should be X" preview during the shift
- **Files:**
  - `supabase/migrations/20260101000019_link_cash_sales_to_till.sql`
  - `lib/actions/till.ts` (extend close), `lib/actions/till-math.ts` (new arithmetic)
  - `app/(workspace)/app/till/till-container.tsx` (live preview during shift)
  - `tests/till-close-math.test.ts` (extend cases)
- **RLS / security risks:**
  - `complete_sale` already SECURITY DEFINER — verify it still derives tenant/cashier from JWT, never from client
  - Deferred constraint or trigger must reject mismatched tenant_id between sale and till session
- **Verification checklist:**
  - Cash sale rejects when till is not open
  - Mixed cash + card sale: only cash portion changes expected_cash
  - Returns linked to same session decrement expected_cash
  - Close with matching count → `closed`; mismatch → `disputed`
  - Cross-tenant scenario: tenant B cannot read tenant A's till
- **Do not build:** card / mobile money settlement reconciliation, multi-currency, manager override of expected_cash. Those land in G3 and beyond.

### G1.3 — Returns ledger

- **Goal:** Make `/app/returns` a real operational module backed by a return ledger.
- **Schema:** `public.returns` (id, sale_id, branch_id, tenant_id, cashier_id, total, reason, status, restocked, created_at); `public.return_items` (return_id, variant_id, qty, unit_refund, restock); link to till session if return is cash.
- **RPCs:** `process_return(p_sale_id, p_items[], p_reason, p_restock)`; updates `stock_levels` on restock; writes audit.
- **Files:** new migration, `lib/actions/returns.ts`, returns page rewrite, tests.
- **RLS / risks:** Refunds can be abused; only owner / manager by default. Cashier permission gated on the future `tenant_permissions.returns_process` toggle (G4).
- **Verification:** partial return, full return, restock vs no-restock, cash refund affects till expected_cash.
- **Do not build:** loyalty refunds, store credit, exchanges-as-returns (separate flow later).

### G1.4 — Credit ledger

- **Goal:** Customer credit (sale on tab) with repayment recording.
- **Schema:** `public.customer_credit_ledger` (tenant_id, customer_id, sale_id, branch_id, type ('charge'|'repayment'), amount, balance_after, created_at). Customer balance is a `SUM()` view, never a stored column.
- **RPCs:** `record_credit_sale(...)`, `record_credit_repayment(...)`; both SECURITY DEFINER, writes to ledger.
- **Files:** migration, `lib/actions/credit.ts`, `/app/credit/*`, customer detail integration.
- **RLS / risks:** double-counting if ledger and balance are both stored. **Only ledger; balance is derived.**
- **Verification:** charge raises balance, repayment lowers it, no negative balance allowed, statement export totals match ledger sum.
- **Do not build:** interest / late fees / SMS reminders.

### G1.5 — Expenses backend

- **Goal:** Owner / manager / authorized staff record expenses; daily totals feed into control center P&L approximation.
- **Schema:** `public.expenses` (tenant_id, branch_id, category, amount, paid_by, payment_method, note, created_by, created_at). Optional `expense_categories` lookup table.
- **RPCs:** `record_expense(...)`. Cash expense decrements expected_cash on the open till.
- **Files:** migration, `lib/actions/expenses.ts`, `/app/expenses/*`, control-center wiring.
- **RLS:** owner / manager full; cashier gated on `tenant_permissions.expenses` (G4).
- **Verification:** expense recorded → affects till math, appears in daily report, cannot be edited by cashier without permission.
- **Do not build:** receipt photo upload (Storage integration is its own phase).

### G2 — Inventory / procurement

- **Goal:** Make `/app/purchases`, `/app/inventory`, `/app/transfers`, `/app/suppliers` fully operational.
- **Schema:** `purchase_orders`, `purchase_order_items`, extend `stock_movements`; `transfer_orders`, `transfer_items`; `suppliers` (likely already exists — verify).
- **RPCs:** `create_purchase_order`, `receive_purchase_order`, `create_transfer`, `dispatch_transfer`, `receive_transfer`, `cancel_transfer`, `adjust_stock`.
- **Files:** several migrations, server actions per module, real pages over the existing shells.
- **RLS:** branch scoping critical — cashier cannot see other branches' stock; manager scoped to assigned branch unless owner.
- **Verification:** receive PO bumps on_hand, transfer in transit doesn't double-count, manual adjustment writes audit reason.
- **Do not build:** barcode scanner integration, label printing, supplier portal.

### G3 — Payments / SeerBit

- **Goal:** Card / mobile-money / wallet payments at POS with server-verified settlement.
- See §9 for the full security model. This is the **highest-risk** phase.
- **Do not build:** until G1.2 - G1.5 ledger is solid. Payment reconciliation depends on a stable cash + credit + returns ledger.

### G4 — Staff permissions

- **Goal:** Owner unlocks specific features for individual cashier / staff users.
- See §8 for the full model.
- **Schema:** `public.tenant_permissions` (tenant_id, user_id, feature, allowed, granted_by, granted_at).
- **RLS:** select scoped to tenant; mutations owner-only.
- **Verification:** unlock `returns_process` for one cashier → that cashier sees returns action; another cashier in same tenant does not.

### G5 — Delivery / pickup

- **Goal:** POS fulfillment selection (pickup vs delivery), delivery fee quote, manual dispatch logging.
- See §10 for the full architecture.
- **Do not build:** Bolt / Uber / external rider API integration. Manual fulfillment first.

### G6 — Online store / shop link

- **Goal:** Owner publishes a shareable catalog link; customers browse and submit orders.
- See §11 for the full architecture.
- **Do not build:** customer-side payment automation, returns initiated from the shop, accounts/login for customers.

### G7 — PWA / mobile polish + Vercel deployment

- **Goal:** Service worker (re-introduced cleanly, not the old broken one), offline-first POS read-only fallback, mobile nav, bottom-sheet patterns, prod Vercel deploy.
- **Verification:** Lighthouse PWA score, offline POS open with last-cached products, install prompt on Android.
- **Do not build:** native wrappers (Capacitor / RN). PWA is the target.

---

## 7. Module-by-Module Activation Map

| Module | UI state today | Backend today | Missing backend | Next phase | Risk | Access expectation |
|---|---|---|---|---|---|---|
| POS | live | `complete_sale` RPC, sales/sale_items/stock_movements | till linkage, returns hook, payment provider | G1.2 / G3 | HIGH | owner / manager / cashier (cashier home) |
| Orders | live read | reads from `sales` | granular fulfillment status | G1.2 / G5 | MED | owner / manager / cashier (own) |
| Returns | shell | none | full returns ledger | G1.3 | HIGH | owner / manager (cashier via G4) |
| Till | live | `till_sessions` + 3 RPCs | cash sale linkage | G1.2 | HIGH | owner / manager / cashier |
| Credit | shell | none | credit ledger | G1.4 | HIGH | owner / manager (cashier via G4) |
| Products | live | product_families, product_variants | none for core CRUD; image upload TBD | maintain | LOW | owner / manager |
| Inventory | shell | stock_levels, stock_movements (partial) | counts / adjustments RPC | G2 | MED | owner / manager (cashier read via permissions) |
| Transfers | shell | none | full transfer schema + RPCs | G2 | MED | owner / manager |
| Customers | live | customers table | credit linkage (G1.4) | maintain → G1.4 | LOW | owner / manager / cashier (read, gated write) |
| Suppliers | shell | likely suppliers table exists | full PO linkage | G2 | LOW | owner / manager |
| Purchases | shell | none | full PO + receive | G2 | MED | owner / manager |
| Sales Trends | live read | reads from sales | drill-downs | maintain | LOW | owner / manager |
| Item Sales | live read | reads from sale_items | drill-downs | maintain | LOW | owner / manager |
| Staff Insights | shell | reads from profiles + sales | breakdown by cashier | G1.4 dependency | LOW | owner only |
| Expenses | shell | none | expenses table + RPC | G1.5 | MED | owner / manager (cashier via G4) |
| Payments / SeerBit | shell | none | provider config + attempts + webhook | G3 | CRITICAL | owner only (config) |
| Security Logs | live read | reads from `audit.activity_log` | filters / search | maintain | LOW | owner / manager |
| Settings | live | tenant + branch CRUD partial | full multi-section settings | maintain → G2 | LOW | owner |
| Users | live | profiles CRUD partial | invite flow | maintain → G4 | MED | owner |
| Control Center | live | aggregate reads | richer P&L (needs expenses + returns) | G1.5 | LOW | owner / manager |
| Notifications | shell | banner_dismissals exists | actual events stream | maintain | LOW | all roles (filtered) |
| Product Quick Add | live | products table | barcode scan | maintain | LOW | owner / manager |
| Online Store / Shop Link | not built | none | full read-only public catalog + order intake | G6 | HIGH | public (read), owner (config) |

---

## 8. Role and Permission Architecture

### Current role defaults

Hardcoded in [lib/auth/permissions.ts](lib/auth/permissions.ts):

- **owner** — full access including overrides (refunds, till variance accept, security logs)
- **manager** — branch-scoped operational access, dispatch / receive transfers, till override
- **cashier** — `/app/pos`, `/app/orders`, `/app/returns` (read), `/app/till` (own), `/app/customers` (read + limited write)

`UNIVERSAL_ROUTES` lists cashier-allowed routes. `CASHIER_DENIED_ROUTES` redirect to `CASHIER_FALLBACK_ROUTE` (`/app/pos`).

### What's missing

Currently a cashier either has the role-default access or nothing. Real businesses need finer control: *"this cashier can record expenses, that one cannot"*.

### Future model (G4)

```sql
CREATE TABLE public.tenant_permissions (
  tenant_id    public.ulid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id)    ON DELETE CASCADE,
  feature      text        NOT NULL CHECK (feature IN (
                 'credit', 'expenses', 'returns_process',
                 'inventory_count', 'customer_credit',
                 'delivery_quote', 'receive_purchase',
                 'view_reports_limited', 'till_open_close'
               )),
  allowed      boolean     NOT NULL DEFAULT true,
  granted_by   uuid        NOT NULL REFERENCES auth.users(id),
  granted_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id, feature)
);
```

### RLS

- SELECT: `tenant_id = current_tenant()` (everyone in the tenant can see overrides — owners need to audit, cashiers need to see their own grants)
- INSERT / UPDATE / DELETE: owner only

### UI behavior

- Nav must `await` a merged permission set: `{ ...roleDefaults, ...tenantOverrides }`
- Disabled actions must explain *why*: "Owner has not enabled expenses recording for your account."
- Cache the merge per request (similar to `getCurrentUser` cache pattern)

### Server enforcement

- Every server action must re-check via a helper `assertPermission(supabase, feature)` — never trust client claims
- The advisory `ROLE_PERMISSIONS` map stays in place but is no longer authoritative for the gated features

---

## 9. Payments / SeerBit Security Model

### Provider config

```sql
CREATE TABLE public.payment_providers (
  tenant_id        public.ulid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider         text        NOT NULL CHECK (provider IN ('seerbit', 'manual')),
  is_active        boolean     NOT NULL DEFAULT false,
  public_key       text,                              -- safe to expose
  encrypted_secret bytea,                             -- pgcrypto AES, never returned to client
  webhook_secret   bytea,                             -- pgcrypto AES
  config_meta      jsonb       NOT NULL DEFAULT '{}',
  PRIMARY KEY (tenant_id, provider)
);
```

- **Encrypted columns** decrypted only inside SECURITY DEFINER RPCs with `pgcrypto`. Decryption key from `app.settings.payments_master_key` (set via Postgres GUC, never via env var read at runtime by the client).
- RLS: SELECT for owner only; never expose `encrypted_secret` / `webhook_secret` via PostgREST. Use a view that omits them, or restrict columns via grants.

### Payment attempts

```sql
CREATE TABLE public.payment_attempts (
  id               public.ulid PRIMARY KEY DEFAULT public.generate_ulid(),
  tenant_id        public.ulid NOT NULL,
  sale_id          public.ulid REFERENCES public.sales(id) ON DELETE RESTRICT,
  provider         text NOT NULL,
  provider_ref     text,                       -- provider's transaction id
  amount           numeric(14,2) NOT NULL CHECK (amount > 0),
  currency         char(3)       NOT NULL DEFAULT 'TZS',
  status           text          NOT NULL CHECK (status IN
                     ('initiated','pending','succeeded','failed','reversed')),
  raw_request      jsonb,                      -- redacted of secrets
  raw_response     jsonb,                      -- redacted
  initiated_by     uuid NOT NULL REFERENCES auth.users(id),
  initiated_at     timestamptz NOT NULL DEFAULT now(),
  settled_at       timestamptz
);
```

### Webhook verification

- Webhook endpoint: a Next.js Route Handler at `/api/webhooks/seerbit` (server-only)
- Verifies HMAC against `webhook_secret` decrypted inside a SECURITY DEFINER RPC
- Idempotency: `provider_ref` is unique per provider; replays return 200 without re-applying state

### Settlement records

```sql
CREATE TABLE public.payment_settlements (
  id              public.ulid PRIMARY KEY DEFAULT public.generate_ulid(),
  tenant_id       public.ulid NOT NULL,
  provider        text NOT NULL,
  settlement_ref  text NOT NULL,
  amount_gross    numeric(14,2) NOT NULL,
  amount_fees     numeric(14,2) NOT NULL DEFAULT 0,
  amount_net      numeric(14,2) NOT NULL,
  settled_on      date NOT NULL,
  meta            jsonb NOT NULL DEFAULT '{}',
  UNIQUE (provider, settlement_ref)
);
```

### Secret handling

- **No secret in client.** Anon key only on client; provider secrets never leave Postgres.
- **No service-role bypass in user actions.** Service-role usage limited to webhook receiver and tenant provisioning.
- All payment RPCs are SECURITY DEFINER with `SET search_path=''`, fully qualified.

### Client / server separation

- POS UI calls `initiatePayment` server action → returns `provider_ref` + redirect / SDK params
- Provider SDK runs in browser only with the **public** key
- Webhook lands server-side, updates `payment_attempts.status`, marks `sale.status='completed'` only on `succeeded`

### Testing strategy

- SeerBit sandbox credentials in `.env.local` (gitignored)
- Unit tests: HMAC verification, idempotency, state machine transitions
- Integration test: mock the provider, simulate initiated → succeeded and initiated → failed
- Never test against production. Use a dedicated test tenant.

---

## 10. Delivery / Pickup Architecture

### Pickup / delivery choice

POS adds a fulfillment step before payment:

- `pickup` — customer collects in-store, no delivery fee, no address required
- `delivery` — staff captures address and delivery fee, customer confirms before payment

### Schema

```sql
ALTER TABLE public.sales
  ADD COLUMN fulfillment_mode   text CHECK (fulfillment_mode IN ('pickup','delivery')),
  ADD COLUMN delivery_address   text,
  ADD COLUMN delivery_lat       numeric(9,6),
  ADD COLUMN delivery_lng       numeric(9,6),
  ADD COLUMN delivery_fee       numeric(14,2) NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  ADD COLUMN delivery_method    text CHECK (delivery_method IN
              ('own_staff','manual_rider','external_provider')),
  ADD COLUMN delivery_status    text CHECK (delivery_status IN
              ('pending','dispatched','delivered','failed','cancelled'));
```

Optional `delivery_dispatches` log table for richer status history later.

### Delivery fee quote

- Initial: manual entry by staff
- Later: `quote_delivery_fee(p_branch_id, p_lat, p_lng)` SECURITY DEFINER RPC pulling from a `delivery_fee_rules` table (zones, per-km tiers)
- Never calculate on client without server confirmation

### Customer confirmation

- POS displays total = items + tax + delivery_fee
- Customer "confirms" verbally or via printed receipt summary
- Recorded as part of `sale` creation; no separate quote record needed in v1

### Dispatch method

- `own_staff` — shop staff delivers; recorded for stats
- `manual_rider` — bodaboda / Bolt-as-rider booked manually outside the system
- `external_provider` — placeholder for future Bolt/Uber API integration

### Provider integration boundary

Out of scope until G5 ships and is stable. Until then, dispatch is logged but not automated.

---

## 11. Online Store / Shop Link Architecture

### Public catalog

- Route: `/catalog/[slug]` (already scaffolded in route table)
- RLS: a **read-only public** policy on `product_families` and `product_variants` filtered by `tenant.published_storefront = true`
- No auth required
- No prices on credit-only items; show "contact seller"

### Shareable link

- Slug from `tenants.slug` (already unique)
- Optionally a sub-route per branch: `/catalog/[slug]/[branch_code]`

### Order intake

```sql
CREATE TABLE public.storefront_orders (
  id              public.ulid PRIMARY KEY DEFAULT public.generate_ulid(),
  tenant_id       public.ulid NOT NULL,
  branch_id       public.ulid,
  customer_name   text NOT NULL,
  customer_phone  text NOT NULL,
  customer_note   text,
  status          text NOT NULL CHECK (status IN
                    ('new','contacted','converted_to_sale','cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  converted_sale_id public.ulid REFERENCES public.sales(id)
);

CREATE TABLE public.storefront_order_items (
  order_id    public.ulid REFERENCES public.storefront_orders(id) ON DELETE CASCADE,
  variant_id  public.ulid REFERENCES public.product_variants(id),
  qty         integer NOT NULL CHECK (qty > 0),
  unit_price  numeric(14,2) NOT NULL,
  PRIMARY KEY (order_id, variant_id)
);
```

- Orders are **leads**, not sales. Staff converts → existing `complete_sale()` flow.
- Public INSERT policy with rate limiting (one order per phone+IP per 60s, enforced via a SECURITY DEFINER `submit_storefront_order` RPC, not direct INSERT).

### Subscription gating

- `tenants.plan_id` already exists (added in migration 014)
- Gate the storefront publish toggle on `plan_id IN ('pro','premium')` (or whatever the future plan matrix decides)
- UI shows "Upgrade to publish your store" on lower tiers

### Owner controls

- Toggle publish / unpublish
- Choose products to show (a `product_families.show_in_storefront` boolean)
- Customise basic theme (logo, hero text, contact methods) — stored in `tenants.storefront_meta jsonb`

### What NOT to build yet

- Customer accounts / login on the storefront
- Customer-side payment (collected manually by staff for v1)
- Customer-side returns
- Multi-language storefront (English default; Swahili added when admin i18n stabilises)
- Storefront analytics beyond a simple "leads this week" count

---

## 12. Language and Localization Rules

### Rules

- **English mode** → every UI string is English. The only allowed non-English strings are: brand names, product names, SKUs, currency codes ("TSh"), provider names ("SeerBit", "M-Pesa").
- **Swahili mode** → mirror image. No English bleed into Swahili copy except the same proper-noun set.
- **No mixed-language strings.** A sentence is one language or the other.

### Carryover violations to fix

[lib/auth/permissions.ts:155-194](lib/auth/permissions.ts:155) — `validateServerMutation` throws mixed-language messages such as `"Mtumiaji hajatambulishwa (Unauthenticated mutation attempt)"`. This must be replaced with a localized message system. Suggested approach:

- Errors throw codes (`AUTH_REQUIRED`, `PERMISSION_DENIED_FOR_ROLE`, `CROSS_BRANCH_FORBIDDEN`, `REFUND_REQUIRES_MANAGER`)
- A central translator maps code → localized message based on the user's `profiles.locale` (new column, defaults `en`)

### Where translations live

- Recommended: `lib/i18n/en.ts` and `lib/i18n/sw.ts` as flat key-value modules
- Server actions return error codes only; client maps to localized strings
- Avoid runtime fallback to mixed strings — fail closed with the code itself if a translation is missing

### What NOT to do

- Don't introduce `react-i18next` unless explicitly approved — it's heavy and the app's copy volume doesn't justify it yet
- Don't store user locale only in client cookies — it must be in the profile so server-rendered errors localize correctly

---

## 13. Design System and UX Rules

### Tokens (already in Tailwind config under `nx-*`)

- `bg-nx-bg` — base near-black background
- `bg-nx-surface` — card surface
- `bg-nx-elevated` — inset / input surface
- `border-nx-border` — neutral border
- `text-nx-text` / `text-nx-text-sec` / `text-nx-text-muted` — text hierarchy
- `text-nx-green` / `bg-nx-green` — primary action (emerald)
- `text-nx-amber` / `bg-nx-amber` — warning / attention
- `text-nx-red` / `bg-nx-red` — danger / variance only
- `text-nx-gold` — currency / premium accents
- `font-data` — tabular numeric data
- `font-ui` — primary UI font
- `rounded-nx-card`, `rounded-nx-btn`, `rounded-nx-xs` — radius scale

### Forbidden

- **No blue or cyan UI.** Even in disabled / link states, default to amber-on-dark or muted text, not blue.
- **No emojis as icons.** Use Lucide React only.
- **No fake data.** Empty states must be honest ("No till sessions recorded yet.").
- **No "Coming Soon" placeholders.** Use production shells with activation state.
- **No layout-shifting hover.** Hover changes color/opacity, not size.

### Component behavior

- Disabled actions explain *why* (the till "Open Till" button shows an amber notice with a `LockKeyhole` icon when no branch is selected — copy this pattern across modules)
- Loading buttons disable + swap label/icon to `Loader2 animate-spin`
- Transitions 150-300ms, `transition-colors duration-200` preferred
- Tabular numerics for all currency: `font-data tabular-nums`

### Mobile responsiveness

- Default mobile-first; desktop expansion via `lg:` breakpoints
- Min target tap area: 44 × 44 px
- Min readable body text on mobile: 16 px
- No horizontal scroll on mobile (test 375 px width)
- Sidebar collapses to overlay drawer on mobile (not yet implemented across all pages)

### Selcom-style smoothness goal

- Sub-100ms perceived response on every tap (optimistic UI where safe)
- Skeleton loaders sized to final layout — no content jumping
- Status changes (open → closed → disputed → reviewed) animate via background color, not movement

### Accessibility

- 4.5:1 contrast minimum on dark backgrounds
- Visible focus ring on interactive elements (Tailwind `focus:ring-2 focus:ring-nx-green/40`)
- `aria-label` on icon-only buttons
- `<label for>` on every form input

---

## 14. Local Development and Environment Rules

### Local Supabase via Docker

```
npx supabase start          # boot stack (or rely on Docker Desktop auto-start)
npx supabase status         # show URLs / keys
npx supabase db reset       # re-apply migrations + seed.sql (DESTRUCTIVE on local)
npx supabase stop           # halt stack
```

### `.env.local` rules

- **Never commit.** Gitignored.
- When pointing at **local Supabase**:
  ```
  NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<sb_publishable_*** from `supabase status`>
  SUPABASE_SERVICE_ROLE_KEY=<sb_secret_*** from `supabase status`>
  ```
- When pointing at **remote**:
  - `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
  - Keys from the Supabase dashboard (Project Settings → API)
- **Keep a `.env.local.example`** with placeholders, committed.
- Switching local ↔ remote requires a Next dev restart so the new env is picked up.

### Local auth users need app_metadata claims

- `seed-users.ts` sets `app_metadata.{tenant_id, role, branch_id}` at creation
- If a user is already in `auth.users` and you re-run the script, the script currently **does not** refresh their claims (see G1.1 finding in §5)
- Symptom of missing claims: `current_tenant()` returns NULL, RLS silently strips all rows, UI looks broken without a Postgres error
- Manual repair until `seed-users.ts` is patched:
  ```sql
  UPDATE auth.users
  SET raw_app_meta_data = raw_app_meta_data
    || jsonb_build_object('tenant_id', '<TENANT_ULID>', 'role', '<role>', 'branch_id', null)
  WHERE email = '<email>';
  ```
- After any `app_metadata` change the user must **sign out and back in** so a fresh JWT is minted

### Running local migration tests

```
npx supabase db reset                 # full rebuild against migrations + seed
npx tsx supabase/seed-users.ts        # seed auth users
npm run dev                            # start Next.js dev server
```

Then sign in with `owner@nexpos.dev` / `password123` (or any other seeded account).

### Reset / restart cycle

- After editing a migration: `npx supabase db reset` (destructive on local), then re-seed users
- After editing `.env.local`: stop and re-start `npm run dev`
- After editing `app_metadata` for an existing user: sign out + sign in

### Why JWT re-login is required after metadata updates

The JWT is minted by GoTrue at sign-in time and cached in the browser cookies. `app_metadata` updates to `auth.users` do not invalidate the existing JWT. The session continues with stale claims until the next sign-in. There is no in-app way to force this — the user must sign out.

---

## 15. Antigravity Execution Playbook

### Core rules

1. **Inspect first.** Before any change, read the relevant migration, server action, page, and adjacent files. Do not edit blindly.
2. **Small phases.** One slice per branch / commit. Never bundle two phases.
3. **No remote DB mutation without explicit user approval.** Local-only `supabase db reset` is fine. `supabase db push` is forbidden by default.
4. **Build / typecheck / test every slice:**
   ```
   npx tsc --noEmit
   npx vitest run
   npm run build
   ```
5. **Manual browser smoke every slice.** Spin up `npm run dev`, sign in, exercise the new feature, screenshot the success and failure states.
6. **Use screenshots / artifacts.** Attach proof to the PR description: screenshots, logs, SQL audit rows.
7. **Never stage secrets / local tooling.** Use the safe `git add` list from §17. Do not `git add -A` or `git add .`.
8. **Do not jump phases.** G1.x must close before G2 starts. G2 must close before G3 starts. Skipping a phase corrupts the assumptions of the next.
9. **Surface errors loudly.** No silent `.catch(() => null)`. If a query errors, log it and surface to the UI (the till diagnostic pattern from §5 is the template).
10. **Honest empty states.** If data is missing, say so plainly. No mock fallbacks.
11. **Respect tenant isolation.** Every query, every action — derive `tenant_id` from JWT, never from client input.
12. **No service-role in user code paths.** Service role is for webhooks, tenant provisioning, and `seed-users.ts` only.

### Phase completion definition

A phase is "done" only when:

- All migrations apply cleanly on a fresh `supabase db reset`
- `npm run build` exits 0
- `npx tsc --noEmit` exits 0
- All tests pass
- Browser smoke confirms happy path + at least one failure path
- The user has reviewed and approved the commit message and file list
- The commit is made (and only then pushed)

---

## 16. Next Immediate Task — G1.2 Cash Sales ↔ Till Sessions linkage

**Why G1.2 and not G1.3:** G1.1 introduces till sessions but leaves `expected_cash = opening_float`. Every cash-heavy day ends as "disputed" because there's no way to expect *opening_float + cash sales − cash refunds − cash expenses*. The UI even labels this "Unreconciled Difference" with the explicit promise that G1.2 fixes it. Until that's done, the till feature is operationally useless beyond a checklist.

Returns, credit, expenses (G1.3 / G1.4 / G1.5) all depend on the till being able to honestly compute expected cash — they all feed into it. Doing them first compounds the problem.

**Suggested next Antigravity prompt (copy into a fresh session):**

```
/senior-backend /senior-architect

You are continuing NEXPOS on branch feat/phase-f-operational-modules
(or a new branch feat/phase-g1.2-cash-sales-till-linkage).

Implement Phase G1.2 — Cash Sales ↔ Till Sessions linkage.

Strict rules:
- Do not push.
- Do not run supabase db push.
- Do not mutate remote Supabase.
- Do not change SeerBit, payments, service worker, or permissions routing.
- Keep tenant isolation and RLS intact.
- No service-role bypass.

Scope:
1. Create migration 20260101000019_link_cash_sales_to_till.sql:
   - Add `till_session_id public.ulid` to public.sales,
     REFERENCES public.till_sessions(id) ON DELETE RESTRICT.
   - Index (till_session_id, completed_at DESC).
   - Trigger or deferred constraint:
     - If payment_method='cash' and status='completed',
       till_session_id MUST be set.
     - till_session_id must belong to same tenant as the sale.
2. Extend public.complete_sale RPC to resolve the open till session
   for (branch_id, cashier_id, status='open') and stamp till_session_id
   on cash sales. Reject the sale if no open till and payment is cash.
3. Extend public.close_till_session math:
     expected_cash = opening_float
                   + SUM(sales.total)  WHERE till_session_id = p_session_id
                                          AND payment_method = 'cash'
                                          AND status = 'completed'
                   - SUM(returns.refund_amount) WHERE till_session_id = p_session_id
                                                AND refund_method = 'cash'
     (returns ledger not built yet — gate the returns subtraction behind
      `IF table exists` so the migration applies cleanly now; G1.3 will
      activate it.)
   variance = actual_cash_counted - expected_cash.
4. Add read-only RPC pending_cash_summary(p_session_id) returning
   { expected_cash, cash_sales_count, cash_sales_total } for the live
   "drawer should be X" preview during the shift.
5. Server actions:
   - Update lib/actions/till.ts to expose getPendingCashSummary.
   - Update lib/actions/till-math.ts to take (openingFloat, cashSalesTotal,
     cashRefundsTotal, actualCashCounted) and return the same shape.
   - Update tests/till-close-math.test.ts to cover the new math.
6. UI:
   - app/(workspace)/app/till/till-container.tsx — show live
     expected_cash preview ("Expected drawer: TSh X") for the open
     session, refreshing on sale completion (server action refetch).
   - Relabel "Opening Float Only" → "Expected Cash"
     once cash sale linkage is active.
   - Keep "Unreconciled Difference" wording only on the close form
     between counted vs expected.
7. Verification:
   - npx tsc --noEmit
   - npx vitest run
   - npm run build
   - Local smoke:
     a. Sign in as cashier@nexpos.dev.
     b. Cash sale rejects when no till is open.
     c. Open till with 100,000 float.
     d. Complete two cash sales: 50,000 and 30,000.
     e. Live preview shows expected 180,000.
     f. Mixed cash+card sale: only cash portion increments expected.
     g. Close with 180,000 → status=closed.
     h. Close with 170,000 → status=disputed, variance=-10,000.
     i. Cross-tenant test: tenant B sale cannot reference tenant A till.

Deliver:
- Files changed
- Migration filename
- Verification output
- Manual smoke checklist
- Exact git add command (do not include .env.local, .claude/*, supabase/snippets/)
- Commit message recommendation

Stop after reporting. Do not commit. Do not push.
```

---

## 17. Exact Commands Reference

### Safe inspection

```
git status
git log --oneline -20
git diff --stat
git show <sha> --stat
npx supabase status
npx supabase db query "<sql>"      # local DB only
```

### Verification (run every phase)

```
npx tsc --noEmit
npx vitest run
npx vitest run tests/till-close-math.test.ts    # focused
npm run build
npm run dev                                       # smoke
```

### Local Supabase lifecycle

```
npx supabase start
npx supabase status
npx supabase db reset                  # DESTRUCTIVE on local; re-applies migrations + seed
npx tsx supabase/seed-users.ts         # repopulate dev auth users + profiles
npx supabase stop
```

### Safe G1.1 commit (already done locally as 8769884; left here as a template)

```
git add ^
  supabase/migrations/20260101000018_till_sessions.sql ^
  lib/actions/till.ts ^
  lib/actions/till-math.ts ^
  "app/(workspace)/app/till/page.tsx" ^
  "app/(workspace)/app/till/till-container.tsx" ^
  tests/till-close-math.test.ts

git commit -m "feat: activate till sessions backend"
```

### Pushing G1.1 (still pending)

```
git push origin feat/phase-f-operational-modules
```

### Commands NEVER to run without explicit user approval

```
supabase db push                       # mutates remote
supabase link                          # rebinds project context
git push --force                       # rewrites remote history
git reset --hard                       # destroys local work
git add .                              # would stage .env.local / .claude/*
git add -A                             # same
```

---

## 18. Final Warnings

These rules are non-negotiable. Violating any of them is grounds for reverting the change.

1. **Do not make NEXPOS shoe-specific.** Air Force 1 / Stan Smith / Timberland in `seed.sql` are demo data. Universal schema, universal copy, universal nav. No "footwear" in table names, no shoe icons in default UI, no shoe-themed empty states.

2. **Do not bypass RLS.** Every query is tenant-scoped via `current_tenant()`. Server actions re-derive tenant from JWT, never from client input.

3. **Do not expose service-role keys.** Service role lives server-side only — webhooks, tenant provisioning, `seed-users.ts`. Never in a server action that runs as a user. Never in any client code.

4. **Do not use service-role hacks** to "fix" an RLS issue. If RLS blocks a query that should succeed, the bug is in the JWT claims or the policy, not in the choice of client. Fix the root cause.

5. **Do not mix languages.** A user in English mode sees English everywhere. A user in Swahili mode sees Swahili everywhere. The only exceptions are proper nouns (brands, SKUs, currency, provider names).

6. **Do not build online checkout / payment automation before core ledger is stable.** Cash sales linkage (G1.2), returns (G1.3), credit (G1.4), and expenses (G1.5) must all ship and be smoke-clean before payments (G3) is touched. Payments depend on a trustworthy ledger.

7. **Do not deploy to Vercel before local smoke passes.** Build, typecheck, vitest, and manual browser smoke against a local Supabase DB. Only then promote. The remote DB is not a test environment.

8. **Do not commit secrets or local tooling.** `.env.local`, `.claude/`, `supabase/snippets/` are gitignored / scratch. Use the explicit file list in §17.

9. **Do not introduce blue or cyan UI.** Emerald primary, amber warning, red danger, gold accent. Anything else is drift.

10. **Do not skip the manual browser smoke.** Builds and tests pass on broken UI all the time. Open the browser. Click the buttons. Confirm the screenshots match expectations before committing.

---

*End of handoff.*
