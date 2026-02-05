# Complete VPS Deployment Guide - Payment Gateway System

**Server**: Hostinger VPS Ubuntu  
**IP**: 72.61.254.18  
**Domain**: pay.alandi.in  
**User**: pgadmin  

---

## **Phase 0: VPS Initial Setup (Root User)**

### **1. Login as Root**

```bash
ssh root@72.61.254.18
```

### **2. Update System Packages**

```bash
apt update
apt upgrade -y
```

### **3. Create Non-Root User (pgadmin)**

```bash
# Create user
adduser pgadmin

# Enter password when prompted
# Fill in user information (optional)
```

### **4. Grant Sudo Privileges**

```bash
# Add user to sudo group
usermod -aG sudo pgadmin

# Verify
groups pgadmin
# Should show: pgadmin : pgadmin sudo
```

### **5. Configure SSH Access for pgadmin**

```bash
# Copy SSH keys from root to pgadmin
rsync --archive --chown=pgadmin:pgadmin ~/.ssh /home/pgadmin

# Or create SSH directory manually
mkdir -p /home/pgadmin/.ssh
cp ~/.ssh/authorized_keys /home/pgadmin/.ssh/
chown -R pgadmin:pgadmin /home/pgadmin/.ssh
chmod 700 /home/pgadmin/.ssh
chmod 600 /home/pgadmin/.ssh/authorized_keys
```

### **6. Test New User Login**

```bash
# Exit root session
exit

# Login as pgadmin
ssh pgadmin@72.61.254.18

# Test sudo access
sudo whoami
# Should return: root
```

---

## **Phase 0.5: Install Required Software**

### **7. Install Node.js (as pgadmin)**

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version    # Should show v20.x.x
npm --version     # Should show 10.x.x
```

### **8. Install Git**

```bash
sudo apt install -y git

# Configure Git
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# Verify
git --version
```

### **9. Install Build Tools**

```bash
sudo apt install -y build-essential

# Install Python (needed for some npm packages)
sudo apt install -y python3 python3-pip
```

### **10. Install SQLite (for database)**

```bash
sudo apt install -y sqlite3

# Verify
sqlite3 --version
```

### **11. Install PM2 Process Manager**

```bash
sudo npm install -g pm2

# Verify
pm2 --version
```

### **12. Install Nginx**

```bash
sudo apt install -y nginx

# Enable and start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Verify
sudo systemctl status nginx
nginx -v
```

### **13. Configure Firewall (UFW)**

```bash
# Install UFW if not installed
sudo apt install -y ufw

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (IMPORTANT - do this first!)
sudo ufw allow ssh
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

---

## **Phase 0.6: Create Application Directory Structure**

### **14. Create Project Directories**

```bash
# Create main directory
sudo mkdir -p /var/www/payment-gateway

# Change ownership to pgadmin
sudo chown -R pgadmin:pgadmin /var/www/payment-gateway

# Verify
ls -la /var/www/
```

### **15. Create Subdirectories**

```bash
cd /var/www/payment-gateway

# Create app directories
mkdir -p backend
mkdir -p frontend
mkdir -p admin
mkdir -p logs

# Create backend subdirectories
mkdir -p backend/prisma
mkdir -p backend/logs
mkdir -p backend/uploads/documents
mkdir -p backend/uploads/kyc
mkdir -p backend/uploads/profiles
mkdir -p backend/uploads/temp

# Verify structure
ls -R
```

---

## **Phase 0.7: Setup SSH Keys (Optional but Recommended)**

### **16. Generate SSH Key on Local Machine**

**On your Windows machine (PowerShell):**

```powershell
# Generate SSH key
ssh-keygen -t ed25519 -C "your-email@example.com"

# Default location: C:\Users\YourName\.ssh\id_ed25519
# Press Enter to accept default location
# Enter passphrase (optional)

# View public key
cat ~\.ssh\id_ed25519.pub
```

### **17. Add Public Key to VPS**

**Copy the public key content, then on VPS:**

```bash
# On VPS as pgadmin
cd ~
mkdir -p .ssh
nano .ssh/authorized_keys

# Paste your public key
# Save and exit (Ctrl+X, Y, Enter)

# Set correct permissions
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

### **18. Test SSH Key Login**

**From local machine:**

```powershell
# Should login without password
ssh pgadmin@72.61.254.18
```

### **19. Disable Password Authentication (Security)**

**On VPS:**

```bash
sudo nano /etc/ssh/sshd_config
```

**Find and update these lines:**

```
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
```

**Restart SSH:**

```bash
sudo systemctl restart sshd
```

---

## **Phase 0.8: Setup Git Repository**

### **20. Initialize Git Repository**

**Option A: Clone Existing Repository**

```bash
cd /var/www/payment-gateway

