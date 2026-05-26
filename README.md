# NEXPOS - Full-Stack POS & Workspace System

A production-grade MVP web application for NEXPOS, a multi-branch shoe business in Tanzania. This system combines a premium public-facing website with a comprehensive internal POS and workspace management system.

---

## 🎯 System Overview

NEXPOS is built as **one unified web application** with two distinct layers:

### 1. **PUBLIC WEBSITE** (`/`, `/catalog`, `/login`)
- Premium dark luxury brand presence
- Product catalog display
- Branch locations and contact information
- Staff login portal access

### 2. **PRIVATE WORKSPACE** (`/app/*`)
- **POS (Point of Sale)**: Fast checkout with barcode support
- **Products**: Full product management with variants
- **Inventory**: Movement-based stock tracking
- **Customers**: Customer registry and history
- **Credit Management**: Credit accounts, follow-ups, repayments
- **Purchases**: Supplier management and stock receiving
- **Expenses**: Business expense tracking
- **Reports**: Sales and business analytics
- **Till**: Cash session management
- **Returns**: Product return processing
- **Settings**: System configuration
- **Users**: Staff management with role-based access

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14+ (App Router) with TypeScript |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth with Row Level Security (RLS) |
| **Storage** | Supabase Storage (for product images) |
| **Styling** | Tailwind CSS with custom design system |
| **UI Components** | shadcn/ui + Radix UI primitives |
| **Icons** | Lucide React |
| **Fonts** | Cormorant Garamond, Inter, Montserrat |

---

## 🎨 Design System

### Typography
- **Display/Headers**: Cormorant Garamond (serif, elegant)
- **Body Text**: Inter (sans-serif, readable)
- **Labels/Buttons**: Montserrat (sans-serif, structural)

### Color Palette
- **Background**: `#0E0D0B` (warm near-black)
- **Foreground**: `#FAF6EE` (warm cream)
- **Muted**: `#A19B94` (soft gray)
- **Accent**: `#B48E4F` (restrained gold)
- **Card**: `#141210` (dark surface)
- **Border**: `#292521` / `#41362D` (subtle borders)

### Visual Direction
- Dark luxury editorial aesthetic
- Sharp corners (no rounded elements)
- Premium spacing and typography hierarchy
- Glass card effects with subtle borders
- Controlled, elegant animations

---

## 📁 Project Structure

```
/app
├── app/
│   ├── (public)/           # Public routes
│   │   ├── page.tsx        # Landing page
│   │   ├── catalog/        # Product catalog
│   │   └── login/          # Staff login
│   │
│   ├── (workspace)/        # Protected routes
│   │   └── app/
│   │       ├── layout.tsx  # Workspace shell
│   │       ├── dashboard/  # Dashboard
│   │       ├── pos/        # Point of Sale
│   │       ├── products/   # Product management
│   │       ├── inventory/  # Stock tracking
│   │       ├── customers/  # Customer database
│   │       ├── credit/     # Credit management
│   │       ├── purchases/  # Supplier purchases
│   │       ├── expenses/   # Expense tracking
│   │       ├── reports/    # Analytics
│   │       ├── till/       # Cash sessions
│   │       ├── returns/    # Return processing
│   │       ├── settings/   # System settings
│   │       └── users/      # User management
│   │
│   ├── globals.css         # Global styles
│   └── layout.tsx          # Root layout
│
├── components/
│   └── workspace/
│       └── workspace-nav.tsx  # Sidebar navigation
│
├── lib/
│   ├── supabase/
│   │   ├── server.ts       # Server-side Supabase client
│   │   └── client.ts       # Client-side Supabase client
│   │
│   ├── auth/
│   │   └── session.ts      # Auth helpers
│   │
│   ├── types/
│   │   └── database.types.ts  # TypeScript database types
│   │
│   └── db/
│       ├── schema.sql      # Database schema
│       └── rls-policies.sql   # Security policies
│
├── middleware.ts           # Route protection
├── .env.local              # Environment variables (active)
├── .env.local.example      # Environment template
├── DATABASE_SETUP.md       # Database setup guide
└── README.md               # This file
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- Supabase account with project created
- Database schema executed (see below)

### 1. Clone & Install

```bash
cd /app
yarn install
```

### 2. Environment Setup

Create a `.env.local` file in the project root with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
```

