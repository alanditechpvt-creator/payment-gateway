# Simpler update script using line numbers
$adminPath = "src\components\AdminDashboard.tsx"
$newModalPath = ".\SchemaRatesModal-NEW.tsx"

Write-Host "Reading files..." -ForegroundColor Cyan
$lines = Get-Content $adminPath
$newModal = Get-Content $newModalPath -Raw

Write-Host "Found $($lines.Count) lines in AdminDashboard.tsx" -ForegroundColor Yellow

# The function starts at line 3244 (index 3243) and ends at line 3733 (index 3732)
# Remove lines 3244-3733 (that's 490 lines to remove)
$before = $lines[0..3242]  # Lines before the function (0-3242, which is lines 1-3243)
$after = $lines[3733..($lines.Count-1)]  # Lines after the function (from 3734 onwards)

Write-Host "Before: $($before.Count) lines" -ForegroundColor Gray
Write-Host "After: $($after.Count) lines" -ForegroundColor Gray

# Combine: before + new modal + after
$newContent = $before -join "`n"
$newContent += "`n" + $newModal
$newContent += "`n" + ($after -join "`n")

# Write back
Write-Host "Writing updated file..." -ForegroundColor Yellow
Set-Content $adminPath -Value $newContent -NoNewline

Write-Host "SUCCESS! File updated" -ForegroundColor Green
Write-Host "New line count: $(((Get-Content $adminPath).Count))" -ForegroundColor Gray
