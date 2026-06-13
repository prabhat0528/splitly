# Splitly - AI Context Document

This document serves as the comprehensive record of the context, decisions, architecture, and evolution of the **Splitly** application. It is created and maintained to capture the end-to-end design and implementation details.

---

## 1. Product Understanding
**Splitly** is a reverse-engineered clone of Splitwise, focusing on the core problem of tracking and sharing expenses among groups of people (e.g., roommates, travel companions, friends).
- **Core Value Proposition**: Eliminates the social awkwardness and complexity of tracking who owes whom what, providing mathematical clarity, suggesting minimal transactions for settling debts, and facilitating discussion over specific shared bills.

---

## 2. Product Scope
- **User Authentication**: Secure sign up, log in, session persistence, and user search features.
- **Group Management**: Group creation, member invitation (search and add), member removal.
- **Expense Management**:
  - Multiple split methods: Equal splits, unequal (exact amount) splits, percentage splits, and share-based splits.
  - Penny-rounding adjustment to prevent balance discrepancies.
- **Real-Time Group Communication**: Chat room for each individual expense to discuss billing details, saving historical messages in the database.
- **Ledger & Balances**:
  - Individual overall balance tracking (Net Balance, total owed, total owing).
  - Group-specific member ledger.
  - **Greedy transaction minimization solver** to simplify debt settlement.
- **Debt Resolution**: Logging payments and settlements to decrease debt levels.

---

## 3. Implementation Decisions & Architecture
- **Single Page App (SPA)**: Built using React with a view-based router in `App.jsx` to keep the user experience seamless, eliminating the need for full page refreshes.
- **Hybrid Real-Time Backend**: A unified Node.js Express server hosting a REST API for standard transactions alongside a Socket.io WebSocket server.
- **Relational Integrity**: A PostgreSQL server hosting tables with explicit foreign keys to guarantee relational consistency (e.g., deleting an expense cascade-deletes its splits and comments).
- **Prisma Client Generation**: Generating database clients dynamically via post-install triggers on deployment platforms to support native Linux runtimes.

---

## 4. Engineering Requirements
- **Responsive Layout**: Designed with fluid layouts and breakpoints (mobile-first principles) to ensure usability across mobile devices, tablets, and desktops.
- **Socket Rooms**: Isolation of chat messages by scope using room joining (`expense_${id}`).
- **Transaction Simplification**: Greedy matching of the largest debtors with the largest creditors to reduce transaction counts.

---

## 5. Tech Stack
- **Frontend**: React (v19), Vite (v6), Tailwind CSS (v4), Socket.io-Client, Lucide React (Icons).
- **Backend**: Node.js, Express (REST API), Socket.io (WebSockets), JSONWebTokens (JWT), BcryptJS.
- **Database**: PostgreSQL (hosted on Neon Serverless), Prisma ORM (Database query building & sync).

---

