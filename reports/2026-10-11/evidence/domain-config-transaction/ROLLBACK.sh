#!/usr/bin/env bash
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
target="${1:?pass a disposable copy path}"
test -f "$target"
cp "$here/BASELINE_FILE" "$target"
echo 'RESTORED_LOCAL_TEST_CONFIG'
