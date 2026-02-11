#!/bin/bash
# Quick deployment - just pull code and restart services
# Use this for quick code updates without full rebuild

set -e

echo "⚡ Quick deployment..."
cd /var/www/payment-gateway

echo "📦 Pulling from git..."
git stash
git pull origin main

# Only rebuild admin if AdminDashboard changed
if git diff HEAD@{1} --name-only | grep -q "admin/"; then
    echo "🎨 Rebuilding admin..."
    cd admin
    rm -rf .next
    npm run build
    cd ..
    pm2 restart admin
else
    echo "⏭️  Admin unchanged, skipping rebuild"
fi

# Restart backend (always, since it's fast)
echo "♻️  Restarting backend..."
pm2 restart backend

echo "✅ Quick deploy complete!"
pm2 status
