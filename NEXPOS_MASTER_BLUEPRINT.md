# NEXPOS — Master Migration Blueprint
### Project Handoff Document · Claude Design → Antigravity
---

## SECTION 1 — PROJECT OVERVIEW

### What NEXPOS Is

NEXPOS is a premium, multi-tenant B2B SaaS Point of Sale and retail business management platform. It is the commercial retail operating system under the Nextec ecosystem, designed initially for the Tanzanian and Zanzibar retail market with a phased expansion into Kenya, Uganda, Rwanda, and the broader East African region.

NEXPOS is not a generic global POS product. It is built specifically for:
- African retail workflows and operational realities
- SMB retail businesses: footwear, clothing, accessories, general merchandise
- High-transaction-volume cashier environments
- Touchscreen-heavy cashier terminals and tablets
- Mobile-first business owners who monitor their business from their phones
- Unstable or limited internet connectivity (offline-first considerations)
- Multilingual operational simplicity (Swahili + English)

### The Problem NEXPOS Solves

Most POS systems available in East Africa fall into two categories: (1) expensive, complex enterprise systems designed for Western retail chains, or (2) basic receipt-printing apps with no business intelligence. NEXPOS occupies the space between them — enterprise-grade structure and data intelligence, delivered with the simplicity a Tanzanian shop owner can operate without training.

