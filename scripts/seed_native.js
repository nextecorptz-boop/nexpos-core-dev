const fs = require('fs');

const envRaw = fs.readFileSync('.env.local', 'utf8');
envRaw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach(l => {
  const [k, ...v] = l.split('=');
  process.env[k] = v.join('=');
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEV_USERS = [
  {
    email: 'manager@nexpos.dev',
    fullName: 'Amina Hassan',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: '01HZDEV00000000000BRANCH01',
    role: 'manager',
  }
];

async function seed() {
  for (const user of DEV_USERS) {
    console.log(`Seeding user ${user.email}...`);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        email: user.email,
        password: 'password123',
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
        app_metadata: {
          tenant_id: user.tenantId,
          role: user.role,
          branch_id: user.branchId,
        }
      })
    });
    
    const data = await res.json();
    if (!res.ok) {
      console.error(`Failed to create user ${user.email}:`, data);
      continue;
    }
    console.log(`Created user ${user.email} (ID: ${data.id})`);

    // Ensure profile row using PostgREST
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        id: data.id,
        tenant_id: user.tenantId,
        branch_id: user.branchId,
        full_name: user.fullName,
        role: user.role,
        is_active: true
      })
    });
    
    if (!profileRes.ok) {
      console.error(`Failed to upsert profile for ${user.email}:`, await profileRes.text());
    } else {
      console.log(`Profile created for ${user.email}`);
    }
  }
}

seed();
