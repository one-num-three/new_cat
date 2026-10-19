#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cp -- "$HERE/baseline.json" "${1:-$HERE/MODIFIED_FILE.json}"
printf 'ROLLBACK_PASS enabled=false artwork=unchanged\n'
