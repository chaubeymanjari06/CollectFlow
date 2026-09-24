# CollectFlow

> **Smart Receivables Automation Platform for Indian MSMEs**

CollectFlow bridges accounting platforms (like TallyPrime / ERP 9, Zoho Books) with automated customer follow-ups (WhatsApp, SMS), UPI & payment gateway collections, automated reconciliation, and write-back synchronization.

---

## 🚀 Key Features

- **TallyPrime Synchronization**: Incremental, idempotent sync for customers, ledgers, open invoices, and payment receipts via a dedicated lightweight agent.
- **WhatsApp Follow-up Automation**: Policy-compliant template notifications for pre-due, due-date, and overdue receivables with embedded dynamic UPI payment links.
- **Promise-to-Pay (PTP) Tracking**: Captures and monitors payment commitments with automated workflow pausing and reminder escalation.
- **Confidence-Based Reconciliation**: Auto-matches incoming payments against open invoices (95–100% auto-match, 80–94% approval queue, <80% manual matching).
- **Tally Accounting Write-Back**: Generates and syncs approved receipt vouchers back into Tally with full audit history.
- **Customer 360 & Analytics**: Real-time DSO, aging buckets (`0-30`, `31-60`, `61-90`, `90+` days), collection trends, and broken PTP metrics.

---

## 🛠️ Technology Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Firebase Cloud Functions (v2 HTTPS & Scheduled Jobs)
- **Database & Auth**: Firebase Authentication & Firebase Realtime Database
- **Desktop Agent**: Go / Windows Background Service for Tally communication
- **External Integrations**: Meta WhatsApp Business Cloud API, Razorpay, Cashfree, UPI Intent

---

## ⚙️ Setup & Installation

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and fill in your Firebase and integration credentials:
```bash
cp .env.example .env
```

---

## 🔒 Security & Privacy

Sensitive environment keys (`.env`) and proprietary internal specifications/documentation (`docs/`) are excluded from version control via `.gitignore` to ensure security in public repositories.
