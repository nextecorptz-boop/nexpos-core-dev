-- =============================================================================
-- MIGRATION 009: Audit Log
-- Run order: AFTER 008
-- Rollback: DROP TABLE IF EXISTS audit.activity_log CASCADE;
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT.ACTIVITY_LOG
-- Append-only compliance log. Written by SECURITY DEFINER functions only.
-- Clients have no SELECT access — queried by owners/admins via the API layer.
--
-- Uses bigserial PK (not ULID) because:
-- 1. Audit rows are server-generated, never client-generated
-- 2. bigserial is cheaper and orders correctly for sequential audit queries
-- 3. No need for distributed ID generation on an append-only log
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE audit.activity_log (
  id            bigserial     PRIMARY KEY,
  tenant_id     public.ulid   NOT NULL,
  actor_id      uuid,         -- NULL for system actions
  action        text          NOT NULL,
  -- Canonical action names: 'sale.completed', 'sale.voided', 'stock.adjusted',
  -- 'user.created', 'user.deactivated', 'product.created', etc.
  entity_type   text          NOT NULL,
  entity_id     text,         -- string to accommodate both ULIDs and UUIDs
  metadata      jsonb         NOT NULL DEFAULT '{}'::jsonb,
  ip_address    inet,
  occurred_at   timestamptz   NOT NULL DEFAULT now()
);

-- Primary time-series query per tenant
CREATE INDEX audit_log_tenant_time_idx
  ON audit.activity_log (tenant_id, occurred_at DESC);

-- Entity-specific audit trail (e.g. all events for sale X)
CREATE INDEX audit_log_entity_idx
  ON audit.activity_log (entity_type, entity_id, occurred_at DESC)
  WHERE entity_id IS NOT NULL;

-- Actor-based audit queries (what did this cashier do?)
CREATE INDEX audit_log_actor_idx
  ON audit.activity_log (actor_id, occurred_at DESC)
  WHERE actor_id IS NOT NULL;

-- RLS on audit schema: no direct client access.
-- The audit schema is read via the API layer (admin Edge Function with service_role).
-- This is intentional — audit logs should not be filterable by tenants on RLS alone.
ALTER TABLE audit.activity_log ENABLE ROW LEVEL SECURITY;

-- No policies = deny all. Only service_role (used by admin Edge Functions) can read/write.

COMMENT ON TABLE audit.activity_log IS
  'Append-only compliance log. Written by SECURITY DEFINER functions only. '
  'No client access. Query via admin Edge Functions with service_role. '
  'Partition by month after 1M rows (roughly 2-3 years at MVP scale).';


-- ─────────────────────────────────────────────────────────────────────────────
-- AUDIT WRITE FUNCTION
-- SECURITY DEFINER so operational functions can write to audit.activity_log
-- without granting INSERT to the authenticated role on audit schema.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_tenant_id   public.ulid,
  p_actor_id    uuid,
  p_action      text,
  p_entity_type text,
  p_entity_id   text DEFAULT NULL,
  p_metadata    jsonb DEFAULT '{}'::jsonb,
  p_ip_address  inet DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  -- Prevent forged identities: if called by an authenticated client,
  -- always enforce the actual session context.
  IF current_setting('request.jwt.claims', true) IS NOT NULL AND public.current_tenant() IS NOT NULL THEN
    p_tenant_id := public.current_tenant();
    p_actor_id  := public.current_user_id();
  END IF;

  INSERT INTO audit.activity_log (
    tenant_id, actor_id, action, entity_type, entity_id, metadata, ip_address
  ) VALUES (
    p_tenant_id, p_actor_id, p_action, p_entity_type,
    p_entity_id, p_metadata, p_ip_address
  );
EXCEPTION WHEN OTHERS THEN
  -- Audit failures MUST NOT bubble up and abort the calling transaction.
  -- Log to Postgres log file but swallow the exception.
  RAISE WARNING 'write_audit_log failed: % %', SQLERRM, p_metadata;
END;
$$;

-- Revoke all direct client execution. SECURITY DEFINER functions (like complete_sale) 
-- run as the owner and can still call this internally.
REVOKE EXECUTE ON FUNCTION public.write_audit_log FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.write_audit_log FROM anon;
REVOKE EXECUTE ON FUNCTION public.write_audit_log FROM authenticated;

COMMENT ON FUNCTION public.write_audit_log IS
  'SECURITY DEFINER: writes to audit.activity_log. '
  'Exceptions are swallowed — audit failures never abort business transactions. '
  'Cannot be called directly by clients. Call from inside complete_sale(), etc.';
