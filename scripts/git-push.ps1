# Usage: .\scripts\git-push.ps1 [commit message]
# Example: .\scripts\git-push.ps1 "Add BBPS biller import"
# If no message given, uses "Update"

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

$msg = if ($args.Count -gt 0) { $args -join " " } else { "Update" }

Write-Host "Staging all changes..."
git add .

$status = git status --porcelain
if (-not $status) {
    Write-Host "Nothing to commit. Working tree clean."
    exit 0
}

Write-Host "Committing with message: $msg"
git commit -m $msg

Write-Host "Pushing to remote..."
git push

Write-Host "Done. On VPS run: git pull"
