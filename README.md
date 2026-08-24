# GymPartner — Operations Console

> High-agency mission control for gym operations. A multi-tenant platform for managing members, check-ins, billing, staff, and IoT access control — built for the Rwandan market.

---

## Table of Contents

- [Overview](#overview)
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

GymPartner is a full-stack, multi-tenant gym management platform. Each gym (tenant) operates in complete data isolation. The system handles the full member lifecycle — from sign-up and waiver signing through billing, access control, membership holds, and retention.

Currency is denominated in **Rwandan Francs (RWF)**.

---

## Features

| Module | Description |
|---|---|
| **Member CRM** | Full member profiles, dependents/family links, notes, status management |
| **Check-in / Access Control** | QR code scanning with GPS geofencing, manual override, IoT device triggers |
| **Waivers** | Digital signature capture, PDF upload to Supabase Storage, 1-year expiry tracking |
| **Billing & Payments** | Invoicing, payment processing (cash, card, MoMo, bank transfer, member tab) |
| **Membership Holds & Freezes** | Hold/freeze with proration calculations and dependent impact analysis |
| **Point of Sale (POS)** | In-gym product and service sales |
| **Staff Management** | Role-based access control (admin, staff, trainer) |
| **Calendar** | Class and appointment scheduling |
| **IoT Integration** | Device-based gate/door access triggers |
| **Marketing / Retention** | Member outreach and retention tooling |
| **Cron Jobs** | Background billing runs, membership renewals, reminders |
| **Sync** | Data synchronisation utilities |

---

## Tech Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org) (App Router) + React 19 + TypeScript 5
- **UI**: [shadcn/ui](https://ui.shadcn.com) · Tailwind CSS v4 · Base UI React · Lucide React
- **State**: Zustand
- **PDF / Signatures**: jsPDF + react-signature-canvas
- **Fonts**: Manrope, Inter, JetBrains Mono + Material Symbols Outlined

### Backend
- **Runtime**: Node.js (CommonJS)
- **Framework**: Express 5
- **File Uploads**: Multer (in-memory storage)
- **Scheduling**: node-cron

### Infrastructure
- **Database / Auth / Storage**: [Supabase](https://supabase.com) (PostgreSQL + Auth + Storage)
- **Deployment**: [Render.com](https://render.com) — Web Service (backend) + Static Site (frontend CDN)

---

## Project Structure

```
gymproject/
├── render.yaml                  # Render deployment config
├── supabase/
│   └── migrations/              # Database migration files
└── src/
    ├── backend/                 # Node.js / Express API
    │   ├── index.js             # Entry point, core routes (check-in, waivers)
    │   ├── member-crm.js        # Member CRUD, billing, dependents, holds
    │   ├── payments.js          # Payment processing
    │   ├── pos.js               # Point of sale
    │   ├── staff.js             # Staff management
    │   ├── calendar.js          # Scheduling
    │   ├── iot.js               # IoT device integration
    │   ├── marketing.js         # Marketing / outreach
    │   ├── membership_holds.js  # Hold management
    │   ├── cron.js              # Background jobs
    │   ├── sync.js              # Data sync
    │   ├── admin.js             # Admin utilities
    │   ├── events.js            # Internal event emitter
    │   └── MEMBER_CRM_API.md    # API documentation
    └── frontend/                # Next.js application
        └── src/
            ├── app/             # App Router pages
            │   ├── admin/
            │   ├── calendar/
            │   ├── login/
            │   ├── members/
            │   ├── monitor/
            │   ├── pos/
            │   ├── reception/
            │   ├── retention/
            │   ├── staff/
            │   └── waiver/
            ├── components/      # Shared UI components
            ├── contexts/        # React contexts (Auth, etc.)
            ├── lib/             # Utilities and state context
            └── store/           # Zustand stores
```

---

## Getting Started

### Prerequisites

- Node.js v20+
- A [Supabase](https://supabase.com) project with the required tables provisioned
- npm

### Backend Setup

```bash
cd src/backend
npm install
cp .env.example .env   # fill in your values
node index.js
```

The backend runs on **port 3001** by default.

### Frontend Setup

```bash
cd src/frontend
npm install
cp .env.local.example .env.local   # fill in your values
npm run dev
```

The frontend runs on **[http://localhost:3000](http://localhost:3000)**.

---

## Environment Variables

### Backend (`src/backend/.env`)

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret key |
| `FRONTEND_URL` | Allowed CORS origin (e.g. `http://localhost:3000`) |
| `PORT` | Server port (default: `3001`) |
| `NODE_ENV` | `development` or `production` |

### Frontend (`src/frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL |

---

## API Overview

All API endpoints are prefixed with `/api/` and require a valid Supabase JWT in the `Authorization: Bearer <token>` header. All queries are scoped to a `tenant_id`.

| Route prefix | Module |
|---|---|
| `POST /api/checkin` | Member check-in with geofencing |
| `POST /api/waivers/sign` | Upload signed waiver PDF |
| `/api/members/:id` | Member CRM (profile, billing, holds, dependents, waiver) |
| `/api/payments` | Payment processing |
| `/api/pos` | Point of sale |
| `/api/staff` | Staff management |
| `/api/calendar` | Scheduling |
| `/api/iot` | IoT device access |
| `/api/membership-holds` | Hold management |
| `/api/admin` | Admin utilities |
| `/api/sync` | Data sync |

See [`src/backend/MEMBER_CRM_API.md`](src/backend/MEMBER_CRM_API.md) for full Member CRM endpoint documentation.

---

## Deployment

The project deploys to [Render.com](https://render.com) via [`render.yaml`](render.yaml):

| Service | Type | Config |
|---|---|---|
| `gym-backend-core` | Web Service (Node.js, Free tier) | `cd src/backend && node index.js` |
| `gym-frontend-app` | Static Site (CDN) | `cd src/frontend && npm run build` → publishes `src/frontend/out` |

---

## Database

The Supabase PostgreSQL schema includes the following core tables:

| Table | Purpose |
|---|---|
| `tenants` | Gym tenant records (includes geofence lat/lon/radius) |
| `profiles` | Member profiles, roles, waiver status |
| `memberships` | Membership records per member |
| `membership_holds` | Hold and freeze records |
| `invoices` | Billing invoices |
| `payments` | Payment transactions |
| `member_tabs` | Running tab balances |
| `family_links` | Dependent/family relationships |
| `check_ins` | Access log (approved, warning, denied) |

Database migrations live in [`supabase/migrations/`](supabase/migrations/).