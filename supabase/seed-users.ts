/**
 * supabase/seed-users.ts
 *
 * Seeds dev users and their profiles via the Supabase Admin API.
 * This replaces the old direct INSERT into auth.users / auth.identities
 * pattern that caused GoTrue schema drift.
 *
 * Usage:
 *   npx tsx supabase/seed-users.ts
 *
 * Requirements:
 *   - NEXT_PUBLIC_SUPABASE_URL  (or SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * These can be set in .env.local (loaded automatically via dotenv).
 *
 * DO NOT run this in production.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    '❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ─── Dev Users ─────────────────────────────────────────────────────────────
// Password for ALL dev users: "password123"

interface DevUser {
  email: string
  fullName: string
  tenantId: string
  branchId: string | null
  role: 'owner' | 'manager' | 'cashier' | 'viewer'
}

const DEV_USERS: DevUser[] = [
  // Tenant 1 — Kariakoo Footwear Ltd
  {
    email: 'owner@nexpos.dev',
    fullName: 'James Kimani',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: null,
    role: 'owner',
  },
  {
    email: 'manager@nexpos.dev',
    fullName: 'Amina Hassan',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: '01HZDEV00000000000BRANCH01',
    role: 'manager',
  },
  {
    email: 'cashier@nexpos.dev',
    fullName: 'Peter Mwangi',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: '01HZDEV00000000000BRANCH01',
    role: 'cashier',
  },
  {
    email: 'grace@nexpos.dev',
    fullName: 'Grace Odhiambo',
    tenantId: '01HZDEV00000000000TENANT01',
    branchId: '01HZDEV00000000000BRANCH02',
    role: 'cashier',
  },
  // Tenant 2 — Zanzibar Boutique SARL
  {
    email: 'fatima@nexpos.dev',
    fullName: 'Fatima Said',
    tenantId: '01HZDEV00000000000TENANT02',
    branchId: null,
    role: 'owner',
  },
]

async function seedUsers() {
  console.log('🌱 Seeding dev users via Admin API...\n')

  let created = 0
  let skipped = 0
  let failed = 0

  for (const user of DEV_USERS) {
    // Check if user already exists (by email)
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existing = existingUsers?.users?.find((u) => u.email === user.email)

    if (existing) {
      console.log(`  ⏭  ${user.email} — already exists (${existing.id})`)
      skipped++

      // Ensure profile exists even if user was previously created
      await ensureProfile(existing.id, user)
      continue
    }

    // Create auth user via Admin API
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: user.email,
        password: 'password123',
        email_confirm: true,
        user_metadata: { full_name: user.fullName },
        app_metadata: {
          tenant_id: user.tenantId,
          role: user.role,
          branch_id: user.branchId,
        },
      })

    if (authError || !authData.user) {
      console.error(`  ❌ ${user.email} — ${authError?.message ?? 'Unknown error'}`)
      failed++
      continue
    }

    console.log(`  ✅ ${user.email} — created (${authData.user.id})`)

    // Create profile row
    await ensureProfile(authData.user.id, user)
    created++
  }

  console.log(
    `\n🏁 Done: ${created} created, ${skipped} skipped, ${failed} failed`
  )

  if (failed > 0) process.exit(1)
}

async function ensureProfile(userId: string, user: DevUser) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      tenant_id: user.tenantId,
      branch_id: user.branchId,
      full_name: user.fullName,
      role: user.role,
      is_active: true,
    },
    { onConflict: 'id' }
  )

  if (error) {
    console.error(`     ⚠️  Profile upsert failed for ${user.email}: ${error.message}`)
  }
}

seedUsers().catch((err) => {
  console.error('💥 Unhandled error:', err)
  process.exit(1)
})
