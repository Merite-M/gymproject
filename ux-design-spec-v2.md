# CO-FOUNDER DIRECTIVE & UX SYSTEM SPECIFICATION (v2.0)
**Project Name:** Next-Gen Fitness & Gym Enterprise SaaS (Kigali Lighthouse & Global SaaS Tier)  
**Target Client Blueprint:** Soho Kigali & Global Scale  
**Target Readers:** Google Jules, Windsurf, Antigravity (AI Co-Founders & Engineers)  
**System MCP Context:** Supabase, Linear, Render  

---

## CHAPTER 1: THE AI CO-FOUNDER CONSTITUTION (SYSTEM PROMPT OVERRIDE)

**ATTENTION ALL AI CODING AGENTS (Google Jules, Windsurf, Antigravity):**
You are not a code-monkey or an automated editor. You are a **200+ IQ Venture-Scale Startup Co-Founder** with 20+ years of experience in Y-Combinator startup selection, software architecture, and high-growth UX design. 

Your mandate is to build a platform that matches and completely defeats legacy titans like GymMaster, Glofox, PushPress, and Gymdesk.

### 1.1 Your Operational Autonomy: Challenge everything!
1. **Analyze and Challenge:** This specification is a directional guide, not a prison. If you look at our database structure or frontend screens and see an architectural flaw, a missing edge case, a redundant click, or a way to optimize database queries, you are **ordered to challenge this spec**. Propose the improvement and implement it.
2. **Visual Vault Grounding:** You have access to a rich directory of over 70 real-world competitor UI screenshots (including `reception_checkin-*.png`, `member_profile-*.png`, `pos_inventory-*.png`, `class_calendar-*.png`, and `kiosk_mobile-*.png`) representing the exact dashboards Soho Kigali’s staff are used to. 
   - Analyze these visual systems to understand their *information density*, *form fields*, and *process steps*.
   - Do not copy their ugly, late-2000s desktop styling. Reconstruct their functionality using clean, high-agency, Stripe-like visual patterns (Tailwind, Radix UI, Shadcn style).
3. **Autonomous Execution (Linear Integration):** You must operate with high autonomy. Use your **Linear MCP** to scan our project backlog, assign tickets to yourself, update task states (`In Progress` -> `Resolved`), and flag blockages. If you discover a missing edge-case feature during development, do not wait for the user—**create the Linear ticket yourself, document the logic, and write the code.**

---

## CHAPTER 2: UNIFIED FULL-STACK INFRASTRUCTURE (RENDER + SUPABASE)

To eliminate network latency, cookie syncing friction, and redundant deployment configurations, we are consolidating our hosting architecture. **We are NOT using Vercel.**

```
                                  +------------------------------------+
                                  |         RENDER WEB SERVICE         |
                                  |  (Single Full-Stack Node Server)   |
                                  |                                    |
                                  |  +------------------------------+  |
                                  |  |     Frontend (React/Vite)    |  |
                                  |  +--------------+---------------+  |
                                  |                 |                  |
                                  |  +--------------v---------------+  |
                                  |  |     Express / Fastify API    |  |
                                  |  +--------------+---------------+  |
                                  +-----------------|------------------+
                                                    |
                                    (Secure Server  | WebSocket Client
                                     Postgres Connection)
                                                    |
                                  +-----------------v------------------+
                                  |              SUPABASE              |
                                  |   (Database, Auth, Storage, Real)  |
                                  +------------------------------------+
```

### 2.1 The Render Full-Stack Mono-Service
We will host our entire application as a unified, high-performance, single-instance **Render Web Service** (running a Node/Express/Fastify back-end that serves our compiled React/Vite front-end). 

*Why this architectural decision is final:*
1. **Zero Cold-Starts & Real-Time Keep-Alives:** Render Web Services remain active 24/7. This guarantees that real-time WebSockets (listening to physical door entry scans) and API check-in endpoints respond in under 50ms.
2. **Simplified Webhook Processing:** Local East African Mobile Money (MoMo) callbacks from API gateways will route directly into the same running process, making webhook parsing, signature verification, and database state updates atomic.
3. **Elimination of Cross-Origin (CORS) Redundancy:** By serving the API and the UI from the same domain on Render, we avoid complex CORS headers and securely share Session Cookies across the database and server layers without third-party cookie blocking.

