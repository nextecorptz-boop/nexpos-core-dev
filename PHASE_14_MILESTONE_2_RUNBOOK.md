# NEXPOS Phase 14 Milestone 2: Adaptive Sync & Edge Coordination Runbook

## Overview
This milestone introduces the **Adaptive Sync Engine** and **Simulated Edge Mesh**. These systems ensure that NEXPOS branches remain operational during WAN outages by coordinating locally and optimizing cloud synchronization based on network quality.

## Core Systems

### 1. Adaptive Sync Engine
- **Priority Queues (P0-P3)**:
  - **P0**: Critical Financial (Sales, Tills). Syncs immediately.
  - **P1**: High Priority (Inventory). Syncs every 1 min.
  - **P2**: Operational (Customers, Suppliers). Syncs every 5 mins.
  - **P3**: Low Priority (Telemetry). Syncs when idle or excellent connection.
- **Adaptive Batching**: The engine monitors RTT and battery levels. On poor connections (2G/3G) or low battery, batch sizes are reduced to 1 item to ensure durability over throughput.

### 2. Intelligent Edge Mesh
- **Transport**: Currently uses `BroadcastChannel` to simulate multi-device coordination across browser tabs.
- **Leader Election**: Uses a **Bully Lite** algorithm. The node with the best score (highest ledger position + uptime + battery) becomes the Branch Leader.
- **Failover**: If the leader crashes, heartbeats stop. After 6 seconds, peers trigger a new election.

## Operational Procedures

### Monitoring Mesh Health
1. Open the **Telemetry Dashboard**.
2. Navigate to the **Mesh & Adaptive Sync** tab.
3. Verify:
   - **Leadership Role**: One device should be "Branch Leader".
   - **Peer Count**: Should match the number of active tablets in the branch.
   - **Network Quality**: Check the "Avg RTT" and "Active Strategy".

### Emergency Recovery: Split-Brain
If two devices both claim to be "Branch Leader" (Split-Brain):
1. The system detects this via heartbeat comparison.
2. The device with the **lower UUID** stays leader; the other steps down automatically.
3. If persistence occurs, refresh the page on the "Peer Node" to reset its coordination state.

### Emergency Recovery: Data Loss
If a device's IndexedDB is wiped or corrupted:
1. The system attempts to restore from the **Encrypted Offline Backup** (`nexpos_emergency_backup.json` in LocalStorage).
2. Contact an administrator to provide the **Security PIN** for decryption.
3. Navigate to **System Diagnostics** to trigger a "Full Cold Replay" once restored.

## Maintenance
- **Backups**: Critical state is backed up locally every day. Ensure the device has at least 100MB of free space.
- **Telemetry**: Monitor the **Telemetry Feed** for `MESH SPLIT-BRAIN` or `MESH FAILOVER` events to identify unstable local Wi-Fi.
