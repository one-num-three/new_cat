import difflib,hashlib,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]; report=root/(sys.argv[1] if len(sys.argv)>1 else 'reports/2026-10-12/replica-v2')
records=json.loads((report/'baseline-hashes.json').read_text(encoding='utf-8-sig')); original={r['path'] for r in records}
extras=['utils/display-font.wxss','utils/art-ratios.wxss','scripts/build-faithful-art.cjs','scripts/build-display-font.py','scripts/verify-replica-package.py']
extras += [p.relative_to(root).as_posix() for p in (root/'assets/faithful-v2').iterdir() if p.is_file()]
extras += ['design/2026-10-12/faithful-art/manifest.json','design/2026-10-12/faithful-art/font.json']
chunks=[];changed=[]
for r in records:
    old=(report/'baseline'/r['path']).read_bytes();cur=(root/r['path']).read_bytes();assert hashlib.sha256(old).hexdigest()==r['sha256']
    if old==cur:continue
    changed.append({'path':r['path'],'before':r['sha256'],'after':hashlib.sha256(cur).hexdigest()})
    chunks.extend(difflib.unified_diff(old.decode('utf-8-sig').splitlines(True),cur.decode('utf-8-sig').splitlines(True),fromfile='baseline/'+r['path'],tofile='modified/'+r['path']))
for name in sorted(set(extras)-original):
    b=(root/name).read_bytes();changed.append({'path':name,'before':None,'after':hashlib.sha256(b).hexdigest()})
    if name.endswith(('.png','.woff')):chunks.append(f'Binary new asset: {name} SHA256={hashlib.sha256(b).hexdigest()}\n')
    else:chunks.extend(difflib.unified_diff([],b.decode('utf-8-sig').splitlines(True),fromfile='/dev/null',tofile='modified/'+name))
(report/'DIFF_FILE.diff').write_text('# Compared to byte-preserved working tree at this iteration, NOT Git HEAD.\n'+''.join(chunks),encoding='utf8',newline='\n')
(report/'changes.json').write_text(json.dumps({'comparison':'saved working-tree baseline','baselineFiles':len(records),'changed':changed},ensure_ascii=False,indent=2),encoding='utf8')
print(f'DIFF_VERIFY changed={len(changed)} baselineSHA256={len(records)} newPaths={sum(x["before"] is None for x in changed)}')