> ⚠️ Get these values from your [Supabase Dashboard](https://app.supabase.com) → Project Settings → API.

### 3. Database Setup

**⚠️ IMPORTANT**: You must execute the SQL migrations in Supabase before the app will work.

1. Go to [Supabase Dashboard](https://app.supabase.com) → Your Project → SQL Editor

2. Execute the schema:
   - Copy contents of `/app/lib/db/schema.sql`
   - Paste into SQL Editor
   - Click "Run"

3. Execute RLS policies:
   - Copy contents of `/app/lib/db/rls-policies.sql`
   - Paste into SQL Editor
   - Click "Run"

4. Create your owner account:
   - Dashboard → Authentication → Users → Add User
   - Copy the generated User ID
   - Run this SQL (replace placeholders):
   ```sql
   INSERT INTO profiles (id, full_name, email, role, branch_id, is_active, created_by)
   VALUES (
     'YOUR_USER_ID',
     'Your Name',
     'your@email.com',
     'owner',
     NULL,
     true,
     'YOUR_USER_ID'
   );
   ```

📖 **Detailed instructions**: See `/app/DATABASE_SETUP.md`

### 4. Start Development Server

```bash
yarn dev
```

Visit:
- **Public site**: http://localhost:3000
- **Login**: http://localhost:3000/login
- **Workspace**: http://localhost:3000/app/dashboard

---

## 👥 User Roles & Access

### 🔑 Owner
- **Access**: All features, all branches
- **Routes**: Full system access
- **Special**: Can create users, modify settings

### 👔 Manager
- **Access**: Branch-scoped operations
- **Routes**: Dashboard, Products, Inventory, Purchases, Customers, Credit, Expenses, Reports, Till, Returns, POS
- **Limitations**: Cannot manage users or global settings

### 💰 Cashier
- **Access**: POS and customer operations only
- **Routes**: POS, Till, Returns, Customers (limited)
- **Limitations**: Cannot access admin features, reports, or management functions

**Note**: Role-based access is enforced at both the application level (middleware) and database level (RLS policies).

---

## 🗄️ Database Architecture

### Core Concepts

#### 1. **Movement-Based Inventory**
Stock is **NOT** stored as a simple quantity field. All stock changes are recorded as movements, and current stock is calculated from movement history.

**Movement Types:**
- `opening_stock` - Initial stock entry
- `purchase_in` - Stock from supplier
- `sale_out` - Stock sold
- `return_in` - Customer return
- `adjustment_in` / `adjustment_out` - Manual corrections
- `damaged_out` - Damaged/unsellable stock
- `transfer_in` / `transfer_out` - Inter-branch transfers

**Get Current Stock:**
```sql
SELECT * FROM current_stock WHERE variant_id = 'xxx';
```

#### 2. **Product Structure**
- **Product Families** → UI shows as "Products" (e.g., "Classic Leather Shoes")
- **Product Variants** → Size/color combinations with unique SKU/barcode

Users see "Products" but the backend manages families + variants for flexibility.

#### 3. **Branch-Scoped Data**
Most operational data is tied to a specific branch. Owners can access all branches, while managers and cashiers are limited to their assigned branch via RLS policies.

### Key Tables (26 total)

| Table | Purpose |
|-------|---------|
| `profiles` | User accounts linked to auth.users |
| `branches` | Business locations |
| `product_categories` | Product categories (Men's, Women's, Kids) |
| `product_families` | Main products (name, brand, gender, pricing) |
| `product_variants` | Size/color variants with SKU/barcode |
| `inventory_movements` | All stock changes (movement-based) |
| `suppliers` | Supplier directory |
| `purchases` | Purchase orders from suppliers |
| `purchase_items` | Items in each purchase |
| `customers` | Customer registry |
| `cash_sessions` | Till open/close tracking |
| `sales` | Sale transactions |
| `sale_items` | Items in each sale |
| `payments` | Payment records |
| `credit_accounts` | Customer credit tracking |
| `credit_repayments` | Credit payments |
| `credit_followups` | Follow-up logs |
| `expense_categories` | Expense types |
| `expenses` | Business expenses |
| `returns` | Product returns |
| `return_items` | Items in each return |
| `system_settings` | App configuration (JSONB) |
| `import_batches` | Bulk import tracking |
| `audit_logs` | System activity audit trail |

### Security: Row Level Security (RLS)

All tables are protected with RLS policies that enforce:
- Owners can access all data across all branches
- Managers can access only their assigned branch data
- Cashiers can access only POS and limited customer data
- Public catalog data is read-only for unauthenticated users

**Helper Functions:**
- `get_user_role()` - Returns current user's role
- `get_user_branch()` - Returns current user's branch
- `is_owner()` - Check if user is owner
- `is_manager_or_owner()` - Check if user has manager+ access

---

## 🛠️ Key Features

### ✅ Implemented (MVP Phase 1)

#### Public Website
- [x] Premium landing page with dark luxury design
- [x] Product catalog page (public products only)
- [x] Staff login with role-aware redirect
- [x] Responsive mobile/tablet design
- [x] Premium typography and spacing

#### Authentication & Security
- [x] Supabase Auth integration
- [x] Role-based access control (Owner, Manager, Cashier)
- [x] Row Level Security policies
- [x] Protected routes with middleware
- [x] Session management

#### Dashboard
- [x] Today's sales summary
- [x] Product count
- [x] Customer count
- [x] Recent sales table

#### Products
- [x] Product listing with categories
- [x] Quick Add product workflow
- [x] Size/color variant support
- [x] Opening stock entry
- [x] Public visibility toggle
- [x] Import placeholder page

#### POS (Point of Sale)
- [x] Product search
- [x] Barcode entry field (ready for scanner)
- [x] Size/color selection
- [x] Shopping cart
- [x] Quantity adjustment
- [x] Price calculation
- [x] Checkout placeholder (needs cash session integration)

#### Customers
- [x] Customer registry
- [x] Add new customers
- [x] Search by name/phone
- [x] Customer type (cash, credit, wholesale)
- [x] Credit limit tracking

#### Credit Management
- [x] Credit account listing
- [x] Outstanding balance tracking
- [x] Overdue highlighting
- [x] Due today/soon segmentation
- [x] KPI dashboard (total outstanding, overdue count, etc.)

#### Inventory
- [x] Current stock view (from movement-based system)
- [x] Low stock highlighting
- [x] Branch-specific stock levels

#### User Management
- [x] User listing with roles
- [x] Branch assignments
- [x] Active/inactive status
- [x] Instructions for adding new users

### 🚧 Placeholder Pages (Ready for Implementation)

These pages have UI shells but need business logic:
- [ ] Purchases (supplier orders, receiving)
- [ ] Expenses (expense entry, categorization)
- [ ] Reports (sales reports, analytics)
- [ ] Till (cash session open/close)
- [ ] Returns (return processing, refunds)
- [ ] Settings (business config, thresholds)
- [ ] Product Import (CSV bulk import)

### 🔮 Future Enhancements

- [ ] Complete POS checkout with cash session integration
- [ ] Receipt generation (PDF/thermal printer)
- [ ] Barcode scanner integration
- [ ] Till reconciliation with variance tracking
- [ ] Advanced reporting (charts, exports)
- [ ] SMS/WhatsApp integration for credit follow-ups
- [ ] Product image upload
- [ ] Multi-currency support
- [ ] Discount and promotion management
- [ ] Employee commission tracking
- [ ] Customer loyalty program

---

## 🎨 Customization

### Adding a New Feature Page

1. **Create the page:**
```tsx
// /app/app/(workspace)/app/your-feature/page.tsx
import { requireRole } from '@/lib/auth/session'

export default async function YourFeaturePage() {
  await requireRole(['owner', 'manager']) // Set allowed roles
  
  return (
    <div>
      <h1 className="font-display text-5xl font-bold text-[#FAF6EE]">
        Your Feature
      </h1>
      {/* Your content */}
    </div>
  )
}
```

2. **Add to navigation:**
Edit `/app/components/workspace/workspace-nav.tsx`:
```tsx
const navItems: NavItem[] = [
  // ... existing items
  { 
    name: 'Your Feature', 
    href: '/app/your-feature', 
    icon: YourIcon, 
    roles: ['owner', 'manager'] 
  },
]
```

3. **Create database table if needed:**
Add to `/app/lib/db/schema.sql` and execute in Supabase.

4. **Add RLS policies:**
Add to `/app/lib/db/rls-policies.sql` and execute in Supabase.

### Styling Guidelines

Follow the established design system:
- Use `font-display` for headings (Cormorant Garamond)
- Use `font-body` for content (Inter)
- Use `font-label` for labels/buttons (Montserrat)
- Use `glass-card` class for card containers
- Use `btn-primary` and `btn-secondary` for buttons
- Stick to the color palette (avoid introducing new colors)
- Use sharp corners (no `rounded-` utilities)

---

## 🧪 Testing

### Manual Testing Checklist

**Public Site:**
- [ ] Landing page loads and displays correctly
- [ ] Catalog page shows public products
- [ ] Login redirects to correct page based on role
- [ ] Mobile responsive design works

**Authentication:**
- [ ] Owner can access all pages
- [ ] Manager can access operational pages
- [ ] Cashier can only access POS/Till/Customers
- [ ] Logout works correctly

**Products:**
- [ ] Quick Add creates product with variants
- [ ] Stock movements are created correctly
- [ ] Products appear in listing
- [ ] Product search works in POS

**POS:**
- [ ] Product search returns results
- [ ] Can select size/color variants
- [ ] Cart updates correctly
- [ ] Quantity adjustment works

**Customers:**
- [ ] Can add new customers
- [ ] Search finds customers
- [ ] Customer types save correctly

**Credit:**
- [ ] Credit accounts display
- [ ] Overdue highlighting works
- [ ] KPIs calculate correctly

---

## 🐛 Troubleshooting

### Database Connection Issues

**Problem**: "RLS policy blocks query"
- **Solution**: Check user has a profile: `SELECT * FROM profiles WHERE id = auth.uid();`
- **Solution**: Verify you're logged in as the correct user

**Problem**: "Foreign key violation"
- **Solution**: Ensure related records exist (category before product, branch before stock, etc.)

### Auth Issues

**Problem**: Redirect loop on login
- **Solution**: Check middleware.ts and profile exists for user

**Problem**: "Not authorized" errors
- **Solution**: Verify user role in profiles table matches page requirements

### Stock Not Showing

**Problem**: Inventory shows zero stock
- **Solution**: Check `inventory_movements` table has records
- **Solution**: Use `SELECT * FROM current_stock;` to see calculated stock

### Build Errors

**Problem**: TypeScript errors
- **Solution**: Run `yarn add --dev typescript @types/react @types/node`

**Problem**: Module not found
- **Solution**: Run `yarn install` to ensure all dependencies are installed

---

## 📊 Performance Considerations

### Database Optimization
- Indexes are created on frequently queried columns
- Use `selectinload` or `joinedload` for relationships to avoid N+1 queries
- RLS policies are optimized for branch-scoped queries

### Frontend Optimization
- Server Components used for data fetching
- Client Components only where interactivity needed
- Images should use `next/image` with lazy loading
- Catalog images should be WebP/AVIF format

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Enable Supabase connection pooling
- [ ] Add proper error boundaries
- [ ] Configure CSP headers
- [ ] Set up monitoring (Sentry, LogRocket, etc.)
- [ ] Optimize images and assets
- [ ] Enable Next.js caching strategies

---

## 🔐 Security Best Practices

1. **Never commit secrets** - Use `.env.local` (already in `.gitignore`)
2. **RLS is enabled** on all tables - data is protected at the database level
3. **Middleware protects routes** - but also verify auth in page components
4. **Service role key** is only used in server-side code, never exposed to client
5. **Input validation** - Always validate user input before database operations
6. **SQL injection** - Supabase client uses parameterized queries
7. **XSS protection** - React escapes content by default

---

## 📝 License & Credits

**NEXPOS** - Internal Business System
Built with Next.js, Supabase, and Tailwind CSS

**Fonts:**
- Cormorant Garamond (Google Fonts)
- Inter (Google Fonts)
- Montserrat (Google Fonts)

**Icons:** Lucide React
**UI Components:** shadcn/ui + Radix UI

---

## 🆘 Support

For technical issues:
1. Check this README
2. Review `/app/DATABASE_SETUP.md`
3. Check Supabase Dashboard → Logs for errors
4. Verify RLS policies in Supabase Dashboard → Authentication

For feature requests:
- Document requirements clearly
- Consider impact on existing features
- Plan database changes if needed

---

## 🎯 Next Steps

1. ✅ **Test the application** with sample data
2. ✅ **Add product images** to public catalog
3. ⏳ **Complete POS checkout** with cash session integration
4. ⏳ **Implement Till management** (open/close cash sessions)
5. ⏳ **Build Purchases module** for stock receiving
6. ⏳ **Add reporting features** (sales reports, profit analysis)
7. ⏳ **Implement Returns workflow** with inventory updates
8. ⏳ **Build Expenses tracking** with categorization
9. ⏳ **Create Settings page** for business configuration
10. ⏳ **Add CSV import** for bulk product upload

---

**Last Updated**: June 2025
**Version**: 1.0.0 (MVP)
**Status**: Production-Ready Foundation ✅
