import hashlib,json,subprocess,zipfile,re
from pathlib import Path
from datetime import datetime
root=Path(__file__).resolve().parents[1]; r=root/'reports/2026-10-12/replica'
paths={key:r/name for key,name in [('MODIFIED_FILE','MODIFIED_FILE.zip'),('DIFF_FILE','DIFF_FILE.diff'),('VERIFICATION','VERIFICATION.txt'),('ROLLBACK','ROLLBACK.sh')]}
baseline=(r/'baseline-tests.txt').read_text(encoding='utf-8-sig'); modified=(r/'modified-tests.txt').read_text(encoding='utf-8-sig'); rollback=(r/'rollback-tests.txt').read_text(encoding='utf-8-sig')
for text,count in [(baseline,20),(modified,26),(rollback,20)]:
    assert f'# pass {count}' in text and '# fail 0' in text
for directory in ['verified','large']:
    d=json.loads((r/directory/'metrics.json').read_text());assert d['status']=='PASS' and len(d['records'])==16
assert len(json.loads((r/'interactions/result.json').read_text())['records'])==8
with zipfile.ZipFile(paths['MODIFIED_FILE']) as z:
    assert z.testzip() is None
    assert json.loads(z.read('app.json'))['window']['navigationStyle']=='custom'
    assert len([n for n in z.namelist() if not n.endswith('/')])==55
assert json.loads((root/'app.json').read_text())['window']['navigationStyle']=='custom'
saved=json.loads((r/'baseline-hashes.json').read_text(encoding='utf-8-sig'))
for item in saved:
    assert hashlib.sha256((r/'baseline'/item['path']).read_bytes()).hexdigest()==item['sha256']
    assert hashlib.sha256((r/'rollback-fixture'/item['path']).read_bytes()).hexdigest()==item['sha256']
