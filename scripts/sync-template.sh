#!/usr/bin/env bash
# Copy example/ (the demo band) into a clone of the template content repo, so
# both stay identical. Leaves the template's own files (.git, .github, README.md,
# LICENSE) alone and doesn't commit: review and commit in the template repo.
# Usage: scripts/sync-template.sh ../bdtree-the-placeholders
set -euo pipefail

TEMPLATE="${1:?Usage: $0 <path to the template repo clone>}"
[ -d "$TEMPLATE/.git" ] || { echo "$TEMPLATE is not a git clone" >&2; exit 1; }

rsync -a --delete --exclude .git --exclude .github --exclude README.md --exclude LICENSE \
  "$(dirname "$0")/../example/" "$TEMPLATE/"
git -C "$TEMPLATE" status --short