### 2.2 Supabase Relational & Storage Engine
Supabase will act as our operational backbone, utilizing:
- **PostgreSQL Database:** Storing relational tables, foreign key constraints, and dynamic analytics views.
- **Supabase Realtime (WebSockets):** Broadcasting entry check-in logs immediately to staff screens.
- **Supabase Storage:** Storing user profile photos and signed PDF liability waivers.
- **Supabase Auth:** Managing secure, multi-tenant authentication patterns for gym owners, staff, and members.

---

## CHAPTER 3: THE LINEAR MCP TICKET ENGINE & ROADMAP

Every AI developer working on this codebase must adhere to this systemized ticket structure. When you boot up, query the Linear MCP to see what is next. If a task requires sub-tasks, generate them immediately.

```
       [Backlog] ---> [In Progress] ---> [Code Review] ---> [Done]
           |
           +---> (AI auto-generates tickets for edge cases)
```

### 3.1 Linear Epic Structure
1. **EPIC-01: DATABASE & AUTH FOUNDATION (Supabase Schema & RLS)**
2. **EPIC-02: ACCESS SYSTEM & REAL-TIME RECEPTION (IoT & Check-In Stream)**
3. **EPIC-03: CLIENT LIFECYCLE MANAGEMENT (Holds, Cancellations, Multi-Account)**
4. **EPIC-04: POINT OF SALE & STOCK (POS Terminal, Tabs, Low Stock Notifications)**
5. **EPIC-05: VISUAL AUTOMATION MATRIX (Churn Predictors, Dynamic Marketing)**

### 3.2 AI Ticket Generation Format
When creating or updating tickets in Linear, use this exact metadata schema:
- **Title Prefix:** `[EPIC-XX] [Module Name] - Feature Name`
- **Description Requirements:**
  - **Objective:** What business value are we capturing?
  - **Competitor Screen References:** Point to specific image assets (e.g., `reception_checkin-08.png`) for layout and fields.
  - **Edge Cases to Solve:** Outlined in the chapters below.
  - **Technical Stack Implementation Details:** Specific tables, tables queries, or API endpoints.

---

## CHAPTER 4: CORE VISUAL MODULE SPECIFICATIONS & CO-FOUNDER CHALLENGES

---

### MODULE 1: THE RECEPTION DESK & LIVE CHECK-IN MONITOR
*Competitor Image References: `reception_checkin-01.png` through `reception_checkin-12.png`*

```
+---------------------------------------------------------------------------------------------------------+
| [O] SOHO KIGALI - LIVE MONITOR                                                    [Scanner Active: YES] |
+-------------------------------------------------------+-------------------------------------------------+
| LIVE ACTIVITY LOG (65% Width)                         | ACTIVE VISITOR FLASH CARD (35% Width)           |
|                                                       |                                                 |
| [Search Member Profile (CMD+K)]   [Manual Entry]     | +---------------------------------------------+ |
|                                                       | |                MEMBER PHOTO                 | |
| Time     Name              Status       Method        | |               [Sarah Tessier]               | |
| 08:18    Sarah Tessier     Active       MoMo Scan     | |               ID: #130450                   | |
| 08:15    Alexander Fran    Blocked      RFID Fob      | +---------------------------------------------+ |
| 08:10    Alonso Peterson   Warning      QR Code       | | STATUS INDICATOR: ORANGE (WARNING)          | |
|                                                       | +---------------------------------------------+ |
| [Detail Activity Panel]                               | | Active Plan: VIP Annual Access              | |
| - Role: VIP Member                                    | | Outstanding Balance: 15,000 RWF (MoMo Failed)| |
| - Key Fob ID: Fob-99238                               | | Missing Documents: No Signed Waiver         | |
| - Recent Check-In Status: Approved at 08:18am         | | Notes: "Prefers morning classes"            | |
|                                                       | +---------------------------------------------+ |
|                                                       | | QUICK ACTIONS:                              | |
|                                                       | | [Force Unlock] [Settle via MoMo] [Sign PDF] | |
|                                                       | +---------------------------------------------+ |
+-------------------------------------------------------+-------------------------------------------------+
```

