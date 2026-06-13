# Splitly - Build Plan Document

This document outlines the product research, architectural decisions, AI collaboration process, and trade-offs made during the creation, engineering, and deployment of **Splitly** (a Splitwise clone).

---

## 1. Product Research

### Study of Splitwise
We analyzed the core behavior of Splitwise to identify the minimum viable product (MVP) requirements. Our research focused on the core problem: **how individuals organize shared group transactions and settle debts with minimal friction.**

### Key Discoveries & Learnings
- **Core Ledger Logic**: Splitwise uses a double-entry ledger. For any expense, one user pays the total, and multiple users benefit (owe fractions). Net balances represent the delta between what you paid and what you owe.
- **Simplification of Debts**: Rather than having everyone pay each other individually, a central clearing solver minimizes transactions by matching net debtors directly with net creditors.
- **Social Loop**: Discussing billing issues requires context. Shared expense comments act as a micro-thread for each bill.

### Core Workflows Identified
1. **User Lifecycle**: Account creation -> Joining/Creating groups -> Searching for friends to join.
2. **Expense Lifecycle**: Creating an expense -> Choosing split details -> Live comments discussion -> Settle up / recording payment -> Ledger update.
3. **Settlement Lifecycle**: Identifying pairwise debt -> Recording payment -> Recalculating balances.

### Product Assumptions Made
- **Single Payer**: To keep the database transactions simple, we assumed a single user pays for the entire bill.
- **Group Scope**: We assumed most expenses occur within a group context to keep organization clear (while still supporting individual settlements).
- **Group Membership Integrity**: Splits must only involve users who are currently members of the group.

---

## 2. Architecture

### Tech Stack
- **Frontend**: React (v19) + Vite + Tailwind CSS v4.
- **Backend**: Node.js + Express (REST endpoints) + Socket.io (WebSockets).
- **Database**: PostgreSQL (hosted on Neon Serverless) + Prisma ORM (Type-safe client & migrations).
- **Deployment**: Render Web Services (Backend) and Render Static Sites (Frontend).

### Database Schema
We designed a clean, normalized relational database layout:
- **`users`**: Auth credentials (hashed passwords) and profiles.
- **`groups` & `group_members`**: Organization layers and user roles (admin/member).
- **`expenses` & `expense_splits`**: Relational logs mapping transactions to debt breakdowns.
- **`settlements`**: Payments recorded to reduce debts.
- **`expense_comments`**: Micro-chat logs.

### API Design
- **Authentication**: JWT-based session security under `/api/auth` (signup, login, search, me).
- **Groups**: Member addition, list, and removal under `/api/groups`.
- **Expenses**: Calculation of splits and db-write under single transactions under `/api/expenses`.
- **Settlements**: Balance ledger queries and debt simplification calculations under `/api/settlements`.
- **Comments**: History extraction under `/api/comments`.

### Frontend Structure
- View-based layout router (`App.jsx`) controlling navigation based on session state and group selections.
- Modular component folder structuring containing Navbar, Login, Dashboard, GroupDetails, modals (Expense, Settle).
- Single-instance WebSocket handler (`socket.io-client`) dynamically joining room namespaces when opening bills.

### Deployment Approach
- **Monorepo Separation**: Backend and Frontend directories hosted under the same repo.
- **Platform**: Web servers and Static web targets on Render.
- **Environment Handling**: Environment variable fallbacks built into client configs to allow seamless switching between local development and production.

---

## 3. AI Collaboration Process

### Instruction Workflow
- The user initiated the build by listing features and providing a database string.
- The AI created an **Implementation Plan** and **Task Checklist (`task.md`)** before writing code, checking database parameters first.
- The user approved the plan ("go for it").
- The AI developed the backend routes and the React client concurrently with library installations.

### Challenges & Evolution of the Plan
- **Vite compilation check**: Initial build failed due to a HTML element tag typo (`</</button>`) in `Dashboard.jsx`. Re-compilation resolved this instantly.
- **Peer-Dependency blocks**: Render deployment crashed on client `npm install` because `lucide-react` peer-dependencies were not ready for React 19. The AI resolved this by adding `.npmrc` files enforcing override flags.
- **Rebranding request**: The user requested renaming the project. The AI renamed the repository branding elements to **Splitly** and updated the documentation.
- **Footer update**: User requested credit lines for Prabhat and the AI. The footer was updated to credit both.
- **Database parameters**: The 500 error on Render occurred because `.env` files were correctly git-ignored, meaning Render had no access to the database configuration. The AI instructed the user to define variables on the Render Dashboard and added a `postinstall` script to compile Prisma.

### Maintenance of `AI_CONTEXT.md`
- Created `AI_CONTEXT.md` to summarize project parameters, relational models, prompts, history, and structural details.

---

## 4. Tradeoffs & Simplifications

### What We Simplified
- **Simplified Debts Solver**: We used a greedy matching algorithm ( debtor balances matching creditor balances) to simplify debts. Although not guaranteed to find the absolute mathematically optimal minimal subset of transactions in 100% of complex multi-party edge cases, it resolves debts correctly.
- **State Management**: We used standard React `useState` and `useEffect` state triggers. This kept our bundle light and responsive without adding the complexity of Redux or Zustand.

### What We Hardcoded / Avoided
- **No File Uploads**: Avatars are generated dynamically from names using first-letter icons, avoiding expensive image hosting.
- **No Multi-Payer Splits**: An expense can only be recorded as paid by a single user.

### Future Improvements
- **Email Invites**: Allow inviting users who don't have accounts yet by sending email notifications.
- **Multi-Currency Support**: Support currency conversions in groups (e.g., USD, EUR).
- **Push Notifications**: Use browser notifications to alert users when they are added to a group or tagged in an expense chat.

---

## Final Note
We successfully built a production-ready application called **Splitly**. The repository contains the complete codebase, configurations, `.gitignore` exclusions, deployment builds, and context documentation, ready for GitHub!
