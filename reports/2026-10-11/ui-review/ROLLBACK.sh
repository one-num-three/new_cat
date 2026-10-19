#!/usr/bin/env bash
set -euo pipefail
# Evidence-only rollback: never accepts the live working tree or arbitrary directory.
base="$(cd -- "$(dirname -- "$0")" && pwd -P)"
target="$(cd -- "${1:?Usage: ROLLBACK.sh <ui-review/rollback-fixture>}" && pwd -P)"
if [[ "$target" != "$base/rollback-fixture" || ! -f "$target/.ui-review-rollback-fixture" ]]; then
  printf '%s\n' 'ROLLBACK_TARGET_REJECTED'
  exit 64
fi
while IFS= read -r file; do
  mkdir -p -- "$target/$(dirname -- "$file")"
  cp -p -- "$base/baseline/$file" "$target/$file"
done <<'FILES'
pages/index/index.js
pages/index/index.wxml
pages/index/index.wxss
pages/room/room.js
pages/room/room.wxml
pages/room/room.wxss
pages/map/map.js
pages/map/map.wxml
pages/map/map.wxss
pages/qrcode/qrcode.wxml
pages/qrcode/qrcode.wxss
utils/theme.wxss
utils/dev-preview.js
cat-mouse-server/v2/dev-preview.test.js
WORK_LOG.md
README.md
FILES
node - "$base/baseline-hashes.json" "$target" <<'NODE'
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
for(const item of manifest){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(process.argv[3],item.path))).digest('hex');
  if(actual.toUpperCase()!==item.sha256)throw Error('Rollback hash mismatch '+item.path);
}
console.log('ROLLBACK_FILES='+manifest.length+' HASHES_RESTORED='+manifest.length);
NODE
if node "$base/../../../scripts/verify-ui-view.cjs" "$target"; then
  printf '%s\n' 'ROLLBACK_BASELINE_NOT_RESTORED'
  exit 1
else
  status=$?
  [[ "$status" == 1 ]] || exit "$status"
fi
printf '%s\n' 'ROLLBACK_RESTORED=baseline'