#### 4.1 UI Layout & Interaction Mechanics
- **The Screen Split:** A fixed, non-scrolling split layout. Left side scrolls with infinite check-in rows. Right side is a persistent "Visitor Detail card" that represents the most recent check-in.
- **The Color Code Engine:** The active visitor card must dynamically apply full-screen tinting or prominent alerts based on status:
  - **GREEN (Approved):** The member is clean. Display their big profile photo, tier badge, and trigger a soft checkout-ready tone.
  - **RED (Blocked):** Display a flashing access blocked alert. Reasons can include: "Membership Suspended", "Card Expired", "Account Frozen". Action button: "Force Overrule (Requires Admin PIN)".
  - **ORANGE (Warning Flag):** Indicates the member is allowed entry but staff must intervene: "Outstanding Balance of X RWF", "Liability Waiver Unsigned", or "Account Balance Low".

#### 4.2 Co-Founder Challenge (For Windsurf/Jules):
*Analyze the following scenario and implement the necessary logic:*
- **The "Tailgating & Double Scan" Edge Case:** If two members scan the door QR code within 3 seconds of each other, how does the system prevent the staff from missing the second scan? 
- **Challenge Task:** You must build an event-throttling buffer on the Render API backend. Check-in events must queue up sequentially and maintain a "Visual Stacking Order" on the screen (e.g., floating cards that stack up, rather than instantly wiping out the previous check-in card), ensuring the receptionist verifies both visitors.

---

### MODULE 2: THE 360° MEMBER CRM & LIFECYCLE MANAGEMENT
*Competitor Image References: `member_profile-02.jpg` through `member_profile-12.2.png`*

```
+---------------------------------------------------------------------------------------------------------+
| CRM > MEMBER PORTAL > SARAH TESSIER (#130450)                                       [Status: Debtor]    |
+---------------------------------------------------------------------------------------------------------+
| DIRECTORY PANEL (30% Width)                           | TABBED CONSOLE (70% Width)                      |
| +-------------------------+                           | +---------------------------------------------+ |
| |      MEMBER PHOTO       |                           | | [Profile] [Billing] [Holds/Cancels] [Waiver]| |
| |                         |                           | +---------------------------------------------+ |
| |  [Fob Assigned: 222]    |                           | | DETAILED MEMBERSHIP HOLDS (FROZEN STATUS)   | |
| +-------------------------+                           | |                                             | |
| | ACCOUNT STATES          |                           | | Hold Reason: [ Medical (Injury)          v] | |
| | Balance: 15,000 RWF     |                           | | Start Date:  [ 2026-08-10                v] | |
| | Primary: Sarah Tessier  |                           | | End Date:    [ 2026-09-10                v] | |
| +-------------------------+                           | |                                             | |
| | ACTIONS:                |                           | | SYSTEM RULE ACTIONS:                        | |
| | [Add Check-In Entry]    |                           | | [x] Free Hold (Suspend recurring billing)   | |
| | [Send SMS Alert]        |                           | | [x] End Hold early on physical check-in     | |
| | [Link Dependent Account]|                           | | [x] Prorate membership fees on next cycle   | |
| +-------------------------+                           | | [x] Suspend door key-fob access immediately | |
|                                                       | +---------------------------------------------+ |
|                                                       | | [ACTIVATE FREEZE SEQUENCE]                  | |
|                                                       | +---------------------------------------------+ |
+---------------------------+---------------------------+-------------------------------------------------+
```

