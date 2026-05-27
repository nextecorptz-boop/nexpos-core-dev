-- =============================================================================
-- MIGRATION 001: Schemas, Types, Extensions
-- Run order: FIRST — all other migrations depend on this
-- Rollback: DROP SCHEMA audit CASCADE; DROP DOMAIN IF EXISTS public.ulid;
-- =============================================================================

-- Extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram index support for ILIKE search
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- accent-insensitive full-text (Swahili names)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for generate_ulid()

-- Audit schema — append-only, no RLS, accessed only by SECURITY DEFINER functions
CREATE SCHEMA IF NOT EXISTS audit;
REVOKE ALL ON SCHEMA audit FROM PUBLIC;
REVOKE ALL ON SCHEMA audit FROM anon;
REVOKE ALL ON SCHEMA audit FROM authenticated;

-- ULID domain: 26-char Crockford base32, chronologically sortable
-- Stored as text so it's human-readable in logs and admin queries.
-- Generate client-side: ulid() from the 'ulid' npm package.
CREATE DOMAIN public.ulid AS text
  CONSTRAINT ulid_format CHECK (
    VALUE ~ '^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$'
  );

COMMENT ON DOMAIN public.ulid IS
  'Universally Unique Lexicographically Sortable Identifier. '
  'Generated client-side. Sorts chronologically in B-tree indexes. '
  'Format: 26-char Crockford base32.';

-- ─────────────────────────────────────────────────────────────────────────────
-- ULID GENERATOR (server-side, Postgres-native)
-- Used for server-assigned IDs inside SECURITY DEFINER functions.
-- Client-generated ULIDs are passed in and stored as-is.
-- This is a minimal implementation using pgcrypto random bytes + timestamp.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_ulid()
  RETURNS public.ulid
  LANGUAGE plpgsql
  VOLATILE
  SET search_path = ''
AS $$
DECLARE
  v_timestamp   bigint;
  v_random      bytea;
  v_chars       text  := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_result      text  := '';
  v_byte        int;
  v_timestamp_r bigint;
  i             int;
BEGIN
  -- 48-bit millisecond timestamp
  v_timestamp := (extract(epoch from clock_timestamp()) * 1000)::bigint;

  -- Encode timestamp (10 chars)
  v_timestamp_r := v_timestamp;
  FOR i IN 1..10 LOOP
    v_result := substr(v_chars, (v_timestamp_r % 32)::int + 1, 1) || v_result;
    v_timestamp_r := v_timestamp_r / 32;
  END LOOP;

  -- 80 bits of randomness (16 chars)
  v_random := gen_random_bytes(10);
  FOR i IN 0..9 LOOP
    -- Extract each byte, use modulo 32 for character selection
    v_byte := get_byte(v_random, i);
    v_result := v_result || substr(v_chars, (v_byte % 32) + 1, 1);
    -- Use high bits too for second character from each byte
    IF i < 6 THEN  -- 16 chars total from 10 bytes
      v_result := v_result || substr(v_chars, (v_byte / 8 % 32) + 1, 1);
    END IF;
  END LOOP;

  RETURN substr(v_result, 1, 26);
END;
$$;

COMMENT ON FUNCTION public.generate_ulid() IS
  'Server-side ULID generation. Use only inside SECURITY DEFINER functions. '
  'Client-generated ULIDs are preferred (better distribution, offline support). '
  'This function is for server-assigned IDs: sale.id, movement.id, etc.';
