# Deployment Best Practices

## Problem We're Solving
After migrations, TypeScript compilation errors can break production, causing hundreds of restart loops and downtime.

## Root Cause (Recent Example)
- Migrated `rate.service.ts` to new models
- Left commented code block for reference with `/* ... */`
- Accidentally left duplicate code AFTER closing `*/`
- TypeScript couldn't compile → 575+ backend restarts → Complete outage

## Prevention Strategy

### 1. Local Validation Before Commit

**Always run before committing:**
```powershell
.\validate-before-deploy.ps1
```

This checks TypeScript compilation in:
- Backend
- Admin
- Frontend

**Manual check:**
```bash
cd backend
npx tsc --noEmit  # Check for errors without building
```

### 2. Use Git Hooks (Automated)

We've created pre-commit and pre-push hooks that automatically validate TypeScript.

**To enable (run once):**
```bash
# On Linux/Mac (VPS)
chmod +x .git/hooks/pre-commit .git/hooks/pre-push

# On Windows (local)
# Hooks work automatically if using Git Bash
# For PowerShell, use validate-before-deploy.ps1 manually
```

### 3. Safe Deployment Script

**Use instead of manual deployment:**
```powershell
.\safe-deploy.ps1           # Full validation + deployment
.\safe-deploy.ps1 -Quick    # Quick deployment (still validates)
```

**What it does:**
1. ✅ Validates TypeScript compilation locally
2. ✅ Commits and pushes to git
3. ✅ Saves commit hash for easy rollback
4. ✅ Deploys to production
5. ✅ Verifies all services are online
6. ✅ Tests API health endpoint
7. ✅ Provides rollback command if failed

### 4. Code Review Checklist

Before committing migrations:

- [ ] Remove all commented code blocks (or ensure they're properly closed)
- [ ] No orphaned code after `*/` comment closures
- [ ] Run `npx tsc --noEmit` locally
- [ ] Test the migration locally first
- [ ] Check for unused imports/variables
- [ ] Verify Prisma client is regenerated if schema changed

### 5. Migration-Specific Practices

**When migrating service files:**

```typescript
// ❌ DON'T: Leave commented blocks with orphaned code
async oldFunction() {
  /* OLD CODE
  await prisma.oldModel.create({...});
  */
  await prisma.newModel.create({...});  // ← This looks active!
}

// ✅ DO: Remove old code completely or use proper block comments
async newFunction() {
  // Migrated from oldModel to newModel
  await prisma.newModel.create({...});
}
```

**When keeping reference code:**

```typescript
// ✅ DO: Use line comments for reference
// OLD IMPLEMENTATION (before migration to newModel):
// const result = await prisma.oldModel.create({
//   data: { field1, field2 }
// });

// NEW IMPLEMENTATION:
const result = await prisma.newModel.create({
  data: { field1, field2 }
});
```

### 6. Test Compilation After File Edits

**In VS Code:**
- Problems panel shows TypeScript errors in real-time
- Fix all errors before committing

**Command line:**
```bash
# Backend
cd backend && npx tsc --noEmit

# Admin  
cd admin && npx tsc --noEmit

# Frontend
cd frontend && npx tsc --noEmit
```

### 7. Deployment Workflow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Make changes locally                                 │
├─────────────────────────────────────────────────────────┤
│ 2. Run: .\validate-before-deploy.ps1                    │
│    └─ Fix any TypeScript errors                         │
├─────────────────────────────────────────────────────────┤
│ 3. Test locally (npm run dev)                           │
├─────────────────────────────────────────────────────────┤
│ 4. Run: .\safe-deploy.ps1                               │
│    ├─ Validates again                                   │
│    ├─ Commits & pushes                                  │
│    ├─ Deploys to production                             │
│    └─ Verifies services                                 │
├─────────────────────────────────────────────────────────┤
│ 5. If deployment fails:                                 │
│    └─ Script provides rollback command                  │
└─────────────────────────────────────────────────────────┘
```

### 8. Emergency Rollback

If production breaks:

```bash
# Get recent commits
git log --oneline -n 5

# Rollback to last working commit
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway; \
   git reset --hard <COMMIT_HASH>; \
   ./quick-deploy.sh"
```

**Example:**
```bash
# Rollback to commit b7f8d47
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway; \
   git reset --hard b7f8d47; \
   ./quick-deploy.sh"
```

### 9. Monitoring After Deployment

**Check service status:**
```bash
ssh -i D:\ssh_imp pgadmin@72.61.254.18 "pm2 status"
```

**Check logs:**
```bash
ssh -i D:\ssh_imp pgadmin@72.61.254.18 "pm2 logs backend --lines 50"
```

**Watch for restart loops:**
- If uptime is < 10 seconds and restart count increasing
- Check error logs immediately
- Rollback if compilation errors found

### 10. Editor Configuration

**VS Code Settings (add to .vscode/settings.json):**
```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.codeActionsOnSave": {
    "source.fixAll": true,
    "source.organizeImports": true
  },
  "files.watcherExclude": {
    "**/.git/objects/**": true,
    "**/node_modules/**": true,
    "**/dist/**": true
  }
}
```

## Summary: Your New Workflow

**Before every deployment:**
```powershell
# 1. Validate
.\validate-before-deploy.ps1

# 2. Deploy safely
.\safe-deploy.ps1
```

That's it! The scripts handle:
- ✅ TypeScript validation
- ✅ Git push
- ✅ Production deployment
- ✅ Service verification
- ✅ Rollback commands if failed

**No more manual debugging of 575+ restart loops!** 🎉

## Additional Tools

### Create backup before risky migrations:
```bash
ssh -i D:\ssh_imp pgadmin@72.61.254.18 \
  "cd /var/www/payment-gateway/backend/prisma; \
   cp prod.db prod.db.backup-$(date +%Y%m%d-%H%M%S)"
```

### Test TypeScript in watch mode:
```bash
cd backend
npx tsc --noEmit --watch  # Shows errors as you type
```

### Quick syntax check without full type checking:
```bash
node --check src/services/rate.service.ts  # Fast syntax-only check
```
