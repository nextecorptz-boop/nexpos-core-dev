# NEXPOS Security Runbook: Edge Trust, Key Rotation & Disaster Recovery

This operational runbook provides step-by-step procedures for administrators and branch managers to maintain device credentials, execute key rotations, handle lost/stolen tablets, and resolve replication trust blocks.

---

## 1. Device Compromise / Theft Recovery Flow

When a retail tablet is lost, stolen, or suspected of compromise, its cryptographic credentials must be revoked immediately to protect central ledger integrity.

### Step 1: Revoke the Device from the Dashboard
An administrator must log into the Central SaaS Control Panel and mark the device as **Compromised**.
- This action updates the device status to `revoked` in the central postgres database table of approved nodes.
- Any future sync payload received from the compromised device ID will be rejected by the cloud replication endpoints.

### Step 2: Local Mesh Revocation Broadcast (Offline Recovery)
If the branch network is offline and cannot contact the cloud:
1. The Branch Manager logs into any active **trusted** terminal in the branch.
2. In the **Security & Trust Mesh** diagnostics tab, find the Compromised device ID.
3. Click **Revoke Device**.
4. The local node will immediately update its registry state for that device to `revoked` and broadcast a revocation packet over the local network (via peer heartbeats).
5. All other active tablets in the branch mesh will mark the compromised device ID as `revoked` in their local `device_trust_registry` database tables.
6. Local replication or mesh synchronization requests from the revoked device will be hard-rejected.

### Step 3: Provision a Replacement Device
To introduce a new tablet:
1. Install the NEXPOS application on the new hardware.
2. Boot the application. The system will automatically generate a unique persistent Device UUID and a non-exportable ECDSA P-256 keypair.
3. Log in with manager credentials. The tablet will auto-enroll with a status of `pending`.
4. Go to the dashboard on a trusted machine and approve the pending registration. Once approved, the new device receives `trusted` status and can participate in replication.

---

## 2. Cryptographic Key Rotation Runbook

As a security policy, device keys should be rotated periodically (e.g. every 180 days) or immediately following a security incident.

### Step 1: Trigger Rotation
* **Automatic Rotation:** The client app automatically triggers key rotation if the current certificate is within 30 days of its 180-day expiration window.
* **Manual Rotation:** Go to **Security & Trust Mesh** diagnostics tab on the target device, scroll to **Cryptographic Rotation & Recovery** section, and click **Rotate Device Credentials**.

### Step 2: Verification of Rotation
Upon triggering rotation:
1. The system creates a new ECDSA P-256 keypair (with the private key marked as non-extractable).
2. It transitions the status of the old certificate to `rotated`.
3. It updates the database with the new certificate, resetting the signature nonce to `1`.
4. Check the diagnostics panel to ensure:
   - **Active Outbound Nonce** has reset to `1`.
   - **Certificate Status** shows `active`.
   - **Certificate Expires At** is exactly 180 days in the future.

---

## 3. Resolving Ledger Replication Trust Blocks

Replication blocks occur if a node receives events with invalid signatures, expired certificates, or duplicated nonces (triggering replay protections).

### Scenario A: Replay Block (Duplicate Nonces)
If a device has database corruption or clock reset, it might output event nonces that overlap with previously verified streams.
- **Symptom:** Logs show `REPLAY ATTACK BLOCKED: Nonce reuse detected`.
- **Resolution:**
  1. The blocked events are automatically moved to the local **Quarantine Queue** to prevent halting queue replication.
  2. Access the **Quarantined Mutations** tab in the Telemetry panel to review payloads.
  3. If verified as benign (e.g., node was hard-rebooted and lost clock synchronization), click **Retry Sync** which increments the local nonce and signs a new payload.
  4. If malicious, click **Discard** and mark the originating node as `suspected` or `revoked`.

### Scenario B: Expired Certificate (Offline branches)
- **Symptom:** Diagnostic shows `Certificate has expired`.
- **Resolution:**
  - If the branch has been offline > 180 days, the certificate will exceed the 30-day offline grace period.
  - Establish temporary internet connectivity (e.g., tethering a mobile hotspot) to let the device auto-contact the central SaaS server, check minimal version compatibility, and renew its trust credentials.
