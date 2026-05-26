-- =============================================================================
-- MIGRATION 001: Schemas, Types, Extensions
-- Run order: FIRST — all other migrations depend on this
-- Rollback: DROP SCHEMA audit CASCADE; DROP DOMAIN IF EXISTS public.ulid;
-- =============================================================================

-- Extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram index support for ILIKE search
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- accent-insensitive full-text (Swahili names)

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
