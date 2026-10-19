#!/usr/bin/env bash
set -euo pipefail
REPORT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
# The Node guard accepts only this report's marked rollback-fixture, never live.
# Locked 33-file baseline: b5953497ee187de27bf88341c0ea26d7acd7b972d853e7b439a8d00b8b606980
exec node "$REPORT_DIR/rollback-restore.cjs" "$@"
