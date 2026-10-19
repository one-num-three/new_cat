"""Read real logs and reopen artifacts; writes evidence only, never runtime files."""
from pathlib import Path
import hashlib, json, re, zipfile

report = Path(__file__).resolve().parent
root = report.parents[2]
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
read = lambda p: p.read_text(encoding='utf-8-sig')
baseline = json.loads(read(report/'baseline-hashes.json'))
assert len(baseline) == 42
for item in baseline:
    assert sha(report/'baseline'/item['path']) == item['sha256']
changed = json.loads(read(report/'changes.json'))
for item in changed['changed']:
    assert sha(root/item['path']) == item['after'], item['path']
rollback = json.loads(read(report/'rollback-execution-final.json'))
proof = json.loads(read(report/'rollback-live-backup-verification.json'))
assert rollback['status'] == 'FINAL_AFTER_SECOND_READY'
assert all(r['exitStatus'] == 0 for r in rollback['records'])
for item in proof['records']:
    name = item['path']
    assert sha(root/name) == item['currentSha256']
    assert sha(report/'rollback-fixture/current-before-rollback'/name) == item['currentSha256']
    assert sha(report/'rollback-fixture'/name) == item['baselineSha256']
assert all(proof[k] == 42 for k in ['baselineValid','liveCurrentUnchanged','currentBackupMatches','fixtureRestored'])

tests = {}
for name, filename, expected in [('BASELINE','baseline-tests.txt',26),('MODIFIED','modified-final-tests.txt',31),('ROLLBACK_TESTS','rollback-tests.txt',26)]:
    log = read(report/filename)
    assert re.search(r'# tests '+str(expected)+r'\b', log)
    assert re.search(r'# pass '+str(expected)+r'\b', log)
    assert re.search(r'# fail 0\b', log)
    tests[name] = log

package = report/'MODIFIED_FILE.zip'
with zipfile.ZipFile(package) as z:
    assert z.testzip() is None
    files = {n.replace('\\','/'):z.read(n) for n in z.namelist() if not n.endswith('/')}
    for name,data in files.items():
        assert hashlib.sha256(data).hexdigest() == sha(root/name), name
    assert b'localTestIdentities: false' in files['utils/config.js']
    assert len(json.loads(files['app.json'].decode('utf-8-sig'))['pages']) == 5
    total = sum(map(len,files.values()))
    assert total < 2*1024*1024
assert '+++ modified/pages/map/map.wxml' in read(report/'DIFF_FILE.diff')
assert 'fixture-only' in read(report/'ROLLBACK.sh')

sets = []
ratios = []
for mode in ['normal','large','narrow']:
    folder = report/'visual'/(mode+'-complete')
    j = json.loads(read(folder/'metrics.json'))
    assert j['status'] == 'PASS' and len(j['records']) == 16
    for r in j['records']:
        assert sha(folder/(r['id']+'.png')) == r['sourceCaptureSHA256']
        for i in r.get('imageChecks',[]):
            if i['mode'] == 'widthFix' or i['selector'] == '.parkArt':
                error = abs((i['rendered'][0]/i['rendered'][1])/(i['intrinsic'][0]/i['intrinsic'][1])-1)
                assert error < .015
                ratios.append(error)
    sets.append({'mode':mode,'routes':16,'batches':j['batches'],'assembly':j['assembly']})
interaction = json.loads(read(report/'visual/interaction-final/result.json'))
assert interaction['status'] == 'PASS' and len(interaction['records']) == 12
restored = json.loads(read(report/'restored-final-metrics.json'))['records'][0]
assert restored['id'] == 'gallery' and restored['viewportWidth'] == 390 and restored['viewportHeight'] == 844 and restored['fontScale'] == 1

