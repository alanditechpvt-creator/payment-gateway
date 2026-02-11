# update-schema-modal.ps1
# Automatically replace SchemaRatesModal function in AdminDashboard.tsx

$adminDashboardPath = "src\components\AdminDashboard.tsx"
$newModalPath = ".\SchemaRatesModal-NEW.tsx"
$backupPath = "src\components\AdminDashboard.tsx.backup"

Write-Host "Updating SchemaRatesModal in AdminDashboard.tsx..." -ForegroundColor Cyan

# 1. Create backup
Write-Host "Creating backup..." -ForegroundColor Yellow
Copy-Item $adminDashboardPath $backupPath -Force
    Write-Host "  Backup created: $backupPath" -ForegroundColor Green

# 2. Read files
Write-Host "Reading files..." -ForegroundColor Yellow
$dashboardContent = Get-Content $adminDashboardPath -Raw
$newModalContent = Get-Content $newModalPath -Raw

# 3. Find the function bounds
Write-Host "Locating SchemaRatesModal function..." -ForegroundColor Yellow

# Pattern to match the old function implementation
$pattern = '(?s)function SchemaRatesModal\({[^}]+}\) \{.*?\n\}\n\n(?=export default)'

if ($dashboardContent -match $pattern) {
    Write-Host "  Found SchemaRatesModal function" -ForegroundColor Green
    
    # 4. Replace
    Write-Host "Replacing with new implementation..." -ForegroundColor Yellow
    $updatedContent = $dashboardContent -replace $pattern, ($newModalContent + "`n`n")
    
    # 5. Write back
    Write-Host "Writing updated file..." -ForegroundColor Yellow
    Set-Content $adminDashboardPath -Value $updatedContent -NoNewline
    
    Write-Host "SUCCESS! SchemaRatesModal has been updated" -ForegroundColor Green
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Restart admin server: npm run dev" -ForegroundColor White
    Write-Host "  2. Test the new channel rates UI" -ForegroundColor White
    Write-Host "  3. If there are issues, restore backup from:" -ForegroundColor White
    Write-Host "     $backupPath" -ForegroundColor Gray
    
} else {
    Write-Host "  ERROR: Could not find SchemaRatesModal function" -ForegroundColor Red
    Write-Host "  The function pattern may have changed." -ForegroundColor Yellow
    Write-Host "  Please use manual update method (see UPDATE_SCHEMA_MODAL.md)" -ForegroundColor Yellow
}
