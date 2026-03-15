#!/bin/bash
# Git add, commit, and push - run locally (e.g. Git Bash). On VPS: git pull
# Usage: ./push.sh "Your commit message"
#        ./push.sh   (uses default message "Update")

cd "$(dirname "$0")"
MSG="${1:-Update}"

echo "Adding all changes..."
git add -A
[ $? -ne 0 ] && exit $?

echo "Committing: $MSG"
git commit -m "$MSG"
[ $? -ne 0 ] && echo "Nothing to commit or commit failed." && exit $?

echo "Pushing to remote..."
git push
[ $? -ne 0 ] && exit $?

echo "Done. On VPS run: git pull"
