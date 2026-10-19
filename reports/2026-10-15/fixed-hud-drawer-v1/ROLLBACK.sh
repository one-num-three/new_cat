#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd -- "$(dirname -- "$0")" && pwd)"
node "$HERE/rollback.cjs" "${1:?Provide marked isolated rollback fixture}"