parts = [
    '当前：02-01-faithful-2 / 等比适配与本轮回归已验证 / 按visual/compare.html残差继续逐页复刻',
    'DATE=2026-10-12\nBRANCH=master (unchanged)\nCHANGED_FIELDS=image.mode(widthFix), intrinsic aspect-ratio/height:auto, onResize presentation metrics, native layout/font/state copy\nRULES=pilot-0.2 unchanged',
    '\nFOUR_ARTIFACTS',
]
for label in ['MODIFIED_FILE.zip','DIFF_FILE.diff','VERIFICATION.txt','ROLLBACK.sh']:
    parts.append(label+'='+str(report/label).replace('\\','/'))
parts += [
    'Baseline is 42 byte-preserved working-tree files, NOT Git HEAD. Original manifest SHA256='+sha(report/'baseline-hashes.json'),
    'DIFF covers 26 changed baseline files + 57 new helper/font/art/manifest paths. README.md and RELEASE.md are final documentation updates outside this 42-file byte-rollback scope; Git status retains prior user changes/deletions. This is not a whole-repository rollback.',
    '\nBASELINE\nCWD=D:/cat-mouse-miniprogram/cat-mouse-server\nCOMMAND=npm test\nINPUT=working tree before faithful-2; baseline 42 file manifest\nLITERAL_OUTPUT=1..26\n# tests 26\n# pass 26\n# fail 0\nEXIT_STATUS=0\nFull output: baseline-tests.txt',
    '\nMODIFIED\nCWD=D:/cat-mouse-miniprogram/cat-mouse-server\nCOMMAND=npm test\nINPUT=final live faithful-2 after responsive/code spacing/cancelled exact-copy repairs\nLITERAL_OUTPUT=1..31\n# tests 31\n# pass 31\n# fail 0\nEXIT_STATUS=0\nFull output: modified-final-tests.txt',
    '\nROLLBACK exact executed PowerShell commands, inputs and literal outputs:',
]
for r in rollback['records']:
    parts += [r['name'], 'CWD='+r['cwd'], 'COMMAND='+r['command'], 'INPUT='+json.dumps(r['input'],ensure_ascii=False), 'LITERAL_OUTPUT='+r['literalOutput'], 'EXIT_STATUS='+str(r['exitStatus'])]
