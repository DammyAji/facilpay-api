# FacilPay Feature Specification

## Table of Contents
1. [Merchant Branding](#1-merchant-branding)
2. [Invoice Reminders](#2-invoice-reminders)
3. [Checkout Sessions](#3-checkout-sessions)
4. [Payment Link Analytics](#4-payment-link-analytics)

---

## 1. Merchant Branding

### Overview
Allow merchants to customise the look of customer-facing emails, receipts, and invoice PDFs with their own branding.

### Problem
All emails and PDFs use FacilPay branding, so payers may not recognise who charged them.

### Proposed Solution
- Add merchant branding settings: `displayName`, `logo` (PNG/SVG ≤ 500 KB), `primaryColor` (hex), `supportEmail`, `supportUrl`
- Add endpoints:
  - `GET /v1/merchants/me/branding` - Get current branding
  - `PATCH /v1/merchants/me/branding` - Update branding settings
  - `PUT /v1/merchants/me/branding/logo` - Upload logo
- Pass branding into Handlebars templates and invoice.generator.ts
- Fall back to FacilPay defaults when unset

### Data Model
```typescript
// merchant-branding.entity.ts
{
  id: string;              // UUID, primary key
  merchantId: string;      // FK to users table
  displayName: string;     // Merchant display name
  logo: string | null;     // URL to logo (PNG/SVG)
  primaryColor: string;    // Hex color code (default: #1a1a2e)
  supportEmail: string | null;
  supportUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### API Endpoints

#### GET /v1/merchants/me/branding
- **Auth**: JWT required
- **Response**: MerchantBranding object
- **Fallback**: Returns FacilPay defaults if no branding set

#### PATCH /v1/merchants/me/branding
- **Auth**: JWT required
- **Body**:
```json
{
  "displayName": "string",
  "primaryColor": "#RRGGBB",
  "supportEmail": "support@merchant.com",
  "supportUrl": "https://merchant.com/support"
}
```
- **Validation**:
  - `displayName`: max 100 chars
  - `primaryColor`: valid hex format
  - `supportEmail`: valid email format
  - `supportUrl`: valid URL format

#### PUT /v1/merchants/me/branding/logo
- **Auth**: JWT required
- **Content-Type**: multipart/form-data
- **Body**: file (PNG/SVG, max 500KB)
- **Response**: `{ logoUrl: string }`

### Acceptance Criteria
- [ ] Branding appears in payer emails and PDFs
- [ ] Logo uploads are validated (PNG/SVG, ≤ 500KB)
- [ ] Fallback to FacilPay defaults when branding unset

---

## 2. Invoice Reminders

### Overview
Automatically email customers when an invoice is approaching or past its due date.

### Problem
Without reminders, merchants must chase unpaid invoices manually.

### Proposed Solution
- Daily cron marks OPEN invoices past `dueDate` as OVERDUE
- Send reminder emails at configurable offsets (default: 3 days before, on due date, 7 days after)
- Add merchant setting to disable reminders
- Add per-invoice `remindersEnabled` flag
- Record each reminder sent to avoid duplicates

### Data Model
```typescript
// invoice-reminder.entity.ts
{
  id: string;              // UUID
  paymentId: string;       // FK to payments
  type: 'BEFORE' | 'ON_DUE' | 'AFTER';
  sentAt: Date;
  createdAt: Date;
}

// Add to payment entity:
{
  dueDate: Date | null;    // Invoice due date
  status: PaymentStatus;   // Add OVERDUE status
  remindersEnabled: boolean; // Per-invoice flag (default: true)
}

// Add to merchant settings:
{
  remindersEnabled: boolean; // Merchant-level default (default: true)
  reminderOffsets: number[]; // Days before/on/after (default: [-3, 0, 7])
}
```

### Payment Status Additions
```typescript
enum PaymentStatus {
  // ... existing
  OVERDUE = 'OVERDUE',  // Past due date, not paid
}
```

### Cron Job
- Run daily at midnight UTC
- Query: `status = 'PENDING' AND dueDate < NOW() AND remindersEnabled = true`
- Mark as OVERDUE
- Check reminder schedule and queue emails

### Email Templates
- **3 days before**: "Reminder: Invoice due in 3 days"
- **On due date**: "Invoice due today"
- **7 days after**: "Urgent: Invoice overdue"

### Acceptance Criteria
- [ ] Each reminder is sent once (tracked in invoice_reminders table)
- [ ] Overdue status transitions correctly
- [ ] Tests use fake timers

---

## 3. Checkout Sessions

### Overview
Introduce one-time checkout sessions: the merchant backend creates a session with line items, and the payer completes it.

### Problem
Payment links are reusable and single-amount. E-commerce integrations need a per-order session with an itemised cart, expiry and redirect URLs.

### Data Model
```typescript
// checkout-session.entity.ts
{
  id: string;              // UUID
  merchantId: string;      // FK to users
  lineItems: LineItem[];   // Embedded JSON
  currency: string;        // ISO 4217
  total: number;           // Computed from line items
  customerId: string | null;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  expiresAt: Date;         // Default: 30 minutes
  status: 'OPEN' | 'COMPLETE' | 'EXPIRED';
  paymentId: string | null; // FK to payments
  createdAt: Date;
  updatedAt: Date;
}

type LineItem = {
  name: string;
  description?: string;
  quantity: number;
  unitAmount: number;     // In smallest currency unit
};
```

### API Endpoints

#### POST /v1/checkout/sessions
- **Auth**: JWT required
- **Body**:
```json
{
  "lineItems": [
    { "name": "Product 1", "quantity": 2, "unitAmount": 1000 }
  ],
  "currency": "USD",
  "customerId": "cus_123",
  "customerEmail": "customer@example.com",
  "successUrl": "https://example.com/success",
  "cancelUrl": "https://example.com/cancel",
  "expiresInMinutes": 30
}
```
- **Response**: CheckoutSession object with `publicId` for URL

#### GET /v1/checkout/sessions/:id
- **Auth**: JWT required
- **Response**: CheckoutSession (merchant's own sessions only)

#### POST /v1/checkout/sessions/:id/expire
- **Auth**: JWT required
- **Response**: Updated CheckoutSession

#### GET /v1/checkout/sessions/:publicId/public
- **Auth**: None (public)
- **Response**: Public session info for payer view

### Payment Creation
- On successful payment, create Payment via PaymentsService
- Link payment to session
- Emit `checkout.session.completed` webhook
- Emit `checkout.session.expired` webhook when session expires

### Acceptance Criteria
- [ ] Totals are computed server-side from line items
- [ ] Expired sessions cannot be paid
- [ ] E2E test covers full create → pay → webhook flow

---

## 4. Payment Link Analytics

### Overview
Show merchants how each payment link performs over time with detailed analytics.

### Problem
Payment links track only lifetime views and completions counters with no time dimension or revenue.

### Data Model
```typescript
// payment-link-event.entity.ts
{
  id: string;              // UUID
  paymentLinkId: string;   // FK to payment_links
  type: 'VIEW' | 'REDEEM' | 'COMPLETE';
  ipHash: string;          // SHA256 of IP for deduplication
  userAgent: string | null;
  createdAt: Date;
}
```

### API Endpoint

#### GET /v1/payment-links/:id/analytics
- **Auth**: JWT required
- **Query Params**:
  - `from`: ISO date (default: 30 days ago)
  - `to`: ISO date (default: today)
  - `interval`: 'day' | 'week' (default: 'day')
- **Response**:
```json
{
  "linkId": "uuid",
  "total": {
    "views": 100,
    "redemptions": 50,
    "completions": 25,
    "conversionRate": 0.25,
    "revenue": 2500.00
  },
  "buckets": [
    {
      "date": "2026-01-01",
      "views": 10,
      "redemptions": 5,
      "completions": 2,
      "conversionRate": 0.2,
      "revenue": 200.00
    }
  ]
}
```

### View Deduplication
- Hash IP with a short time window (1 hour)
- Debounce repeated views from same IP within window
- Store IP hash for deduplication

### Acceptance Criteria
- [ ] Analytics buckets are correct and scoped to owner
- [ ] View counting is resistant to trivial refresh spam
- [ ] Tests cover bucketing

---

## Implementation Notes

### Module Structure
```
src/modules/
├── merchants/
│   ├── entities/
│   │   ├── merchant-branding.entity.ts     (new)
│   │   └── merchant-settings.entity.ts     (new for reminders)
│   ├── dto/
│   │   ├── update-branding.dto.ts          (new)
│   │   └── upload-logo.dto.ts              (new)
│   ├── merchants.controller.ts             (update)
│   └── merchants.service.ts                (update)
├── checkout-sessions/                      (new module)
│   ├── dto/
│   ├── entities/
│   ├── checkout-sessions.controller.ts
│   ├── checkout-sessions.service.ts
│   └── checkout-sessions.module.ts
├── payment-links/
│   ├── entities/
│   │   └── payment-link-event.entity.ts    (new)
│   ├── payment-links.controller.ts         (update)
│   ├── payment-links.service.ts            (update)
│   └── payment-links.module.ts             (update)
└── payments/
    ├── payment.entity.ts                   (update - add dueDate, OVERDUE status)
    ├── invoice-reminder.entity.ts          (new)
    ├── payments.service.ts                 (update - reminder logic)
    └── invoice.service.ts                  (update - branding integration)
```

### Invoice Generator Updates
- Accept optional `branding` parameter
- Use merchant branding in header section
- Fall back to FacilPay defaults

### Email Template Updates
- Add Handlebars variables for branding
- Support per-merchant template customisation

### Cron Jobs
- Daily invoice reminder processor
- Checkout session expiry checker

### Webhooks
- Add new event types:
  - `checkout.session.completed`
  - `checkout.session.expired`