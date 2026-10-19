#!/usr/bin/env bash
set -euo pipefail

target=${1:?pass a disposable copy of package-lock.json}
source_dir=$(cd "$(dirname "$0")" && pwd)
baseline="$source_dir/package-lock-baseline.json"
expected_modified=f71a98d0b4bcc8fafe62d23a0370da1236c8dd1eabb82700e1ba141b6d0aa67f
expected_baseline=ca2eae4b06308d5194e15348dcb434dcd43a29cda66e33e3cd60a59fcb45f83d

test -f "$target"
test -f "$baseline"
test "$(sha256sum "$target" | cut -d' ' -f1)" = "$expected_modified"
cp "$baseline" "$target"
test "$(sha256sum "$target" | cut -d' ' -f1)" = "$expected_baseline"
echo 'ROLLBACK_COPY_VERIFIED'
