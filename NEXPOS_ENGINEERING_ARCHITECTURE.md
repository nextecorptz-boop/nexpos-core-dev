# NEXPOS ENGINEERING ARCHITECTURE SPECIFICATION
_Version 1.1 - System Expansion & Extensibility Directive_

This document bridges the NEXPOS operational philosophy with a buildable technical architecture. It is the foundational engineering blueprint for designing a category-defining, offline-first, and trust-centric mobile commerce platform. **Version 1.1 incorporates the architectural plans for future system extensibility.**

---

## SECTION 1 — CORE DOMAIN MODEL

This model defines the core entities. The **Inquiry** remains the central aggregate root.

### 1.1. Inquiry Entity
- **Aggregate Root:** `Inquiry`
- **ID:** `inq_[ULID]`
- **Attributes:**
    - `tenant_id`, `customer_id`
    - `status`: [`initiated`, `quoted`, `negotiating`, `confirmed`, `fulfilled`, `stale`, `cancelled`]
    - `line_items`: JSONB array.
    - `client_context`: Device/client info at initiation.
    - **`source` (v1.1):** Text field indicating the origin. e.g., `mobile-app`, `storefront-web`.
    - **`source_metadata` (v1.1):** JSONB for context, e.g., `{ "product_id": "prod_123", "utm_campaign": "festive_sale" }`.
- **Lifecycle:** Unchanged. The Inquiry remains the eternal record of the commercial conversation.

*(Other core entities - Conversation, Order, Customer, etc. - remain unchanged in their fundamental structure.)*

---

## SECTION 2 — EVENT SYSTEM ARCHITECTURE

The event-driven core is maintained and extended.

### 2.1. Canonical Event Structure
Unchanged. The structure is stable.

### 2.2. Event Categories (Expanded)
- `inquiry.*`: Unchanged.
- `conversation.*`: Unchanged.
- `order.*`: Unchanged.
- `payment.*`: `payment.initiated`, `payment.verified`, `payment.failed`, `payment.refund_requested`, `payment.refunded`.
- **`fulfillment.*` (Expanded):** `fulfillment.method_selected`, `fulfillment.schedule_requested`, `fulfillment.handler_assigned`, `fulfillment.in_transit`, `fulfillment.delivered`, `fulfillment.failed`.
- `inventory.*`: Unchanged.
- `trust.*`: Unchanged.
- **`notification.*` (New):** `notification.send_requested`, `notification.sent`, `notification.delivered`, `notification.failed`.

*(Event Storage, Idempotency, Replay, and Data Authority models remain unchanged.)*

---

## SECTION 3 — OFFLINE-FIRST SYNCHRONIZATION

The core sync protocol remains robust for the mobile app.

### 3.1. Sync Impact Analysis (v1.1)
- **Storefront:** The public storefront is a web-based, read-only projection of server data. It does **not** participate in the offline-first sync protocol. Its state is managed by standard web caching (HTTP headers, Vercel/Cloudflare edge caching).
- **Inquiry Initiation:** When an inquiry is initiated from the storefront, it creates an `inquiry.initiated` event directly on the server. This event will then be delivered to the vendor's mobile app(s) during their next regular sync cycle, appearing as a new conversation in their inbox.

---

## SECTION 4 — PROJECTION ARCHITECTURE

Projections are extended to support the public storefront.

### 4.1. Projection Mechanism
Unchanged. Serverless workers continue to build materialized views from the event stream.

### 4.2. Read Models (Expanded)
- **Existing Models:** `inbox_view`, `orders_view`, `inventory_levels`, `customer_summary` remain.
- **`projections.public_vendor_profile` (New):**
    - Consumes: `vendor.profile_updated`, `trust.score_updated`.
    - Holds: Shop name, branding, contact info, public trust indicators.
- **`projections.public_catalog` (New):**
    - Consumes: `product.created`, `product.updated`, `product.visibility_changed`.
    - Holds: A list of all products a vendor has marked as publicly visible.
- **`projections.storefront_inventory_state` (New):**
    - Consumes: `inventory.stock_added`, `fulfillment.item_shipped`.
    - A simplified, potentially slightly delayed inventory view (e.g., `in_stock`, `low_stock`, `out_of_stock`) safe for public display. Avoids exposing exact numbers.

---

## SECTION 5 — TRUST INFRASTRUCTURE ENGINEERING

The trust score becomes a public-facing asset.

### 5.1. Public Trust Indicators
The `Reliability Scoring Engine`'s output (`platform_trust_score`) will be consumed by the `public_vendor_profile` projection worker. This allows trust scores or badges to be displayed on storefronts, converting internal reliability metrics into external customer confidence.

---

## SECTION 6 — SUPABASE + POSTGRES ARCHITECTURE

The architecture must handle increased read-load and more function invocations.