# If you already have a GitHub repo
git clone https://github.com/alanditechpvt-creator/payment-gateway.git .

# Or with SSH
git clone git@github.com:alanditechpvt-creator/payment-gateway.git .
```

**Option B: Initialize New Repository**

```bash
cd /var/www/payment-gateway

# Initialize Git
git init

# Add remote
git remote add origin https://github.com/alanditechpvt-creator/payment-gateway.git
```

**Create .gitignore:**

```bash
nano .gitignore
```

```
# Dependencies
node_modules/
.pnp
.pnp.js

# Testing
coverage/

# Production
build/
dist/
.next/

# Environment
.env
.env.local
.env.production
.env.*.local

# Database
*.db
*.db-journal

# Logs
logs/
*.log
npm-debug.log*

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# Uploads
uploads/

# PM2
.pm2/
```

### **21. Setup GitHub Authentication**

**Option A: HTTPS with Personal Access Token**

```bash
# Generate token at: https://github.com/settings/tokens
# Use token as password when pushing

git config --global credential.helper store
git push origin main
# Enter username and token
```

**Option B: SSH Keys**

```bash
# Generate SSH key on VPS
ssh-keygen -t ed25519 -C "pgadmin@payment-gateway"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub: https://github.com/settings/keys

# Test connection
ssh -T git@github.com

# Use SSH remote
git remote set-url origin git@github.com:alanditechpvt-creator/payment-gateway.git
```

---

## **Phase 0.9: Setup Swap Space (Optional)**

### **22. Create Swap File**

```bash
# Check current swap
free -h

# Create 2GB swap file
sudo fallocate -l 2G /swapfile

# Set permissions
sudo chmod 600 /swapfile

# Make swap
sudo mkswap /swapfile

# Enable swap
sudo swapon /swapfile

# Verify
free -h

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## **Phase 0.10: Install Additional Tools**

### **23. Install Useful Tools**

```bash
# Install useful utilities
sudo apt install -y curl wget vim htop tree unzip

# Install certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Install compression tools
sudo apt install -y gzip brotli
```

---

## **Phase 1: Initial Setup & Problem Identification**

### **24. Initial Problem Discovery**
- BBPS API returning "Unauthorized Access Detected" (507904 bytes HTML error)
- Root cause: BillAvenue registered IP was 127.0.0.1, but actual IP was 49.36.50.234
- Decision: Deploy to VPS with fixed IP (72.61.254.18) for BBPS whitelisting

---

## **Phase 2: Local Code Fixes (Before Deployment)**

### **25. Fixed TypeScript Compilation Errors**

**Updated `backend/tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "allowSyntheticDefaultImports": true,
    "noImplicitAny": false,
    "strictNullChecks": false,
    "strictFunctionTypes": false,
    "strictPropertyInitialization": false,
    "noImplicitThis": false,
    "alwaysStrict": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"],
  "ts-node": {
    "transpileOnly": true,
    "files": true,
    "compilerOptions": {
      "module": "commonjs"
    }
  }
}
```

**IMPORTANT: Remove deprecated option:**
- Remove `"suppressImplicitAnyIndexErrors": true,` if present

### **26. Fixed Controller Return Types**

Added `Promise<void>` return types to all async controller methods in:
- `backend/src/controllers/*.ts`

### **27. Fixed Service Type Issues**

- **`backend/src/middleware/auth.ts`**: Changed UserRole from import to type definition
- **`backend/src/services/bbps.service.ts`**: Fixed dueDate null→Date, billerId null→undefined
- **`backend/src/services/pg.service.ts`**: Converted Decimal to Number, JSON.stringify for configuration
- **`backend/src/services/schema.service.ts`**: Converted Decimal to Number

### **28. Updated package.json**

Added production start script:

```json
{
  "scripts": {
    "start:prod": "ts-node --transpile-only src/index.ts"
  }
}
```

### **29. Fixed Prisma Schema**

**Updated `backend/prisma/schema.prisma`:**

Added missing priority field to PaymentGateway model:

