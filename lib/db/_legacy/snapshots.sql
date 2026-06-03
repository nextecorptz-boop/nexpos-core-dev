-- NEXPOS - Aggregate Snapshots & Checkpoint Schema
-- Execute this script in the Supabase SQL Editor

-- 1. Inventory State Snapshots
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  aggregate_id UUID NOT NULL, -- variant_id
  last_event_position BIGINT NOT NULL, -- Watermark of global_position
  last_event_version INTEGER NOT NULL, -- Watermark of event_version
  snapshot_checksum TEXT NOT NULL, -- Integrity validation checksum
  data JSONB NOT NULL, -- Serialized inventory levels & reservations
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_inventory_snapshot UNIQUE(aggregate_id, last_event_version)
);

CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_lookup 
  ON inventory_snapshots(aggregate_id, last_event_position DESC);


-- 2. Sales Totals Snapshots
CREATE TABLE IF NOT EXISTS sales_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
  aggregate_id UUID NOT NULL, -- sale_id
  last_event_position BIGINT NOT NULL,
  last_event_version INTEGER NOT NULL,
  snapshot_checksum TEXT NOT NULL,
  data JSONB NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_sales_snapshot UNIQUE(aggregate_id, last_event_version)
);

CREATE INDEX IF NOT EXISTS idx_sales_snapshots_lookup 
  ON sales_snapshots(aggregate_id, last_event_position DESC);


-- 3. Branch Metrics Snapshots
CREATE TABLE IF NOT EXISTS branch_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  aggregate_id UUID NOT NULL, -- branch_id
  last_event_position BIGINT NOT NULL,
  last_event_version INTEGER NOT NULL,
  snapshot_checksum TEXT NOT NULL,
  data JSONB NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_branch_snapshot UNIQUE(aggregate_id, last_event_version)
);

CREATE INDEX IF NOT EXISTS idx_branch_snapshots_lookup 
  ON branch_snapshots(aggregate_id, last_event_position DESC);


-- 4. Transfer History Snapshots
CREATE TABLE IF NOT EXISTS transfer_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  aggregate_id UUID NOT NULL, -- transfer_id
  last_event_position BIGINT NOT NULL,
  last_event_version INTEGER NOT NULL,
  snapshot_checksum TEXT NOT NULL,
  data JSONB NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT uq_transfer_snapshot UNIQUE(aggregate_id, last_event_version)
);

CREATE INDEX IF NOT EXISTS idx_transfer_snapshots_lookup 
  ON transfer_snapshots(aggregate_id, last_event_position DESC);
