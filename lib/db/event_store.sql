-- NEXPOS - Append-Only Event Store & Dead-Letter Tables
-- Execute this script in the Supabase SQL Editor

-- 1. Create Event Store Table
CREATE TABLE IF NOT EXISTS event_store (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  global_position BIGSERIAL UNIQUE, -- Resilient, clock-drift safe sequence ordering
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INTEGER NOT NULL, -- Version of the specific aggregate stream
  schema_version INTEGER DEFAULT 1 NOT NULL, -- Payload structure version
  payload JSONB NOT NULL,
  metadata JSONB,
  actor_id UUID,
  correlation_id UUID,
  causation_id UUID,
  device_id VARCHAR(255),
  idempotency_key TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent double execution across network glitches/storms
  CONSTRAINT uq_tenant_idempotency UNIQUE(tenant_id, idempotency_key)
);

-- Indexes for time-travel queries and stream lookups
CREATE INDEX IF NOT EXISTS idx_event_store_aggregate 
  ON event_store(aggregate_id, event_version);

CREATE INDEX IF NOT EXISTS idx_event_store_tenant_occurred 
  ON event_store(tenant_id, occurred_at);

CREATE INDEX IF NOT EXISTS idx_event_store_correlation 
  ON event_store(correlation_id);

CREATE INDEX IF NOT EXISTS idx_event_store_event_type 
  ON event_store(event_type);

CREATE INDEX IF NOT EXISTS idx_event_store_recorded 
  ON event_store(recorded_at);

CREATE INDEX IF NOT EXISTS idx_event_store_global_pos 
  ON event_store(global_position);


-- 2. Create Dead-Letter Events Table
-- Keeps track of un-replayable events without breaking execution streams
CREATE TABLE IF NOT EXISTS dead_letter_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
  aggregate_type VARCHAR(100),
  aggregate_id UUID,
  event_type VARCHAR(100),
  payload JSONB NOT NULL,
  metadata JSONB,
  failure_reason TEXT,
  stack_trace TEXT,
  actor_id UUID,
  device_id VARCHAR(255),
  replay_attempts INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_tenant 
  ON dead_letter_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dead_letter_aggregate 
  ON dead_letter_events(aggregate_id);