## 6. Database Schema (Prisma)
```prisma
model User {
  id            Int              @id @default(autoincrement())
  email         String           @unique
  passwordHash  String           @map("password_hash")
  name          String
  createdAt     DateTime         @default(now()) @map("created_at")
  memberships   GroupMember[]
  groupsCreated Group[]          @relation("GroupCreator")
  expensesPaid  Expense[]        @relation("ExpensePayer")
  splits        ExpenseSplit[]
  sentPayments  Settlement[]     @relation("PaymentSender")
  receivedPayments Settlement[]  @relation("PaymentReceiver")
  comments      ExpenseComment[]
}

model Group {
  id          Int           @id @default(autoincrement())
  name        String
  description String?
  createdById Int           @map("created_by")
  createdAt   DateTime      @default(now()) @map("created_at")
  creator     User          @relation("GroupCreator", fields: [createdById], references: [id])
  members     GroupMember[]
  expenses    Expense[]
  settlements Settlement[]
}

model GroupMember {
  groupId  Int      @map("group_id")
  userId   Int      @map("user_id")
  role     String   @default("member")
  joinedAt DateTime @default(now()) @map("joined_at")
  group    Group    @relation(fields: [groupId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([groupId, userId])
}

model Expense {
  id          Int              @id @default(autoincrement())
  groupId     Int?             @map("group_id")
  description String
  amount      Decimal          @db.Decimal(12, 2)
  paidById    Int              @map("paid_by")
  date        DateTime         @default(now())
  splitType   String           @default("EQUAL") @map("split_type")
  createdAt   DateTime         @default(now()) @map("created_at")
  group       Group?           @relation(fields: [groupId], references: [id], onDelete: Cascade)
  payer       User             @relation("ExpensePayer", fields: [paidById], references: [id], onDelete: Cascade)
  splits      ExpenseSplit[]
  comments    ExpenseComment[]
}

model ExpenseSplit {
  expenseId       Int      @map("expense_id")
  userId          Int      @map("user_id")
  owedAmount      Decimal  @map("owed_amount") @db.Decimal(12, 2)
  shareValue      Decimal? @map("share_value") @db.Decimal(12, 2)
  percentageValue Decimal? @map("percentage_value") @db.Decimal(12, 2)
  expense         Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@id([expenseId, userId])
}

model Settlement {
  id           Int      @id @default(autoincrement())
  groupId      Int?     @map("group_id")
  fromUserId   Int      @map("from_user_id")
  toUserId     Int      @map("to_user_id")
  amount       Decimal  @db.Decimal(12, 2)
  date         DateTime @default(now())
  createdAt    DateTime @default(now()) @map("created_at")
  group        Group?   @relation(fields: [groupId], references: [id], onDelete: Cascade)
  fromUser     User     @relation("PaymentSender", fields: [fromUserId], references: [id], onDelete: Cascade)
  toUser       User     @relation("PaymentReceiver", fields: [toUserId], references: [id], onDelete: Cascade)
}

model ExpenseComment {
  id        Int      @id @default(autoincrement())
  expenseId Int      @map("expense_id")
  userId    Int      @map("user_id")
  message   String
  createdAt DateTime @default(now()) @map("created_at")
  expense   Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 7. API Design
- **Auth Routes (`/api/auth`)**:
  - `POST /register`: Registers user, hashes password, returns JWT token.
  - `POST /login`: Validates password, returns JWT token.
  - `GET /search?q=...`: Finds users (authed only).
  - `GET /me`: Returns details of current authenticated user.
- **Group Routes (`/api/groups`)**:
  - `GET /`: Lists all groups current user belongs to.
  - `POST /`: Creates group and sets creator as admin.
  - `GET /:id`: Retrieves group members, ledger details, and expense logs.
  - `POST /:id/members`: Invites/adds a member to the group.
  - `DELETE /:id/members/:userId`: Removes member from group.
- **Expense Routes (`/api/expenses`)**:
  - `POST /`: Creates expense, processes calculations (splits), writes to database under a single database transaction.
  - `GET /:id`: Fetches expense description, splits, and comments.
  - `DELETE /:id`: Deletes expense transaction.
- **Settlement Routes (`/api/settlements`)**:
  - `POST /`: Logs a settlement between two users.
  - `DELETE /:id`: Reverts a settlement transaction.
  - `GET /balances`: Retrieves overall individual balance totals.
  - `GET /groups/:groupId/balances`: Computes group ledger balances and suggests simplified settlements.
- **Comment Routes (`/api/comments`)**:
  - `GET /expense/:expenseId`: Gets expense chat board log.

---

## 8. Frontend Structure
- **Navbar Component**: Houses styling branding, user badge info, and logout capabilities.
- **Login Component**: Unified screen dealing with credential submission, register state toggling, and input validation.
- **Dashboard Component**: Contains Net Balance stats blocks, list of groups, overall friends balance summaries, and a quick group creation modal.
- **GroupDetails Component**: Main working area containing ledger list, user invitation inputs, suggested settlements solver list, payment modals, and the Socket.io live chat drawer.
- **Modals (Expense / Settle)**: Dedicated sub-forms ensuring inputs validity (e.g. checkbox state count, custom input sums equating to total amount) before dispatching requests.

---

## 9. Deployment Plan
- **Frontend**: Deployed on Render Static Sites hosting the Vite built `dist/` directory assets.
- **Backend**: Deployed on Render Web Service running a persistent Node.js environment.
- **Database**: PostgreSQL hosted on Neon Serverless database cluster.
- **Build Configurations**: Enforced `.npmrc` legacy flags to guarantee installation flow on platforms without local script flags.

---

## 10. Testing Plan
- **Functional Validation**:
  - Test signup, login, search, and group creation flows.
  - Add expense with EQUAL split (verify division logic).
  - Add expense with UNEQUAL split (verify validation errors when total sum doesn't match).
  - Add expense with PERCENTAGE split (verify percentage sum validator at 100%).
  - Add expense with SHARE split (verify proportional split logic).
- **Socket Connectivity**: Open multiple client browser sessions in incognito windows, post messages, and verify real-time, order-preserved comment rendering.
- **Settlement Math**: Record payments, check if group-wise balances subtract appropriately, and verify that suggested settlements simplify correctly.

---

## 11. Trade-offs
1. **Socket.io vs. HTTP Long Polling**: Chosen Socket.io. Although WebSockets are sometimes blocked by intermediate proxies, they provide immediate, real-time feedback with lower server overhead than repeated HTTP polling.
2. **Neon serverless pg vs. SQLite**: Selected Neon serverless pg to fulfill the core requirement of using a relational database suitable for distributed deployments, rather than local disk-dependent SQLite databases.
3. **ORM (Prisma) vs. Pure SQL Queries**: Selected Prisma. While pure SQL queries offer slightly lower overhead, Prisma provides compile-time type-safety, automatic migration syncing (`db push`), and readable relation inclusions, speeding up development.

---

## 12. Key Prompts & AI Responses
- **Initial Setup**: Request to reverse-engineer Splitwise. Response was database modeling, implementation architecture, and creation of `task.md` checklists.
- **Rebranding Request**: Request to rename Splitwise to something related. Response was rename-verification and rebranding of UI files, footer credits, configurations, and walkthrough documents.
- **Render Build Error**: Lucide-react conflict with React 19. Response was creation of `.npmrc` files enforcing peer-dependency overrides automatically.

---

## 13. Changes Made During Implementation
- Rebranded application from **Splitwise** to **Splitly**.
- Configured client `api.js` and `GroupDetails.jsx` to dynamically switch between environment API urls and deployed Render backend urls.
- Overwrote client/server `package.json` configurations to enable `.npmrc` automated build flags.
- Altered footer credits in `client/src/App.jsx` to "Built by Prabhat and his pair programmer".

---

## 14. Known Limitations
- **Socket.io Fallbacks**: On certain free-tier deployments, Render may block WebSockets or delay connections, prompting Socket.io to fall back to HTTP polling.
- **Session Expiration**: Token validity is set to 7 days; session renewal triggers are not fully automated.
- **Profile Avatars**: Render defaults to the first letter of user names; custom image upload is not currently implemented.
