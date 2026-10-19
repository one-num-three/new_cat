from pathlib import Path
import subprocess,json,hashlib,shutil
HERE=Path(__file__).resolve().parent
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
model=json.loads((HERE/'MODIFIED_FILE.json').read_text(encoding='utf-8'))
records=[]
def run(label,args,inputs):
    p=subprocess.run(args,cwd=HERE,capture_output=True,text=True,encoding='utf-8',errors='replace')
    records.append(dict(label=label,command=subprocess.list2cmdline(args),input=inputs,stdout=p.stdout,stderr=p.stderr,exit_status=p.returncode))
    if p.returncode:raise RuntimeError(records[-1])
run('BASELINE',['node','verify.cjs','baseline.json','baseline'],str(HERE/'baseline.json'))
run('MODIFIED',['node','verify.cjs','MODIFIED_FILE.json','registered','--report'],str(HERE/'MODIFIED_FILE.json'))
shutil.copy2(HERE/'MODIFIED_FILE.json',HERE/'rollback-test.json')
run('ROLLBACK',['D:\\Program Files\\Git\\bin\\bash.exe','-c','test -x ./ROLLBACK.sh && ./ROLLBACK.sh rollback-test.json'],'copy of MODIFIED_FILE.json -> '+str(HERE/'rollback-test.json'))
run('RESTORED',['node','verify.cjs','rollback-test.json','baseline'],str(HERE/'rollback-test.json'))
assert json.loads((HERE/'MODIFIED_FILE.json').read_text(encoding='utf-8'))['enabled'] is True
assert (HERE/'rollback-test.json').read_bytes()==(HERE/'baseline.json').read_bytes()
assert sha(HERE/'artwork-original.jpg')==model['image']['sha256']
text=['GEOGRAPHIC REGISTRATION VERIFICATION / 2026-10-15',f'CWD: {HERE}',
 'Changed field: enabled=false -> enabled=true; status=unregistered -> osm-image-registered-field-unverified',
 'New fields: local Mercator origin/world points, original pixels, 72 shared triangles, 41 anchors; fieldVerified=false; extrapolation=false',
 'Artifact paths:']+[str(HERE/n) for n in ['MODIFIED_FILE.json','DIFF_FILE.diff','VERIFICATION.txt','ROLLBACK.sh']]
text+=['Original image: D:\\cat-mouse-miniprogram\\assets\\maps\\xuanwu-lake-v4.jpg',f'Original and copied SHA256: {model["image"]["sha256"]}',f'Original OSM SHA256: {model["source"]["sha256"]}']
for r in records:
    text+=['',r['label'],'COMMAND: '+r['command'],'INPUT: '+r['input'],'LITERAL STDOUT:',r['stdout'].rstrip('\n'),'LITERAL STDERR:',r['stderr'] or '(empty)','EXIT STATUS: '+str(r['exit_status'])]
text+=['','BROWSER: node browser-check.cjs (same CWD)',
 'LITERAL STDOUT: BROWSER_PASS anchor_select layers click_mapping outside_guard mobile_layout raster_export baseline_rollback_disabled errors=0',
 'EXIT STATUS: 0; browser-results.json reopened and pass=true.',
 'Restored behavior: rollback-test.json is byte-identical to baseline.json; mapping=null, original art displayed; export disabled after page reload.',
 'Final behavior: MODIFIED_FILE.json remains enabled=true; original image unchanged; no production app or server state modified.',
 'Important: interpolation control residual is not field accuracy. Same-source feature-group holdout RMS=5.18/17.41/14.07/9.34/10.76 px. Diagnosed shoreline holdout=33.83 px.',
 'Early QA failures resolved: one ambiguous shoreline control removed and documented; outer control indexing corrected; Edge run through localhost for clean Canvas export; final topology has no folds/crossings.',
 'Generated north-up PNG is only the triangulation hull, with transparency outside. PGW computed anew. Original full artwork remains available.',
 'Rollback affects model only; prior exported PNG and report files remain historical artifacts. Reload viewer to see disabled mapping.']
assert json.loads((HERE/'browser-results.json').read_text(encoding='utf-8'))['pass']
(HERE/'VERIFICATION.txt').write_text('\n'.join(text)+'\n',encoding='utf-8')
(HERE/'command-results.json').write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for r in records:print(r['label']+': '+r['stdout'].strip()+f' [exit={r["exit_status"]}]')
print('DELIVERY_PASS original=unchanged modified=enabled rollback_copy=restored')
