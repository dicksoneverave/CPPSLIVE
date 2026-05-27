# CPPS 2026: Comprehensive System Manual

## 1. Executive Summary
CPPS 2026 is an enterprise-grade Compensation Processing & Payment System designed to streamline the lifecycle of corporate and public insurance claims. The system integrates multiple stakeholders—including claimants, employers, insurance providers, legal counsel (Solicitor General), and judicial bodies (Tribunal)—into a unified digital workflow.

---

## 2. Technical Architecture

### Frontend
- **Framework**: React 18+ with Vite.
- **Routing**: Client-side routing using `react-router-dom` (HashRouter).
- **Styling**: Tailwind CSS for responsive and consistent UI.
- **Icons**: Lucide React for industry-standard iconography.
- **State Management**: Built-in React Context (`AuthContext`) for security and session state.

### Backend (BaaS)
- **Engine**: Supabase (PostgreSQL).
- **Authentication**: JWT-based role authentication managed via Supabase Auth.
- **Service Layer**: Centralized `supabase.ts` client for all CRUD operations.
- **File Storage**: Supabase Storage buckets for claim attachments (Medical, Police, and Employer reports).

---

## 3. Persona & Access Directory

The system implements a robust **Role-Based Access Control (RBAC)** model. Users are mapped to specific "Groups" that dictate their dashboard view and functional permissions.

| Category | Primary Personas | Key Responsibilities |
| :--- | :--- | :--- |
| **Intake** | Data Entry, Claimant, Employer | Initial claim submission and document upload. |
| **Review** | Claims Officer (CPO), Registrar | Regional verification and statutory compliance. |
| **Adjudication** | Tribunal Clerk, Commissioner | Legal hearings, outcomes, and award approvals. |
| **External** | Insurance Provider, Solicitor General | Stakeholder responses and legal reviews. |
| **Finance** | Payment Section, Finance Manager | Disbursement of awards and financial reporting. |
| **Oversight** | Admin, SuperAdmin, Statistics | User management and global analytics. |

---

## 4. End-to-End Claim Workflow

```mermaid
graph LR
    A[Entry] --> B[CPO Review]
    B --> C[Manager Appr]
    C --> D[Stakeholder Resp]
    D --> E[Tribunal Hearing]
    E --> F[Worker Decision]
    F --> G[Finance/Pay]
```

### 1. Claim Registration & Submission
Claims are entered into the system via **Data Entry** or submitted by **Employers/Insurance Providers**. The system validates mandatory documentation (Medical and Police reports).

### 2. Administrative Review
Regional **Claims Officers (CPO)** perform the first-level review. They calculate preliminary compensation using the built-in `CompensationCalculation` engine.

### 3. Stakeholder Notification (Form 6/Form 7)
The system generates formal notifications to Employers and Insurance Companies. Their responses are captured directly within their dedicated dashboards, updating the claim status in real-time.

### 4. Judicial Processing (Tribunal)
Contested claims or claims requiring formal approval are forwarded to the **Tribunal**. This involving scheduling hearings, recording outcomes, and managing the Form 18 notification pipeline.

### 5. Award Finalization (Worker Response)
Once a decision is approved, the **Worker** must formally accept the award. This is the final statutory checkpoint before payment.

### 6. Payment Processing
The **Payment Section** reviews all accepted awards and generates payment instructions for the **Finance Department**.

---

## 5. Security & Operation Standards

- **Session Security**: Protected routes ensure that only authorized roles can access specific dashboards.
- **Data Integrity**: Real-time status updates prevent concurrent editing conflicts and stale data.
- **Background Processes**: Dashboards implement 30-second heartbeats to keep metric counters up-to-date with background database activities.

---

## Appendix: Core Data Entities

- `form1112master`: The primary record for all Injury/Death claims.
- `owcstaffmaster`: User-to-Region mapping table.
- `tribunalhearingoutcome`: The source of truth for all judicial decisions.
- `currentemploymentdetails`: Mapping workers to their respective employers.
