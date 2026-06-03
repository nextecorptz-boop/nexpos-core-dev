-- =========================================================================
-- NEXPOS Enterprise Database Scalability & Partitioning Blueprint
-- =========================================================================
-- This script contains production-grade SQL strategies for handling high transaction
-- volumes, partitioning tables, optimizing autovacuum, and scheduling archival policies.
-- Execute these scripts on the production PostgreSQL instance to sustain growth.

-- =========================================================================
-- 1. TABLE PARTITIONING POLICY FOR HIGH-VOLUME TRANSACTION TABLES
-- =========================================================================
-- Partitioning strategy: Partition by RANGE of `created_at` or `timestamp`.
-- We partition `inventory_movements` and `audit_logs` since they scale linearly with transactions.

-- Step 1: Create a partitioned version of `inventory_movements` (if migrating existing table)
-- Note: In PostgreSQL, partitioning must be defined at table creation time.

-- Example partitioning for inventory_movements:
CREATE TABLE IF NOT EXISTS inventory_movements_partitioned (
  id UUID DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  movement_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  reference_id UUID,
  reference_type VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL,
  PRIMARY KEY (id, created_at) -- Partition key MUST be part of the primary key
) PARTITION BY RANGE (created_at);

-- Create sample quarterly partitions for 2026
CREATE TABLE IF NOT EXISTS inventory_movements_y2026q1 PARTITION OF inventory_movements_partitioned
  FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS inventory_movements_y2026q2 PARTITION OF inventory_movements_partitioned
  FOR VALUES FROM ('2026-04-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS inventory_movements_y2026q3 PARTITION OF inventory_movements_partitioned
  FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS inventory_movements_y2026q4 PARTITION OF inventory_movements_partitioned
  FOR VALUES FROM ('2026-10-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

-- Create a default partition for overflow
CREATE TABLE IF NOT EXISTS inventory_movements_default PARTITION OF inventory_movements_partitioned DEFAULT;


-- Partitioning strategy for `audit_logs`
CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
  id UUID DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  user_id UUID NOT NULL,
  branch_id UUID,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS audit_logs_y2026 PARTITION OF audit_logs_partitioned
  FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2027-01-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS audit_logs_default PARTITION OF audit_logs_partitioned DEFAULT;


-- =========================================================================
-- 2. AUTOVACUUM & QUERY PLANNER PERFORMANCE OPTIMIZATION
-- =========================================================================
-- High insert/delete churn on transactional tables (like queues) causes index bloat.
-- We customize autovacuum settings specifically for these high-traffic tables.

-- Fine-tune autovacuum parameters for sales, sale_items and inventory_movements
ALTER TABLE sales SET (
  autovacuum_vacuum_scale_factor = 0.05, -- Trigger vacuum after 5% changes (default is 20%)
  autovacuum_analyze_scale_factor = 0.02, -- Trigger analyze after 2% changes (default is 10%)
  autovacuum_vacuum_cost_limit = 1000 -- Allow vacuum process to use more CPU/IO resources
);

ALTER TABLE sale_items SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 1000
);

ALTER TABLE inventory_movements SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_limit = 1000
);


-- =========================================================================
-- 3. SCHEDULED INDEX MAINTENANCE & FRAGMENTATION CHECKS
-- =========================================================================
-- Over time, B-tree indexes get bloated. Run this periodic index maintenance script 
-- during off-peak operational hours (e.g. 2:00 AM EAT).

-- Identify index bloat & fragmentation ratio
CREATE OR REPLACE VIEW index_bloat_diagnostics AS
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan AS number_of_scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Rebuild index concurrently (prevents table write locks during execution)
-- Run these commands periodically:
-- REINDEX INDEX CONCURRENTLY idx_sales_date;
-- REINDEX INDEX CONCURRENTLY idx_inventory_movements_created;


-- =========================================================================
-- 4. COLD STORAGE & HISTORICAL DATA RETENTION POLICIES
-- =========================================================================
-- To prevent production performance degradation, we archive audit logs older than
-- 1 year and inventory movements older than 2 years into compressed archival storage.

-- Create archival schemas to hold historical partitions
CREATE SCHEMA IF NOT EXISTS nexpos_archive;

-- 1-Year Retention Policy configuration for Audit Logs
CREATE TABLE IF NOT EXISTS nexpos_archive.audit_logs_archive (
  id UUID,
  tenant_id UUID,
  user_id UUID,
  branch_id UUID,
  action VARCHAR(100),
  entity_type VARCHAR(100),
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pruning & Archiving Procedure (runs on pg_cron scheduler nightly)
CREATE OR REPLACE PROCEDURE archive_stale_data()
LANGUAGE plpgsql AS $$
DECLARE
  archive_limit TIMESTAMPTZ;
  rows_moved INT;
BEGIN
  -- Move Audit Logs older than 1 year
  archive_limit := NOW() - INTERVAL '1 year';
  
  WITH moved_rows AS (
    DELETE FROM audit_logs
    WHERE created_at < archive_limit
    RETURNING *
  )
  INSERT INTO nexpos_archive.audit_logs_archive (
    id, tenant_id, user_id, branch_id, action, entity_type, entity_id, old_value, new_value, created_at
  )
  SELECT id, tenant_id, user_id, branch_id, action, entity_type, entity_id, old_value, new_value, created_at
  FROM moved_rows;

  GET DIAGNOSTICS rows_moved = ROW_COUNT;
  RAISE NOTICE 'Archived % audit logs older than %', rows_moved, archive_limit;
  
END;
$$;
