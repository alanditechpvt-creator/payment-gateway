# Quick Start - SabPaisa Integration Test

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host " SabPaisa Integration - Quick Start  " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check backend status
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:4100/api/health" -UseBasicParsing -TimeoutSec 2
    Write-Host "[OK] Backend running on port 4100" -ForegroundColor Green
    $backendOK = $true
} catch {
    Write-Host "[FAIL] Backend not running" -ForegroundColor Red
    Write-Host "       Start with: cd backend; npm run dev" -ForegroundColor Yellow
    $backendOK = $false
}

# Check frontend status
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5000" -UseBasicParsing -TimeoutSec 2
    Write-Host "[OK] Frontend running on port 5000" -ForegroundColor Green
    $frontendOK = $true
} catch {
    Write-Host "[INFO] Frontend not running" -ForegroundColor Yellow
    Write-Host "       Start with: cd frontend; npm run dev" -ForegroundColor Yellow
    $frontendOK = $false
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Quick Commands" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Seed Database:"
Write-Host "   cd backend; npx ts-node prisma/seed-sabpaisa.ts" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Test Integration:"
Write-Host "   .\test-sabpaisa.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Start Services:"
Write-Host "   Backend:  cd backend; npm run dev" -ForegroundColor Gray
Write-Host "   Frontend: cd frontend; npm run dev" -ForegroundColor Gray
Write-Host "   Mobile:   cd mobile; npm start" -ForegroundColor Gray
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Integration Files" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:"
Write-Host "  backend/src/services/sabpaisa.service.ts" -ForegroundColor Gray
Write-Host "  backend/src/controllers/sabpaisa.controller.ts" -ForegroundColor Gray
Write-Host ""
Write-Host "Frontend:"
Write-Host "  frontend/src/components/SabpaisaCheckout.tsx" -ForegroundColor Gray
Write-Host ""
Write-Host "Mobile:"
Write-Host "  mobile/src/screens/PayinScreen.tsx" -ForegroundColor Gray
Write-Host ""
Write-Host "Docs:"
Write-Host "  docs/SABPAISA-INTEGRATION-GUIDE.md" -ForegroundColor Gray
Write-Host "  SABPAISA_SETUP_SUMMARY.md" -ForegroundColor Gray
Write-Host ""

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Status Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

if ($backendOK -and $frontendOK) {
    Write-Host "SUCCESS: Ready to test!" -ForegroundColor Green
    Write-Host "Open http://localhost:5000 to start" -ForegroundColor Cyan
} elseif ($backendOK) {
    Write-Host "PARTIAL: Backend ready, start frontend for web testing" -ForegroundColor Yellow
} else {
    Write-Host "NOT READY: Start backend first" -ForegroundColor Red
}

Write-Host ""
