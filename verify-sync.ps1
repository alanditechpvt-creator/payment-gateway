# Verify Local and Production Sync
Write-Host "`n=== CHECKING GIT SYNC ===" -ForegroundColor Cyan

Write-Host "`n1. Local Git Status:" -ForegroundColor Yellow
git status --short

Write-Host "`n2. Local vs Remote:" -ForegroundColor Yellow
$ahead = git log --oneline origin/main..HEAD
if ($ahead) {
    Write-Host "Local is AHEAD of remote:" -ForegroundColor Red
    Write-Host $ahead
} else {
    Write-Host "✓ Local is in sync with remote" -ForegroundColor Green
}

Write-Host "`n3. VPS Git Status:" -ForegroundColor Yellow
ssh -i D:\ssh_imp pgadmin@72.61.254.18 "cd /var/www/payment-gateway; git status --short; git log --oneline HEAD..origin/main"

Write-Host "`n=== CHECKING DATABASE SYNC ===" -ForegroundColor Cyan

Write-Host "`n4. Production Database Stats:" -ForegroundColor Yellow
$prodStats = ssh -i D:\ssh_imp pgadmin@72.61.254.18 "cd /var/www/payment-gateway/backend; sqlite3 prisma/prod.db 'SELECT COUNT(*) FROM Schema; SELECT COUNT(*) FROM PaymentGateway; SELECT COUNT(*) FROM TransactionChannel; SELECT COUNT(*) FROM User; SELECT COUNT(*) FROM UserPGAssignment; SELECT COUNT(*) FROM SchemaPayinRate; SELECT COUNT(*) FROM UserPayinRate;'"
Write-Host "Schemas: $($prodStats[0])"
Write-Host "Payment Gateways: $($prodStats[1])"  
Write-Host "Channels: $($prodStats[2])"
Write-Host "Users: $($prodStats[3])"
Write-Host "PG Assignments: $($prodStats[4])"
Write-Host "Schema Payin Rates: $($prodStats[5])"
Write-Host "User Payin Rates: $($prodStats[6])"

Write-Host "`n5. Local Database Stats:" -ForegroundColor Yellow
if (Test-Path "backend\prisma\dev.db") {
    Write-Host "Local dev.db found"
} else {
    Write-Host "⚠ Local dev.db NOT FOUND - may need to run migrations" -ForegroundColor Red
}

Write-Host "`n=== CHECKING SERVICE STATUS ===" -ForegroundColor Cyan

Write-Host "`n6. VPS PM2 Services:" -ForegroundColor Yellow
ssh -i D:\ssh_imp pgadmin@72.61.254.18 "pm2 list"

Write-Host "`n=== CHECKING ENVIRONMENT FILES ===" -ForegroundColor Cyan

Write-Host "`n7. Production Environment Variables:" -ForegroundColor Yellow
ssh -i D:\ssh_imp pgadmin@72.61.254.18 @"
echo "Backend .env:"
cat /var/www/payment-gateway/backend/.env | grep -v "SECRET\|KEY\|PASSWORD" | head -10
echo ""
Write-Host "Admin .env.production:"
ssh -i D:\ssh_imp pgadmin@72.61.254.18 "cat /var/www/payment-gateway/admin/.env.production"