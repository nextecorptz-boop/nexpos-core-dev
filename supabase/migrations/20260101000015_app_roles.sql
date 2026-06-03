-- =============================================================================
-- MIGRATION 015: Create App Postgres Roles
-- Reason: Supabase hoists app_metadata.role to the JWT root. PostgREST attempts
-- to assume these roles, so they must exist in Postgres and be granted to the
-- authenticator role.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'owner') THEN
    CREATE ROLE owner NOLOGIN;
    GRANT owner TO authenticator;
    GRANT authenticated TO owner;
    GRANT USAGE ON SCHEMA public TO owner;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'manager') THEN
    CREATE ROLE manager NOLOGIN;
    GRANT manager TO authenticator;
    GRANT authenticated TO manager;
    GRANT USAGE ON SCHEMA public TO manager;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cashier') THEN
    CREATE ROLE cashier NOLOGIN;
    GRANT cashier TO authenticator;
    GRANT authenticated TO cashier;
    GRANT USAGE ON SCHEMA public TO cashier;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'viewer') THEN
    CREATE ROLE viewer NOLOGIN;
    GRANT viewer TO authenticator;
    GRANT authenticated TO viewer;
    GRANT USAGE ON SCHEMA public TO viewer;
  END IF;
END
$$;