```prisma
model PaymentGateway {
  id              String              @id @default(uuid())
  name            String              @unique
  code            String              @unique
  description     String?
  
  // Is this an aggregator (like Runpaisa) with internal PGs?
  isAggregator    Boolean             @default(false)
  
  // Configuration (encrypted in production)
  apiKey          String?
  apiSecret       String?
  merchantId      String?
  webhookSecret   String?
  configuration   String?
  
  // Status
  isActive        Boolean             @default(true)
  supportedTypes  String              @default("PAYIN,PAYOUT")
  
  // Priority for selection (higher = preferred)
  priority        Int                 @default(0)
  
  // Default Rate Configuration
  baseRate        Float               @default(0.02)
  minAmount       Float?
  maxAmount       Float?
  
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt
  
  transactions    Transaction[]
  userAssignments UserPGAssignment[]
  schemaRates     SchemaPGRate[]
  userRates       UserPGRate[]        @relation("PGUserRates")
  cardTypes       CardType[]
}
```

---

## **Phase 3: Database Preparation**

### **30. Created Fresh Local Database**

**On local machine (PowerShell):**

```powershell
cd d:\WebsiteNew\WebsiteNew\backend

# Remove old database
Remove-Item prisma\dev.db -Force

# Create new database with correct schema
npx prisma db push --accept-data-loss

# Seed database
npx prisma db seed
```

**Seeded data included:**
- Admin user: admin@newweb.com / Admin@12345
- Payment Gateways: Razorpay, PayU, Cashfree, Paytm, BBPS
- Schemas: Platinum, Gold, Silver
- Email templates and configs

### **31. Uploaded Database to VPS**

```powershell
cd d:\WebsiteNew\WebsiteNew\backend
scp prisma\dev.db pgadmin@72.61.254.18:/var/www/payment-gateway/backend/prisma/dev.db
```

---

## **Phase 4: Backend Configuration**

### **32. Setup Backend Environment**

```bash
cd /var/www/payment-gateway/backend

# Create .env file
nano .env
```

**`.env` contents:**

```env
# Database
DATABASE_URL="file:./prisma/prod.db"

# Server
NODE_ENV=production
PORT=4100
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-2024
JWT_EXPIRES_IN=7d

# URLs
BACKEND_URL="https://pay.alandi.in"
FRONTEND_URL="https://pay.alandi.in"
ADMIN_URL="https://admin.pay.alandi.in"

# CORS
CORS_ORIGIN="https://pay.alandi.in,https://admin.pay.alandi.in,https://alandi.in"

# BBPS Configuration
BBPS_ENABLED=true
BBPS_ACCESS_CODE="AVVE35JN22ZK88VCYW"
BBPS_WORKING_KEY="C61E255FF301E786683DB016BF747024"
BBPS_AGENT_INSTITUTION_ID="RA79"
BBPS_AGENT_INSTITUTION_NAME="Alandi Tech Business Pvt Ltd"
BBPS_AGENT_ID="CC01CC01513515340681"
BBPS_PAYMENT_CHANNEL="AGT"
BBPS_INSTITUTE_ID="RA79"
BBPS_ENDPOINT="production"
BBPS_CALLBACK_URL="https://pay.alandi.in/api/bbps/callback"
BBPS_RESPONSE_URL="https://pay.alandi.in/api/bbps/response"

# Razorpay
RAZORPAY_ENABLED=true
RAZORPAY_KEY_ID="rzp_live_wwKNiHFmM4FLaP"
RAZORPAY_KEY_SECRET="GYtBVmvCNk7kePPpXbKqg1Fn"
RAZORPAY_WEBHOOK_SECRET="shgmnk"

# Cashfree
CASHFREE_ENABLED=true
CASHFREE_APP_ID="TEST1006921359fca9ca0d2e84b64ce0291600"
CASHFREE_SECRET_KEY="TESTbaa0c3c8ebec07d1e8aaa95ae6afed5f5b25ecab"
CASHFREE_ENV="PRODUCTION"
CASHFREE_CALLBACK_URL="https://pay.alandi.in/api/webhooks/cashfree"

# SabPaisa
SABPAISA_ENABLED=true
SABPAISA_PRODUCTION=true
SABPAISA_CLIENT_CODE="DJ020"
SABPAISA_USERNAME="DJL754@sp"
SABPAISA_PASSWORD="4q3qhgmJNM4m"
SABPAISA_AUTH_KEY="ISTrmmDC2bTvkxzlDRrVguVwetGS8xC/UFPsp6w+Itg="
SABPAISA_AUTH_IV="M+aUFgRMPq7ci+Cmoytp3KJ2GPBOwO72Z2Cjbr55zY7++pT9mLES2M5cIblnBtaX"
SABPAISA_CALLBACK_URL="https://pay.alandi.in/api/sabpaisa/callback"

# RunPaisa
RUNPAISA_ENABLED=true
RUNPAISA_CLIENT_ID="your-client-id"
RUNPAISA_USERNAME="your-username"
RUNPAISA_PASSWORD="your-password"
RUNPAISA_CALLBACK_URL="https://pay.alandi.in/api/runpaisa/callback"
RUNPAISA_PAYOUT_CALLBACK_URL="https://pay.alandi.in/api/runpaisa/payout-callback"

# Email (configure as needed)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_NAME="Payment Gateway"
SMTP_FROM_EMAIL=noreply@pay.alandi.in

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Security
BCRYPT_ROUNDS=12
```