### 6.1. Supabase Impact Analysis (v1.1)
- **Read Traffic:** The public storefront will significantly increase read operations on `projections` tables. This reinforces the need for aggressive edge caching (e.g., Vercel Data Cache, Cloudflare) fronting the public projection data.
- **Edge Functions:** The adapter-based architecture for payments, fulfillment, and messaging will increase the number and diversity of edge functions. This requires disciplined monitoring of function execution times and costs.
- **Database:** The primary `events` table write-load is unaffected by storefront reads. Read-replicas for the `projections` schema may become necessary to isolate analytics and storefront traffic from the core operational app's read traffic.
- **Realtime:** Impact is minimal. Realtime is used for the authenticated mobile app experience, not the public web storefront.

---

## SECTION 7 — MOBILE SYSTEM CONSTRAINTS

The mobile app must interoperate with the web-based storefront.

### 7.1. Mobile App Implications (v1.1)
- **Deep Linking:** The mobile app must handle deep links from the web storefront (e.g., a link to `nexpos://inquiry/inq_123`). This allows a user browsing the web to seamlessly transition into the native app conversation.
- **Web Views:** For non-critical content (e.g., a vendor's "About Us" page), the app may use in-app web views to render pages from the public storefront, reducing the need to build and maintain duplicate native UI.

---

## SECTION 8 — MODULAR SERVICE BOUNDARIES

Adapter patterns are introduced to isolate third-party dependencies.

| Service | Owns (Publishes) | Consumes (Subscribes to) | Responsibility |
|---|---|---|---|
| **Inquiry/Order/Conversation Engines** | `inquiry.*`, etc. | Core events | Unchanged core business logic. |
| **Payment Engine** | `payment.*` | `order.confirmed` | Orchestrates payment flow, calls appropriate adapter. |
| **`-> PayPal Adapter`** | - | `payment.initiated` with `provider: 'paypal'` | Translates and executes PayPal API calls. Emits `payment.verified/failed`. |
| **`-> Pesapal Adapter`**| - | `payment.initiated` with `provider: 'pesapal'` | Translates and executes Pesapal API calls. Emits `payment.verified/failed`. |
| **Fulfillment Engine**| `fulfillment.*` | `payment.verified` | Orchestrates delivery, calls appropriate adapter. |
| **`-> Bolt Adapter`** | - | `fulfillment.schedule_requested` | Translates and executes Bolt API calls and webhooks. |
| **Notification Engine**| `notification.*` | `conversation.message_sent`, etc. | Orchestrates notifications, calls appropriate adapter. |
| **`-> Beem Adapter`** | - | `notification.send_requested` | Translates and executes Beem SMS/WhatsApp API calls. |

---

## SECTION 9 — MVP PRIORITIZATION & ENGINEERING DISCIPLINE

This section is updated to reflect the new strategic roadmap.

### 9.1. Product Strategy Positioning
- **NEXPOS IS:** A conversational commerce OS, an inquiry-centric engine, offline-first infrastructure, a trust layer, and a business memory graph.
- **NEXPOS IS NOT:** A Shopify clone, a POS clone, or just an inventory/delivery app.

### 9.2. Updated MVP Roadmap
- **MUST BUILD NOW:**
    - Inquiry & Conversation engines, Event Store, Offline Sync with Local DB.
    - Inbox projection, basic product management.
    - **Simple schema foundations for future storefront projections.**
    - **Basic PayPal integration** (hardcoded, no complex abstraction).
    - **Manual/Private Pickup** fulfillment option (no 3rd party integration).
- **BUILD LATER:**
    - Full public-facing Storefront UI.
    - **Bolt package integration** (build the adapter).
    - **Multi-provider payment orchestration** (build the engine and more adapters).
    - Beem messaging automation.
    - Trust scoring engine & Advanced Analytics.

### 9.3. Engineering Discipline & Traps to Avoid
- **Prioritize:** Reliability, sync resilience, mobile performance, offline function, event integrity, and shipping fast.
- **Avoid:**
    - **Premature Microservices:** The modular monolith on Supabase is sufficient.
    - **Overbuilt Abstractions:** A simple, hardcoded PayPal flow is better for V1 than a perfect but unused multi-provider payment engine.
    - **Enterprise Ceremony / Unnecessary CQRS:** The event-sourcing + projections model is already a lightweight form of CQRS. No need for more complexity.
    - **Premature AI Layers:** Focus on the core deterministic system first.

---

## SECTION 10 — ENGINEERING RISKS (EXPANDED)

### 10.1. Technical Debt Warnings (New)
- **Hardcoded V1 Integrations:** The MVP's PayPal and manual fulfillment logic will be hardcoded. This is acceptable technical debt, but it **must** be scheduled for refactoring into the proper adapter pattern before a second provider is added for either service. Failure to do so will lead to a brittle, unmaintainable codebase.
- **Projection Debt:** As new features are added, there is a temptation to add new columns to existing projections. This leads to bloated, slow read models. Instead, favor creating new, small, purpose-built projections for specific UI components.

### 10.2. Scalability Considerations (New)
- **Projection Workers:** The number of events will grow linearly, but the work of projections can grow factorially if not managed. Projection workers must be idempotent and designed to be parallelizable.
- **Storefront Caching:** Uncached storefronts will create a massive read load on the database. A multi-layer caching strategy (CDN, edge cache, in-memory cache for hot profiles) is not optional; it is a core requirement for the storefront architecture.

---

## SECTION 11 — FUTURE PLATFORM EXTENSIBILITY (REFINED)

This section details the architecture for future expansion layers, applying the adapter pattern consistently.

### 11.1. Storefront System Architecture
The storefront is a **discovery and acquisition channel**, not a separate business line.
- **Architecture:** A static site generator (e.g., Next.js) renders pages by fetching data from a set of **public, read-only API endpoints** that expose the storefront projections (`public_vendor_profile`, `public_catalog`). These endpoints must be heavily cached.
- **Interaction Flow:**
    1. Customer clicks "Inquire" on a storefront product page.
    2. The frontend makes a POST request to a dedicated `inquiry-initiator` edge function, passing product and customer contact info.
    3. The function creates a `customer` (if new), then emits an `inquiry.initiated` event with `source: 'storefront'` and `source_metadata: { product_id: ... }`.
    4. The vendor receives the new inquiry in their mobile app inbox. The conversation proceeds as normal.
- **Principle:** The storefront funnels all intent into the single, canonical conversational engine.

### 11.2. Fulfillment Integration Architecture (Adapter Pattern)
- **Core Logic:** The `Fulfillment Engine` is the internal orchestrator. When an `order.confirmed` event is processed, the user's selected fulfillment method determines the next step.
- **Flow (Bolt Example):**
    1. User selects "Bolt Delivery". An event `fulfillment.method_selected` with payload `{ provider: 'bolt' }` is saved.
    2. The `Fulfillment Engine` consumes this and emits `fulfillment.schedule_requested`.
    3. The `bolt_adapter` function is subscribed to this event. It transforms the generic internal request into a specific Bolt API call.
    4. The `bolt_adapter` also exposes a webhook endpoint to receive status updates from Bolt (`bolt.com/webhooks/nexpos`).
    5. When Bolt sends an `in_transit` update, the webhook translates it into a canonical `fulfillment.in_transit` event and submits it to the main event log.
- **Principle:** The core system only speaks in terms of `fulfillment.*` events. The `bolt_adapter` is the bilingual translator.

### 11.3. Payment Adapter Architecture
- **Flow (Pesapal Example):**
    1. User selects "Pesapal". The client emits `payment.initiated` with `{ provider: 'pesapal', amount: ... }`.
    2. The `Payment Engine` sees the provider and invokes the `pesapal_adapter`.
    3. The `pesapal_adapter` communicates with Pesapal's API to generate a transaction URL/request.
    4. The adapter's webhook listens for callbacks from Pesapal.
    5. A successful callback causes the adapter to emit the canonical `payment.verified` event.
- **Principle:** The `Order Engine`'s dependency is on the `payment.verified` event, not on Pesapal. This makes providers swappable.

### 11.4. Messaging Adapter Architecture
- **Flow (WhatsApp via Beem Example):**
    1. `conversation.message_sent` event occurs for an offline user who prefers WhatsApp.
    2. The `Notification Engine` consumes this and emits `notification.send_requested` with `{ channel: 'whatsapp', recipient: '...', content: '...' }`.
    3. The `beem_adapter` is subscribed to this event. It calls the Beem API to dispatch the message.
    4. It subscribes to Beem's delivery receipt webhooks, translating them into `notification.delivered` events.
- **Principle:** The canonical conversation lives in the NEXPOS database. External channels are merely presentation layers.

---

## SECTION 12 — RECOMMENDED IMPLEMENTATION SEQUENCE (NEW)

A logical, phased approach to building the MVP.

1.  **Phase 1: The Core Event System**
    - Setup Supabase, define the `events_store.events` table schema.
    - Create the `event-ingestor` edge function. Lock down all other DB access.
    - **Goal:** A secure, append-only log is functional.

2.  **Phase 2: Authentication & Local State**
    - Implement Supabase auth (phone/email).
    - Choose a client-side database technology (e.g., WatermelonDB).
    - Implement the local `outbound_events` queue.
    - **Goal:** A user can log in and perform actions that are saved reliably on their device.

3.  **Phase 3: The Conversational Core**
    - Define `inquiry.initiated` and `conversation.message_sent` events.
    - Build the basic UI for the inbox and conversation view, powered **only** by the local database.
    - **Goal:** A user can start and participate in a conversation, all offline.

4.  **Phase 4: Synchronization & Projections**
    - Implement the client-side sync protocol (sending the outbound queue, fetching deltas).
    - Build the first, simplest server-side projection for the `inbox_view`. This can be a simple cron job that runs every minute.
    - **Goal:** Local actions sync to the server, and server changes are reflected back on the client, completing the round trip.

5.  **Phase 5: Commercial Reality**
    - Add product management (CRUD for products).
    - Implement the `order.confirmed` and `payment.initiated` flow.
    - Build the simple, hardcoded PayPal integration.
    - **Goal:** The first end-to-end transaction, however simple, is possible.