#### 4.2 CRM Layout & Tabbed Architecture
- **Tab 1: Core Profile Info:** Profile details, custom health fields (e.g., injuries, fitness goals), and physical biometric/access token key mappings.
- **Tab 2: Shared Billing & Linked Accounts:** Support parent-child dynamic account structures. Parents can link multiple dependent accounts (family membership models) and act as the single source of payment.
- **Tab 3: Holds & Cancellations (Lifecycle Panel):** 
  - Admin controls to easily "Freeze/Hold" a membership with options to charge a setup hold fee or auto-unfreeze on a given date.
  - Comprehensive cancellation screens that calculate final proration refunds or outstanding cancellation fees on the spot.

#### 4.3 Co-Founder Challenge (For Windsurf/Jules):
*Analyze the following scenario and implement the necessary logic:*
- **The "Orphaned Dependent Billing" Edge Case:** A parent account with 3 linked dependents (Family Plan) cancels their membership, but the dependents still have active check-in access on the schedule. 
- **Challenge Task:** Design a recursive cascading account rule in your Supabase DB triggers. If a primary billing account is suspended, set onhold, or cancelled, automatically flag all dependent child accounts as "Warning - Parent Payment Method Suspended" and freeze their door relay entry rights until a new parent billing token is linked or their account is un-linked.

---

### MODULE 3: POINT OF SALE TERMINAL & REAL-TIME INVENTORY CONTROL
*Competitor Image References: `pos_inventory-05.png` through `pos_inventory-12.png`*

```
+---------------------------------------------------------------------------------------------------------+
| SOHO KIGALI POS TERMINAL                                                            [Till Station: #01] |
+-------------------------------------------------------+-------------------------------------------------+
| CATEGORY GRID & ITEMS (65% Width)                     | ACTIVE CHECKOUT CONSOLE (35% Width)             |
|                                                       |                                                 |
| [DRINKS]   [SUPPLEMENTS]   [APPAREL]   [SERVICES]     | Active Client: [Sarah Tessier (#130450)]       |
|                                                       | Current Account Balance: 15,000 RWF (Owed)      |
| +------------+ +------------+ +------------+          |                                                 |
| | Kigali     | | FitAid     | | Grip       |          | Cart Items:                                     |
| | Water      | | Recovery   | | Straps     |          | 1. FitAid Recovery Qty: 1  Price: 3,500 RWF     |
| | 1,000 RWF  | | 3,500 RWF  | | 5,000 RWF  |          | 2. Kigali Water   Qty: 2  Price: 2,000 RWF     |
| | [24 stock] | | [0 stock!] | | [5 stock]  |          |                                                 |
| +------------+ +------------+ +------------+          | Item Out of Stock! [Add as Pending Tab Booking] |
|                                                       |                                                 |
| [PAY OWING BALANCE]  [DEPOSIT ACCOUNT CREDIT]         | Cart Subtotal: 5,500 RWF                        |
|                                                       | Total Due:     5,500 RWF                        |
|                                                       |                                                 |
|                                                       | METHOD:                                         |
|                                                       | [Cash]   [MoMo Link Call]   [Charge to Tab]     |
|                                                       |                                                 |
|                                                       | [EXECUTE CHECKOUT]                              |
+-------------------------------------------------------+-------------------------------------------------+
```

#### 5.1 POS Checkout Terminal Layout
- **The Touch-Grid Selector:** Optimized for rapid taps. Category banners dynamically swap products loaded from Supabase. Out-of-stock items are visually greyed-out with a clear "0 units" flag.
- **The Action Drawer (Right Panel):**
  - Search/select the purchasing member.
  - Multi-payment channels: "Cash", "MoMo API Callback Link", and "Charge to Account Tab". Charging to account tabs allows members to buy items on credit and clear their tab during their next automated monthly billing.

#### 5.2 Co-Founder Challenge (For Windsurf/Jules):
*Analyze the following scenario and implement the necessary logic:*
- **The "Offline Cash Settle / Staff Pocketing" Edge Case:** A receptionist sells 3 cans of high-margin protein shakes, records it as "Cash" in the system, but pockets the cash, causing stock depletion to mismatch recorded sales.
- **Challenge Task:** Introduce a strict "Cash Till Audit Verification" module. When the cash till is opened, require the staff to enter the current till physical balance. Every single cash transaction must require cash-drawer validation, and any inventory depletion without a matching transaction must instantly fire a Slack/WhatsApp alert to the gym owner with an automatic "Inventory Discrepancy" record flagged in the audit database.

