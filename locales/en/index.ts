export const en = {
  common: {
    save: "Save Changes",
    cancel: "Cancel",
    loading: "Loading...",
    success: "Success",
    error: "Error",
    active: "Active",
    inactive: "Inactive",
    status: "Status",
    actions: "Actions",
    name: "Name",
    email: "Email",
    phone: "Phone Number",
    address: "Address",
    role: "Role",
    edit: "Edit",
    delete: "Delete",
    view: "View",
    unauthorized: "Unauthorized Access",
    retry: "Retry",
    discard: "Discard",
    refresh: "Refresh Feed"
  },
  settings: {
    title: "Operational Workspace Settings",
    subtitle: "Configure localization, device trust, billing subscriptions, edge networking, and staff scopes.",
    tabs: {
      general: "General Settings",
      security: "Security & Trust Mesh",
      subscription: "Subscription & Billing",
      sync: "Sync & Edge Network",
      staff: "Staff & Permissions"
    },
    general: {
      branchInfo: "Branch Specifications",
      branchName: "Branch Name",
      timezone: "Timezone",
      currency: "Default Currency",
      language: "Preferred Language",
      receiptSettings: "Receipt Format Settings",
      receiptHeader: "Receipt Header Message",
      receiptFooter: "Receipt Footer Message",
      saveSuccess: "General settings updated successfully."
    },
    security: {
      credentials: "Cryptographic Node Credentials",
      deviceUuid: "Persistent Device UUID",
      fingerprint: "Supplemental Hardware Fingerprint",
      keyStorage: "ECDSA Private Key Storage",
      keyStorageStatus: "SECURE & NON-EXPORTABLE (P-256)",
      activeNonce: "Active Outbound Nonce",
      certStatus: "Device Certificate Status",
      certIssued: "Certificate Issued At",
      certExpires: "Certificate Expires At",
      rotationTitle: "Cryptographic Rotation & Recovery",
      rotationDesc: "Rotate local ECDSA P-256 keypairs and generate a new trust certificate. This updates your node signature context across peer nodes.",
      rotateBtn: "Rotate Device Credentials",
      trustRegistry: "Trusted Device Registry (Edge Mesh)",
      peerDeviceId: "Peer Device ID",
      peerStatus: "Trust Status",
      peerNonce: "Last Verified Nonce",
      peerLastSeen: "Last Seen",
      noPeers: "No peer devices registered in the local trust registry.",
      rotationSuccess: "Key rotation completed successfully!"
    },
    subscription: {
      planCard: "Active SaaS Plan",
      quotaMeters: "Resource Quotas & Utilization",
      branchesQuota: "Branch Quota Usage",
      staffQuota: "Staff Account Usage",
      terminalsQuota: "Terminal Device Usage",
      unlimited: "Unlimited",
      renewalDate: "Subscription Renewal Date",
      paymentHistory: "Recent Transaction History",
      lockedFeatures: "Locked Enterprise Feature Set",
      upgradePrompt: "Unlock full local mesh networking, cross-device stock locking, and multi-branch catalog projections with a Pro or Enterprise plan.",
      upgradeBtn: "Upgrade Subscription Plan",
      features: {
        mesh: "Local Mesh Heartbeats & Raft Elections",
        locking: "Cross-Device Shared Stock Locking",
        multiBranch: "Multi-Branch Catalog Replications",
        telemetry: "Real-time Edge Diagnostics & Audits"
      }
    },
    sync: {
      leaderCard: "Intelligent Leader Coordination",
      leaderStatus: "Local Node Leadership Status",
      leader: "Branch Leader Node",
      follower: "Replicating Follower Node",
      peerCount: "Active Mesh Peer Count",
      meshHealth: "Local Mesh Heartbeat Health",
      wanQuality: "WAN Network Quality Telemetry",
      online: "Online (SLA Active)",
      offline: "Offline Mode",
      queuePriority: "Priority Replay Queues",
      queueDesc: "Critical financial (P0) transactions replay immediately; analytics (P3) are throttled until idle/Wi-Fi gates are satisfied.",
      failoverLogs: "Local Failover Telemetry Logs",
      noLogs: "No recent failover incidents recorded.",
      pendingQueue: "Local Pending Sync Queue",
      logMessage: "Log Message"
    },
    staff: {
      title: "Authorized Branch Staff Accounts",
      subtitle: "Authorized operators and terminals registered to Dar es Salaam Central.",
      ownerName: "Faraji Salum",
      addStaff: "Add Staff Member",
      branchAccess: "Branch Scope",
      allBranches: "All Branches (Owner Scope)",
      deviceAuth: "Device Authorization Limits",
      authStatus: "Auth Status",
      roles: {
        owner: "Workspace Owner",
        manager: "Branch Manager",
        cashier: "Terminal Cashier"
      }
    }
  }
};

export type TranslationType = typeof en;
