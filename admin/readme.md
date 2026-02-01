@"
# Payment Gateway Management System

Multi-tier payment gateway management platform with support for multiple payment providers.

## 🚀 Features

- **Multi-level User Hierarchy**: Admin → White Label → Master Distributor → Distributor → Retailer
- **Multiple Payment Gateways**: Razorpay, Cashfree, SabPaisa, RunPaisa, PayU
- **BBPS Integration**: Credit card bill fetch and payment
- **Real-time Transactions**: Webhook support with offline fallback
- **Commission Management**: Configurable rates per user level
- **Wallet System**: Automated balance management
- **Admin Panel**: Comprehensive management interface
- **Mobile App**: React Native app for on-the-go access

## 📦 Tech Stack

- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Admin**: Next.js 14, TypeScript
- **Mobile**: React Native (Expo)
- **Database**: SQLite (dev), PostgreSQL (production)

## 🏗️ Project Structure

\`\`\`
├── backend/          # Express API server
├── frontend/         # Next.js web application
├── admin/            # Next.js admin panel
├── mobile/           # React Native mobile app
└── docs/             # Documentation
\`\`\`

## 🔧 Setup

### Prerequisites
- Node.js 20 LTS
- npm or yarn

### Backend Setup
\`\`\`bash
cd backend
npm install
cp .env.example .env
# Update .env with your credentials
npx prisma generate
npx prisma migrate dev
npm run dev
\`\`\`

### Frontend Setup
\`\`\`bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
\`\`\`

### Admin Setup
\`\`\`bash
cd admin
npm install
cp .env.example .env.local
npm run dev
\`\`\`

## 🌐 Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guide.

## 📱 Payment Gateways

- ✅ Razorpay (PAYIN/PAYOUT)
- ✅ Cashfree (PAYIN/PAYOUT)
- ✅ SabPaisa (PAYIN)
- ✅ RunPaisa (PAYOUT)
- ✅ BBPS (Bill Payments)

## 📝 License

Private - All Rights Reserved

## 👨‍💻 Author

Alandi Tech Business Pvt Ltd
"@ | Out-File -FilePath README.md -Encoding utf8

# Commit README
git add README.md
git commit -m "docs: Add comprehensive README"
git push