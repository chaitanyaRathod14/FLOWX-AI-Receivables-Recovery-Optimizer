# FLOWX

### AI-Powered Receivables Recovery and Optimization

FLOWX is an AI-powered receivables recovery platform designed to help businesses identify payment risks, understand customer payment behavior, prioritize invoices, and choose the most appropriate recovery action.

Instead of treating every overdue invoice the same way, FLOWX analyzes invoice and customer behavior to answer three key questions:

- **Who** should be prioritized?
- **Why** is the payment at risk?
- **What** action should be taken next?

The goal is to help businesses improve cash flow, reduce collection effort, and make data-driven recovery decisions.

---

## Live Demo

Try the deployed application:

**[flowx-ai-receivables-recovery-optim.vercel.app](https://flowx-ai-receivables-recovery-optim.vercel.app/register)**

The application includes:

- User registration and authentication
- Receivables dashboard
- Invoice management
- Payment risk analysis
- Customer behavior analysis
- Recovery recommendations
- Recovery simulation
- Promise-to-pay tracking
- Approval-based recovery workflow
- Analytics and cash intelligence
- Audit logs
- Multi-tenant merchant accounts

> **Note:** The demo backend uses ephemeral storage. If newly registered accounts appear reset after a period of inactivity, please use the seeded demo credentials or register again.

---

## Problem Statement

Businesses often have a significant amount of money tied up in unpaid or delayed invoices.

Traditional receivables systems generally focus on:

- Listing overdue invoices
- Sending payment reminders
- Tracking outstanding amounts
- Basic collection follow-ups

However, these systems often do not answer:

- Which customer is most likely to delay payment?
- How serious is the payment risk?
- What factors are contributing to the risk?
- Which recovery strategy is most suitable?
- How reliable has the customer's previous payment behavior been?

As the number of customers and invoices increases, manually making these decisions becomes difficult and time-consuming.

FLOWX addresses this problem by combining invoice data, payment behavior, risk analysis, and recovery strategies into a single platform.

---

## Solution

FLOWX converts receivables data into actionable recovery decisions.

Instead of simply showing that an invoice is overdue, FLOWX attempts to determine:

1. Which invoices require attention
2. The risk associated with each invoice
3. The customer's historical payment behavior
4. The factors contributing to the risk
5. The recovery strategies that can be considered
6. The expected recovery from each strategy
7. Which strategy provides the best expected outcome

This allows businesses to move from reactive collections to more intelligent and prioritized recovery.

---

## Key Features

### 1. Intelligent Receivables Dashboard

The dashboard provides an overview of the business receivables portfolio, including:

- Total receivables
- Cash recovered
- At-risk amount
- Promise-to-pay performance
- Risk distribution
- Recovery trends
- Pending recovery actions

### 2. Invoice Risk Analysis

FLOWX analyzes individual invoices and assigns a risk tier. The system provides:

- Risk tier
- Risk probability
- Predicted payment delay
- Outstanding amount
- Overdue days
- Risk drivers

### 3. Customer Payment Behavior

FLOWX analyzes historical customer behavior to provide insights such as:

- Average payment delay
- Late payment rate
- Number of invoices
- Promise-to-pay reliability
- Customer payment patterns

### 4. Recovery Strategy Recommendation

For each recovery case, FLOWX evaluates different strategies, such as:

- Payment link reminder
- Promise-to-pay
- Escalation and commitment

Each strategy can include expected recovery, expected recovery time, confidence score, discount information, and approval requirements. FLOWX then recommends a strategy based on the expected recovery outcome.

### 5. Recovery Simulation

Users can simulate different recovery strategies before taking action. The simulator compares:

- Expected recovery amount
- Number of days
- Strategy confidence
- Customer/invoice risk

### 6. Promise-to-Pay Management

FLOWX allows businesses to record and track customer payment commitments, including committed amount, promised payment date, notes, and promise status.

### 7. Approval-Based Recovery Workflow

Recovery actions follow a controlled workflow:

1. Recovery action is generated
2. Action is reviewed
3. Action is approved
4. Action is executed

### 8. Analytics and Cash Intelligence

The analytics section provides insights into recovery performance, recovered cash, risk-tier performance, recovery improvement, DSO reduction, promise performance, and ROI-related metrics.

### 9. Audit Logs

FLOWX maintains audit records for important system activities, including recovery approvals, recovery execution, payments, policy changes, and demo runs.

### 10. Multi-Tenant User Management

Each registered merchant gets an isolated workspace. Registering a new merchant creates a merchant account, a user account, default policies, and tenant-specific data — allowing different businesses to use the platform independently while keeping their data isolated.

---

## FLOWX vs Traditional Receivables Systems

| Capability | Traditional Approach | FLOWX |
|---|---|---|
| Invoice tracking | Yes | Yes |
| Overdue invoice identification | Yes | Yes |
| Payment reminders | Yes | Yes |
| Payment risk analysis | Limited | Yes |
| Customer behavior analysis | Limited | Yes |
| Risk drivers | Usually unavailable | Yes |
| Predicted payment delay | Usually unavailable | Yes |
| Recovery strategy recommendation | Manual | Automated |
| Recovery simulation | Usually unavailable | Yes |
| Promise-to-pay tracking | Basic | Yes |
| Approval-based recovery | Limited | Yes |
| Recovery analytics | Basic | Advanced |
| Audit trail | Varies | Yes |
| Multi-tenant architecture | Varies | Yes |

The main difference is that FLOWX is designed to move from:

> "Who has not paid?"

to:

> "Who should we prioritize, why are they at risk, and what should we do next?"

---

## Application Workflow

```
Invoice Data
     |
     v
Risk Analysis
     |
     v
Customer Behavior Analysis
     |
     v
Risk Drivers
     |
     v
Recovery Strategy Evaluation
     |
     v
Recommended Action
     |
     v
Approval
     |
     v
Recovery Execution
     |
     v
Outcome & Analytics
```

---

## Project Structure

```
FLOWX/
├── app/
│   ├── login/
│   ├── register/
│   ├── invoices/
│   ├── recovery/
│   ├── promises/
│   ├── analytics/
│   ├── intelligence/
│   ├── audit-log/
│   ├── settings/
│   └── system-health/
│
├── components/
│   └── Reusable UI components
│
├── lib/
│   └── api.ts
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   └── supabase_schema.sql
│   └── requirements.txt
│
├── proxy.ts
├── package.json
├── .env.example
└── README.md
```

---

## Technology Stack

**Frontend**
- Next.js
- React
- TypeScript
- Tailwind CSS
- Next.js Middleware / Proxy-based route protection

**Backend**
- Python
- FastAPI
- Uvicorn
- PyJWT
- Pydantic

**Database**
- PostgreSQL
- Supabase
- SQLite compatibility during migration/development

**Authentication**
- JWT-based authentication
- Secure password authentication
- Protected API endpoints
- Tenant-aware authorization

**Deployment**
- Vercel for frontend deployment
- Render for backend deployment
- Supabase PostgreSQL for persistent database storage

---

## API Reference

```
POST   /auth/register
POST   /auth/login

GET    /dashboard

GET    /invoices
POST   /invoices
POST   /invoices/import

GET    /recovery
POST   /recovery/{id}/approve
POST   /recovery/{id}/execute
GET    /recovery/{id}/simulate

GET    /promises
POST   /promises

GET    /analytics
GET    /intelligence

GET    /audit-logs

GET    /policies
PUT    /policies

POST   /demo/run
```

---

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- Python 3.10+
- A Supabase project (or local PostgreSQL/SQLite for development)

### Frontend Setup

```bash
git clone https://github.com/<your-username>/FLOWX.git
cd FLOWX
npm install
cp .env.example .env.local
npm run dev
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

---

## License

This project is available for portfolio and demonstration purposes. Please reach out for licensing or collaboration inquiries.

---

## Author

**Chaitanya**
MERN Stack Developer | B.Tech IT, VIT Pune