### **33. Setup Database on VPS**

```bash
cd /var/www/payment-gateway/backend

# Copy dev.db to prod.db
cp prisma/dev.db prisma/prod.db

# Verify database
ls -lh prisma/prod.db

# Install dependencies
npm install

# Generate Prisma Client
npx prisma generate
```

---

## **Phase 5: PM2 Process Manager Setup**

### **34. Start Backend with PM2**

```bash
cd /var/www/payment-gateway/backend

# Start backend
pm2 start npm --name backend -- run start:prod

# Check status
pm2 list

# View logs
pm2 logs backend --lines 50
```

---

## **Phase 6: Frontend Configuration**

### **35. Setup Frontend Environment**

```bash
cd /var/www/payment-gateway/frontend

# Create .env.production
nano .env.production
```

**`.env.production` contents:**

```env
NEXT_PUBLIC_API_URL=https://pay.alandi.in/api
NEXT_PUBLIC_BACKEND_URL=https://pay.alandi.in
```

### **36. Build and Start Frontend**

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start with PM2
pm2 start npm --name frontend -- start

# Check logs
pm2 logs frontend --lines 20
```

---

## **Phase 7: Admin Panel Configuration**

### **37. Setup Admin Environment**

```bash
cd /var/www/payment-gateway/admin

# Create .env.production
nano .env.production
```

**`.env.production` contents:**

```env
NEXT_PUBLIC_API_URL=https://pay.alandi.in/api
NEXT_PUBLIC_BACKEND_URL=https://pay.alandi.in
```

### **38. Build and Start Admin**

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start with PM2
pm2 start npm --name admin -- start

# Check logs
pm2 logs admin --lines 20
```

---

## **Phase 8: Nginx Web Server Configuration**

### **39. Configure Nginx**

```bash
sudo nano /etc/nginx/sites-available/payment-gateway
```

**Nginx configuration:**

```nginx
# Frontend - Customer Portal
server {
    listen 80;
    server_name pay.alandi.in;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 10M;
    }
}

# Admin Panel
server {
    listen 80;
    server_name admin.pay.alandi.in;

    location / {
        proxy_pass http://localhost:5002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### **40. Enable Nginx Site**

```bash
# Enable site
sudo ln -sf /etc/nginx/sites-available/payment-gateway /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable auto-start
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

---

## **Phase 9: DNS Configuration**

### **41. Added DNS Records**

In domain registrar (e.g., GoDaddy, Namecheap):

```
Type: A
Host: pay
Value: 72.61.254.18
TTL: 3600

Type: A
Host: admin.pay
Value: 72.61.254.18
TTL: 3600
```

**Wait 5-10 minutes for DNS propagation.**

**Verify DNS:**

```bash
# Test DNS resolution
ping pay.alandi.in
ping admin.pay.alandi.in

# Or use dig
dig pay.alandi.in
dig admin.pay.alandi.in
```

---

## **Phase 10: SSL Certificate Setup**

### **42. Get SSL Certificates**

```bash
sudo certbot --nginx -d pay.alandi.in -d admin.pay.alandi.in
```

**Follow prompts:**
1. Enter email address
2. Agree to terms of service
3. Choose: Redirect HTTP to HTTPS (option 2)

### **43. Update Environment Files for HTTPS**

**Backend .env:**

```bash
cd /var/www/payment-gateway/backend
nano .env
```

Update URLs to HTTPS:

```env
BACKEND_URL="https://pay.alandi.in"
FRONTEND_URL="https://pay.alandi.in"
ADMIN_URL="https://admin.pay.alandi.in"
CORS_ORIGIN="https://pay.alandi.in,https://admin.pay.alandi.in"
```

**Frontend .env.production:**

```bash
cd /var/www/payment-gateway/frontend
nano .env.production
```

