#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# Stage all changes only when the stage area is empty.
if git diff --cached --quiet; then
  git add .
fi

# Commit staged changes only, reading the commit message from stdin.
git commit -F -
