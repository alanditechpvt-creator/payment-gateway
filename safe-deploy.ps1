#!/usr/bin/env pwsh
# Safe deployment script with validation and rollback

param(
    [switch]$SkipValidation = $false,
    [switch]$Quick = $false
)

Write-Host "`n🚀 Safe Deployment Script" -ForegroundColor Cyan
Write-Host "================================`n" -ForegroundColor Cyan

# Step 1: Validate locally
if (-not $SkipValidation) {
    Write-Host "📋 Step 1: Validating TypeScript compilation..." -ForegroundColor Yellow
    .\validate-before-deploy.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n❌ Validation failed. Aborting deployment." -ForegroundColor Red
        exit 1
    }
    Write-Host ""
}

# Step 2: Commit and push
Write-Host "📤 Step 2: Committing and pushing changes..." -ForegroundColor Yellow
git add .
$commitMsg = Read-Host "Enter commit message"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "chore: Deploy updates"
}

git commit -m "$commitMsg"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No changes to commit or commit failed" -ForegroundColor Yellow
}

git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Git push failed. Aborting deployment." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Get current commit for rollback reference
$currentCommit = git rev-parse HEAD
Write-Host "📌 Current commit: $currentCommit (save this for rollback)" -ForegroundColor Cyan
Write-Host ""

# Step 4: Deploy to production
Write-Host "🚢 Step 3: Deploying to production..." -ForegroundColor Yellow
if ($Quick) {
    ssh -i D:\ssh_imp pgadmin@72.61.254.18 "cd /var/www/payment-gateway; ./quick-deploy.sh"
} else {
    ssh -i D:\ssh_imp pgadmin@72.61.254.18 "cd /var/www/payment-gateway; ./deploy-production.sh"
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Deployment script failed!" -ForegroundColor Red
    Write-Host "To rollback, run: ssh -i D:\ssh_imp pgadmin@72.61.254.18 'cd /var/www/payment-gateway; git reset --hard $currentCommit; ./quick-deploy.sh'" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Step 5: Verify services
Write-Host "🔍 Step 4: Verifying services..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

$status = ssh -i D:\ssh_imp pgadmin@72.61.254.18 "pm2 jlist"
$services = $status | ConvertFrom-Json

$allOnline = $true
foreach ($service in $services) {
    if ($service.pm2_env.status -ne "online") {
        Write-Host "❌ Service $($service.name) is $($service.pm2_env.status)" -ForegroundColor Red
        $allOnline = $false
    } else {
        $uptime = $service.pm2_env.pm_uptime
        $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        $uptimeSeconds = [math]::Round(($now - $uptime) / 1000)
        Write-Host "✅ $($service.name) is online (uptime: $uptimeSeconds seconds)" -ForegroundColor Green
    }
}
Write-Host ""

if (-not $allOnline) {
    Write-Host "⚠️  Some services are not online. Check logs with:" -ForegroundColor Yellow
    Write-Host "ssh -i D:\ssh_imp pgadmin@72.61.254.18 'pm2 logs --lines 50'" -ForegroundColor Cyan
    Write-Host "`nTo rollback:" -ForegroundColor Yellow
    Write-Host "ssh -i D:\ssh_imp pgadmin@72.61.254.18 'cd /var/www/payment-gateway; git reset --hard $currentCommit; ./quick-deploy.sh'" -ForegroundColor Cyan
    exit 1
}

# Step 6: Test health endpoint
Write-Host "🏥 Step 5: Testing health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "https://pay.alandi.in/api/health" -Method Get -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ API health check passed" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  API health check failed: $_" -ForegroundColor Yellow
}

Write-Host "`n✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "🌐 Admin: https://admin.pay.alandi.in" -ForegroundColor Cyan
Write-Host "🌐 API: https://pay.alandi.in/api" -ForegroundColor Cyan
Write-Host "🌐 Frontend: https://pay.alandi.in" -ForegroundColor Cyan
