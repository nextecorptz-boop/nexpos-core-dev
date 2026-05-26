# Database Setup Instructions

## Overview
This guide will help you set up the complete database schema for NEXPOS in Supabase.

## Prerequisites
- Supabase account with project created
- Access to Supabase SQL Editor

## Steps

### 1. Access Supabase SQL Editor

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: **NEXPOS POINT**
3. Click on **SQL Editor** in the left sidebar

### 2. Execute Schema Migration

1. Open the file `/app/lib/db/schema.sql`
2. Copy the entire contents
3. In Supabase SQL Editor, click **New Query**
4. Paste the schema SQL
5. Click **Run** (or press Cmd/Ctrl + Enter)

This will create:
- ✅ 26 core tables
- ✅ Indexes for performance
- ✅ Views for stock tracking
- ✅ Functions for business logic
- ✅ Triggers for automation
- ✅ Seed data (branches, categories, settings)

### 3. Execute RLS Policies

1. Open the file `/app/lib/db/rls-policies.sql`
2. Copy the entire contents
3. In Supabase SQL Editor, click **New Query**
4. Paste the RLS policy SQL
5. Click **Run**

This will:
- ✅ Enable Row Level Security on all tables
- ✅ Create helper functions for role checks
- ✅ Set up policies for owner, manager, and cashier roles
- ✅ Protect sensitive data with branch-scoped access

### 4. Verify Setup

Run this query to verify tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see all 26 tables listed.

### 5. Create First User (Owner Account)

Since we're using Supabase Auth, you need to:

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User**
3. Enter email and password
4. Click **Create User**
5. Note the User ID

Then create the profile:

```sql
-- Replace 'USER_ID_HERE' with the actual user ID from step 5
-- Replace 'owner@nexpos.com' with actual email

INSERT INTO profiles (id, full_name, email, role, branch_id, is_active, created_by)
VALUES (
  'USER_ID_HERE',
  'Owner Name',
  'owner@nexpos.com',
  'owner',
  NULL,
  true,
  'USER_ID_HERE'
);
```

### 6. Optional: Add Sample Products

```sql
-- Get a category ID first
SELECT id, name FROM product_categories;

-- Add a sample product family (replace category_id and created_by)
INSERT INTO product_families (
  category_id,
  name,
  brand,
  gender,
  base_cost,
  base_price,
  currency,
  is_active,
  is_public,
  created_by
) VALUES (
  'CATEGORY_ID_HERE',
  'Classic Leather Shoes',
  'NEXPOS Premium',
  'men',
  45000,
  85000,
  'TZS',
  true,
  true,
  'USER_ID_HERE'
);
```

## Database Architecture

### Core Concepts

#### 1. **Movement-Based Inventory**
- Stock is NOT stored as a simple quantity field
- All stock changes are recorded as movements
- Current stock is calculated from movement history
- Use the `current_stock` view for real-time quantities

#### 2. **Branch-Scoped Data**
- Most operational data is tied to a specific branch
- Owners can access all branches
- Managers and cashiers are limited to their assigned branch
- RLS policies enforce this at the database level

#### 3. **Role Hierarchy**
- **Owner**: Full system access, all branches, user management
- **Manager**: Branch operations, reporting, credit management
- **Cashier**: POS, till operations, customer lookup only

#### 4. **Product Structure**
- **Product Families**: The main "product" (e.g., "Classic Leather Shoes")
- **Product Variants**: Size/color combinations with unique SKU/barcode
- UI shows "Products" but backend uses families + variants

## Troubleshooting

### Issue: RLS policies blocking queries

If you see "permission denied" errors:

1. Check user has a profile: `SELECT * FROM profiles WHERE id = auth.uid();`
2. Verify RLS policies are correct for the table
3. Ensure user is authenticated properly

### Issue: Stock not showing correctly

The `current_stock` view calculates stock from movements:

```sql
SELECT * FROM current_stock 
WHERE variant_id = 'VARIANT_ID_HERE';
```

If stock seems wrong, check movements:

```sql
SELECT * FROM inventory_movements 
WHERE variant_id = 'VARIANT_ID_HERE' 
ORDER BY created_at DESC;
```

### Issue: Foreign key violations

Make sure related records exist:
- Variants need a valid family_id
- Families need a valid category_id
- Branch-scoped records need a valid branch_id

## Next Steps

After database setup:
1. ✅ Start the Next.js app: `yarn dev`
2. ✅ Login with the owner account you created
3. ✅ Set up additional users via `/app/users`
4. ✅ Add products via `/app/products`
5. ✅ Configure system settings via `/app/settings`

## Need Help?

- Check Supabase logs: Dashboard → Logs
- View table structure: Dashboard → Table Editor
- Test RLS policies: Use the Supabase SQL Editor with different user contexts
