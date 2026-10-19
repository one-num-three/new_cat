#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ "${1:-}" == "--button-fix-test" ]]; then
  TARGET="$ROOT/evidence/button-fix-rollback"
  [[ -d "$TARGET" && ! -L "$ROOT/evidence" && ! -L "$TARGET" ]]
  for FILE in replica.js replica.css serve.cjs; do
    [[ ! -L "$TARGET/$FILE" ]]
    cp -- "$ROOT/baseline/button-fix-v1/$FILE" "$TARGET/$FILE"
    cmp -- "$ROOT/baseline/button-fix-v1/$FILE" "$TARGET/$FILE"
  done
  node "$ROOT/verify-button-fix.cjs" rollback
  exit 0
fi
# Restore the baseline HTML only to the dedicated test copy; leave the deliverable intact.
if [[ "${1:-}" != "--test-copy" ]]; then
  printf '%s\n' 'Usage: ./ROLLBACK.sh --test-copy'
  exit 2
fi
TARGET="$ROOT/evidence/rollback-test.html"
[[ -d "$ROOT/evidence" && ! -L "$ROOT/evidence" && ! -L "$TARGET" ]]
cp -- "$ROOT/baseline/index.html" "$TARGET"
cmp -- "$ROOT/baseline/index.html" "$TARGET"
node "$ROOT/verify.cjs" rollback
