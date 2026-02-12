#!/usr/bin/env pwsh
# Validate TypeScript compilation before deployment

Write-Host "`n🔍 Validating TypeScript compilation before deployment..." -ForegroundColor Cyan

$errors = 0

# Validate Backend
Write-Host "`n📦 Checking Backend..." -ForegroundColor Yellow
Push-Location backend
$backendResult = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend TypeScript errors found:" -ForegroundColor Red
    Write-Host $backendResult
    $errors++
} else {
    Write-Host "✅ Backend TypeScript is valid" -ForegroundColor Green
}
Pop-Location

# Validate Admin
Write-Host "`n🎨 Checking Admin..." -ForegroundColor Yellow
Push-Location admin
$adminResult = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Admin TypeScript errors found:" -ForegroundColor Red
    Write-Host $adminResult
    $errors++
} else {
    Write-Host "✅ Admin TypeScript is valid" -ForegroundColor Green
}
Pop-Location

# Validate Frontend
Write-Host "`n🌐 Checking Frontend..." -ForegroundColor Yellow
Push-Location frontend
$frontendResult = npx tsc --noEmit 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend TypeScript errors found:" -ForegroundColor Red
    Write-Host $frontendResult
    $errors++
} else {
    Write-Host "✅ Frontend TypeScript is valid" -ForegroundColor Green
}
Pop-Location

# Summary
Write-Host "`n" -NoNewline
if ($errors -eq 0) {
    Write-Host "✅ All TypeScript validations passed! Safe to deploy." -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Found $errors error(s). Fix them before deploying." -ForegroundColor Red
    exit 1
}
