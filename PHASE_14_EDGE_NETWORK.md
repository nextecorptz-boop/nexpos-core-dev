# NEXPOS Phase 14: Trusted Edge Network & Intelligent Device Coordination
## Master Architecture & Implementation Plan

**Role Context:** Principal Distributed Systems Architect
**Focus Area:** Retail-grade edge computing platform for unreliable network environments

---

## 1. Executive Summary

Phase 14 transitions NEXPOS from an offline-capable system to a fully trusted, intelligent edge network. In retail environments like East Africa, devices are frequently stolen, network connections drop unpredictably, and store topologies are dynamic. This phase hardens our distributed event-sourced architecture by introducing cryptographic trust at the edge, orchestrating device coordination without cloud dependency, and optimizing synchronization under severe network constraints.

---

## 2. Threat Model (Edge Trust)

Given the reality of physical retail edge environments, our threat model assumes the local network is untrusted and physical devices can be compromised.

### Threat Vectors & Mitigations
| Threat Vector | Description | Mitigation Strategy |
| --- | --- | --- |
| **Physical Device Theft** | A tablet is stolen and used to inject fraudulent sales or extract PII. | Cryptographic device identity linked to hardware root-of-trust. Remote revocation capabilities. Encrypted local storage. |
| **Rogue Device Injection** | An attacker connects a personal laptop to the branch Wi-Fi to sync with the local mesh. | Strict device registration workflows. Mutual TLS (mTLS) for local mesh communication. Signed sync payloads requiring trusted private keys. |
| **Replay Attacks** | An attacker captures and replays sync payloads to duplicate transactions or alter inventory. | Nonce-based signed payloads, monotonic event versioning, and strict append-only validation at the ledger layer. |
| **Data Tampering** | Altering IndexedDB storage offline before sync. | Sync payloads are cryptographically signed at the point of origin. Signatures are verified before appending to the central event store. |
| **Denial of Service (Local)**| Flooding the branch leader with garbage events to take down the local POS mesh. | Rate-limiting at the branch leader, smart queue prioritization (sales > telemetry), and anomaly detection. |

---

## 3. Edge Trust Architecture

The foundation of Phase 14 is the **Device Trust Mesh**. Devices are no longer implicitly trusted just because they have a valid user JWT.

### 3.1 Cryptographic Device Identity & Hardware Fingerprinting
1. **Device Keypair Generation:** Upon app installation/first boot, a non-exportable ECDSA P-256 keypair is generated using the Web Crypto API.
2. **Hardware Fingerprinting:** A composite hash is generated from stable device characteristics (screen resolution, OS, canvas fingerprint, persistent local storage ID).
3. **Registration Payload:** `(PublicKey, Fingerprint, Timestamp)` is sent to the cloud.

### 3.2 Trusted Device Registration
- **Approval Workflow:** The Branch Manager or Admin must explicitly approve the pending device in the dashboard.
- **Trust Certificate:** Once approved, the central server issues a signed "Device Certificate" valid for 30 days (auto-renewed during active syncs).

### 3.3 Signed Sync Payloads & Encrypted Edge Sync
- Every sync batch sent to the central database or the Branch Leader is signed by the device's private key.
- The receiving node verifies the signature against the active Device Certificate registry.
- Payloads are encrypted in transit via mTLS and at rest (using AES-GCM for sensitive offline data).

---

## 4. Sync Optimization Layer & Replay Prioritization

When internet connectivity is restored after a 6-hour outage, dumping 10,000 events simultaneously will choke the network and delay critical operations. 

### 4.1 Smart Queue Prioritization
Events are grouped into priority tiers:
- **P0 (Critical):** Sales transactions, cash till operations (Sync Immediately).
- **P1 (High):** Inventory movements, returns (Sync every 1 min).
- **P2 (Medium):** Product catalog updates, customer creations (Sync every 5 mins).
- **P3 (Low):** Telemetry, analytics, UI state (Sync when idle or Wi-Fi only).

### 4.2 Adaptive Replay Batching
- **Dynamic Batch Sizing:** The sync engine measures network latency and throughput (RTT).
  - High Latency/Low Bandwidth (e.g., 2G/3G): Small batches (10-50 events).
  - High Bandwidth (e.g., Fiber): Large batches (500-1000 events).
- **Backoff & Jitter:** Exponential backoff on sync failure with randomized jitter to prevent thundering herd problems when a branch comes back online.

