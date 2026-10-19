import hashlib, json, re, zipfile, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
package=Path(sys.argv[1]) if len(sys.argv)>1 else root/'dist/replica-02-01-v2/cat-mouse-miniprogram-mvp.zip'
with zipfile.ZipFile(package) as z:
    assert z.testzip() is None
    files={n.replace('\\','/'):z.read(n) for n in z.namelist() if not n.endswith('/')}
    for name, data in files.items():
        assert hashlib.sha256(data).digest()==hashlib.sha256((root/name).read_bytes()).digest(),name
        assert not name.startswith(('design/','reports/','cat-mouse-server/','node_modules/'))
    app=json.loads(files['app.json'].decode('utf-8-sig'))
    assert app['window']['navigationStyle']=='custom'
    for page in app['pages']:
        for ext in ['js','json','wxml','wxss']: assert page+'.'+ext in files,page+'.'+ext
    for name, data in files.items():
        if name.endswith(('.js','.wxml')):
            for asset in re.findall(r'[\"\'](/assets/[^\"\'{}]+\.png)[\"\']',data.decode('utf-8-sig')):
                assert asset[1:] in files,(name,asset)
    for ext in ['js','json','wxml','wxss']: assert 'components/nav-bar/nav-bar.'+ext in files
    assert b'localTestIdentities: false' in files['utils/config.js']
    total=sum(map(len,files.values()))
    assert total<2*1024*1024,total
    print(f'PACKAGE_VERIFY=PASS files={len(files)} uncompressed={total} zip={package.stat().st_size} testIdentities=false')