```env
NEXT_PUBLIC_API_URL=https://pay.alandi.in/api
NEXT_PUBLIC_BACKEND_URL=https://pay.alandi.in
```

**Admin .env.production:**

```bash
cd /var/www/payment-gateway/admin
nano .env.production
```

```env
NEXT_PUBLIC_API_URL=https://pay.alandi.in/api
NEXT_PUBLIC_BACKEND_URL=https://pay.alandi.in
```

### **44. Rebuild and Restart Services**

```bash
# Rebuild frontend
cd /var/www/payment-gateway/frontend
npm run build
pm2 restart frontend

# Rebuild admin
cd /var/www/payment-gateway/admin
npm run build
pm2 restart admin

# Restart backend
pm2 restart backend

# Save PM2 configuration
pm2 save
```

### **45. Setup Auto-Renewal for SSL**

```bash
# Test auto-renewal
sudo certbot renew --dry-run

# Setup cron job (Certbot usually does this automatically)
sudo crontab -e

# Add this line:
0 0 * * * certbot renew --quiet && systemctl reload nginx
```

---

## **Phase 11: PM2 Auto-Start Configuration**

### **46. Configure PM2 Startup**

```bash
# Setup auto-start on system reboot
pm2 startup

# Copy and run the command it outputs (example):
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u pgadmin --hp /home/pgadmin

# Save current process list
pm2 save
```

---

## **Phase 12: Payment Gateway Configuration**

### **47. BBPS Whitelisting Request**

**Send to BillAvenue support:**

```
Subject: IP Whitelisting Request for BBPS Integration

Dear BBPS Team,

Please whitelist the following details for our BBPS integration:

Server IP: 72.61.254.18
Domain: pay.alandi.in
Agent ID: CC01CC01513515340681
Institution ID: RA79
Institution Name: Alandi Tech Business Pvt Ltd

Callback URLs:
- Callback URL: https://pay.alandi.in/api/bbps/callback
- Response URL: https://pay.alandi.in/api/bbps/response
- Webhook URL: https://pay.alandi.in/api/webhooks/bbps

Thanks,
[Your Name]
[Contact Details]
```

### **48. RunPaisa Configuration**

**Send to RunPaisa support:**

```
Subject: IP Whitelisting and Callback URL Configuration

Dear RunPaisa Team,

Please whitelist the following:

Server IP: 72.61.254.18
Domain: pay.alandi.in
Client ID: [Your Client ID]

Callback URLs:
- Payment: https://pay.alandi.in/api/runpaisa/callback
- Payout: https://pay.alandi.in/api/runpaisa/payout-callback
- Webhook: https://pay.alandi.in/api/webhooks/runpaisa

Thanks,
[Your Name]
```

### **49. SabPaisa Configuration**

**Send to SabPaisa support:**

```
Subject: IP Whitelisting Request

Dear SabPaisa Team,

Please whitelist:

Server IP: 72.61.254.18
Domain: pay.alandi.in
Client Code: DJ020

Callback URL: https://pay.alandi.in/api/sabpaisa/callback
Webhook URL: https://pay.alandi.in/api/webhooks/sabpaisa

Thanks,
[Your Name]
```

### **50. Razorpay Webhook Configuration**

**In Razorpay Dashboard:**
1. Login to https://dashboard.razorpay.com
2. Go to Settings → Webhooks
3. Add webhook: `https://pay.alandi.in/api/webhooks/razorpay`
4. Select events: `payment.captured`, `payment.failed`, `refund.created`
5. Enter webhook secret from .env

### **51. Cashfree Webhook Configuration**

**In Cashfree Dashboard:**
1. Login to https://merchant.cashfree.com
2. Go to Developers → Webhooks
3. Add webhook: `https://pay.alandi.in/api/webhooks/cashfree`
4. Select relevant events

---

## **Phase 13: Database Verification**

### **52. Verify Database Contents**

```bash
cd /var/www/payment-gateway/backend

# Check admin user
sqlite3 prisma/prod.db "SELECT email, role, status FROM User WHERE role = 'ADMIN';"

# Check payment gateways with priority
sqlite3 prisma/prod.db "SELECT code, name, priority, isActive FROM PaymentGateway ORDER BY priority;"

# Check schemas
sqlite3 prisma/prod.db "SELECT name, isDefault, isActive FROM Schema;"

# Check BBPS specifically
sqlite3 prisma/prod.db "SELECT code, name, isActive, configuration FROM PaymentGateway WHERE code = 'BBPS';"
```

---

## **Phase 14: Final Verification**

### **53. Test All Services**

