# PowerShell deployment script - Run from local machine
# Usage: .\deploy.ps1

Write-Host "🚀 Deploying to Production VPS..." -ForegroundColor Cyan

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Host "⚠️  You have uncommitted changes:" -ForegroundColor Yellow
    git status --short
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        Write-Host "Deployment cancelled" -ForegroundColor Red
        exit 1
    }
}

# Push to git
Write-Host "`n📤 Pushing to GitHub..." -ForegroundColor Green
git push origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git push failed!" -ForegroundColor Red
    exit 1
}

# Deploy on VPS
Write-Host "`n🌐 Deploying on VPS..." -ForegroundColor Green
ssh -i D:\ssh_imp pgadmin@72.61.254.18 "cd /var/www/payment-gateway && ./quick-deploy.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ Deployment Complete!" -ForegroundColor Green
Write-Host "🔗 Admin: https://admin.pay.alandi.in" -ForegroundColor Cyan
Write-Host "🔗 Frontend: https://pay.alandi.in" -ForegroundColor Cyan
