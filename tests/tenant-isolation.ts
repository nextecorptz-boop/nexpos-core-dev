import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// 1. Load Env Vars
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8')
  envConfig.split('\n').forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      const key = match[1]
      let value = match[2] || ''
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1)
      }
      process.env[key] = value
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Error: Supabase environment variables are missing from .env.local')
  process.exit(1)
}

// 2. Setup Clients
const serviceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function runTests() {
  console.log('=== STARTING MULTI-TENANT ISOLATION & LIMITS INTEGRATION TESTS ===\n')

  const tenantASlug = `tenant-a-${Date.now()}`
  const tenantBSlug = `tenant-b-${Date.now()}`
  let tenantA: any = null
  let tenantB: any = null
  let userA: any = null
  let userB: any = null

  try {
    // ------------------------------------------------------------------
    // TEST STEP 1: Provision Tenants
    // ------------------------------------------------------------------
    console.log('Step 1: Provisioning test Tenant A and Tenant B...')
    
    // Create Tenant A
    const { data: tA, error: errA } = await serviceClient
      .from('tenants')
      .insert({ name: 'Tenant A Corp', slug: tenantASlug, status: 'trialing', plan_id: 'basic' })
      .select()
      .single()
    if (errA) throw new Error(`Failed to create Tenant A: ${errA.message}`)
    tenantA = tA
    console.log(`- Created Tenant A: ${tenantA.name} (ID: ${tenantA.id})`)

    // Create Tenant B
    const { data: tB, error: errB } = await serviceClient
      .from('tenants')
      .insert({ name: 'Tenant B Corp', slug: tenantBSlug, status: 'trialing', plan_id: 'basic' })
      .select()
      .single()
    if (errB) throw new Error(`Failed to create Tenant B: ${errB.message}`)
    tenantB = tB
    console.log(`- Created Tenant B: ${tenantB.name} (ID: ${tenantB.id})`)

    // ------------------------------------------------------------------
    // TEST STEP 2: Create Auth Owners
    // ------------------------------------------------------------------
    console.log('\nStep 2: Creating Auth Users with Tenant Metadata...')
    
    const emailA = `owner-a-${Date.now()}@test.com`
    const passwordA = 'TestPass123!'
    const { data: authA, error: aErrA } = await serviceClient.auth.admin.createUser({
      email: emailA,
      password: passwordA,
      email_confirm: true,
      user_metadata: { full_name: 'Owner A' },
      app_metadata: { tenant_id: tenantA.id, role: 'owner', branch_id: null }
    })
    if (aErrA || !authA.user) throw new Error(`Failed to create auth user A: ${aErrA?.message}`)
    userA = authA.user
    console.log(`- Created Auth User A: ${emailA}`)

    // Create profile for Owner A
    const { error: pErrA } = await serviceClient
      .from('profiles')
      .insert({
        id: userA.id,
        tenant_id: tenantA.id,
        full_name: 'Owner A',
        email: emailA,
        role: 'owner',
        is_active: true
      })
    if (pErrA) throw new Error(`Failed to create profile A: ${pErrA.message}`)

    const emailB = `owner-b-${Date.now()}@test.com`
    const passwordB = 'TestPass123!'
    const { data: authB, error: aErrB } = await serviceClient.auth.admin.createUser({
      email: emailB,
      password: passwordB,
      email_confirm: true,
      user_metadata: { full_name: 'Owner B' },
      app_metadata: { tenant_id: tenantB.id, role: 'owner', branch_id: null }
    })
    if (aErrB || !authB.user) throw new Error(`Failed to create auth user B: ${aErrB?.message}`)
    userB = authB.user
    console.log(`- Created Auth User B: ${emailB}`)

    // Create profile for Owner B
    const { error: pErrB } = await serviceClient
      .from('profiles')
      .insert({
        id: userB.id,
        tenant_id: tenantB.id,
        full_name: 'Owner B',
        email: emailB,
        role: 'owner',
        is_active: true
      })
    if (pErrB) throw new Error(`Failed to create profile B: ${pErrB.message}`)

    // ------------------------------------------------------------------
    // TEST STEP 3: Authenticate Clients
    // ------------------------------------------------------------------
    console.log('\nStep 3: Authenticating tenant clients...')
    
    const clientA = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
    const { data: sessA, error: lErrA } = await clientA.auth.signInWithPassword({ email: emailA, password: passwordA })
    if (lErrA || !sessA.session) throw new Error(`Login failed for User A: ${lErrA?.message}`)

    const clientB = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } })
    const { data: sessB, error: lErrB } = await clientB.auth.signInWithPassword({ email: emailB, password: passwordB })
    if (lErrB || !sessB.session) throw new Error(`Login failed for User B: ${lErrB?.message}`)

    console.log('- Successfully authenticated client A and client B.')

    // ------------------------------------------------------------------
    // TEST STEP 4: Assert RLS Category Isolation
    // ------------------------------------------------------------------
    console.log('\nStep 4: Testing RLS data isolation for categories...')
    
    // Client A inserts a category
    console.log('- Client A inserting category "Tenant A Shoes"...')
    const { data: catA, error: cErrA } = await clientA
      .from('product_categories')
      .insert({ tenant_id: tenantA.id, name: 'Tenant A Shoes', description: 'Categories for A' })
      .select()
      .single()
    
    if (cErrA) throw new Error(`Client A failed to insert category: ${cErrA.message}`)
    console.log(`  - Category created successfully (ID: ${catA.id})`)

    // Client B attempts to fetch categories
    console.log('- Client B attempting to read categories...')
    const { data: catListB, error: cErrB } = await clientB
      .from('product_categories')
      .select('*')
    
    if (cErrB) throw new Error(`Client B failed to query categories: ${cErrB.message}`)
    
    const foundAInB = (catListB || []).some((c: any) => c.id === catA.id)
    if (foundAInB) {
      throw new Error('RLS VIOLATION: Tenant B is able to see Tenant A categories!')
    } else {
      console.log('  - SUCCESS: Tenant B cannot see Tenant A categories (Empty or isolated).')
    }

    // ------------------------------------------------------------------
    // TEST STEP 5: Assert Pricing Limits (Branch Limits)
    // ------------------------------------------------------------------
    console.log('\nStep 5: Testing subscription limits enforcement...')
    
    console.log('- Creating first branch for Tenant A...')
    const { data: br1, error: brErr1 } = await clientA
      .from('branches')
      .insert({ tenant_id: tenantA.id, name: 'Branch 1', is_active: true })
      .select()
      .single()
    if (brErr1) throw new Error(`Failed to create Branch 1: ${brErr1.message}`)
    console.log(`  - Branch 1 created: ${br1.name}`)

    console.log('- Creating second branch for Tenant A...')
    const { data: br2, error: brErr2 } = await clientA
      .from('branches')
      .insert({ tenant_id: tenantA.id, name: 'Branch 2', is_active: true })
      .select()
      .single()
    if (brErr2) throw new Error(`Failed to create Branch 2: ${brErr2.message}`)
    console.log(`  - Branch 2 created: ${br2.name}`)

    console.log('- Attempting to create third branch (should violate limit since default plan is Basic)...')
    const { data: br3, error: brErr3 } = await clientA
      .from('branches')
      .insert({ tenant_id: tenantA.id, name: 'Branch 3', is_active: true })
      .select()
    
    if (brErr3) {
      console.log(`  - SUCCESS: Blocked as expected. Error message: "${brErr3.message}"`)
    } else {
      throw new Error(`RLS/Trigger Failure: Branch 3 was created successfully (ID: ${br3?.[0]?.id}) when it should have been blocked!`)
    }

    console.log('\n=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===')

  } catch (err: any) {
    console.error('\n=== TEST RUN FAILED ===')
    console.error(err.message || err)
  } finally {
    // ------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------
    console.log('\nCleaning up test resources...')
    
    if (userA) {
      await serviceClient.auth.admin.deleteUser(userA.id)
      console.log('- Cleaned up Auth User A')
    }
    if (userB) {
      await serviceClient.auth.admin.deleteUser(userB.id)
      console.log('- Cleaned up Auth User B')
    }
    if (tenantA) {
      await serviceClient.from('tenants').delete().eq('id', tenantA.id)
      console.log('- Cleaned up Tenant A')
    }
    if (tenantB) {
      await serviceClient.from('tenants').delete().eq('id', tenantB.id)
      console.log('- Cleaned up Tenant B')
    }
    
    console.log('\n=== Cleanup complete. ===')
  }
}

runTests()
