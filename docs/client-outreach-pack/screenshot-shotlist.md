# NEXPOS: Exact Screenshot Shotlist

**Target URL:** `https://nexpos-v1-demo.vercel.app`

### Shot 1: The Secure Login
- **URL:** `/auth/login`
- **Role:** None (logged out state)
- **Action:** Type `manager@nexpos.dev` into the email field to show the active input state.
- **Filename:** `01-login-screen.png`
- **Caption:** "Secure, role-based access control from day one."

### Shot 2: Manager Dashboard
- **URL:** `/app/dashboard`
- **Role:** `manager@nexpos.dev`
- **Action:** Hover over the main sales chart to show a tooltip (if applicable).
- **Filename:** `02-manager-dashboard.png`
- **Caption:** "Real-time sales metrics and stock alerts at a glance."

### Shot 3: Inventory Matrix
- **URL:** `/app/inventory`
- **Role:** `manager@nexpos.dev`
- **Action:** Ensure the list shows a mix of in-stock and low-stock items.
- **Filename:** `03-inventory-matrix.png`
- **Caption:** "The single source of truth for your stock across all branches."

### Shot 4: Fast POS Terminal
- **URL:** `/app/pos`
- **Role:** `cashier@nexpos.dev`
- **Action:** Add "Air Force 1 White" (Size 42) to the cart. Keep the cart pane visible.
- **Filename:** `04-pos-cart.png`
- **Caption:** "A distraction-free POS terminal built specifically for speed."

### Shot 5: Successful Checkout
- **URL:** `/app/pos`
- **Role:** `cashier@nexpos.dev`
- **Action:** Click "Pay", select "Cash", and capture the success modal/receipt view before it closes.
- **Filename:** `05-checkout-success.png`
- **Caption:** "Process cash transactions securely in seconds."

### Shot 6: Owner Reports
- **URL:** `/app/reports`
- **Role:** `owner@nexpos.dev`
- **Action:** Ensure the aggregated sales data is clearly visible.
- **Filename:** `06-owner-reports.png`
- **Caption:** "High-level insights aggregated from every branch you own."

### Shot 7: The Product Catalog
- **URL:** `/app/products`
- **Role:** `manager@nexpos.dev`
- **Action:** Expand a product family to show its variants (sizes/colors).
- **Filename:** `07-product-catalog.png`
- **Caption:** "Organize your catalog effortlessly, supporting complex product variations."

### Shot 8: Upcoming Modules
- **URL:** Any `/app/*` page
- **Role:** `manager@nexpos.dev`
- **Action:** Hover over "Transfers" or "Expenses" on the sidebar to highlight the "Coming Soon" indicator.
- **Filename:** `08-coming-soon-modules.png`
- **Caption:** "A system that grows with you. Advanced modules plug directly into your secure foundation."
