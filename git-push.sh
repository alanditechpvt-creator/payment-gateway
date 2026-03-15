#!/bin/bash
# Git add, commit, and push - run locally, then pull on VPS
# Usage: ./git-push.sh "Your commit message"
#    or: ./git-push.sh

set -e
MSG="${1:-Update}"

echo "Adding all changes..."
git add .

if [ -z "$(git status --short)" ]; then
  echo "Nothing to commit. Working tree clean."
  exit 0
fi

echo "Committing with message: $MSG"
git commit -m "$MSG"

echo "Pushing to remote..."
git push

echo "Done. On VPS run: git pull"
