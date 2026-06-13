# Splitly 💸

Splitly is a fully responsive, modern expense-sharing and bill-splitting web application (Splitwise clone). It helps friends, roommates, and travel buddies track group expenses, calculate balances, chat in real-time about shared bills, and settle debts efficiently using a transaction minimization solver.

Built by **Prabhat and his pair programmer**.

---

## 🚀 Key Features

- **Relational Database Design**: Data modeled using Prisma ORM with constraints for users, groups, memberships, expenses, splits, settlements, and chat messages on a Neon PostgreSQL server.
- **Robust Split Calculations**: Supports splitting bills in multiple ways:
  - **Equally**: Divides total amount among participants (auto-handles penny rounding).
  - **Unequally**: Explicit decimal splits with sum validation.
  - **By Percentage**: Split by defined percentages (sum must equal 100%).
  - **By Share**: Split proportionally based on numeric shares (e.g., 1.5, 2, etc.).
- **Simplify Debts (Greedy Solver)**: Implementation of a transaction-minimization solver that computes the most efficient transactions needed to settle up a group.
- **Real-Time Expense Chats**: Live commenting board inside expense detail panels, powered by WebSockets (`Socket.io`) and persisted in the database.
- **Premium Glassmorphic UI**: Beautiful responsive dashboard built using React, Vite, and Tailwind CSS v4 with smooth transitions, dark-theme layout, and status indicators.
- **Secure JWT Authentication**: Sign up and login modules with password hashing using `bcryptjs` and session tokens.

---

## 📁 Project Directory Structure

```
splitwise-clone/                    # Root project directory
├── client/                         # Frontend Application (React + Vite + Tailwind CSS)
│   ├── public/                     # Static assets (favicons, manifest, etc.)
│   ├── src/
│   │   ├── assets/                 # SVGs, images, and visual components
│   │   ├── components/             # Reusable React UI components
│   │   │   ├── Dashboard.jsx       # User balances overview, metrics cards, and group list
│   │   │   ├── ExpenseModal.jsx    # Add expense dialog with split calculations (equal/unequal/percentage/share)
│   │   │   ├── GroupDetails.jsx    # Group ledger, suggested settlements, and real-time chat drawer
│   │   │   ├── Login.jsx           # Clean glassmorphic Auth switcher (Login/Register)
│   │   │   ├── Navbar.jsx          # Header navigation showing logo and active user profile
│   │   │   └── SettleModal.jsx     # Recording payments and debt resolution dialog
│   │   ├── utils/
│   │   │   └── api.js              # Fetch client wrapper with JWT token insertion
│   │   ├── App.jsx                 # Core routing, view switcher, and auth state management
│   │   ├── index.css               # Global Tailwind CSS v4 setup and body base styles
│   │   └── main.jsx                # Vite mounting entry point
│   ├── index.html                  # HTML template with SEO metadata
│   ├── package.json                # Frontend package dependencies (react, router, socket.io-client)
│   └── vite.config.js              # Vite config including Tailwind CSS v4 compiler
│
└── server/                         # Backend Application (Node.js + Express + WebSockets)
    ├── middleware/
    │   └── auth.js                 # JWT validation and user identity injection middleware
    ├── prisma/
    │   └── schema.prisma           # Prisma ORM Schema defining User, Group, Expense, Split, and Chat models
    ├── routes/                     # Express REST Router handlers
    │   ├── auth.js                 # Sign-up, Login, and Search endpoints
    │   ├── comments.js             # Historical comments fetcher inside expenses
    │   ├── expenses.js             # Expense creation and custom split calculator
    │   ├── groups.js               # Group CRUD and membership administration
    │   └── settlements.js          # Recording payments and greedy simplified debt calculations
    ├── db.js                       # Singleton instance helper for Prisma Client connection
    ├── package.json                # Backend dependencies (express, prisma, socket.io, jsonwebtoken, pg)
    ├── server.js                   # Application bootstrap integrating HTTP Server, Socket.io, and REST routes
    ├── socket.js                   # WebSocket connection handling, rooms, and real-time messaging
    └── .env                        # Local secrets configuration (DATABASE_URL, JWT_SECRET, PORT)
```

---

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v18+ recommended)
- Neon / PostgreSQL Connection URL

### 1. Database & Server Setup
1. Open a terminal and navigate to the `server/` directory:
   ```bash
   cd server
   ```
2. Install the package dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `server/` directory and configure your variables:
   ```env
   DATABASE_URL="your_postgresql_connection_string"
   PORT=5000
   JWT_SECRET="your_jwt_signing_secret"
   ```
4. Sync the schema database migrations with Prisma:
   ```bash
   npx prisma db push
   ```
5. Start the backend development server:
   ```bash
   npm run dev
   ```
   *The server will run on `http://localhost:5000`.*

### 2. Client Setup
1. Open a new terminal window and navigate to the `client/` directory:
   ```bash
   cd client
   ```
2. Install frontend dependencies (ignoring peer-conflicts with React 19/Lucide):
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the client Vite server:
   ```bash
   npm run dev
   ```
   *The application UI will run on `http://localhost:5173`.*

---

## 🧪 Tech Stack Summary

- **Frontend**: React (v19), Vite, Tailwind CSS (v4), Lucide React (Icons), Socket.io Client.
- **Backend**: Node.js, Express, Socket.io (WebSockets), JSONWebTokens (JWT), BcryptJS.
- **Database**: PostgreSQL (Neon Serverless), Prisma ORM Client.
