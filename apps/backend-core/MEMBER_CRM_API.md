# Member CRM API Documentation

This document describes the Member CRM API endpoints implemented in `member-crm.js`. All endpoints require JWT authentication via Supabase and follow RESTful conventions.

## Base URL
```
/api/members/:id
```

## Authentication
All endpoints require a valid JWT token in the Authorization header:
```
Authorization: Bearer <your_jwt_token>
```

## Currency Formatting
All monetary values are returned in Rwandan Francs (RWF) with proper formatting.

---

## Member Profile API

### Get Full Member Profile
**GET** `/api/members/:id`

Retrieves complete member profile including membership details, billing information, waiver status, and dependents.

**Query Parameters:**
- `tenant_id` (required) - The tenant ID for multi-tenancy

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+250788123456",
    "status": "active",
    "waiver_signed": true,
    "waiver_signed_at": "2024-01-15T10:30:00Z"
  },
  "memberships": [...],
  "billing": {
    "invoices": [...],
    "outstanding_balance": 15000,
    "formatted_balance": "RWF 15,000",
    "member_tab": {...}
  },
  "waiver": {
    "signed": true,
    "signed_at": "2024-01-15T10:30:00Z",
    "is_valid": true
  },
  "dependents": [...]
}
```

### Update Member Information
**PUT** `/api/members/:id`

Updates member profile information.

**Body Parameters:**
- `tenant_id` (required)
- `first_name` (optional)
- `last_name` (optional)
- `email` (optional)
- `phone` (optional)
- `date_of_birth` (optional)
- `address` (optional)
- `emergency_contact_name` (optional)
- `emergency_contact_phone` (optional)
- `status` (optional)
- `notes` (optional)

**Response:** Updated profile object

### Get Membership History
**GET** `/api/members/:id/membership-history`

Retrieves historical membership data and associated holds.

**Query Parameters:**
- `tenant_id` (required)

**Response:**
```json
{
  "memberships": [...],
  "holds": [...]
}
```

---

## Membership Holds API

### List Active Holds
**GET** `/api/members/:id/holds`

Retrieves membership holds for a member.

**Query Parameters:**
- `tenant_id` (required)
- `status` (optional) - Filter by status (e.g., 'active', 'pending')

**Response:** Array of hold objects with membership details

### Create Membership Hold
**POST** `/api/members/:id/holds`

Creates a new membership hold request.

**Body Parameters:**
- `tenant_id` (required)
- `membership_id` (required)
- `hold_reason` (required)
- `start_date` (required) - ISO date string
- `end_date` (optional) - ISO date string
- `notes` (optional)
- `created_by` (required) - User ID creating the hold

**Response:**
```json
{
  "hold": {...},
  "proration_calculation": {
    "daily_rate": "500.00",
    "hold_days": 30,
    "proration_amount": "15000.00",
    "formatted_amount": "RWF 15,000"
  }
}
```

### Cancel Membership
**POST** `/api/members/:id/cancel`

Cancels a member's membership.

**Body Parameters:**
- `tenant_id` (required)
- `membership_id` (required)
- `cancellation_reason` (optional)
- `effective_date` (optional) - ISO date string
- `cancelled_by` (required) - User ID cancelling the membership

**Response:** Updated membership object

### Reactivate Membership
**POST** `/api/members/:id/reactivate`

Reactivates a previously cancelled membership.

**Body Parameters:**
- `tenant_id` (required)
- `membership_id` (required)
- `reactivated_by` (required) - User ID reactivating the membership

**Response:** Updated membership object

---

## Membership Freeze API

### Freeze Membership
**POST** `/api/members/:id/freeze`

Freezes a membership with dependent impact analysis.

**Body Parameters:**
- `tenant_id` (required)
- `membership_id` (required)
- `freeze_reason` (required)
- `start_date` (required) - ISO date string
- `end_date` (optional) - ISO date string
- `created_by` (required) - User ID creating the freeze

**Response:**
```json
{
  "freeze": {...},
  "affected_dependents": [
    {
      "dependent_id": "uuid",
      "name": "Jane Doe",
      "membership_id": "uuid",
      "relationship_type": "spouse"
    }
  ],
  "proration_calculation": {...},
  "warning": "This freeze will affect 1 dependent membership(s)"
}
```

### Unfreeze Membership
**POST** `/api/members/:id/unfreeze`

Unfreezes a frozen membership.

**Body Parameters:**
- `tenant_id` (required)
- `hold_id` (required) - The hold ID to end
- `unfrozen_by` (required) - User ID unfreezing the membership

**Response:** Updated hold object

### Get Freeze Status
**GET** `/api/members/:id/freeze-status`

Retrieves current freeze status and affected dependents.

**Query Parameters:**
- `tenant_id` (required)

**Response:**
```json
{
  "active_freezes": [...],
  "affected_dependents": [...],
  "is_frozen": true
}
```

---

## Billing API

### Get Payment History
**GET** `/api/members/:id/billing/payments`

Retrieves payment history for a member.

**Query Parameters:**
- `tenant_id` (required)
- `limit` (optional, default: 50)
- `offset` (optional, default: 0)

**Response:** Array of payment objects with formatted amounts

### Get Outstanding Balance
**GET** `/api/members/:id/billing/balance`

Retrieves current outstanding balance including invoices and member tab.

**Query Parameters:**
- `tenant_id` (required)

**Response:**
```json
{
  "invoice_balance": 15000,
  "formatted_invoice_balance": "RWF 15,000",
  "tab_balance": 5000,
  "formatted_tab_balance": "RWF 5,000",
  "total_balance": 20000,
  "formatted_total_balance": "RWF 20,000",
  "unpaid_invoices": [...],
  "overdue_invoices": [...]
}
```

### Create Invoice
**POST** `/api/members/:id/billing/invoices`

Creates a new invoice for a member.

**Body Parameters:**
- `tenant_id` (required)
- `subtotal` (required)
- `tax` (optional, default: 0)
- `discount` (optional, default: 0)
- `due_date` (optional) - ISO date string
- `invoice_type` (optional, default: 'membership')
- `notes` (optional)
- `items` (optional) - Array of line items
- `created_by` (required) - User ID creating the invoice

**Response:** Invoice object with formatted amounts

### Process Payment
**POST** `/api/members/:id/billing/payments`

Processes a payment for a member.

**Body Parameters:**
- `tenant_id` (required)
- `amount` (required)
- `method` (required) - One of: 'cash', 'card', 'momo', 'bank_transfer', 'member_tab'
- `invoice_id` (optional)
- `reference_code` (optional)
- `processed_by` (required) - User ID processing the payment

**Response:** Payment object with formatted amount

---

## Waiver API

### Get Waiver Status
**GET** `/api/members/:id/waiver`

Retrieves current waiver status and validity.

**Query Parameters:**
- `tenant_id` (required)

**Response:**
```json
{
  "signed": true,
  "signed_at": "2024-01-15T10:30:00Z",
  "is_valid": true,
  "expires_at": "2025-01-15T10:30:00Z",
  "days_until_expiry": 180
}
```

### Record Waiver Signature
**POST** `/api/members/:id/waiver/sign`

Records a waiver signature for a member.

**Body Parameters:**
- `tenant_id` (required)
- `signature_data` (optional) - Signature data if capturing digital signature
- `signed_by` (required) - User ID recording the signature

**Response:** Updated profile object

### Check Waiver Validity
**GET** `/api/members/:id/waiver/validity`

Checks if waiver is valid and when it expires.

**Query Parameters:**
- `tenant_id` (required)

**Response:**
```json
{
  "validity_status": "valid",
  "is_valid": true,
  "signed_at": "2024-01-15T10:30:00Z",
  "expires_at": "2025-01-15T10:30:00Z",
  "days_remaining": 180,
  "action_required": false
}
```

---

## Dependents API

### List Linked Dependents
**GET** `/api/members/:id/dependents`

Retrieves all dependents linked to a member account.

**Query Parameters:**
- `tenant_id` (required)

**Response:**
```json
[
  {
    "link_id": "uuid",
    "dependent_id": "uuid",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "+250788123456",
    "relationship_type": "spouse",
    "membership_status": "active",
    "membership_type": "family"
  }
]
```

### Add Dependent
**POST** `/api/members/:id/dependents`

Links a dependent to a member account.

**Body Parameters:**
- `tenant_id` (required)
- `dependent_id` (required) - Profile ID of the dependent
- `relationship_type` (required) - e.g., 'spouse', 'child', 'parent'
- `created_by` (required) - User ID creating the link

**Response:** Created family link object

### Remove Dependent
**DELETE** `/api/members/:id/dependents/:dependent_id`

Removes a dependent link from a member account.

**Query Parameters:**
- `tenant_id` (required)

**Response:** 204 No Content

### Update Dependent Relationship
**PUT** `/api/members/:id/dependents/:dependent_id`

Updates the relationship type for a dependent.

**Body Parameters:**
- `tenant_id` (required)
- `relationship_type` (required)

**Response:** Updated family link object

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing/invalid parameters)
- `401` - Unauthorized (invalid/missing JWT token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

---

## Security Features

1. **JWT Authentication**: All endpoints require valid Supabase JWT tokens
2. **Tenant Isolation**: All queries are scoped to the tenant_id
3. **Role Validation**: User roles are validated for tenant access
4. **Input Validation**: All inputs are validated before processing
5. **SQL Injection Protection**: Using Supabase client with parameterized queries

---

## RWF Currency Formatting

All monetary values use the `formatRWF()` helper function:
- Format: `RWF X,XXX`
- No decimal places for whole numbers
- Uses Rwandan locale formatting
- Consistent across all billing endpoints

---

---

## Sales Lead Pipeline API

### List Sales Leads
**GET** `/api/members/leads`

Retrieves leads with stage, source, and search filters.

**Query Parameters:**
- `tenant_id` (required)
- `stage` (optional, e.g. 'inquiry', 'tour_scheduled', 'trial_active', 'trial_expired', 'closed_won', 'closed_lost')
- `search` (optional)
- `source` (optional)
- `limit` (optional, default: 100)
- `offset` (optional, default: 0)

### Create Sales Lead
**POST** `/api/members/leads`

Creates a new lead.

**Body Parameters:**
- `tenant_id` (required)
- `first_name` (required)
- `last_name` (required)
- `phone` (required)
- `email` (optional)
- `pipeline_stage` (optional, default: 'inquiry')
- `tour_date` (optional, ISO timestamp)
- `referral_code_used` (optional)
- `notes` (optional)

### Advance Pipeline Stage
**POST** `/api/members/leads/:leadId/stage`

Transitions lead pipeline stage and executes automated triggers (e.g. tour confirmation, trial activation, reward vouchers).

**Body Parameters:**
- `tenant_id` (required)
- `stage` (required)
- `tour_date` (optional)
- `trial_days` (optional, default: 7)
- `lost_reason` (optional)
- `notes` (optional)

### Convert Lead to Member
**POST** `/api/members/leads/:leadId/convert`

One-click converts lead to member profile and fulfills referral rewards.

---

## Member Referral Engine API

### Get Member Referral Hub
**GET** `/api/members/:id/referral`

Returns personal referral code, share link, list of referee leads/members, and earned rewards in RWF.

### List All Referrals (Tenant-wide)
**GET** `/api/members/referrals/list`

### Validate Referral Code
**POST** `/api/members/referrals/validate`

---

## Embeddable Public Web Widgets API

### Get Public Gym Config & Schedules
**GET** `/api/public/config/:tenant_id`

### Public Schedule Tour / Trial Pass
**POST** `/api/public/schedule`

### Public Web Registration & Sign-up
**POST** `/api/public/join`

### Embeddable Widget JavaScript Script
**GET** `/api/public/widget.js`

Embed snippet:
```html
<div id="polyfit-widget" data-tenant-id="<TENANT_UUID>" data-mode="schedule"></div>
<script src="https://polyfit-backend.onrender.com/api/public/widget.js"></script>
```

---

## Database Schema Requirements

The following database tables are expected to exist:

- `profiles` - Member profiles (with `referral_code`, `referred_by_id`)
- `leads` - Sales funnel leads and pipeline stages
- `referral_rewards` - Attribution tracking and voucher bonuses
- `lead_stage_history` - Audit trail of stage movements
- `gift_vouchers` - Monetary reward vouchers (RWF)
- `memberships` - Membership records
- `membership_holds` - Hold/freeze records
- `invoices` - Billing invoices
- `payments` - Payment records
- `member_tabs` - Member tab balances
- `family_links` - Dependent relationships
- `check_ins` - Check-in records

---

## Example Usage

### Using fetch():
```javascript
const response = await fetch('/api/members/leads?tenant_id=456&stage=inquiry', {
  headers: {
    'Authorization': 'Bearer <jwt_token>'
  }
});
const data = await response.json();
```