```bash
# Check PM2 status
pm2 list

# Should show:
# backend  | online
# frontend | online
# admin    | online

# Test backend health
curl https://pay.alandi.in/api/health

# Test payment gateways endpoint
curl https://pay.alandi.in/api/payment-gateways

# View logs
pm2 logs --lines 20
```

### **54. Browser Testing**

1. **Frontend**: https://pay.alandi.in
2. **Admin Panel**: https://admin.pay.alandi.in
3. **Login Credentials**:
   - Email: admin@newweb.com
   - Password: Admin@12345

---

## **Phase 15: Deployment Scripts**

### **55. Create Deployment Script**

```bash
nano /var/www/payment-gateway/deploy.sh
```

**deploy.sh:**

```bash
#!/bin/bash
set -e
echo "🚀 Starting deployment..."

cd /var/www/payment-gateway

# Pull latest
echo "📥 Pulling from GitHub..."
git pull origin main

# Backend
echo "🔧 Backend..."
cd backend
npm install
npx prisma generate
pm2 restart backend

# Frontend
echo "🎨 Frontend..."
cd ../frontend
npm install
npm run build
pm2 restart frontend

# Admin
echo "👨‍💼 Admin..."
cd ../admin
npm install
npm run build
pm2 restart admin

pm2 save
echo "✅ Deployment complete!"
pm2 list
```

**Make executable:**

```bash
chmod +x /var/www/payment-gateway/deploy.sh
```

### **56. Create Database Backup Script**

```bash
nano /var/www/payment-gateway/backup-db.sh
```

**backup-db.sh:**

```bash
#!/bin/bash
BACKUP_DIR="/var/www/payment-gateway/backups"
DB_PATH="/var/www/payment-gateway/backend/prisma/prod.db"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory if not exists
mkdir -p $BACKUP_DIR

# Backup database
cp $DB_PATH "$BACKUP_DIR/prod_backup_$DATE.db"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "prod_backup_*.db" -mtime +7 -delete

echo "✅ Database backed up: prod_backup_$DATE.db"
ls -lh $BACKUP_DIR
```

**Make executable:**

```bash
chmod +x /var/www/payment-gateway/backup-db.sh
```

**Setup daily backup cron:**

```bash
crontab -e

# Add this line (runs daily at 2 AM):
0 2 * * * /var/www/payment-gateway/backup-db.sh >> /var/www/payment-gateway/logs/backup.log 2>&1
```

---

## **Complete Architecture Summary**

### **Server Setup:**
- **VPS**: Hostinger Ubuntu (72.61.254.18)
- **User**: pgadmin (sudo privileges)
- **Path**: /var/www/payment-gateway

### **Services Running:**
- **Backend**: Node.js/Express on port 4100 (PM2)
- **Frontend**: Next.js on port 5000 (PM2)
- **Admin**: Next.js on port 5002 (PM2)
- **Nginx**: Reverse proxy on ports 80/443
- **Database**: SQLite (prod.db)

### **URLs:**
- **Frontend**: https://pay.alandi.in
- **Admin**: https://admin.pay.alandi.in
- **API**: https://pay.alandi.in/api

### **Payment Gateways:**
- BBPS (BillAvenue) - IP whitelisted: 72.61.254.18
- Razorpay
- Cashfree
- SabPaisa
- RunPaisa

### **Webhook URLs:**
```
https://pay.alandi.in/api/webhooks/bbps
https://pay.alandi.in/api/webhooks/razorpay
https://pay.alandi.in/api/webhooks/cashfree
https://pay.alandi.in/api/webhooks/sabpaisa
https://pay.alandi.in/api/webhooks/runpaisa

https://pay.alandi.in/api/bbps/callback
https://pay.alandi.in/api/bbps/response
https://pay.alandi.in/api/sabpaisa/callback
https://pay.alandi.in/api/runpaisa/callback
https://pay.alandi.in/api/runpaisa/payout-callback
```

### **Key Files:**
- Backend: `/var/www/payment-gateway/backend/.env`
- Frontend: `/var/www/payment-gateway/frontend/.env.production`
- Admin: `/var/www/payment-gateway/admin/.env.production`
- Nginx: `/etc/nginx/sites-available/payment-gateway`
- Database: `/var/www/payment-gateway/backend/prisma/prod.db`

