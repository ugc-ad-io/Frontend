#!/usr/bin/env bash
# Stop hook: stage everything, commit, and push to origin/main.
# Runs after every turn. Exits quietly when there is nothing to commit.
set -u

# ⏸ PAUSED by user request (landing redesign was leaking to main). This early
# exit disables ALL auto-committing/pushing. To re-enable, delete the next line.
exit 0

REPO="c:/Users/meetr/Frontend"
cd "$REPO" 2>/dev/null || exit 0

git add -A 2>/dev/null

# Nothing staged -> nothing to do.
if git diff --cached --quiet 2>/dev/null; then
  exit 0
fi

FILES=$(git diff --cached --name-only | wc -l | tr -d ' ')

if ! git commit -q -m "auto: update ($FILES file(s))" 2>/dev/null; then
  echo '{"systemMessage":"auto-push: commit failed"}'
  exit 0
fi

# Push the new commit to main regardless of the local branch name.
PUSH_ERR=$(git push origin HEAD:main 2>&1)
if [ $? -ne 0 ]; then
  printf '{"systemMessage":"auto-push to main FAILED: %s"}\n' \
    "$(printf '%s' "$PUSH_ERR" | tr '\n"' '  ' | cut -c1-200)"
  exit 0
fi

printf '{"systemMessage":"auto-pushed %s file(s) to origin/main"}\n' "$FILES"
