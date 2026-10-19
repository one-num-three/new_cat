#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$HERE/MODIFIED_FILE.json}"
cp -- "$HERE/baseline.json" "$TARGET"
printf 'ROLLBACK_PASS enabled=false status=unregistered image=unchanged\n'
