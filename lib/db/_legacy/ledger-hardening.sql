-- NEXPOS - Ledger Hardening & Cryptographic Tamper-Evidence
-- Execute this script in the Supabase SQL Editor

-- Enable pgcrypto extension for SHA256 hashing functions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Prevent Updates or Deletes on the Event Store
CREATE OR REPLACE FUNCTION enforce_event_store_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'TAMPER_ALERT: UPDATE operations are strictly prohibited on the immutable event store.';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TAMPER_ALERT: DELETE operations are strictly prohibited on the immutable event store.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_event_store_append_only ON event_store;
CREATE TRIGGER trigger_enforce_event_store_append_only
BEFORE UPDATE OR DELETE ON event_store
FOR EACH ROW
EXECUTE FUNCTION enforce_event_store_append_only();


-- 2. Cryptographic Signature Chain for Tamper-Detection
CREATE OR REPLACE FUNCTION chain_event_signature()
RETURNS TRIGGER AS $$
DECLARE
  v_prev_hash TEXT;
  v_combined_payload TEXT;
BEGIN
  -- Find hash of the immediately preceding event in global order
  SELECT metadata->>'signature_chain_hash' INTO v_prev_hash
  FROM event_store
  ORDER BY global_position DESC
  LIMIT 1;

  IF v_prev_hash IS NULL THEN
    v_prev_hash := 'NEXPOS_GENESIS_BLOCK';
  END IF;

  -- Create a deterministic text block for hashing
  v_combined_payload := v_prev_hash || '|' ||
                        NEW.tenant_id::TEXT || '|' ||
                        NEW.aggregate_id::TEXT || '|' ||
                        NEW.event_version::TEXT || '|' ||
                        NEW.event_type || '|' ||
                        NEW.payload::TEXT || '|' ||
                        NEW.occurred_at::TEXT;

  -- Compute SHA256 hash and insert into event metadata
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
    'signature_chain_hash',
    encode(digest(v_combined_payload, 'sha256'), 'hex')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_chain_event_signature ON event_store;
CREATE TRIGGER trigger_chain_event_signature
BEFORE INSERT ON event_store
FOR EACH ROW
EXECUTE FUNCTION chain_event_signature();


-- 3. Row-Level Security (RLS) policies for Event Store
ALTER TABLE event_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant event_store select policy" ON event_store;
CREATE POLICY "Tenant event_store select policy" ON event_store FOR SELECT
USING (tenant_id = get_jwt_tenant_id());

DROP POLICY IF EXISTS "Tenant event_store insert policy" ON event_store;
CREATE POLICY "Tenant event_store insert policy" ON event_store FOR INSERT
WITH CHECK (
  tenant_id = get_jwt_tenant_id() AND
  (get_jwt_user_role() = 'owner' OR branch_id = get_jwt_branch_id())
);