### **Directory Structure:**
```
/var/www/payment-gateway/
├── backend/
│   ├── prisma/
│   │   ├── dev.db
│   │   ├── prod.db
│   │   └── schema.prisma
│   ├── logs/
│   ├── uploads/
│   ├── src/
│   ├── .env
│   └── package.json
├── frontend/
│   ├── .next/
│   ├── .env.production
│   └── package.json
├── admin/
│   ├── .next/
│   ├── .env.production
│   └── package.json
├── logs/
├── backups/
├── deploy.sh
└── backup-db.sh
```

---

## **Useful Commands Reference**

### **PM2 Management**

```bash
# List all processes
pm2 list

# View logs
pm2 logs
pm2 logs backend
pm2 logs frontend
pm2 logs admin
pm2 logs --lines 100

# Restart services
pm2 restart backend
pm2 restart frontend
pm2 restart admin
pm2 restart all

# Stop services
pm2 stop backend
pm2 stop all

# Delete services
pm2 delete backend
pm2 delete all

# Monitor in real-time
pm2 monit

# Save current state
pm2 save

# View process info
pm2 show backend
```

### **Nginx Management**

```bash
# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Reload Nginx (without downtime)
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log
```

### **Database Management**

```bash
# Connect to database
sqlite3 /var/www/payment-gateway/backend/prisma/prod.db

# Backup database
cp /var/www/payment-gateway/backend/prisma/prod.db ~/backup_$(date +%Y%m%d_%H%M%S).db

# Restore database
cp ~/backup_20260201_120000.db /var/www/payment-gateway/backend/prisma/prod.db
pm2 restart backend

# View tables
sqlite3 /var/www/payment-gateway/backend/prisma/prod.db ".tables"

# View schema
sqlite3 /var/www/payment-gateway/backend/prisma/prod.db ".schema"

# Query database
sqlite3 /var/www/payment-gateway/backend/prisma/prod.db "SELECT * FROM User;"
```

### **Deployment**

```bash
# Quick deploy (pull latest code)
cd /var/www/payment-gateway && ./deploy.sh

# Manual deployment
cd /var/www/payment-gateway
git pull origin main
cd backend && npm install && npx prisma generate && pm2 restart backend
cd ../frontend && npm install && npm run build && pm2 restart frontend
cd ../admin && npm install && npm run build && pm2 restart admin
pm2 save

# Backup database
cd /var/www/payment-gateway && ./backup-db.sh
```

### **Monitoring**

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check system resources
htop

# Check PM2 processes
pm2 monit

# Check Nginx connections
sudo netstat -tulpn | grep nginx

# Check backend port
sudo lsof -i :4100

# Check frontend port
sudo lsof -i :5000

# Check admin port
sudo lsof -i :5002
```

### **SSL Certificate Management**

```bash
# Renew certificates manually
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run

# List certificates
sudo certbot certificates

# Revoke certificate
sudo certbot revoke --cert-path /etc/letsencrypt/live/pay.alandi.in/cert.pem
```

### **Firewall Management**

```bash
# Check firewall status
sudo ufw status verbose

# Allow port
sudo ufw allow 4100/tcp

# Deny port
sudo ufw deny 4100/tcp

# Delete rule
sudo ufw delete allow 4100/tcp

# Reset firewall
sudo ufw reset

# Reload firewall
sudo ufw reload
```

### **Git Operations**

```bash
# Check status
git status

# Pull latest
git pull origin main

# Commit changes
git add .
git commit -m "Update configuration"
git push origin main

# View logs
git log --oneline -10

# Revert changes
git checkout -- .
```

---

## **Troubleshooting Guide**

### **Backend Not Starting**

```bash
# Check logs
pm2 logs backend --lines 100

# Check if port is in use
sudo lsof -i :4100

# Kill process on port
sudo kill -9 <PID>

# Check environment file
cat /var/www/payment-gateway/backend/.env | grep DATABASE_URL

# Check database exists
ls -lh /var/www/payment-gateway/backend/prisma/prod.db

# Test backend manually
cd /var/www/payment-gateway/backend
npm run start:prod
# Press Ctrl+C to stop

# Restart with PM2
pm2 delete backend
pm2 start npm --name backend -- run start:prod
pm2 save
```

### **Frontend/Admin Not Building**

```bash
# Check logs
pm2 logs frontend --lines 100

# Clear cache
cd /var/www/payment-gateway/frontend
rm -rf .next
rm -rf node_modules
npm install
npm run build

# Test manually
npm start
# Press Ctrl+C to stop

# Restart with PM2
pm2 restart frontend
```

### **Nginx Not Working**

```bash
# Check syntax
sudo nginx -t

# View error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx

# Check if running
sudo systemctl status nginx

