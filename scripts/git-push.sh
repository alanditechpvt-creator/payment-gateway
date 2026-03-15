#!/usr/bin/env bash
# Usage: ./scripts/git-push.sh [commit message]
# Example: ./scripts/git-push.sh "Add BBPS biller import"
# If no message given, uses "Update"

set -e
cd "$(dirname "$0")/.."

MSG="${1:-Update}"

echo "Staging all changes..."
git add .

if git diff --staged --quiet; then
  echo "Nothing to commit. Working tree clean."
  exit 0
fi

echo "Committing with message: $MSG"
git commit -m "$MSG"

echo "Pushing to remote..."
git push

echo "Done. On VPS run: git pull"
