# PolyFit — Operations Console

> High-agency mission control for gym operations. A multi-tenant B2B SaaS platform for managing members, check-ins, billing, staff, IoT access control, corporate wellness, and communications — built for high performance and offline resilience in emerging markets.

---

## Table of Contents

- [Overview](#overview)
- [Architecture & Design Principles](#architecture--design-principles)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Deployment](#deployment)
- [Database](#database)

---

## Overview

PolyFit is an enterprise-grade, multi-tenant gym management ecosystem and B2B corporate wellness network. Each gym (tenant) operates with strict data isolation using Row-Level Security (RLS) in PostgreSQL. The system manages the entire member lifecycle — from online join widgets and digital waiver signatures to automated billing, IoT turnstile check-ins, corporate B2B contracts, and staff task dispatches.

All financial transactions are denominated in **Rwandan Francs (RWF)**, with built-in integrations for local payment channels (Paypack, MTN Mobile Money, Airtel Money) alongside card and tab payments.

---

## Architecture & Design Principles

PolyFit uses a decoupled, capital-efficient architecture designed for 99.99% uptime and low operational cost:

1. **Persistent Express Backend (`gym-backend-core`)**: An always-on Node.js 5 service hosted on Render. Handles real-time WebSockets, IoT relay triggers, background billing crons, dunning workflows, and payment gateway webhooks.
2. **Static Next.js Frontend (`gym-frontend-app`)**: A Next.js 16 (App Router) frontend compiled as a static export (`output: export`) and served globally via Render's free CDN.
3. **Database & Isolation**: Powered by Supabase PostgreSQL with tenant-level Row Level Security (RLS) and branching support.
4. **Offline Resilience**: PWA client-side WebAssembly SQLite storage (`sql.js`) with background CRDT synchronization to handle local power and network drops seamlessly.

---

## Features

| Module | Description |
|---|---|
| **Member CRM** | Profiles, family/dependent links, membership holds, notes, member tab balances |
| **Check-in & Access Control** | Geofenced QR check-ins, dynamic TOTP codes, hardware turnstile triggers, capacity gating |
| **Self-Service Kiosk** | Tablet-friendly PIN check-in interface with staff override & real-time verification |
| **Live Occupancy Monitor** | Real-time capacity monitoring and gate event streaming |
| **Digital Waivers** | Signature capture, automated PDF generation, Supabase storage, 1-year expiration tracking |
| **Billing & Payments** | Invoicing, promo codes, gift vouchers with atomic deduction (`FOR UPDATE` locking), MoMo, card, and cash |
| **Corporate B2B Portal** | Corporate company wellness plans, bulk member management, and automated invoicing |
| **Communications Hub** | Multi-channel messaging gateway (SMS, Email, WhatsApp) for staff & member outreach |
| **Automated Drip Engine** | Retention workflows, churn-prevention triggers, automated lifecycle messages |
| **Staff & Task Management** | Role-based access control (admin, staff, trainer), task assignments, duty shifts |
| **Point of Sale (POS)** | Product catalog, inventory tracking, instant item sales, running tab management |
| **Calendar & Facility Rentals**| Class scheduling, trainer appointments, court/facility availability & rentals |
| **IoT Integration** | Shelly Wi-Fi relays, turnstile scanner integration, hardware credential pairing |
| **Digital Contracts** | Membership agreement generation and digital signature archiving |
| **Public Embed Widgets** | Unauthenticated schedule widgets, web join flows, and iframe embed scripts |

---

## Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org) (App Router, Static Export) · React 19 · TypeScript 5
- **UI & Styling**: [shadcn/ui](https://ui.shadcn.com) · Tailwind CSS v4 (`@tailwindcss/postcss`) · Base UI React · Lucide React
- **State Management**: Zustand
- **PDF & Digital Signatures**: jsPDF · react-signature-canvas
- **Design Tokens**: CSS Custom Properties (`:root` theme in `globals.css`)

### Backend
- **Runtime**: Node.js (CommonJS)
- **Framework**: Express 5
- **File Uploads**: Multer (In-Memory Storage)
- **Rate Limiting**: express-rate-limit
- **Background Jobs & Events**: node-cron · Node.js EventEmitter

### Infrastructure & Database
- **Database / Auth / Storage**: [Supabase](https://supabase.com) (PostgreSQL + RLS + Auth + Storage)
- **Hosting**: [Render.com](https://render.com) — Web Service (`gym-backend-core`) + Static Site (`gym-frontend-app`)

---

## Project Structure

```
gymproject/
├── render.yaml                  # Render infrastructure-as-code deployment config
├── supabase/
│   └── migrations/              # Database migration files
└── src/
    ├── backend/                 # Node.js / Express API
    │   ├── index.js             # Server entry point, health check, waiver & checkin endpoints
    │   ├── admin.js             # System administration & tenant settings
    │   ├── authMiddleware.js    # Centralized Bearer JWT auth middleware
    │   ├── calendar.js          # Class scheduling & facility rentals
    │   ├── communications.js    # Staff & member communication hub
    │   ├── contracts.js         # Digital contract agreements
    │   ├── corporate.js         # Corporate B2B wellness portal
    │   ├── cron.js              # Background billing, renewals, and dunning engine
    │   ├── drip_engine.js       # Automated member retention drip campaigns
    │   ├── events.js            # Internal Node.js EventEmitters
    │   ├── gateways.js          # Multi-channel messaging gateways (SMS, Email, WhatsApp)
    │   ├── iot.js               # Turnstiles, TOTP QR generation, hardware credentials
    │   ├── marketing.js         # Member outreach & marketing campaigns
    │   ├── member-crm.js        # Member CRUD, billing, tabs, family links
    │   ├── membership_holds.js  # Freeze & hold proration logic
    │   ├── payments.js          # Promo codes, gift vouchers, payment gateways
    │   ├── pos.js               # Point of Sale & inventory management
    │   ├── public.js            # Unauthenticated web widgets & join flows
    │   ├── staff.js             # Staff RBAC & duty roster
    │   ├── staff_tasks.js       # Staff task assignments & workflows
    │   ├── sync.js              # Offline-first SQLite sync engine
    │   ├── tier_proration.js    # Membership tier upgrades/downgrades
    │   └── MEMBER_CRM_API.md    # API documentation
    └── frontend/                # Next.js Static Export Application
        └── src/
            ├── app/             # App Router pages
            │   ├── admin/       # Tenant management & settings
            │   ├── calendar/    # Class & facility scheduling
            │   ├── communications/ # Communication Hub
            │   ├── corporate/   # Corporate B2B wellness management
            │   ├── kiosk/       # Self-service tablet check-in interface
            │   ├── login/       # Authentication login
            │   ├── marketing/   # Campaign manager
            │   ├── members/     # Member CRM profiles & billing
            │   ├── monitor/     # Real-time occupancy monitor
            │   ├── pos/         # Point of Sale interface
            │   ├── reception/   # Front desk check-in dashboard
            │   ├── retention/   # Retention automation & drip workflows
            │   ├── staff/       # Staff management & duty roster
            │   └── waiver/      # Digital waiver signing
            ├── components/      # Reusable UI components & dialogs
            ├── contexts/        # React contexts (Auth, Tenant)
            ├── lib/             # API client modules & utilities
            └── store/           # Zustand state management stores
```

---

## Getting Started

### Prerequisites

- Node.js v20+
- npm
- A [Supabase](https://supabase.com) project with provisioned tables and RLS policies

### Backend Setup

```bash
cd src/backend
npm install
cp .env.example .env   # Fill in Supabase credentials and HMAC keys
node index.js
```

The backend API server runs on **port 3001** by default.

### Frontend Setup

```bash
cd src/frontend
npm install
cp .env.local.example .env.local   # Fill in Supabase anon keys and backend URL
npm run dev
```

The development server runs on **[http://localhost:3000](http://localhost:3000)**.
To test the static build locally:

```bash
cd src/frontend
npm run build
npx serve@latest out -l 3000
```

---

## Environment Variables

### Backend (`src/backend/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret key |
| `FRONTEND_URL` | Allowed CORS origin (e.g. `http://localhost:3000`) |
| `PORT` | Server port (default: `3001`) |
| `JWT_SECRET` | Secret key for custom token validation |
| `INTERNAL_API_KEY` | Internal system-to-system API key |
| `PAYPACK_WEBHOOK_SECRET` | HMAC secret for Paypack webhooks |
| `MOMO_WEBHOOK_SECRET` | HMAC secret for MTN Mobile Money webhooks |
| `AIRTEL_WEBHOOK_SECRET` | HMAC secret for Airtel Money webhooks |

### Frontend (`src/frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:3001`) |

---

## API Overview

All authenticated API endpoints require a valid Supabase Bearer JWT in the `Authorization: Bearer <token>` header. Operations are automatically scoped to the user's `tenant_id`.

| Route Prefix | Module |
|---|---|
| `GET /health` | Backend and database status health check |
| `POST /api/checkin` | Member check-in with GPS geofencing & capacity checks |
| `POST /api/waivers/sign` | Digital liability waiver PDF upload & signature |
| `/api/members` | Member CRM (profiles, family links, tabs, billing) |
| `/api/payments` | Payment processing, promo codes, gift vouchers |
| `/api/corporate` | Corporate B2B wellness portal & company invoicing |
| `/api/communications` | Multi-channel communication hub (SMS, Email, WhatsApp) |
| `/api/workflows` | Retention drip campaigns & automated triggers |
| `/api/tasks` | Staff task assignments & duty management |
| `/api/pos` | Point of Sale catalog, transactions & inventory |
| `/api/staff` | Staff RBAC & duty roster |
| `/api/calendar` | Class scheduling & facility rentals |
| `/api/iot` | Turnstiles, dynamic TOTP QR generation, credentials |
| `/api/membership-holds` | Freeze/hold proration management |
| `/api/tiers` | Tier upgrades/downgrades & proration |
| `/api/contracts` | Digital contracts & agreement archives |
| `/api/public` & `/widgets` | Unauthenticated web widgets & public join flows |
| `/api/admin` | System settings & tenant configuration |
| `/api/sync` | Offline-first WASM SQLite data synchronization |

---

## Deployment

Deployment configuration is managed via [`render.yaml`](render.yaml):

| Service Name | Render Service Type | Build & Start Command |
|---|---|---|
| `gym-backend-core` | Web Service (Node.js) | `cd src/backend && npm install` → `node index.js` |
| `gym-frontend-app` | Static Site (CDN) | `cd src/frontend && npm run build` → publishes `src/frontend/out` |

---

## Database

The database is built on Supabase PostgreSQL with Row Level Security (RLS) enforcement per tenant:

| Core Table | Purpose |
|---|---|
| `tenants` | Tenant records, geofence parameters, feature toggles, capacity limits |
| `profiles` | Member and staff profiles, roles, waiver verification status |
| `memberships` | Active & historical membership plans |
| `membership_holds` | Active & upcoming membership freezes/holds |
| `invoices` | Member and corporate billing invoices |
| `payments` | Payment ledger (Cash, Card, MoMo, Tab, Gift Voucher) |
| `member_tabs` | Member running tab credit balances |
| `family_links` | Dependent and family member associations |
| `check_ins` | Real-time access log (Approved, Warning, Denied) |
| `corporate_companies` | Corporate accounts & B2B subscription plans |
| `communications_log` | Audit trail for multi-channel dispatches |
| `staff_tasks` | Staff task assignments & completion statuses |
| `facility_rentals` | Court and facility scheduling & reservations |
| `gift_vouchers` | Gift voucher codes, initial balance, and remaining balance |

Database migrations live in [`supabase/migrations/`](supabase/migrations/).
