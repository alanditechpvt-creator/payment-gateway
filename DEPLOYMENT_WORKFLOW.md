# Git-Based Deployment Workflow

## Overview
This project uses a git-based deployment workflow to keep local development and production VPS in sync.

## Repository
- **GitHub**: https://github.com/alanditechpvt-creator/payment-gateway.git
- **Production VPS**: 72.61.254.18 at `/var/www/payment-gateway`

## Standard Deployment Process

### 1. Local Development
```bash
# Make your changes locally
# Test thoroughly on localhost

# Check what changed
git status
```

### 2. Commit and Push
```bash
# Add your changes
git add .

# Commit with descriptive message
git commit -m "feat: Add new feature description"

# Push to GitHub
git push origin main
```

### 3. Deploy to VPS
```bash
# SSH into VPS
ssh -i D:\ssh_imp pgadmin@72.61.254.18

# Navigate to project
cd /var/www/payment-gateway

# Run quick deploy (for code updates)
./quick-deploy.sh

# OR run full deploy (for new dependencies, migrations)
./deploy-production.sh
```

## Deployment Scripts

### `quick-deploy.sh` - Fast Updates
Use when you only changed code (no new dependencies or migrations):
- Pulls latest from git
- Rebuilds only admin if admin files changed
- Restarts backend (always fast)
- **Time**: ~2-3 minutes

```bash
cd /var/www/payment-gateway
./quick-deploy.sh
```

### `deploy-production.sh` - Full Deployment
Use when you added dependencies or database changes:
- Pulls latest from git
- Runs `npm install` for all services
- Runs database migrations
- Rebuilds admin and frontend from scratch
- Restarts all services
- **Time**: ~5-10 minutes

```bash
cd /var/www/payment-gateway
./deploy-production.sh
```

## Environment Variables

### Production-Specific Files (Not in Git)

**Backend** (`/var/www/payment-gateway/backend/.env`):
```env
DATABASE_URL=file:./prisma/prod.db
BBPS_ENDPOINT=production
JWT_SECRET=<production-secret>
# ... other production credentials
```

**Admin** (`/var/www/payment-gateway/admin/.env.production`):
```env
NEXT_PUBLIC_API_URL=https://pay.alandi.in/api
```

**Frontend** (`/var/www/payment-gateway/frontend/.env.production`):
```env
NEXT_PUBLIC_API_URL=https://pay.alandi.in/api
```

## Common Workflows

### Fix a Bug
```bash
# Local
git pull origin main  # Get latest
# Fix the bug
git add .
git commit -m "fix: Resolve channel display issue"
git push origin main

# VPS
ssh -i D:\ssh_imp pgadmin@72.61.254.18
cd /var/www/payment-gateway
./quick-deploy.sh
```

### Add New Feature
```bash
# Local
git pull origin main
# Develop feature
git add .
git commit -m "feat: Add payment reconciliation"
git push origin main

# VPS
ssh -i D:\ssh_imp pgadmin@72.61.254.18
cd /var/www/payment-gateway
./quick-deploy.sh
```

### Database Migration
```bash
# Local
# Update schema.prisma
npx prisma generate
npx prisma db push  # Test locally first!

git add prisma/schema.prisma
git commit -m "feat: Add new payment status field"
git push origin main

# VPS
ssh -i D:\ssh_imp pgadmin@72.61.254.18
cd /var/www/payment-gateway
./deploy-production.sh  # Full deploy for migrations
```

### Update Dependencies
```bash
# Local
npm install new-package
# Update package.json and package-lock.json
git add package.json package-lock.json
git commit -m "chore: Add new-package dependency"
git push origin main

# VPS
ssh -i D:\ssh_imp pgadmin@72.61.254.18
cd /var/www/payment-gateway
./deploy-production.sh  # Full deploy for dependencies
```

## Troubleshooting

### Git Pull Conflicts on VPS
If you get merge conflicts when pulling:
```bash
cd /var/www/payment-gateway
git stash  # Stash local changes
git pull origin main
# If needed, review stashed changes:
git stash show -p
```

### Services Not Starting
```bash
# Check logs
pm2 logs backend --lines 50
pm2 logs admin --lines 50

# Restart specific service
pm2 restart backend
pm2 restart admin
pm2 restart frontend

# Full restart
pm2 restart all
```

### Environment Variables Not Working
After changing .env files, you must rebuild:
```bash
# For Next.js apps (admin/frontend)
cd admin  # or frontend
rm -rf .next
npm run build
pm2 restart admin

# Backend picks up .env automatically on restart
pm2 restart backend
```

### Clear Next.js Build Cache
If admin/frontend shows old code after deploy:
```bash
cd /var/www/payment-gateway/admin
rm -rf .next
npm run build
pm2 restart admin
```

## Best Practices

1. **Always pull before making changes**
   ```bash
   git pull origin main
   ```

2. **Test locally first**
   - Run all services locally
   - Test the feature thoroughly
   - Check for errors in console

3. **Write clear commit messages**
   - `feat:` for new features
   - `fix:` for bug fixes
   - `chore:` for maintenance
   - `docs:` for documentation

4. **Use quick-deploy for most changes**
   - Faster deployment
   - Less downtime
   - Only use full deploy when needed

5. **Monitor after deployment**
   ```bash
   pm2 status
   pm2 logs backend --lines 20
   # Test the website
   ```

6. **Keep .env files secure**
   - Never commit .env to git
   - Keep backups of production .env files
   - Use strong secrets in production

## Quick Reference

| Task | Script | Time |
|------|--------|------|
| Code update | `./quick-deploy.sh` | 2-3 min |
| Full deployment | `./deploy-production.sh` | 5-10 min |
| Check status | `pm2 status` | Instant |
| View logs | `pm2 logs backend` | Instant |
| Restart service | `pm2 restart backend` | Instant |

## SSH Access
```bash
ssh -i D:\ssh_imp pgadmin@72.61.254.18
```