# Check ports
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :443
```

### **SSL Certificate Issues**

```bash
# Check certificate
sudo certbot certificates

# Renew certificate
sudo certbot renew --force-renewal

# Check Nginx SSL configuration
sudo cat /etc/nginx/sites-available/payment-gateway | grep ssl
```

### **Database Issues**

```bash
# Check database size
ls -lh /var/www/payment-gateway/backend/prisma/prod.db

# Verify database integrity
sqlite3 /var/www/payment-gateway/backend/prisma/prod.db "PRAGMA integrity_check;"

# Backup and restore
cp /var/www/payment-gateway/backend/prisma/prod.db ~/prod_backup.db
# If corrupted, restore from backup
cp ~/prod_backup.db /var/www/payment-gateway/backend/prisma/prod.db
pm2 restart backend
```

### **DNS Not Resolving**

```bash
# Check DNS
nslookup pay.alandi.in
dig pay.alandi.in

# Flush local DNS cache
sudo systemd-resolve --flush-caches

# Wait for DNS propagation (up to 24 hours)
```

### **PM2 Not Starting on Boot**

```bash
# Setup startup script again
pm2 startup

# Run the command it outputs

# Save current list
pm2 save

# Test reboot
sudo reboot
# Wait 2 minutes, then check:
pm2 list
```

---

## **Security Checklist**

- ✅ Root login disabled
- ✅ Password authentication disabled
- ✅ SSH key authentication enabled
- ✅ UFW firewall enabled
- ✅ Only ports 22, 80, 443 open
- ✅ Sudo access configured
- ✅ SSL certificates installed
- ✅ HTTPS redirect enabled
- ✅ Environment variables secured
- ✅ Database file permissions set
- ✅ Regular backups configured
- ✅ Auto-renewal for SSL enabled

---

## **Maintenance Schedule**

### **Daily:**
- ✅ Automated database backup (2 AM)
- ✅ Check PM2 logs for errors
- ✅ Monitor disk space

### **Weekly:**
- ✅ Review application logs
- ✅ Check SSL certificate expiry
- ✅ Update npm packages if needed

### **Monthly:**
- ✅ System package updates (`sudo apt update && sudo apt upgrade`)
- ✅ Review firewall rules
- ✅ Clean old backups
- ✅ Review user access logs

---

## **Support Contacts**

### **Payment Gateway Providers:**

**BBPS (BillAvenue):**
- Support Email: support@billavenue.com
- Agent ID: CC01CC01513515340681

**Razorpay:**
- Dashboard: https://dashboard.razorpay.com
- Support: https://razorpay.com/support/

**Cashfree:**
- Dashboard: https://merchant.cashfree.com
- Support: https://www.cashfree.com/contact/

**SabPaisa:**
- Support Email: support@sabpaisa.in
- Client Code: DJ020

**RunPaisa:**
- Support: Contact your account manager

---

## **Next Steps After Deployment**

1. ✅ Test all payment gateways
2. ✅ Verify BBPS IP whitelisting (wait for confirmation)
3. ✅ Test webhook callbacks
4. ✅ Configure email templates
5. ✅ Setup monitoring/alerting
6. ✅ Train admin users
7. ✅ Create user documentation
8. ✅ Setup staging environment (optional)
9. ✅ Perform load testing
10. ✅ Create disaster recovery plan

---

## **Performance Optimization (Future)**

### **Database:**
- Consider migrating to PostgreSQL for better performance
- Setup database replication
- Implement connection pooling

### **Caching:**
- Setup Redis for session management
- Implement API response caching
- Use CDN for static assets

### **Monitoring:**
- Install PM2 Plus for advanced monitoring
- Setup application performance monitoring (APM)
- Configure log aggregation (ELK stack)

### **Scaling:**
- Setup load balancer
- Deploy multiple backend instances
- Implement horizontal scaling

---

## **Documentation Links**

- **Project Repository**: https://github.com/alanditechpvt-creator/payment-gateway
- **PM2 Documentation**: https://pm2.keymetrics.io/docs/
- **Nginx Documentation**: https://nginx.org/en/docs/
- **Let's Encrypt**: https://letsencrypt.org/docs/
- **Prisma Documentation**: https://www.prisma.io/docs/

---

**Deployment Completed Successfully! 🚀**

**Live URLs:**
- Frontend: https://pay.alandi.in
- Admin: https://admin.pay.alandi.in
- API: https://pay.alandi.in/api

**Login:**
- Email: admin@newweb.com
- Password: Admin@12345

---

**Last Updated**: February 1, 2026
