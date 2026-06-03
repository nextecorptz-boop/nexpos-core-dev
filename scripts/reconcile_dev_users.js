// =============================================================================
// scripts/reconcile_dev_users.js
//
// Reconciles dev Auth users for NEXPOS using Supabase Admin API only.
// Rules:
//   - Uses supabase.auth.admin.updateUserById to reset passwords
//   - Uses supabase.auth.admin.createUser for missing users
//   - Uses PostgREST (rest/v1) to upsert public.profiles
//   - Never touches auth.users or auth.identities with SQL
// =============================================================================

const fs = require('fs');

// Load .env.local
const envRaw = fs.readFileSync('.env.local', 'utf8');
envRaw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach(l => {
  const [k, ...v] = l.split('=');
  process.env[k] = v.join('=');
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const ADMIN_HEADERS = {
  'Content-Type': 'application/json',
  'apikey': SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
};

// ─────────────────────────────────────────────────────────────────────────────
// Dev user definitions — all IDs verified against live DB
// Tenant 1: 01HZDEV00000000000TENANT01 (Kariakoo Footwear)
// Tenant 2: 01HZDEV00000000000TENANT02 (Zanzibar Boutique)
// Branch 1: 01HZDEV00000000000BRANCH01 (Main Street)
// Branch 2: 01HZDEV00000000000BRANCH02 (Mlimani City)
// Branch 3: 01HZDEV00000000000BRANCH03 (Stone Town)
// ─────────────────────────────────────────────────────────────────────────────
const DEV_USERS = [
  {
    email: 'owner@nexpos.dev',
    password: 'password123',
    fullName: 'James Kimani',
    role: 'owner',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: null,
    phone: '+255 712 111 001',
  },
  {
    email: 'manager@nexpos.dev',
    password: 'password123',
    fullName: 'Amina Hassan',
    role: 'manager',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: '01HZDEV00000000000BRANCH01',
    phone: '+255 712 111 002',
  },
  {
    email: 'cashier@nexpos.dev',
    password: 'password123',
    fullName: 'Peter Mwangi',
    role: 'cashier',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: '01HZDEV00000000000BRANCH01',
    phone: '+255 712 111 003',
  },
  {
    email: 'grace@nexpos.dev',
    password: 'password123',
    fullName: 'Grace Odhiambo',
    role: 'cashier',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: '01HZDEV00000000000BRANCH02',
    phone: '+255 712 111 004',
  },
  {
    email: 'fatima@nexpos.dev',
    password: 'password123',
    fullName: 'Fatima Said',
    role: 'owner',
    tenantId: '01HZDEV00000000000TENANT02',
    branchId: null,
    phone: '+255 777 222 001',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Admin API helpers
// ─────────────────────────────────────────────────────────────────────────────

async function listAuthUsers() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=200`, {
    headers: ADMIN_HEADERS,
  });
  if (!res.ok) throw new Error(`listAuthUsers failed: ${await res.text()}`);
  const data = await res.json();
  return data.users || [];
}

async function createAuthUser(user) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`createAuthUser(${user.email}) failed: ${JSON.stringify(data)}`);
  return data;
}

async function updateAuthUser(userId, user) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify({
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`updateAuthUser(${user.email}) failed: ${JSON.stringify(data)}`);
  return data;
}

async function upsertProfile(authId, user) {
  const profilePayload = {
    id: authId,
    tenant_id: user.tenantId,
    branch_id: user.branchId,
    full_name: user.fullName,
    role: user.role,
    phone: user.phone,
    is_active: true,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: {
      ...ADMIN_HEADERS,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(profilePayload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upsertProfile(${user.email}) failed: ${text}`);
  }
  return profilePayload;
}

async function getProfile(authId) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${authId}&select=id,tenant_id,branch_id,full_name,role,is_active`, {
    headers: ADMIN_HEADERS,
  });
  if (!res.ok) throw new Error(`getProfile failed: ${await res.text()}`);
  const rows = await res.json();
  return rows[0] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main reconcile loop
// ─────────────────────────────────────────────────────────────────────────────

async function reconcile() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  NEXPOS Dev User Reconciliation');
  console.log(`  Project: ${SUPABASE_URL}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // Step 1: Fetch all existing auth users
  console.log('📋 Step 1: Fetching existing Auth users...');
  const existingUsers = await listAuthUsers();
  const existingByEmail = {};
  for (const u of existingUsers) {
    existingByEmail[u.email] = u;
  }
  console.log(`   Found ${existingUsers.length} total Auth users.\n`);

  const report = [];

  // Step 2: Reconcile each dev user
  for (const devUser of DEV_USERS) {
    console.log(`─────────────────────────────────────────────────────`);
    console.log(`  Processing: ${devUser.email}`);

    let authId;
    let authAction;

    const existing = existingByEmail[devUser.email];

    if (existing) {
      // User exists — reset password and ensure email confirmed
      console.log(`  ✅ Auth user exists (ID: ${existing.id})`);
      console.log(`     Email confirmed: ${existing.email_confirmed_at ? 'yes' : 'NO — will fix'}`);
      console.log(`  🔑 Resetting password...`);
      await updateAuthUser(existing.id, devUser);
      authId = existing.id;
      authAction = 'updated (password reset + email_confirm ensured)';
    } else {
      // User does not exist — create
      console.log(`  ⚠️  Auth user NOT found — creating...`);
      const created = await createAuthUser(devUser);
      authId = created.id;
      authAction = `created (ID: ${authId})`;
      console.log(`  ✅ Created Auth user (ID: ${authId})`);
    }

    // Step 3: Upsert profile
    console.log(`  📝 Upserting profile...`);
    await upsertProfile(authId, devUser);

    // Step 4: Verify profile
    const profile = await getProfile(authId);
    if (!profile) {
      console.error(`  ❌ Profile NOT found after upsert for ${devUser.email}`);
      report.push({ email: devUser.email, authId, authAction, profileOk: false, error: 'Profile missing after upsert' });
      continue;
    }

    const profileOk =
      profile.tenant_id === devUser.tenantId &&
      profile.role === devUser.role &&
      profile.is_active === true;

    console.log(`  ✅ Profile verified:`);
    console.log(`     tenant_id:  ${profile.tenant_id} ${profile.tenant_id === devUser.tenantId ? '✓' : '✗ MISMATCH'}`);
    console.log(`     role:       ${profile.role} ${profile.role === devUser.role ? '✓' : '✗ MISMATCH'}`);
    console.log(`     branch_id:  ${profile.branch_id ?? 'null'} ${profile.branch_id === devUser.branchId ? '✓' : '✗ MISMATCH'}`);
    console.log(`     is_active:  ${profile.is_active ? 'true ✓' : 'false ✗'}`);

    report.push({ email: devUser.email, authId, authAction, profile, profileOk });
  }

  // Step 5: Summary report
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RECONCILIATION REPORT');
  console.log('═══════════════════════════════════════════════════════');
  for (const r of report) {
    const status = r.profileOk ? '✅' : '❌';
    console.log(`${status} ${r.email}`);
    console.log(`   Auth:    ${r.authAction}`);
    if (r.profile) {
      console.log(`   tenant:  ${r.profile.tenant_id}`);
      console.log(`   role:    ${r.profile.role}`);
      console.log(`   branch:  ${r.profile.branch_id ?? 'null (owner-level)'}`);
      console.log(`   active:  ${r.profile.is_active}`);
    }
    if (r.error) console.log(`   ERROR:   ${r.error}`);
    console.log('');
  }

  const allOk = report.every(r => r.profileOk);
  if (allOk) {
    console.log('🟢 All dev users reconciled successfully.');
  } else {
    console.log('🔴 Some users failed — review errors above.');
    process.exit(1);
  }
}

reconcile().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
