#!/bin/bash
# Production Deployment Script for VPS (72.61.254.18)
# Usage: Run this script on the VPS after pulling from git

set -e  # Exit on error

echo "🚀 Starting production deployment..."

# Navigate to project directory
cd /var/www/payment-gateway

echo "📦 Pulling latest changes from git..."
git stash  # Stash any local changes
git pull origin main

# Backend deployment
echo "🔧 Setting up backend..."
cd backend

# Ensure production environment variables
if [ ! -f .env ]; then
    echo "⚠️  Creating .env from example..."
    cp env-example.txt .env
    echo "⚠️  IMPORTANT: Update .env with production credentials!"
fi

# Install dependencies if package.json changed
npm install

# Apply database migrations
echo "📊 Applying database migrations..."
npx prisma generate
npx prisma db push

cd ..

# Admin panel deployment
echo "🎨 Building admin panel..."
cd admin

# Ensure production environment
if [ ! -f .env.production ]; then
    echo "NEXT_PUBLIC_API_URL=https://pay.alandi.in/api" > .env.production
fi

# Install dependencies and build
npm install
rm -rf .next  # Clear build cache
npm run build

cd ..

# Frontend deployment (if needed)
echo "🌐 Building frontend..."
cd frontend
npm install
rm -rf .next
npm run build

cd ..

# Restart all services
echo "♻️  Restarting services with PM2..."
pm2 restart backend
pm2 restart admin
pm2 restart frontend

# Show status
echo "✅ Deployment complete!"
pm2 status
pm2 logs --lines 20 --nostream

echo ""
echo "📝 Post-deployment checklist:"
echo "  1. Verify .env files have correct production credentials"
echo "  2. Check logs: pm2 logs backend"
echo "  3. Test admin panel: https://admin.pay.alandi.in"
echo "  4. Test frontend: https://pay.alandi.in"
