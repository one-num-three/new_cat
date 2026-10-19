#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "$0")" && pwd)"
node "$ROOT/rollback.cjs" "${1:?Provide marked isolated fixture directory}"
