-- ============================================================================
-- 20260101000017_banner_dismissals.sql
-- Per-user dismissal log for lifecycle "growth card" banners surfaced on the
-- dashboard (SeerBit setup, inventory setup, insights, social, upgrade, ...).
--
-- Design notes:
--   * Scoped (user_id, tenant_id) so the same human dismissing in tenant A
--     does NOT auto-hide the banner when they switch to tenant B.
--   * banner_id is TEXT (e.g. 'seerbit', 'inventory') — kept in code, no FK.
--     Adding a banner_defs table is overkill for a static enum.
--   * `reappear_after` lets us re-surface banners after a cool-down without
--     deleting the dismissal record (audit trail preserved).
--   * Standard RLS: a user only ever sees/writes their own rows, and only
--     within their current JWT tenant. No service-role escape hatches.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_banner_dismissals (
  user_id         uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id       public.ulid   NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  banner_id       text          NOT NULL CHECK (length(trim(banner_id)) > 0 AND length(banner_id) <= 64),
  dismissed_at    timestamptz   NOT NULL DEFAULT now(),
  reappear_after  timestamptz   NULL,
  PRIMARY KEY (user_id, tenant_id, banner_id)
);

COMMENT ON TABLE  public.user_banner_dismissals IS
  'Per-user dismissal log for dashboard lifecycle banners. Scoped per tenant.';
COMMENT ON COLUMN public.user_banner_dismissals.banner_id IS
  'Banner id from lib/banners/defs.ts (e.g. seerbit, inventory, insights, social, upgrade).';
COMMENT ON COLUMN public.user_banner_dismissals.reappear_after IS
  'If set, the banner can re-surface once now() > reappear_after (used for
   periodic nudges like the Upgrade card). NULL = dismissed permanently.';

-- Lookup pattern: WHERE user_id = auth.uid() AND tenant_id = current_tenant().
-- The primary key already covers (user_id, tenant_id) prefix lookups, so no
-- additional index is needed.

ALTER TABLE public.user_banner_dismissals ENABLE ROW LEVEL SECURITY;

-- SELECT: only your own rows, within your current tenant.
CREATE POLICY user_banner_dismissals_select ON public.user_banner_dismissals
  FOR SELECT
  USING (
    user_id   = public.current_user_id()
    AND tenant_id = public.current_tenant()
  );

-- INSERT: same scoping; the WITH CHECK guarantees a user cannot insert a row
-- attributed to someone else, or into a tenant they are not currently in.
CREATE POLICY user_banner_dismissals_insert ON public.user_banner_dismissals
  FOR INSERT
  WITH CHECK (
    user_id   = public.current_user_id()
    AND tenant_id = public.current_tenant()
  );

-- UPDATE: needed for `reappear_after` adjustments + dismissed_at refreshes
-- via UPSERT (ON CONFLICT). Same scoping for both USING and WITH CHECK.
CREATE POLICY user_banner_dismissals_update ON public.user_banner_dismissals
  FOR UPDATE
  USING (
    user_id   = public.current_user_id()
    AND tenant_id = public.current_tenant()
  )
  WITH CHECK (
    user_id   = public.current_user_id()
    AND tenant_id = public.current_tenant()
  );

-- DELETE: rare ("undo dismiss"), but kept symmetric for completeness.
CREATE POLICY user_banner_dismissals_delete ON public.user_banner_dismissals
  FOR DELETE
  USING (
    user_id   = public.current_user_id()
    AND tenant_id = public.current_tenant()
  );

-- Service role bypasses RLS by default; no service-role grants needed.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_banner_dismissals TO authenticated;
