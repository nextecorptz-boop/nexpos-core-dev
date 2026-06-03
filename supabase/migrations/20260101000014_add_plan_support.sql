-- =============================================================================
-- MIGRATION 014: Add Plan Support and Trialing Status to Tenants
-- Run order: AFTER 013
-- =============================================================================

-- 1. Add plan_id column to tenants table
ALTER TABLE public.tenants 
  ADD COLUMN plan_id text NOT NULL DEFAULT 'basic';

-- 2. Update status check constraint to include 'trialing'
-- Drop the auto-generated constraint (usually tenants_status_check) if exists
ALTER TABLE public.tenants 
  DROP CONSTRAINT IF EXISTS tenants_status_check;

-- Add updated constraint with a dedicated name for maintainability
ALTER TABLE public.tenants 
  ADD CONSTRAINT tenants_status_check 
  CHECK (status IN ('active', 'suspended', 'cancelled', 'trialing'));
