# PaymentGateway - Multi-Level Payment Management Platform

A comprehensive payment gateway management system with multi-level user hierarchy, supporting payin/payout transactions with configurable commission structures.

## 🏗️ Architecture

```
├── backend/          # Node.js + Express API Server
├── frontend/         # Next.js Main Web Application
├── admin/            # Next.js Admin Dashboard (admin.newweb.com)
└── mobile/           # React Native (Expo) Mobile App
```

## ✨ Features

### User Hierarchy
- **Admin** - Full system control, separate login at admin.newweb.com
- **White Label** - Enterprise/Individual top-level partners
- **Master Distributor** - Large-scale distributors
- **Distributor** - Regional distributors
- **Retailer** - End-user transaction initiators

### Core Features
- 🔐 **User Management** - Create users with hierarchical permissions
- 💳 **Multi-PG Support** - Configure multiple payment gateways
- 💰 **Commission System** - Multi-level commission distribution
- 📊 **Schema Management** - Gold, Platinum membership tiers with different rates
- 👛 **Wallet System** - Internal wallet with transfers
- 📱 **KYC Onboarding** - PAN, Aadhaar verification with photo capture
- 🔔 **Email Notifications** - Automated emails for onboarding, approvals, transactions

### Permissions System
- User creation
- Wallet management & transfers
- Schema creation
- PG access control
- User approval
- Transaction initiation (payin/payout)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Setup environment variables
cp config.example.txt .env
# Edit .env with your database and SMTP credentials

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:push

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

Backend runs on `http://localhost:3001`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs on `http://localhost:3000`

### Admin Dashboard Setup

```bash
cd admin

# Install dependencies
npm install

# Start development server
npm run dev
```

Admin Dashboard runs on `http://localhost:3002`

### Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Start Expo
npm start
```

## 📱 Default Credentials

After seeding, use these credentials:

**Admin:**
- Email: `admin@newweb.com`
- Password: `Admin@123456`

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user details
- `PATCH /api/users/:id` - Update user
- `POST /api/users/:id/approve` - Approve/reject user
- `PUT /api/users/:id/permissions` - Update permissions
- `POST /api/users/:id/pg` - Assign PG to user

### Wallet
- `GET /api/wallet` - Get own wallet
- `GET /api/wallet/transactions` - Get wallet transactions
- `POST /api/wallet/transfer` - Transfer funds

### Transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions` - List transactions
- `GET /api/transactions/stats` - Get statistics

### Payment Gateways
- `GET /api/pg` - List payment gateways
- `POST /api/pg` - Create PG (admin)
- `PATCH /api/pg/:id` - Update PG
- `POST /api/pg/:id/toggle` - Enable/disable PG

### Schemas
- `GET /api/schemas` - List schemas
- `POST /api/schemas` - Create schema
- `PUT /api/schemas/:id/rates` - Set PG rates

## 💼 Commission Flow

1. Retailer initiates a payin transaction of ₹10,000
2. PG charges 2% (₹200)
3. Net amount: ₹9,800
4. Commissions distributed up the hierarchy:
   - Distributor earns 0.2% (₹20)
   - Master Distributor earns 0.1% (₹10)
   - White Label earns 0.1% (₹10)
   - Admin earns remaining

## 🎨 Tech Stack

### Backend
- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** JWT with refresh tokens
- **Validation:** Zod

### Frontend & Admin
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **State:** Zustand + React Query
- **Animations:** Framer Motion

### Mobile
- **Framework:** React Native + Expo
- **Navigation:** React Navigation
- **State:** Zustand + React Query

## 📁 Database Schema

### Key Models
- **User** - Multi-role user with hierarchy
- **Wallet** - User wallet with balance
- **WalletTransaction** - Wallet transaction history
- **PaymentGateway** - PG configuration
- **Transaction** - Payin/payout transactions
- **CommissionTransaction** - Commission distribution
- **Schema** - Membership plans (Gold, Platinum)
- **SchemaPGRate** - PG rates per schema

## 🔒 Security

- JWT authentication with short-lived access tokens
- Refresh token rotation
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Helmet.js for HTTP security headers
- CORS configuration
- Input validation with Zod

## 📄 License

MIT License

---

Built with ❤️ for scalable payment solutions