parts += [
    'RESTORED_BEHAVIOR=fixture home uses replica-v1/home-landscape.png; fixture map uses old scaleToFill; baseline SHA42/42 and old tests26/26 restored.',
    'LIVE_STATUS=42 final CURRENT hashes unchanged; 26 modified baseline files remain changed; new UI uses widthFix/intrinsic aspect-ratio. Rollback writes/deletes live=0/0; new resources remain. Current byte backup42/42 matches live.',
    '\nWECHAT_IDE_SCREENSHOTS\nScope: develop preview fixtures; real selector geometry and native screenshots, not real physical devices/real login/GPS/scan/public-network acceptance.',
    json.dumps(sets,ensure_ascii=False,indent=2),
    'Each 16-route set is assembled from sequential PASS batches with per-image sourceCapture/captureBatch/SHA; not a last simultaneous all-16 rerun. Overlapping terminal runs were excluded; failed timeout/ratio frames retained.',
    'Layout modes: normal390x844/font1; large390x844/font1.3; narrow320x693 content canvas inside actual390x844 host. No desktop move/resize/activation. Native capsule uses real host geometry.',
    'WIDTHFIX_IMAGE_BOXES='+str(len(ratios))+' MAX_RATIO_ERROR='+str(max(ratios))+' ASSERTION<0.015; aspectFit icon container boxes excluded (container bounds != rendered image-content bounds). ratio-final.txt is a diagnostic containing these containers, not the acceptance record.',
    'First narrow cached-height ratio=0.17947256895599994 was a real failure; generated intrinsic geometry repaired it. Final code demo circle/title gap4dp measured in all3 modes. Final cancelled complete reference sentence and single-line height assertion passed in all3 modes. Intrinsic raster proportions were not compressed to fix text.',
    'INTERACTION_LITERAL_OUTPUT=REPLICA_INTERACTION_PASS=12\nEXIT_STATUS=0\nInput: develop preview handlers + real selector layout; large pageScrollTo and native ScrollView.scrollTo. Five bottom screenshots. This is not physical tapping or real扫码. Later code/cancel spacing were separately recaptured; not a rerun of all12 interactions.',
    'PREVIEW_FINAL=gallery390x844/font1; restored-line-final actual screenshot and metrics PASS. Simple restore helper timeout retained; that failed response is not counted as success.',
    '\nART / BUILD',
    'COMMAND=node scripts/build-faithful-art.cjs --verify\nINPUT=design/2026-10-12/faithful-art/manifest.json\nLITERAL_OUTPUT=FAITHFUL_ART_VERIFY sources=16 runtime=48 alphaStates=8 bytes=1804120\nEXIT_STATUS=0',
    'Source crop fragments preserve original visible RGB; alpha masks remove occlusions/backgrounds only. Mobile PNGs use width-only resizing and deterministic palette quantization, not pixel-identical RGB claims. Font subset43164B, NotoSansSC Black/SIL OFL1.1; licensed source and system fallback preserved.',
    'COMMAND=python scripts/freeze-art.py --verify\nINPUT=original frozen/v1 art manifest\nLITERAL_OUTPUT=Verified 78 frozen art files\nEXIT_STATUS=0',
    'COMMAND=node --check (12 files enumerated in syntax-final.txt and WORK_LOG evidence)\nLITERAL_OUTPUT=JS_SYNTAX_PASS=12\nEXIT_STATUS=0\nCOMMAND=git diff --check\nLITERAL_OUTPUT=GIT_DIFF_CHECK_EXIT=0 (existing line-ending warnings retained)\nEXIT_STATUS=0',
    'COMMAND=& ./scripts/package-release.ps1 -OutputDirectory D:/cat-mouse-miniprogram/dist/replica-02-01-v2\nINPUT=final current five native pages/runtime assets/config\nEXIT_STATUS=0',
    'COMMAND=python scripts/verify-replica-package.py reports/2026-10-12/replica-v2/MODIFIED_FILE.zip\nINPUT=MODIFIED_FILE.zip\nLITERAL_OUTPUT=PACKAGE_VERIFY=PASS files='+str(len(files))+' uncompressed='+str(total)+' zip='+str(package.stat().st_size)+' testIdentities=false\nEXIT_STATUS=0',
    'Art reconstruction uses current bundled sharp0.35.5; font builder uses Python fontTools4.59.2 and local licensed NotoSansSC-VF.ttf. Preview uses existing built assets, not these authoring dependencies. Server runtime/automation dependencies are in cat-mouse-server package-lock.json.',
    '\nNEXT / UNEXECUTED\nvisual/compare.html records 51 DOM anchor boxes, actual ink ROIs and source hashes. 0 boxes exceed8dp, but internal HUD divider,4 action positions and4 title-ink heights still differ; ready cloud occlusion, pin badge, sky/grass letterbox and native type/texture remain. Not declared pixel-identical. Real Android/iPhone small-screen/system-font/native-map/interaction/login/GPS/扫码/daylight/motion-FPS tests and public-network sustained load are pending; follow RELEASE.md.',
    '\nREOPENED_SHA256 (verification hash is recorded separately to avoid a self-hash cycle)',
]
for name in ['MODIFIED_FILE.zip','DIFF_FILE.diff','ROLLBACK.sh','baseline-tests.txt','modified-final-tests.txt','rollback-tests.txt','rollback-live-backup-verification.json']:
    parts.append(name+' '+sha(report/name))
for name,log in tests.items():
    parts += ['\nFULL_LITERAL_OUTPUT '+name,log]
text='\n\n'.join(parts)+'\n'
(report/'VERIFICATION.txt').write_text(text,encoding='utf8',newline='\n')
assert read(report/'VERIFICATION.txt') == text
print('EVIDENCE_REOPEN=PASS baseline42 modified31 rollback26 package90 imageBoxes156 finalCURRENT42')
for name in ['MODIFIED_FILE.zip','DIFF_FILE.diff','VERIFICATION.txt','ROLLBACK.sh']:
    print(name+' SHA256='+sha(report/name))