### 4.3 Predictive Sync Reliability
- The local node maintains a rolling average of successful sync windows. If the system predicts a drop (e.g., daily power rationing at 6 PM), it triggers aggressive pre-syncing of critical projections (catalog updates, price changes).

---

## 5. Device Coordination System (Branch Mesh)

To survive extended outages, branches with multiple POS tablets must coordinate locally.

### 5.1 Device Heartbeat Mesh
- Devices in the same branch broadcast UDP/WebSocket heartbeats over the local LAN.
- The heartbeat contains: Device ID, Sync State (last processed sequence number), and Queue Size.

### 5.2 Branch Leader Election (Raft-lite)
- If the WAN goes down, local devices must elect a **Branch Leader** to orchestrate local consistency.
- **Election:** The device with the highest processing capability, longest uptime, and most up-to-date sync state is elected.
- **Role of the Leader:** 
  1. Acts as the local event broker (event-bus proxy).
  2. Resolves local conflicts (e.g., two tablets selling the last pair of shoes).
  3. Acts as the single point of sync to the cloud when WAN is restored, reducing redundant bandwidth usage.

### 5.3 Anomaly Detection for Operational Drift
- The Branch Leader monitors local devices for "drift" (a device that hasn't synced in X hours or has clock skew).
- Drifted devices are quarantined and forced to do a full state reconciliation before processing new sales.

---

## 6. Verification & Benchmark Strategy

### 6.1 Benchmark Strategy
To validate the architecture, we will execute the following benchmarks:
1. **Throughput:** Sync 50,000 P0 events from 10 devices over a simulated 3G connection (Target: 100% durability, < 5 minutes total convergence).
2. **Leader Failover:** Kill the Branch Leader during active local operations. (Target: New leader elected and mesh stable in < 2 seconds).
3. **Crypto Overhead:** Measure the CPU cost of signing/verifying payloads on low-end Android tablets (Target: < 5ms per transaction).

### 6.2 Verification Strategy
- **Chaos Testing:** Inject network partitions (split-brain scenarios) within the local branch. Ensure the ledger correctly handles merged timelines.
- **Cryptographic Audit:** Verify that manipulated payloads (altered quantities/prices) are rejected by signature validation.
- **Replay Audit:** Verify that previously accepted, valid payloads cannot be re-submitted.

---

## 7. Secure Local Backup & Recovery Runbooks

### 7.1 Secure Local Backup
- Critical local event queues are backed up daily to encrypted local files on the device filesystem (Android scoped storage).
- Keys for this encrypted backup are derived from a combination of the hardware root-of-trust and an admin-only PIN.

### 7.2 Recovery Runbook: Complete Device Failure (Theft/Damage)
1. **Revoke:** Admin logs into central dashboard and marks the device as "Compromised". Cloud immediately rejects its certificate.
2. **Provision:** New tablet is powered on, app installed.
3. **Register:** Device registration workflow completed.
4. **Hydrate:** New device downloads the latest projection snapshot + incremental events since the snapshot.
5. **Resume:** Device joins the local heartbeat mesh and resumes operations. (Total time < 5 minutes).

### 7.3 Recovery Runbook: Split-Brain Resolution
If a partitioned network causes two leaders to form, upon network restoration:
1. Both leaders submit their local event queues to the cloud.
2. The central Conflict Resolution Engine (Phase 13) handles deterministically conflicting events (e.g., double-spend of inventory).
3. The central server issues a "Force Sync" command, pushing the resolved timeline down to all devices.

---

## 8. Implementation Phases

**Milestone 1: Identity & Trust (Weeks 1-2)**
- Web Crypto API integration.
- Hardware fingerprinting and JWT/Certificate issuance.
- Payload signing and verification middleware.

**Milestone 2: Adaptive Sync Engine (Weeks 3-4)**
- Priority queue implementation (P0-P3).
- Network telemetry and adaptive batch sizing logic.
- Testing under throttled network profiles.

**Milestone 3: Local Mesh & Leadership (Weeks 5-7)**
- Local network discovery (WebRTC/WebSockets).
- Leader election algorithm (Raft implementation for JS).
- Local event brokering and drift detection.

**Milestone 4: Hardening & Chaos Testing (Week 8)**
- Execute benchmark suite.
- Security audit of offline backups.
- Finalize documentation and runbooks.