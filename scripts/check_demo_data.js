const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkData() {
  console.log('--- Demo Data Readiness Check ---');
  
  const { data: tenants, error: errT } = await supabase.from('tenants').select('*');
  console.log(`Tenants: ${tenants?.length || 0}`);

  const { data: branches, error: errB } = await supabase.from('branches').select('*');
  console.log(`Branches: ${branches?.length || 0}`);

  for (const tenant of tenants || []) {
    const demoTenantId = tenant.id;
    console.log(`\nUsing Tenant ID: ${demoTenantId} (${tenant.name})`);

    const { data: profiles, error: errP } = await supabase.from('profiles').select('email, role').eq('tenant_id', demoTenantId);
    console.log(`Profiles in tenant:`, profiles?.map(p => `${p.email} (${p.role})`).join(', ') || null);

    const { data: families, error: errFam } = await supabase.from('product_families').select('*').eq('tenant_id', demoTenantId);
    console.log(`Product Families: ${families?.length || 0}`);

    const { data: variants, error: errVar } = await supabase.from('product_variants').select('*').eq('tenant_id', demoTenantId);
    console.log(`Product Variants: ${variants?.length || 0}`);

    const { data: stock, error: errS } = await supabase.from('stock_levels').select('*').eq('tenant_id', demoTenantId);
    console.log(`Stock Levels: ${stock?.length || 0}`);

    const { data: cust, error: errC } = await supabase.from('customers').select('*').eq('tenant_id', demoTenantId);
    console.log(`Customers: ${cust?.length || 0}`);

    const { data: sales, error: errSa } = await supabase.from('pos_sales').select('*').eq('tenant_id', demoTenantId);
    console.log(`POS Sales: ${sales?.length || 0}`);
  }
}

checkData().catch(console.error);
