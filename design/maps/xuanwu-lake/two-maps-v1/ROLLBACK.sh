#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-$HERE/maps-config.json}"
cp -- "$HERE/baseline-config.json" "$TARGET"
printf '%s\n' 'RESTORED art_mode=flat pixel_grid=false geometry=unchanged'
