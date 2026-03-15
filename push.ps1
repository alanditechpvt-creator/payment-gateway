# Git add, commit, and push - run locally before pulling on VPS
# Usage: .\push.ps1 "Your commit message"
#        .\push.ps1   (uses default message "Update")

param(
    [Parameter(Position = 0)]
    [string]$Message = "Update"
)

Set-Location $PSScriptRoot

Write-Host "Adding all changes..." -ForegroundColor Cyan
git add -A
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Committing: $Message" -ForegroundColor Cyan
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing to commit or commit failed." -ForegroundColor Yellow
    exit $LASTEXITCODE
}

Write-Host "Pushing to remote..." -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done. On VPS run: git pull" -ForegroundColor Green
