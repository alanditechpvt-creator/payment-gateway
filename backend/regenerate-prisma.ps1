# Run this AFTER stopping the backend server (Ctrl+C on "npm run dev").
# Then start the backend again.
Write-Host "Regenerating Prisma client..."
Set-Location $PSScriptRoot
npx prisma generate
if ($LASTEXITCODE -eq 0) {
  Write-Host "Done. You can start the backend again (e.g. npm run dev)."
} else {
  Write-Host "Failed. Make sure no Node/backend process is using the backend folder, then run: npx prisma generate"
}
