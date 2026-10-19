#!/usr/bin/env bash
set -euo pipefail
# Restore this task's 30 saved bytes only, in the deliberately marked test copy.
# New unreferenced assets are retained; no user files, Git state or databases are removed.
REPORT="$(cd -- "$(dirname -- "$0")" && pwd)"
python - "$REPORT" "${1:?Supply the isolated rollback-fixture path}" <<'PY'
import hashlib,json,shutil,sys
from pathlib import Path
report=Path(sys.argv[1]).resolve(); target=Path(sys.argv[2]).resolve()
assert target==report/'rollback-fixture','Only the marked isolated fixture is accepted'
assert (target/'.replica-rollback-fixture').read_text().strip()=='cat-mouse-ui-20261012'
records=json.loads((report/'baseline-hashes.json').read_text(encoding='utf-8-sig'))
for r in records:
    source=report/'baseline'/r['path']; dest=(target/r['path']).resolve()
    assert dest.is_relative_to(target)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==r['sha256'],r['path']
for r in records:
    dest=target/r['path']; dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(report/'baseline'/r['path'],dest)
    assert hashlib.sha256(dest.read_bytes()).hexdigest()==r['sha256']
app=json.loads((target/'app.json').read_text(encoding='utf-8-sig'))
assert app['window'].get('navigationStyle')!='custom'
assert '/assets/replica-v1/home-landscape.png' not in (target/'pages/index/index.wxml').read_text(encoding='utf-8-sig')
print('ROLLBACK_PASS=30 SHA256_MATCH=30 restored=native-navigation-and-previous-UI live-worktree=unchanged')
PY