chunks=[f'02-01 原生页面复刻验证 · {datetime.now().isoformat()}',
'BRANCH: master（沿用；没有创建分叉、reset、推送、上传或部署）',
'CHANGED_FIELDS: app.window.navigationStyle=custom; display-only uiState/canScan/canShowCode/canResume/canReplay; owner + phase + active + online gates.',
'RULE_VERSION: pilot-0.2 unchanged. Runtime art supplement: 02-01-replica-1. Original visual-1.0 unchanged.']
for key,p in paths.items():chunks.append(f'{key}: {p}')
chunks.extend([
'',
'BASELINE',
'CWD: D:\\cat-mouse-miniprogram\\cat-mouse-server',
'COMMAND: npm test',
'INPUT: v2/*.test.js before this UI iteration; 20 healthy regression tests (not audit-baseline.cjs defect assertions).',
'LITERAL OUTPUT EXCERPT:\n1..20\n# tests 20\n# pass 20\n# fail 0',
'EXIT STATUS: 0',
'FULL OUTPUT: '+str(r/'baseline-tests.txt'),
'',
'MODIFIED',
'CWD: D:\\cat-mouse-miniprogram\\cat-mouse-server',
'COMMAND: npm test',
'INPUT: v2/*.test.js including 6 new presentation/template/native-control/art tests; 26 tests.',
'LITERAL OUTPUT EXCERPT:\n1..26\n# tests 26\n# pass 26\n# fail 0',
'EXIT STATUS: 0',
'FULL OUTPUT: '+str(r/'modified-tests.txt'),
'',
'ROLLBACK',
'CWD: D:\\cat-mouse-miniprogram',
'COMMAND (PowerShell invokes Git Bash): & \'D:/Program Files/Git/bin/bash.exe\' -c \'chmod +x /d/cat-mouse-miniprogram/reports/2026-10-12/replica/ROLLBACK.sh; /d/cat-mouse-miniprogram/reports/2026-10-12/replica/ROLLBACK.sh D:/cat-mouse-miniprogram/reports/2026-10-12/replica/rollback-fixture\'',
'INPUT: marked isolated rollback-fixture; 30 byte-preserved original files and baseline-hashes.json.',
'LITERAL OUTPUT:\n'+(r/'rollback-result.txt').read_text(encoding='utf-8-sig').strip(),
'EXIT STATUS: 0',
'RESTORED BEHAVIOR: previous non-custom navigation and old home/UI source restored; 30/30 SHA-256 equal. Live app remains navigationStyle=custom and uses replica artwork.',
'ROLLBACK HEALTH COMMAND: node --test v2/client.test.js v2/dev-preview.test.js v2/integration.test.js v2/rules.test.js',
'CWD: '+str(r/'rollback-fixture/cat-mouse-server'),
'INPUT: original 20-test health suite; 6 replica-specific assertions are not applicable to old UI.',
'LITERAL OUTPUT EXCERPT:\n1..20\n# tests 20\n# pass 20\n# fail 0',
'EXIT STATUS: 0',
'FULL OUTPUT: '+str(r/'rollback-tests.txt'),
'ROLLBACK SCOPE: 30 original UI/platform/helper files only, not a full repository revert. Two mock require adapters in client/dev-preview tests were not in the initial byte backup. New inert assets/tests are retained in the fixture. No Git/user files or databases were deleted.',
'',
'WECHAT IDE NORMAL',
'COMMAND: node scripts/replica-review.cjs all reports/2026-10-12/replica/verified',
'INPUT: develop build; 390x844 viewport; gallery+14 preview cases+drawer.',
'LITERAL OUTPUT:\nREPLICA_UI_PASS=16 FONT_SCALE=1',
'EXIT STATUS: 0',
'FULL OUTPUT: '+str(r/'verified-probe.txt'),
'',
'WECHAT IDE APP FONT MULTIPLIER',
'COMMAND: node scripts/replica-review.cjs all reports/2026-10-12/replica/large large',
'INPUT: same 16 cases; fontScale setData=1.3. This is NOT a phone system font or 320px device test.',
'LITERAL OUTPUT:\nREPLICA_UI_PASS=16 FONT_SCALE=1.3',
'EXIT STATUS: 0',
'FULL OUTPUT: '+str(r/'large-probe.txt'),
'',
'WECHAT HANDLER/RENDER INTEGRATION',
'COMMAND: node scripts/replica-interaction.cjs',
'INPUT: explicit developer fixture only. Name/code, join, readiness gate/start, drawer, mouse code/back, offline, large gallery scrolling. Uses page handlers and official selectors, not physical taps.',
'LITERAL OUTPUT:\nREPLICA_INTERACTION_PASS=8',
'EXIT STATUS: 0',
'FULL OUTPUT: '+str(r/'interaction-results.txt'),
'',
'ART',
'COMMAND: python scripts/freeze-art.py --verify',
'LITERAL OUTPUT: Verified 78 frozen art files',
'EXIT STATUS: 0',
'COMMAND: node scripts/verify-replica-art.cjs',
'LITERAL OUTPUT: REPLICA_ART_VERIFY source=10 runtime=9 alpha=6',
'EXIT STATUS: 0',
'Runtime art bytes: 758167. Original + new locks reopened; six state PNGs have transparent and opaque pixels.',
'',
'PACKAGE',
'COMMAND: & scripts/package-release.ps1 -OutputDirectory dist/replica-02-01',
'COMMAND: python scripts/verify-replica-package.py',
'LITERAL OUTPUT:\n'+(r/'package-result.txt').read_text(encoding='utf-8-sig').strip(),
'EXIT STATUS: 0',
'COMMAND: python scripts/replica-evidence.py',
'LITERAL OUTPUT: DIFF_VERIFY changed=44 baselineSHA256=30 newAssets=9',
'EXIT STATUS: 0',
'INPUT: saved working-tree originals (not Git HEAD). Text EOL normalized in diff; exact byte hashes in changes.json. Design files/logs and two harness adapters separately documented, not included in the 44 UI implementation paths.',
'COMMAND: python scripts/build-replica-comparison.py',
'LITERAL OUTPUT: COMPARISON_VERIFY=16 groups / 48 PNG references PASS',
'EXIT STATUS: 0',
'COMMAND: git diff --check',
'LITERAL RESULT: no whitespace errors; existing LF/CRLF warnings in diff-check.txt.',
'EXIT STATUS: 0',
'',
'SELF REVIEW / REMAINING',
'Actual geographic map and server QR retained; no enemy coordinates added; no new realtime frequency/production dependency; no winner/client-authority change.',
'First presentation test failed FINISHED offline canReplay, then fixed. A large-font WXML conditional quote error was fixed and syntax regression added. Old SDK element failures, 14-case incomplete batch and stale-route timeouts are retained but excluded from PASS claims.',
'Native SDK events did not complete; replacement handler/selector integration is explicitly labelled. Bound navigation waits and no repeated command on response timeout.',
'Not pixel-identical: system text glyphs, layer-derived scenery and semantic preview values differ. No numerical similarity claim.',
'Not executed: actual 320px device, OS font, Android/iPhone touch, real login/GPS/scanning, native map overlays, outdoor light, motion FPS, background location, new public-server load or venue acceptance.',
'IDE window shrink root cause unconfirmed; no desktop move/resize or IDE-fix claim.',
'Local start/config/next venue steps: '+str(r/'README.md'),
'All four deliverables reopened below; live MODIFIED behavior retained.'
])
for key in ['MODIFIED_FILE','DIFF_FILE','ROLLBACK']:
    p=paths[key]; b=p.read_bytes(); assert b; chunks.append(f'REOPEN {key}: bytes={len(b)} SHA256={hashlib.sha256(b).hexdigest()}')
for i,line in enumerate(chunks):
    if line.startswith('COMMAND (PowerShell invokes Git Bash):'):
        chunks[i]="COMMAND (PowerShell invokes Git Bash): & 'D:/Program Files/Git/bin/bash.exe' reports/2026-10-12/replica/ROLLBACK.sh reports/2026-10-12/replica/rollback-fixture"
chunks.extend(['','SYNTAX','COMMAND: node --check <each of pages/index/index.js, pages/room/room.js, pages/map/map.js, pages/qrcode/qrcode.js, pages/dev/dev.js, components/nav-bar/nav-bar.js, utils/presentation.js, scripts/replica-review.cjs, scripts/replica-interaction.cjs>','LITERAL OUTPUT: SYNTAX_VERIFY=9 PASS','EXIT STATUS: 0','ROLLBACK EXECUTABILITY COMMAND: test -x /d/cat-mouse-miniprogram/reports/2026-10-12/replica/ROLLBACK.sh && echo ROLLBACK_EXECUTABLE=YES','LITERAL OUTPUT: ROLLBACK_EXECUTABLE=YES','EXIT STATUS: 0'])
paths['VERIFICATION'].write_text('\n'.join(chunks)+'\n',encoding='utf-8',newline='\n')
assert paths['VERIFICATION'].read_text(encoding='utf-8').startswith('02-01')
print('EVIDENCE_REOPEN=4 PASS; live=navigationStyle:custom; rollback=30 SHA256 + 20 healthy tests')