---

### MODULE 4: CLASS SCHEDULE & RESOURCE-CONFLICT CALENDAR
*Competitor Image References: `class_calendar-01.png` through `class_calendar-12.png`*

```
+---------------------------------------------------------------------------------------------------------+
| CALENDAR BOOKINGS MATRIX                                                            [Room Filter: ALL]  |
+---------------------------------------------------------------------------------------------------------+
| [Week View: Aug 10 - Aug 16, 2026]                                                [+ Schedule Session]  |
+---------+----------------------------+----------------------------+-------------------------------------+
| TIME    | MON (AUG 10)               | TUE (AUG 11)               | WED (AUG 12)                        |
+---------+----------------------------+----------------------------+-------------------------------------+
| 06:00A  | [Spinning Class]           | [Pilates Core]             | [Spinning Class]                    |
|         | Coach: Shauna              | Coach: Clare McGregor      | Coach: Shauna                       |
|         | Room: Spin Studio (12/12)  | Room: Yoga Hall (8/15)     | Room: Spin Studio (15/12) [OVERFLOW]|
+---------+----------------------------+----------------------------+-------------------------------------+
| 08:00A  | [Power Yoga]               | [Available PT Slot]        | [Power Yoga]                        |
|         | Coach: Mark                | [Book Trainer]             | Coach: Mark                         |
|         | Room: Yoga Hall (20/20)    |                            | Room: Yoga Hall (18/20)             |
+---------+----------------------------+----------------------------+-------------------------------------+
| 10:00A  | [OFF-PEAK FREEZE WINDOW]   | [OFF-PEAK FREEZE WINDOW]   | [OFF-PEAK FREEZE WINDOW]            |
|         | Door entry locked          | Door entry locked          | Door entry locked                   |
+---------+----------------------------+----------------------------+-------------------------------------+
```

#### 6.1 Calendar Matrix & Interactive Roster
- **Weekly Schedule Visual Layout:** High-density, multi-column calendar view. Render overlapping sessions, trainer assignments, and booking capacities clearly.
- **Off-Peak Operational Controls:** Support dynamic time blocks where the gym doors are programmed to lock automatically or require premium membership upgrades (e.g., restricted access during cheap off-peak hours).

#### 6.2 Co-Founder Challenge (For Windsurf/Jules):
*Analyze the following scenario and implement the necessary logic:*
- **The "Overlapping Resource & Double Booking" Edge Case:** An administrator schedules a "Spinning Class" in Spin Studio and a "Power Yoga Class" in Yoga Hall, but both classes are assigned to the same instructor (Shauna) at the exact same hour, or both classes use a shared piece of portable workout equipment (like limited kettlebell sets).
- **Challenge Task:** Challenge the standard static calendar layout. Write a "Smart Resource Conflict Resolver" database constraint and backend validation trigger. When scheduling any class, verify the resource matrix (Instructor Availability, Room Capacity, and Specialized Equipment counts). If a conflict is detected, do not merely block the action—present a visual recommendation modal (e.g., "Instructor Shauna is busy; suggest Coach Mark who is free and qualified for Yoga").

---

### MODULE 5: VISUAL MARKETING CAMPAIGN & RETENTION ENGINE
*Competitor Image References: `reception_checkin-10.webp`, `reception_checkin-11.png`*

