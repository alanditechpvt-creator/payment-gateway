# Git add, commit, and push - run locally, then pull on VPS
# Usage: .\git-push.ps1 "Your commit message"
#    or: .\git-push.ps1

param(
    [Parameter(Position = 0)]
    [string]$Message = "Update"
)

$ErrorActionPreference = "Stop"

Write-Host "Adding all changes..." -ForegroundColor Cyan
git add .

$status = git status --short
if (-not $status) {
    Write-Host "Nothing to commit. Working tree clean." -ForegroundColor Yellow
    exit 0
}

Write-Host "Committing with message: $Message" -ForegroundColor Cyan
git commit -m $Message

Write-Host "Pushing to remote..." -ForegroundColor Cyan
git push

Write-Host "Done. On VPS run: git pull" -ForegroundColor Green
