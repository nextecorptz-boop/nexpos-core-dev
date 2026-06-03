const fs = require('fs');

// Load environment variables manually
const envRaw = fs.readFileSync('.env.local', 'utf8');
envRaw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach(l => {
  const [k, ...v] = l.split('=');
  process.env[k] = v.join('=');
});

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('Testing login for manager@nexpos.dev...');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({
      email: 'manager@nexpos.dev',
      password: 'password123'
    })
  });
  
  const data = await res.json();
  if (!res.ok) {
    console.error('Login failed:', data);
    return;
  }
  
  console.log('Login successful! Parsing JWT...');
  const jwt = data.access_token;
  const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
  
  console.log('JWT Payload:');
  console.log(JSON.stringify(payload, null, 2));
  
  // Verify expected claims
  const { tenant_id, role, branch_id, is_active } = payload;
  console.log('--- Claim Verification ---');
  console.log('tenant_id:', tenant_id);
  console.log('role:', role);
  console.log('branch_id:', branch_id);
  console.log('is_active:', is_active);
}

run();