The starting point, NEXPOS, was a functional MVP built in Next.js/Supabase with multi-tenant support. It had:
- Warm dark aesthetics (deep brown/charcoal, gold accent #B48E4F)
- Luxury boutique retail branding (Cormorant Garamond serif)
- Basic POS workflow (text search → product → variant → cart)
- 10 navigation modules in a flat sidebar
- Glass-card UI with 0px border radius

NEXPOS proved the concept and data model. NEXPOS is the commercial product built on that foundation.

### Evolution Through This Session

**Iteration 1 (rejected):** Military/cyberpunk aesthetic — deep navy + electric cyan + corner brackets + scan lines + terminal typography. Operationally it felt like a forex trading platform. Wrong emotional register for the target market.

**Iteration 2 (partially accepted):** Clean light-mode SaaS — white cards, light slate background, Plus Jakarta Sans, rounded cards. Structurally correct but aesthetically too "startup-y" for the African enterprise retail market.

**Iteration 3 (current, approved v3):** Dark premium SaaS — `#0B1020` base, `#111827` surface, `#06B6D4` cyan accent, Plus Jakarta Sans + JetBrains Mono, rounded-xl cards without aggressive styling. Feels like Linear meets Stripe meets Shopify Admin. Calm, premium, operationally efficient.

### Tanzania-First Strategy

The Tanzania-first design strategy means:
- Currency: TZS (Tanzanian Shillings), formatted as `TZS X,XXX,XXX`
- Language: English primary, Swahili secondary
- Transaction speed: prioritized above all else — cashiers process 50-200 transactions/day
- Touch interaction: tablet and touchscreen POS is primary deployment
- Low bandwidth: UI must load fast, data tables paginate, real-time features are optional
- Trust signals: premium interface communicates reliability and seriousness to business owners
- Human warmth: friendly language, welcoming transitions, not terse enterprise copy

### UX Philosophy (Core Statement)

> "The business tool a Tanzanian shop owner wishes always existed."

NEXPOS must feel: **fast, trustworthy, calm, modern, premium, and operationally efficient**.

NOT: crypto dashboard, military terminal, cyberpunk admin panel, developer tool.

---

## SECTION 2 — DESIGN LANGUAGE & BRAND SYSTEM

### Final Visual Direction

The approved aesthetic is **dark premium SaaS** — inspired by Linear (UI precision), Stripe Dashboard (data clarity), Shopify Admin (retail usability), and Apple Store POS (simplicity under load).

The visual language is **engineered, not decorative**. Every element earns its place. Restraint is the primary aesthetic tool.

### Typography System

| Role | Font | Size | Weight | Line Height | Notes |
|---|---|---|---|---|---|
| Page heading | Plus Jakarta Sans | 22px | 700 | 1.3 | Greeting strip, modals |
| Section title | Plus Jakarta Sans | 16px | 700 | 1.35 | Page headers |
| Panel title | Plus Jakarta Sans | 14px | 600 | 1.4 | NxCard headers |
| Nav label | Plus Jakarta Sans | 13px | 400/600 | 1.4 | 600 when active |
| Nav group label | Plus Jakarta Sans | 10px | 600 | 1 | Uppercase, tracking 0.08em |
| Body / UI | Plus Jakarta Sans | 13–14px | 400–500 | 1.5 | General UI text |
| Small / muted | Plus Jakarta Sans | 11–12px | 400 | 1.4 | Metadata, captions |
| Prices | JetBrains Mono | 13–22px | 600–700 | 1 | All monetary values |
| Transaction IDs | JetBrains Mono | 12–13px | 400 | 1.4 | Order IDs, SKUs |
| Metrics / KPIs | JetBrains Mono | 22px | 700 | 1 | KPI card values |
| Table data / time | JetBrains Mono | 12px | 400 | 1.4 | Timestamps, quantities |
| Axis labels | JetBrains Mono | 9px | 400 | 1 | Chart axes |

**Rule:** JetBrains Mono is used ONLY for prices, IDs, SKUs, quantities, timestamps, and financial metrics. ALL other text uses Plus Jakarta Sans.

### Color System

```
Background layers (darkest → lightest):
  bg:       #0B1020  — page background, deepest layer
  surface:  #111827  — card/panel background (primary surface)
  elevated: #182235  — hover backgrounds, table header, alt rows
  border:   #243047  — all borders, dividers

Text hierarchy:
  text:     #F1F5F9  — primary text (not pure white — slightly warm)
  textSec:  #94A3B8  — secondary/muted text
  textMuted:#475569  — very muted, non-essential metadata

Accent (tweakable, default cyan):
  cyan:     #06B6D4  — primary interactive, chart, CTAs
  cyanBg:   rgba(6,182,212,0.10)  — accent tint backgrounds

Premium accent (reserved for revenue/gross profit only):
  gold:     #C9A84C  — ONLY on Gross Profit KPI, never for decoration
  goldBg:   rgba(201,168,76,0.10)

Status colors:
  green:    #10B981  — success, in-stock, completed
  greenBg:  rgba(16,185,129,0.10)
  red:      #EF4444  — danger, out-of-stock, refunded
  redBg:    rgba(239,68,68,0.10)
  orange:   #F59E0B  — warning, low-stock
  orangeBg: rgba(245,158,11,0.10)

Shadows (dark mode):
  shadow:   0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.20)
  shadowMd: 0 4px 16px rgba(0,0,0,0.40)
  shadowLg: 0 10px 32px rgba(0,0,0,0.50)
```

### Border Radius Strategy

```
Cards/panels:     border-radius: 12px  (rounded-xl)
Buttons/inputs:   border-radius: 8px   (rounded-lg)
Small elements:   border-radius: 6px   (rounded-md)
Pills/badges:     border-radius: 999px (rounded-full)
```

Never use `border-radius: 0` (too aggressive). Never use `border-radius: 20px+` (too mobile-app).

### Spacing Philosophy

8px base unit. All spacing is a multiple of 4 or 8.

```
4px  — micro (icon-to-text gap, badge padding)
8px  — tight (component internal, stepper gaps)
10px — compact (nav item padding, small gaps)
12px — standard-small (list items, badge rows)
14px — panel grid gap
16px — standard (card padding small, grid gutters)
20px — comfortable (card padding, section internal)
24px — generous (page padding, section spacing)
32px — section break
```

### Motion Philosophy

Animations are **operational, not decorative**. They communicate state changes, not impress.

| Interaction | Duration | Easing | Effect |
|---|---|---|---|
| Page transition | 200ms | ease | opacity + translateY(6px→0) |
| Sidebar expand/collapse | 200ms | ease | width transition |
| Button hover | 150ms | ease | background tint |
| Button press | 80ms in / 150ms out | ease | scale(0.97) |
| Card hover | 150ms | ease | border-color, shadow |
| Cart item enter | 200ms | ease | slideIn from right + opacity |
| Cart item remove | 180ms | ease | opacity out + height collapse |
| Checkout success | 300ms | ease | checkmark scale in |
| Panel slide (variant) | 200ms | ease | width 0→260px |

**Forbidden:** bounce effects, neon glows, glow box-shadows, exaggerated scale, flashy loaders, cyberpunk motion.

### What Was Intentionally Removed

| Element | Why Removed |
|---|---|
| Scan lines overlay | Cyberpunk aesthetic, hurts readability |
| Corner bracket decorators | Military terminal feel |
| Glow effects on hover | Developer tool aesthetic |
| Dot grid background | Too "dashboard template" |
| ALL CAPS navigation labels | Aggressive, hard to read |
| System status indicators | "SYSTEM ONLINE" is irrelevant noise |
| Live clock in header | Military control center feel |
| Monospace for all UI text | Terminal aesthetic |
| Insights panel (dashboard) | Redundant with KPI deltas |
| Notifications panel (dashboard) | Competing panel; move to dedicated page |
| Top Categories row (dashboard) | Too far from analytical context |
| Subtitles on quick action tiles | Visual noise; label is self-explanatory |
| "COMMAND" / "TERMINAL" nav labels | Military wording, wrong for retail |
| 8-column transaction table | Cognitive overload |

### Dashboard Reduction Logic

**"One Job Per Screen" principle:** Every screen must answer a single operational question. The dashboard answers "How is my business performing today?" — nothing more.

Starting: 11 competing panels → Final: 5 clean zones.

Removed from dashboard: Insights (3 bullet points), Notifications panel, Top Categories full-width bar, chart stat callouts (PEAK/NOW/PROJ), Quick Action subtitles, Cashier column from table, 3 extra transaction rows.

---

## SECTION 3 — APPLICATION ARCHITECTURE

### Sidebar Navigation (Final Approved Structure)

```
Logo Zone (56px)
──────────────────
Dashboard

  SELL
  ├── Point of Sale
  ├── Orders
  └── Returns

  MANAGE
  ├── Products
  ├── Inventory
  └── Customers

  ANALYZE
  ├── Sales
  └── Finance

  SYSTEM
  └── Settings

──────────────────
User Profile Zone (56px)
```

**Group label rules:**
- Font: 10px, 600 weight, uppercase, letter-spacing 0.08em
- Color: #475569 (textMuted — very subtle)
- NOT clickable — organizational only
- margin-top: 14px above each group label

**Active item rules:**
- background: rgba(6,182,212,0.10) — accent tint
- border-left: 2px solid accent
- font-weight: 600
- icon color: accent

**Sidebar states:**
- Expanded: 240px, shows icon + label + group labels
- Collapsed: 64px, shows icon only, tooltips on hover
- Tablet: auto-collapsed to 64px
- Mobile: hidden, reveals as full overlay on hamburger tap

### Sales Sub-Pages (Phase 2)

```
Sales
├── Overview    (high-level revenue summary)
├── Trends      (grouped bar chart, period comparison)
├── Item Sales  (KPI strip + chart + product analytics grid)
└── Employee Sales (cashier performance table)
```

### POS Sub-Modes (Future)

```
Point of Sale
├── Shop View   (primary cashier interface — current build)
├── Customer View (customer-facing display mode)
├── Worker View (simplified for junior staff)
└── Leader Board (staff performance gamification)
```

### Order Management Module (Phase 3)

```
Orders
├── All Orders
├── Pending
├── Processing
└── Fulfilled
```

### Full Route Map

```
/app/dashboard
/app/pos
/app/orders
/app/returns
/app/products
/app/inventory
/app/customers
/app/sales
/app/sales/trends
/app/sales/items
/app/sales/employees
/app/finance
/app/settings
```

---

## SECTION 4 — DASHBOARD SYSTEM

### Final Layout (5 Zones)

```
Zone 1 — Greeting Strip         [24px padding top]
  Left:  "Good morning, James."
         Date (weekday, month day)
  Right: [New Sale] primary CTA button

Zone 2 — KPI Grid               [gap: 14px]
  4 cards in equal columns: Revenue | Orders | Avg Order | Gross Profit

Zone 3 — Analytics Row          [gap: 14px, align: start]
  Left (1fr):    Sales Overview chart + period tabs (Today/Week/Month)
  Right (280px): Top Products ranked list (4 items max)

Zone 4 — Recent Transactions    [full width]
  5 columns: Order ID · Customer · Time · Amount · Status
  5 rows max; "View all" link

Zone 5 — Quick Actions          [gap: 14px]
  4 tiles: New Sale · Add Product · Add Customer · Stock Check
  No subtitles. Icon (44px circle) + label only.
```

### KPI Card Structure

Each card contains:
- Icon in tinted circle (38×38px, radius 8px)
  - Revenue, Orders, Avg Order: accent-tinted circle
  - Gross Profit: gold-tinted circle (ONLY use of gold)
- KPI value: 22px JetBrains Mono 700, primary text color
- KPI unit: 11px muted (e.g., "TZS")
- KPI label: 12px secondary
- Delta: 12px, colored arrow + % (↑ green, ↓ red), no "vs yesterday" text

### Chart Specification

- Type: smooth SVG area chart (cubic bezier interpolation)
- Fill: gradient from accent/20% → transparent
- Line: 2px solid accent, rounded linecap
- Data points: 3px radius circles, accent fill, white 2px stroke
- Grid lines: 0.5px dashed, border color, 4 horizontal
- Y-axis labels: 9px JetBrains Mono, textMuted
- X-axis labels: time labels (00:00–24:00), 9px JetBrains Mono
- Period selector: 3 tabs (Today/Week/Month), active = accent bg + white text

### Layout Ratios

- Dashboard max-width: 1400px, auto horizontal margins
- Page padding: 24px
- Zone spacing (gap): 20px between zones
- KPI grid: `repeat(4, 1fr)`, gap 14px
- Analytics row: `1fr 280px`, gap 14px
- Quick actions: `repeat(4, 1fr)`, gap 14px

### Dashboard Responsive Behavior

| Breakpoint | KPI Grid | Analytics | Quick Actions |
|---|---|---|---|
| > 1024px | 4-column | 2-column (1fr + 280px) | 4-column |
| 768–1024px | 2×2 grid | Chart full-width, products below | 4-column |
| < 768px | 2×2 grid | Stacked, chart 180px height | 2×2 grid |

---

## SECTION 5 — POS SYSTEM ARCHITECTURE

### Why POS Is the Most Critical Screen

For a cashier processing 50–200 transactions per day in an African retail environment, the POS is not a "nice to look at" screen — it is an operational tool that must eliminate friction. A 5-second reduction per transaction = 4–17 minutes saved per day per cashier.

Every design decision in the POS is evaluated against: *does this reduce the time from "customer decides to buy" to "transaction complete"?*

### Layout Structure

```
[Session Bar: 48px — "Point of Sale · Till 01 · James Kimani"]

[Category Bar: ~92px — horizontal scroll of visual category tiles]

[Three-Panel Grid: flex-1]
  [Product Browser: 1fr]  [Variant Panel: 0/260px]  [Current Order: 320px]
```

### Category Bar

**Why image-first matters for African retail:**
Cashiers in Tanzanian retail environments often have limited time for reading — especially during peak hours. Visual recognition (color + icon per category) is 40-60% faster than reading text labels. The category bar is the navigation layer cashiers use most.

**Specification:**
- Height: ~92px total (padding + tile)
- Tile: 72px wide minimum, 80px tall, flex column
- Tile anatomy: 44×44px icon container (colored bg) + 11px label + 9px count
- Each category has a unique background tint + SVG icon color:
  - All: slate, #182235 bg
  - Running: blue #3B82F6, #0D1F3C bg
  - Casual: violet #A78BFA, #1A1535 bg
  - Formal: emerald #34D399, #0D2218 bg
  - Sport: amber #F59E0B, #2A1A0A bg
  - Boots: gold #C9A84C, #201810 bg
- Active state: accent border 1.5px + accent tint bg + transform: translateY(-1px) + shadow
- Horizontal scroll, no scrollbar visible

### Product Grid

- Columns: 3 (desktop), 2 (tablet), 2 (mobile)
- Card anatomy:
  - Image zone: 110px tall, category-tinted bg, SVG icon centered
  - "Selected" badge: positioned top-right on active card
  - Brand: 11px muted label above name
  - Product name: 13px 600 weight, 2-line max
  - Price: 13px JetBrains Mono 700, accent when selected
  - Availability pill: "X/Y sizes" in green/red rounded-full badge
- Selection state: accent border 1.5px + `${accent}12` bg + shadow + translateY(-2px) + "Selected" badge
- Press feedback: scale(0.97) on mousedown/touchstart

### Variant Size Panel

- Slides in as middle column (0px → 260px, 200ms transition)
- Size buttons: 52×52px minimum (touch-optimized)
- States:
  - Available: normal bg, standard border, hover → accent border
  - Low stock (≤2): amber border + "X left" label in amber
  - Out of stock: 35% opacity, `cursor: not-allowed`, no hover state
- Interaction: tap → addToCart + close panel
- "Selected" checkmark state on recently added size

### Current Order Panel (Renamed from "Cart")

- Width: 320px, fixed right column
- Header: "Current Order" label + item count badge
- Item row:
  - Product name (13px 600) + Size/SKU metadata
  - Remove button (top-right, hover → red)
  - Quantity stepper: 28×28px buttons (min touch: 40px hit area)
  - Line total (right-aligned, JetBrains Mono)
- Totals section: Subtotal + VAT 18% + Total (20px JetBrains Mono 700)
- Charge button: full-width, 13px height, accent bg, shows total inside button
  - e.g., "Charge TZS 189,000"
  - Disabled state: elevated bg, muted text, no shadow

### Checkout Flow (3-Step Inline — No Modals)

The panel transforms through 3 states without opening any dialog:

**Step 0 — Cart:** items list + totals + Charge button

**Step 1 — Payment Method:**
- Back link in header
- Total shown prominently
- 4 method buttons (2×2 grid): Cash · Card · M-Pesa · Credit
  - Active method: accent border + accent tint bg
- Cash tendered input field (JetBrains Mono 18px, shows change calculation live)
- Order summary (subtotal + VAT + total)
- "Confirm [Method] Payment" button

**Step 2 — Success:**
- Green checkmark circle scales in
- "Payment received" + amount
- Automatically resets to Step 0 after 2 seconds

**Why inline instead of modal:** Modals add cognitive cost — they break the spatial relationship between the cart and the action. Inline state transformation keeps the cashier anchored to the order context throughout checkout. Faster, less disorienting under pressure.

### Touch Target Rules

| Element | Minimum Size | Notes |
|---|---|---|
| Nav items | 44px height | Current: 34px — needs increase |
| Category tiles | 72×80px | Implemented |
| Size selector buttons | 52×52px | Implemented |
| Quantity steppers | 28×28px visible / 40px hit area | Use padding to expand hit area |
| Charge button | 52px height | Implemented |
| Remove (×) button | 40px hit area | Use invisible padding |
| Product cards | 44px+ tap area | Full card is tappable |

---

## SECTION 6 — RESPONSIVE & DEVICE STRATEGY

### Device Priority Order

1. **Cashier tablet (768–1024px)** — primary POS deployment
2. **Business owner laptop (1280px+)** — dashboard and analytics
3. **Small business laptop (1024–1280px)** — general management
4. **Mobile phone (<480px)** — business owner monitoring only

### Breakpoint Definitions

```
xs: < 480px    (mobile monitoring)
sm: 480–768px  (tablet small)
md: 768–1024px (cashier tablet — PRIMARY)
lg: 1024–1280px (business laptop)
xl: > 1280px   (desktop)
```

### Sidebar Responsive Behavior

| Breakpoint | Default State | Trigger to Expand |
|---|---|---|
| > 1024px | Expanded (240px) | Toggle button |
| 768–1024px | Collapsed (64px) | Tap icon, tap again to collapse |
| < 768px | Hidden | Hamburger → full overlay drawer |

### POS on Tablet (768–1024px)

- Sidebar: auto-collapsed to 64px (icon-only)
- Category bar: same — horizontal scroll works natively on touch
- Product grid: 2 columns instead of 3
- Variant panel: slides in, may overlap product grid on very narrow tablets
- Current Order: remains 300px fixed right (minimum required for cart usability)
- On < 768px: Current Order becomes a bottom sheet (slides up from bottom)

### Dashboard on Tablet

- KPI cards: 2×2 grid instead of 4-column
- Analytics row: chart full-width, Top Products stacks below
- Transaction table: hides "Time" column, keeps ID + Customer + Amount + Status
- Quick Actions: 2×2 grid

### Critical Tablet POS Rules

1. All interactive elements have 44px+ touch targets
2. Horizontal scrolls use momentum scrolling (`-webkit-overflow-scrolling: touch`)
3. No hover-dependent interactions (hover states are supplementary, not required)
4. Variant panel must close when tapping outside it
5. Cart item removal: long-press or swipe gesture on mobile (tap × button on desktop)

---

## SECTION 7 — DESIGN TOKENS & COMPONENT RULES

### Complete Token Set

```javascript
// Colors
bg:         '#0B1020'
surface:    '#111827'
elevated:   '#182235'
border:     '#243047'
text:       '#F1F5F9'
textSec:    '#94A3B8'
textMuted:  '#475569'
cyan:       '#06B6D4'   // default accent (tweakable)
cyanBg:     'rgba(6,182,212,0.10)'
cyanBg5:    'rgba(6,182,212,0.05)'
gold:       '#C9A84C'
goldBg:     'rgba(201,168,76,0.10)'
green:      '#10B981'
greenBg:    'rgba(16,185,129,0.10)'
red:        '#EF4444'
redBg:      'rgba(239,68,68,0.10)'
orange:     '#F59E0B'
orangeBg:   'rgba(245,158,11,0.10)'

// Shadows
shadow:   '0 1px 3px rgba(0,0,0,0.30), 0 1px 2px rgba(0,0,0,0.20)'
shadowMd: '0 4px 16px rgba(0,0,0,0.40)'
shadowLg: '0 10px 32px rgba(0,0,0,0.50)'

// Radii
radius:     '12px'  // cards
radiusSm:   '8px'   // buttons, inputs
radiusXs:   '6px'   // small elements
radiusFull: '999px' // badges, pills

// Fonts
fontUI:   "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
fontData: "'JetBrains Mono', 'Courier New', monospace"
```

### Component Interaction States

**Buttons (primary/accent):**
- Default: accent bg + white text + accent shadow
- Hover: opacity 0.88
- Active: scale(0.97)
- Disabled: elevated bg + muted text + no shadow + cursor:not-allowed

**Buttons (secondary):**
- Default: elevated bg + border + secondary text
- Hover: border-color → accent + accent tint bg
- Active: scale(0.97)

**Cards/Panels:**
- Default: surface bg + border + shadow
- Hover (interactive cards): border-color → slightly lighter + shadowMd

**Nav Items:**
- Inactive hover: background → elevated (rgba(255,255,255,0.04) equivalent)
- Active: cyanBg + left accent border + stronger text weight

**Table Rows:**
- Hover: background → elevated (transition 120ms)

**Inputs:**
- Default: elevated bg + border
- Focus: border → accent + box-shadow 0 0 0 3px accent/22%
- Use onFocus/onBlur JS handlers (no :focus CSS — more reliable in inline-style builds)

**Badges/Pills:**
- Green: greenBg + green text
- Red: redBg + red text
- Orange: orangeBg + orange text
- Cyan: cyanBg + cyan text
- Default: elevated + secondary text

### Container & Grid Rules

```
Page container max-width: 1400px
Page padding: 24px
Standard grid gap: 14–16px
Section gap (between zones): 20px
Card internal padding: 16–20px
Table cell padding: 12px vertical, 20px horizontal
```

---

## SECTION 8 — IMPLEMENTATION ROADMAP

### Phase 1 — Core Structural Refactor

**Objective:** Replace the existing NEXPOS visual shell with the NEXPOS design system while preserving all data/logic.

**Priority order:**
1. Update `globals.css` — new CSS custom properties, fonts, scrollbar styles
2. Replace `workspace-nav.tsx` — implement grouped sidebar with SELL/MANAGE/ANALYZE/SYSTEM structure
3. Update `app/(workspace)/app/layout.tsx` — add AppHeader component, adjust main margin
4. Update `app/(workspace)/app/dashboard/page.tsx` — 5-zone simplified layout
5. Update `app/(workspace)/app/pos/page.tsx` — visual category bar, product cards, Current Order panel

**Files affected:**
- `app/globals.css`
- `components/workspace/workspace-nav.tsx`
- `app/(workspace)/app/layout.tsx`
- `app/(workspace)/app/dashboard/page.tsx`
- `app/(workspace)/app/pos/page.tsx`
- New: `components/workspace/app-header.tsx`
- New: `components/workspace/pos/category-bar.tsx`
- New: `components/workspace/pos/product-card.tsx`
- New: `components/workspace/pos/order-panel.tsx`

**Risk areas:**
- Sidebar role filtering (owner/manager/cashier) — must be preserved exactly
- POS cart state — preserve `useState` cart logic, only restyle the render layer
- Dashboard data fetching — server component pattern must be maintained

**Dependencies:** CSS/font update before component work. Sidebar before layout. Layout before page content.

---

### Phase 2 — UX & Interaction Polish

**Objective:** Elevate touch quality, transition smoothness, and cashier workflow efficiency.

**Priority order:**
1. Touch target audit — increase all interactive elements to 44px+
2. Size selector buttons — 52×52px on POS variant panel
3. Quantity steppers — 28px visible, 40px hit area via padding
4. Checkout inline states — implement 3-step panel transformation (no modal)
5. Hover/press animations — 150ms ease on all interactive elements
6. Cart item enter/exit transitions — CSS transitions on cart item add/remove
7. Success state — checkmark animation on payment confirmation
8. Tablet responsive breakpoints — POS 2-column, sidebar auto-collapse at 1024px

**Files affected:**
- `app/(workspace)/app/pos/page.tsx` and sub-components
- `app/globals.css` (transition utilities)
- `components/workspace/workspace-nav.tsx` (responsive collapse)

**Risk areas:**
- CSS transitions on dynamically added/removed cart items (use height + opacity animation)
- Tablet breakpoints may conflict with existing Tailwind responsive classes

---

### Phase 3 — Feature Expansion

**Objective:** Build the modules that complete NEXPOS as a retail operating system.

**Priority order:**
1. **Sales sub-pages** (`/app/sales/`) — Overview, Trends, Item Sales, Employee Sales
   - Item Sales requires a product analytics grid with search/filter
   - Trends requires a grouped bar chart (multi-series, period comparison)
2. **Order management** (`/app/orders/`) — Pending/Processing/Fulfilled pipeline
3. **Leaderboard** — inside Team/Personnel module, 3-tab (Customer/Shop/Worker)
4. **POS sub-modes** — Customer display view, Worker simplified view
5. **Notifications page** — consolidate alert types into a dedicated notifications module
6. **Offline capability** — local cart persistence, sync queue for unstable internet

**Files affected (new):**
- `app/(workspace)/app/sales/page.tsx` and sub-routes
- `app/(workspace)/app/orders/page.tsx`
- `components/workspace/charts/bar-chart.tsx` (new grouped bar chart component)
- `components/workspace/leaderboard.tsx`

**Risk areas:**
- Sales sub-pages must maintain Supabase RLS (Row Level Security) per tenant
- Order management requires a new `orders` table or extension of `sales` table
- Offline capability requires careful IndexedDB implementation alongside Supabase

---

## SECTION 9 — ANTIGRAVITY EXECUTION INSTRUCTIONS

### Core Principle: Preserve Logic, Replace Presentation

The NEXPOS codebase has a sound data architecture. Supabase multi-tenancy, RLS, auth, and server-side data fetching work correctly. **Do NOT rewrite these.** Only replace the visual/presentation layer.

### Architecture Preservation Rules

**Supabase queries — DO NOT TOUCH:**
```
supabase.from('sales').select(...)
supabase.from('product_families').select(...)
supabase.from('product_variants').select(...)
supabase.from('customers').select(...)
supabase.from('profiles').select(...)
```
These are correct and multi-tenant safe. Refactor component JSX around them.

**Auth/session — DO NOT TOUCH:**
```
requireRole(['owner', 'manager'])
requireAuth()
```
These enforce role-based access. Never remove these guards. New pages must call the appropriate guard.

**Tenant isolation — CRITICAL:**
All Supabase queries use Row Level Security. Never add `.eq('tenant_id', x)` manually — RLS handles it. Never bypass RLS with `service_role` key on client-side. Never pass tenant IDs as URL params without validation.

**State management — PRESERVE:**
The POS `useState` cart logic is correct. Refactor only the JSX render layer. Keep the `addToCart`, `updateQuantity`, `removeFromCart` function signatures identical if possible.

### Component Migration Strategy

**Approach: Component-by-component, bottom-up.**

1. **Start with leaf components** (buttons, badges, cards) — replace className strings with new design token styles. These have no dependencies.

2. **Then layout components** (workspace-nav, layout.tsx) — sidebar and shell.

3. **Then page components** (dashboard, POS) — highest complexity, do last.

**For each component migration:**
```
Step 1: Read existing component fully
Step 2: Identify data props and state logic (PRESERVE EXACTLY)
Step 3: Identify className/style rendering (REPLACE WITH NEW SYSTEM)
Step 4: Replace visual layer only
Step 5: Verify data flows unchanged
Step 6: Test against existing Supabase data
```

### Tailwind Migration Notes

The existing codebase uses Tailwind CSS. The NEXPOS design system uses inline styles (for the prototype). For the production Tailwind migration:

**Create these Tailwind token extensions in `tailwind.config.js`:**
```javascript
colors: {
  nx: {
    bg: '#0B1020',
    surface: '#111827',
    elevated: '#182235',
    border: '#243047',
    text: '#F1F5F9',
    'text-sec': '#94A3B8',
    'text-muted': '#475569',
    cyan: '#06B6D4',
    gold: '#C9A84C',
    green: '#10B981',
    red: '#EF4444',
    orange: '#F59E0B',
  }
}
borderRadius: {
  'nx-card': '12px',
  'nx-btn':  '8px',
  'nx-xs':   '6px',
}
fontFamily: {
  ui:   ["'Plus Jakarta Sans'", 'Inter', 'sans-serif'],
  data: ["'JetBrains Mono'", 'monospace'],
}
```

**Replace glassmorphism classes:** The existing `glass-card` class (`bg-card/40 backdrop-blur-sm border border-border/50`) should be replaced with `bg-nx-surface border border-nx-border rounded-nx-card shadow`.

**Replace font classes:** `font-display` (Cormorant Garamond) → `font-ui font-bold`. `font-label` (Montserrat) → `font-ui font-medium uppercase tracking-wider`.

**Keep utility classes:** spacing utilities (p-4, m-6, gap-4), flex/grid utilities, overflow utilities — these are fine and don't need changing.

### What NOT to Do in Antigravity

- **Do NOT** rewrite `lib/auth/session.ts` — the role system is correct
- **Do NOT** rewrite `lib/supabase/` clients — they are correct
- **Do NOT** add client-side tenant ID filtering — RLS handles it
- **Do NOT** do massive single-file rewrites — incremental only
- **Do NOT** break the `/app/(workspace)/app/layout.tsx` server component pattern
- **Do NOT** convert server components to client components unless truly needed
- **Do NOT** remove the `requireRole()` guards on management pages

---

## SECTION 10 — FINAL PRODUCT PERSONALITY

### What Users Should Feel

**Business owners opening the dashboard:**
*Calm confidence.* The dashboard answers "how are we doing today?" in one glance — no hunting, no confusion. They should feel informed without feeling overwhelmed. The data is there, clearly organized, and supports a decision within 10 seconds.

**Cashiers using the POS:**
*Effortless speed.* The POS should disappear as a tool — it should feel like an extension of the cashier's hands. Category tiles respond instantly. Products are recognizable before text is read. The "Current Order" panel always tells them exactly where they are in the transaction. Checkout is 4 taps from product selection to payment confirmation.

**New staff learning the system:**
*Immediate orientation.* The grouped sidebar tells a logical story: SELL (what I do with customers), MANAGE (what I do with stock), ANALYZE (what I check at end of day), SYSTEM (what I configure). A new employee can navigate to any module within 30 seconds without training.

**What Makes NEXPOS Different**

Generic POS systems in East Africa either look like accounting software from 2010 or try to copy Silicon Valley apps without understanding local context. NEXPOS is designed for the specific operational reality of running a retail shop in Dar es Salaam or Zanzibar:
- TZS currency formatted correctly for large numbers
- Touchscreen-first because most retail setups use tablets
- Calm aesthetics because busy markets create enough visual stress
- Fast checkout because queues at the counter are real operational pressure
- Swahili-ready architecture because language is part of trust

### The Final NEXPOS Philosophy Statement

> **"Operational clarity for every retail business in Africa."**

Not "the most powerful POS." Not "the most beautiful dashboard." The most *usable* retail operating system for the business owner who has 30 other things to think about — and needs their software to just work, every time, without demanding attention.

### Product Vision

NEXPOS becomes the Shopify of African retail: the platform that makes modern commerce tools accessible to every business, from the boutique shoe store in Kariakoo to the multi-branch clothing chain in Nairobi. It grows with the business — simple when you're small, scalable when you're large.

### UX North Star

**Every screen, every workflow, every interaction must earn its place by reducing the time between "what the business needs to do" and "done."**

If a feature doesn't reduce friction, it adds it. Subtract first. Add only when the absence creates a problem.

---

*Document generated: Claude Design Session — NEXPOS → NEXPOS Transformation*
*Current build: NEXPOS v3 (dark premium SaaS)*
*Prototype file: NEXPOS.html*
*Codebase reference: NEXPOS/ (Next.js 14, Supabase, TypeScript, Tailwind CSS)*