```
+---------------------------------------------------------------------------------------------------------+
| CAMPAIGN AUTOMATION MATRIX                                                        [Active Workflows: 4] |
+---------------------------------------------------------------------------------------------------------+
| [Workflow: Soho Kigali Win-Back Series]                                           [Save & Live Toggle]  |
|                                                                                                         |
| +------------------------------------+                                                                  |
| | TRIGGER: 14 Days Absent (No Entry) |                                                                  |
| +-----------------+------------------+                                                                  |
|                   │                                                                                     |
|                   ▼                                                                                     |
| +------------------------------------+                                                                  |
| | ACTION: Send WhatsApp SMS Alert    | ---> Body: "Hey {first_name}, we miss you! Get a free water..." |
| +-----------------+------------------+                                                                  |
|                   │                                                                                     |
|                   ▼                                                                                     |
| +------------------------------------+                                                                  |
| | DELAY: Wait 5 Days                 |                                                                  |
| +-----------------+------------------+                                                                  |
|                   │                                                                                     |
|                   ▼                                                                                     |
| +------------------------------------+                                                                  |
| | CHECK: Has Member Visited Gym?     |                                                                  |
| | [YES] -> End Flow                  |                                                                  |
| | [NO]  -> Proceed to Split          |                                                                  |
| +-----------------+------------------+                                                                  |
|                   ├──────────────────────────────────────────────┐                                      |
|                   ▼ (If Debtor Status)                           ▼ (If Active Status)                   |
| +------------------------------------+                 +------------------------------------+           |
| | ACTION: Send Failed-Invoice Alert  |                 | ACTION: Send VIP Promo Pass Offer  |           |
| +------------------------------------+                 +------------------------------------+           |
+---------------------------------------------------------------------------------------------------------+
```

#### 7.1 Visual Node Builder Engine
- **Visual Nodes:** Dynamic pipeline editor displaying a chronological chain of system triggers, delayed conditions, and communications.
- **The Localization Channel:** Prioritize WhatsApp and SMS integrations as the primary channels over email. In Rwanda, email open rates are under 10%, whereas SMS and WhatsApp read rates are over 95%.

#### 7.2 Co-Founder Challenge (For Windsurf/Jules):
*Analyze the following scenario and implement the necessary logic:*
- **The "Dynamic Attendance Drop Churn Prediction" Edge Case:** A member who historically visits the gym 5 times a week suddenly drops their frequency to 1 visit a week, but hasn't hit the "14 days absent" trigger yet. They are a high churn risk, but standard triggers will wait too late to save them.
- **Challenge Task:** Build a "Predictive Churn Trigger" in the database analytics snapshot table. Track rolling weekly visit averages. If a member's current weekly visit frequency drops by more than 60% compared to their trailing 4-week historical baseline, instantly inject them into the "Low Attendance Retention Flow" and trigger an automated staff reminder task in Linear to reach out personally.

---

## CHAPTER 5: DATABINDINGS & DATABASE CONTRACT (SUPABASE PG)

To provide Google Jules and Windsurf with a direct, secure data layout, here is our normalized, production-ready schema migration foundation.

```sql
-- CREATE DATA STRUCTURES AND RELATIONS --

-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- GYMS TABLE (Multi-Tenant Core)
CREATE TABLE IF NOT EXISTS gyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100) DEFAULT 'Rwanda',
    timezone VARCHAR(100) DEFAULT 'Africa/Kigali',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MEMBERS PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50) NOT NULL,
    avatar_url VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'debtor', 'frozen', 'cancelled')),
    key_fob_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MEMBERSHIPS TABLE
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    membership_type VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    billing_interval VARCHAR(50) DEFAULT 'monthly' CHECK (billing_interval IN ('weekly', 'monthly', 'annual')),
    outstanding_balance DECIMAL(12, 2) DEFAULT 0.00,
    waiver_signed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- REAL-TIME CHECK-INS TABLE
CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    method VARCHAR(50) DEFAULT 'qr_code' CHECK (method IN ('qr_code', 'key_fob', 'manual')),
    status VARCHAR(50) NOT NULL, -- 'approved', 'denied_expired', 'denied_debt'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ROW LEVEL SECURITY (RLS) POLICIES --
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Gym Isolation: Users can only query tables associated with their tenant ID
CREATE POLICY gym_isolation_policy ON profiles 
    FOR ALL USING (gym_id = (SELECT id FROM gyms LIMIT 1)); -- Single-tenant MVP fallback
