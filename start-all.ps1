# ================================================================================
# Payment Gateway Management System - Start All Services
# ================================================================================
# Run this script to start Backend, Frontend, and Admin Panel simultaneously
# Usage: .\start-all.ps1
# ================================================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Payment Gateway Management System    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is available
$nodePath = "C:\Program Files\nodejs"
if (Test-Path $nodePath) {
    $env:Path = "$nodePath;" + $env:Path
}

try {
    $nodeVersion = & node --version 2>$null
    Write-Host "[OK] Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found! Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Starting services..." -ForegroundColor Yellow
Write-Host ""

# Start Backend
Write-Host "[1/3] Starting Backend (Port 4100)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\backend'; `$env:Path = 'C:\Program Files\nodejs;' + `$env:Path; Write-Host 'BACKEND SERVER' -ForegroundColor Green; npm run dev"

# Wait for backend to initialize
Write-Host "      Waiting for backend to start..." -ForegroundColor Gray
Start-Sleep -Seconds 5

# Start Frontend
Write-Host "[2/3] Starting Frontend (Port 5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; `$env:Path = 'C:\Program Files\nodejs;' + `$env:Path; Write-Host 'FRONTEND SERVER' -ForegroundColor Green; npm run dev"

# Wait a moment
Start-Sleep -Seconds 2

# Start Admin
Write-Host "[3/3] Starting Admin Panel (Port 5002)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\admin'; `$env:Path = 'C:\Program Files\nodejs;' + `$env:Path; Write-Host 'ADMIN PANEL' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  All services are starting!           " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access URLs:" -ForegroundColor Yellow
Write-Host "  Backend API:  http://localhost:4100" -ForegroundColor White
Write-Host "  Frontend:     http://localhost:5000" -ForegroundColor White
Write-Host "  Admin Panel:  http://localhost:5002" -ForegroundColor White
Write-Host ""
Write-Host "Default Admin Login:" -ForegroundColor Yellow
Write-Host "  Email:    admin@newweb.com" -ForegroundColor White
Write-Host "  Password: Admin@123456" -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit this window..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

