# CollectFlow — Demo User Accounts & Test Data Directory

This document contains credentials for all demo user roles and a complete directory of the seeded demo dataset in **CollectFlow**.

Live Application URL: **[https://collectflow-320c4.web.app](https://collectflow-320c4.web.app)**  
Firebase Project ID: `collectflow-320c4`  
Database URL: `https://collectflow-320c4-default-rtdb.asia-southeast1.firebasedatabase.app/`

---

## 1. Demo User Accounts (All Roles)

All accounts are pre-created, verified, and mapped to the active demo tenant **Apex Steel & Industrial Supplies Pvt Ltd** (`ten_demo_corp`).

| Role | Name | Email (User ID) | Password | Permissions & Scope |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | Rajesh Singhania | `owner@collectflow.demo` | `CollectFlow@2026` | Full administrative control, billing, user management, integrations, ledger writes, approvals |
| **Admin** | Priya Sharma | `admin@collectflow.demo` | `CollectFlow@2026` | Full accounting & operations administration, team invitations, company settings, reconciliation |
| **Accounts Manager** | Vikram Malhotra | `manager@collectflow.demo` | `CollectFlow@2026` | Day-to-day operations, invoice creation, payment reconciliation approval, WhatsApp reminders |
| **Accounts Executive**| Amit Patel | `executive@collectflow.demo` | `CollectFlow@2026` | Follow-ups, logging manual bank receipts, logging customer PTPs, WhatsApp communications |
| **CA / Partner** | CA Neha Verma | `partner@collectflow.demo` | `CollectFlow@2026` | Read-only ledger, trial balance, customer 360 statements, aging reports, audit history |
| **Viewer / Auditor** | Suresh Reddy | `viewer@collectflow.demo` | `CollectFlow@2026` | Read-only access to receivables dashboard, customer directory, and reports |

---

## 2. Demo Company Profile

- **Company Name**: Apex Steel & Industrial Supplies Pvt Ltd
- **Tenant ID**: `ten_demo_corp`
- **GSTIN**: `27AAACA1234A1Z5`
- **PAN**: `AAACA1234A`
- **Official Email**: `finance@apexsteel.com`
- **Mobile**: `+919820011221`
- **Collection Bank**: HDFC Bank - Collections Account (`apexsteel@hdfcbank`)
- **Tally Integration**: Connected (`ONLINE` via Agent `dev_win_agent_01`, TallyPrime 4.1 on `127.0.0.1:9000`)

---

## 3. Seeded Demo Data Inventory

### 3.1 Customers (Customer 360 Directory)
| Customer Name | Contact Person | Mobile | Total Receivable | Overdue Balance | Credit Limit | Payment Terms | Risk Tier |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Bharat Infrastructure & Projects** | Mahesh Deshmukh | `+919820112233` | ₹4,80,000 | ₹1,80,000 | ₹6,00,000 | Net 30 | Medium |
| **Shree Cement & Building Materials**| Dinesh Agarwal | `+919830223344` | ₹3,50,000 | ₹3,50,000 | ₹3,00,000 | Net 15 | **Critical (Limit Exceeded)** |
| **Kalyan Industrial Works** | Kalyan Sundaram | `+919840334455` | ₹2,40,000 | ₹0 | ₹5,00,000 | Net 45 | Low (Prompt Payer) |
| **Delhi Metro Hardware Traders** | Sanjay Gupta | `+919811445566` | ₹2,90,000 | ₹1,40,000 | ₹4,00,000 | Net 30 | **High (Broken PTP)** |
| **Bangalore Precision Machinery** | Venkat Rao | `+919880556677` | ₹5,50,000 | ₹2,50,000 | ₹5,00,000 | Net 30 | **Critical (>90d Overdue)** |

### 3.2 Invoices Across Aging Buckets
| Invoice # | Customer | Amount | Due Date | Overdue Days | Aging Bucket | Status | UPI Intent |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `INV-2026-0101` | Kalyan Industrial Works | ₹2,40,000 | 2026-10-20 | 0 | `CURRENT` | `OPEN` | Active UPI Link |
| `INV-2026-0102` | Bharat Infrastructure & Projects | ₹1,80,000 | 2026-09-09 | 15 days | `1-30` | `OVERDUE` | Active PTP (`ptp_demo_01`) |
| `INV-2026-0103` | Bharat Infrastructure & Projects | ₹3,00,000 | 2026-10-01 | 0 | `CURRENT` | `DUE_SOON` | Active UPI Link |
| `INV-2026-0104` | Delhi Metro Hardware Traders | ₹1,40,000 | 2026-08-14 | 41 days | `31-60` | `OVERDUE` | Broken PTP (`ptp_demo_02`) |
| `INV-2026-0105` | Delhi Metro Hardware Traders | ₹1,50,000 | 2026-09-19 | 5 days | `1-30` | `OVERDUE` | Active UPI Link |
| `INV-2026-0106` | Shree Cement & Building Materials | ₹2,00,000 | 2026-07-10 | 76 days | `61-90` | `OVERDUE` | Escalated Reminder Sent |
| `INV-2026-0107` | Shree Cement & Building Materials | ₹1,50,000 | 2026-08-04 | 51 days | `31-60` | `OVERDUE` | Active UPI Link |
| `INV-2026-0108` | Bangalore Precision Machinery | ₹2,50,000 | 2026-06-09 | 107 days | `90+` | `OVERDUE` | High Risk Escalation |
| `INV-2026-0109` | Bangalore Precision Machinery | ₹3,00,000 | 2026-08-31 | 24 days | `1-30` | `OVERDUE` | Active UPI Link |

### 3.3 Payments & Receipts
| Payment ID | Customer | Amount | Source | UTR / Reference | Status | Reconciliation State |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pay_demo_01` | Kalyan Industrial Works | ₹2,00,000 | Razorpay | `UTR-HDFC-99221100` | `SUCCESS` | `FULLY_MATCHED` (Auto-reconciled) |
| `pay_demo_02` | Bharat Infrastructure & Projects | ₹1,50,000 | Tally Bank | `AXIS-NEFT-883344` | `SUCCESS` | `FULLY_MATCHED` (Tally Synced) |
| `pay_demo_03` | Delhi Metro Hardware Traders | ₹75,000 | UPI QR | `UPI-ICICI-774411` | `SUCCESS` | `PARTIALLY_MATCHED` (₹25k open) |
| `pay_demo_04` | Direct Payer / Unlinked | ₹1,00,000 | Razorpay | `UTR-SBIN-556677` | `SUCCESS` | `UNMATCHED` (Ready to Split) |

### 3.4 Promise to Pay (PTP) Commitments
- `ptp_demo_01`: Bharat Infrastructure & Projects — **₹1,80,000** promised by `2026-09-28` (`PENDING`, active pause on automated reminders).
- `ptp_demo_02`: Delhi Metro Hardware Traders — **₹1,40,000** promised by `2026-09-15` (`BROKEN`, marked broken upon maturity).
- `ptp_demo_03`: Kalyan Industrial Works — **₹2,00,000** (`KEPT`, matched with payment `pay_demo_01`).

### 3.5 Reconciliations & Tally Voucher Write-Back Queue
- `rec_demo_01`: **₹2,00,000** allocated to `INV-2026-0090` (100% confidence, `AUTO_RECONCILED`, Tally Receipt Voucher `RC-2026-1042` marked `SYNCED`).
- `rec_demo_02`: **₹1,50,000** allocated to `INV-2026-0085` (95% confidence, `APPROVED` by Priya Sharma, Tally Receipt Voucher `RC-2026-0988` marked `SYNCED`).
- `cmd_demo_01`: Queue command under `/tallyVoucherCommands/ten_demo_corp` processed and synced with Tally.

### 3.6 WhatsApp Communication Logs
- `msg_demo_01`: Outbound reminder to Bharat Infrastructure & Projects (`+919820112233`) — Status: `REPLIED`.
- `msg_demo_02`: Missed promise notice to Delhi Metro Hardware Traders (`+919811445566`) — Status: `READ`.

---

## 4. Verification & Testing Guide

1. Navigate to **[https://collectflow-320c4.web.app](https://collectflow-320c4.web.app)**.
2. Sign in using any of the accounts above (e.g. `owner@collectflow.demo` / `CollectFlow@2026`).
3. You will immediately land on the **Receivables Overview Dashboard** pre-loaded with:
   - **Total Receivables**: ₹19,00,000
   - **Overdue Balance**: ₹13,60,000
   - **DSO**: 38 Days
   - **Aging Distribution**: Current, 1-30, 31-60, 61-90, 90+
4. Explore key sections:
   - **Invoices & Aging** (`/invoices`): Filter by Quick Aging Tabs (Current, 1-30, 31-60, 61-90, 90+), open UPI payment modal.
   - **Customers 360** (`/customers`): Click any customer to open their 360 modal (Financial Overview, Invoices, Payments, PTPs, WhatsApp Logs, Reconciliations, and printable Statement of Account).
   - **Payments & UPI** (`/payments`): View incoming payments, simulate a Razorpay webhook or record a manual bank receipt.
   - **Reconciliation Engine** (`/reconciliation`): View pending approvals, perform manual bill split allocation, or trigger simulated Tally Windows Agent sync.
   - **Collection Intelligence** (`/analytics`): View DSO, Collection Efficiency Index (CEI), portfolio risk breakdown, and prioritized follow-up queue with transparent scoring factors.
   - **WhatsApp Reminders** (`/reminders`): Run automated sequence evaluation and log customer PTPs.
   - **Settings & Sync** (`/settings`): View Windows Agent heartbeat and simulation controls.
