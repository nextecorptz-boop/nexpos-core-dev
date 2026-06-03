# Frontend Stabilization Audit Report

**Date:** 2026-06-03  
**Project:** nexpos-core-prod (`wvlvnwyrnrdgysgtvibb`)  
**Branch:** `archive/pre-rebuild-may-31-2026`  

---

## 1. Environment & Build Status

| Check | Status | Details |
|---|---|---|
| Git Branch | ✅ Clean | On `archive/pre-rebuild-may-31-2026` with no uncommitted changes. |
| `npx tsc --noEmit` | ✅ Pass | 0 errors. |
| `npm run build` | ✅ Pass | Next.js compiled 32 routes successfully in ~20s. |

---

## 2. Role Redirects Audit

Audited `middleware.ts`. Route redirection correctly implements the requirements:
- `owner@nexpos.dev` → `/app/dashboard` (Pass)
- `manager@nexpos.dev` → `/app/dashboard` (Pass)
- `cashier@nexpos.dev` → `/app/pos` (Pass)

---

## 3. Schema Mismatch & Legacy Table References

The codebase heavily references legacy table names that **do not exist** in the canonical database schema. 

**Missing / Legacy Tables Found in Code:**
- `product_categories`
- `inventory_movements` *(canonical: `stock_movements`)*
- `transfers` / `transfer_items`
- `expense_categories` / `expenses`
- `cash_sessions`
- `current_stock` *(canonical: `stock_levels` via RPC)*
- `inventory_reservations`
- `sale_items` *(canonical: `sale_lines`)*
- `purchases` / `purchase_items`
- `credit_accounts` / `credit_repayments`
- `payments`
- `suppliers`
- `event_store`
- `contact_submissions`
- `audit_logs` *(canonical: `audit.activity_log`)*

**Route-by-Route Evaluation:**
- **Build-time:** ✅ Pass (Next.js statically generated without runtime DB execution).
- **Runtime:** ❌ Fail. Virtually all workspace routes (e.g., `/app/pos`, `/app/inventory`, `/app/dashboard`) will crash or fail to load data because they attempt to query the nonexistent tables listed above.

---

## 4. Tenant Isolation Anti-Patterns

Direct `.eq('tenant_id', ...)` filters were found in the codebase. This is a severe anti-pattern because it relies on the client to specify the tenant, rather than relying on Postgres Row-Level Security (RLS) via `auth.current_tenant()`.

- `app/(public)/catalog/[slug]/page.tsx`: Lines 81, 88
- `lib/sync/catalog-sync.ts`: Lines 169, 216

---

## 5. Direct Stock Mutation Anti-Patterns

No direct `from('stock_levels').insert/update` calls were found. However, legacy stock mutation anti-patterns exist:
- `lib/sync/sync-engine.ts`: Line 511 directly inserts into `inventory_movements`.
- Canonical architecture requires using Postgres RPCs like `complete_sale()` and `adjust_stock()` to mutate stock securely and immutably.

---

## 6. UI Token Drift (Light-mode Leakage)

Several files retain legacy light-mode Tailwind classes, drifting from the Dark Theme architecture:

**Leaked classes:** `bg-white`, `bg-red-50`, `bg-gray-50`, `text-gray-900`, `text-gray-500`, `text-gray-400`, `border-cyan-100`, `border-red-200`.

**Affected Files:**
- `components/public/pwa-provider.tsx` (Heavy leakage: `bg-white`, `text-gray-900`, `text-gray-500`, `bg-red-50`)
- `app/(public)/contact/page.tsx` (`bg-red-500/5`)
- `app/(public)/login/page.tsx` (`bg-red-500/5`)
- `app/(public)/signup/page.tsx` (`bg-red-500/5`)
- `components/workspace/telemetry-dashboard.tsx` (`bg-red-50`, `border-red-200`)
- `components/settings/security-tab.tsx`
- `components/settings/subscription-tab.tsx`
- `app/(workspace)/app/notifications/notifications-container.tsx` (`bg-white/20`)

---

## 7. Critical Blockers & Warnings

🛑 **CRITICAL BLOCKER:** The mismatch between the frontend's hardcoded table references and the canonical Supabase schema means the application is completely non-functional at runtime, despite passing build checks.

⚠️ **WARNING:** Client-side tenant filtering (`.eq('tenant_id')`) in the public catalog poses a data-leakage risk if the tenant slug/ID logic is manipulated.

---

## 8. Recommended Execution Order

To stabilize the frontend without breaking the build or Auth state, the following sequence is recommended:

1. **UI Token Remediation:** Clean up all light-mode Tailwind classes (`bg-white`, `text-gray-*`) and replace them with standard dark design tokens.
2. **Tenant RLS Enforcement:** Remove `.eq('tenant_id', ...)` client-side filters. Rely exclusively on the JWT claims and RLS policies.
3. **Table Name Alignment:** Update all Supabase `.from()` references in `app/` and `lib/` to match the canonical schema (`sale_lines`, `stock_movements`, etc.). Remove queries to nonexistent features temporarily or stub them.
4. **Mutation Refactoring:** Replace direct inserts (like `inventory_movements`) with the corresponding canonical RPC calls (`adjust_stock()`, `complete_sale()`).
