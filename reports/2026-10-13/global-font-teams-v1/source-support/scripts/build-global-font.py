"""One-page Fusion Pixel trial; original upstream and OFL preserved in design/."""
from pathlib import Path
import base64, hashlib, json, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
folder = root / 'design/2026-10-13/global-font-v1'
source = root / 'design/2026-10-13/fusion-font-v1/upstream-zh-hans.woff'
folder.mkdir(parents=True,exist_ok=True)
output = root / 'utils/fusion-font.wxss'
sha = lambda b: hashlib.sha256(b).hexdigest()
if '--verify' in sys.argv:
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf8'))
    assert sha(source.read_bytes()) == manifest['sourceSha256']
    assert sha(output.read_bytes()) == manifest['wxssSha256']
    print('FUSION_FONT_VERIFY_PASS scope=registered-pages-and-components version=2026.09.25')
    sys.exit(0)

pages = json.loads((root / 'app.json').read_text(encoding='utf8'))['pages']
inputs = [root / (p + ext) for p in pages for ext in ['.wxml','.js']]
inputs += list((root / 'components').rglob('*.wxml')) + list((root / 'components').rglob('*.js')) + list((root / 'utils').glob('*.js'))
words = ''.join(p.read_text(encoding='utf8') for p in inputs)
font = TTFont(source)
raw_words = words
words = ''.join(sorted(set(c for c in raw_words if ord(c) >= 32 and ord(c) in font.getBestCmap())))
assert all(ord(c) in font.getBestCmap() for c in re.findall(r'[\u3400-\u9fff]', raw_words))
words += ''.join(chr(n) for n in range(32, 127)) + '·'
font = TTFont(source)
missing = sorted(set(words) - set(map(chr, font.getBestCmap())))
assert not missing, missing
options = subset.Options()
options.recalc_timestamp = False
options.name_IDs = [0, 1, 2, 3, 4, 6, 13, 14]
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(text=words)
subsetter.subset(font)
# Distinct subset name; never redistribute a modified font under the original name.
for name in font['name'].names:
    if name.nameID in [1, 3, 4, 6]:
        name.string = 'CatMouseFusionUI'.encode(name.getEncoding())
if 'CFF ' in font:
    cff = font['CFF '].cff
    cff.fontNames = ['CatMouseFusionUI']
    cff.topDictIndex[0].FullName = 'CatMouseFusionUI'
    cff.topDictIndex[0].FamilyName = 'CatMouseFusionUI'
font.flavor = 'woff'
runtime = folder / 'ui-subset.woff'
font.save(runtime)
data = base64.b64encode(runtime.read_bytes()).decode('ascii')
output.write_text('/* Fusion Pixel 12px proportional zh-Hans, v2026.09.25. SIL OFL1.1; original and licenses: design/2026-10-13/fusion-font-v1. Global static-label subset; dynamic user text falls back to ParkReplicaUI. */\n@font-face{font-family:CatMouseFusionUI;font-style:normal;font-weight:400;src:url("data:font/woff;base64,' + data + '") format("woff");font-display:swap;}\n', encoding='utf8')
manifest = dict(family='CatMouseFusionUI', upstreamFamily='Fusion Pixel', version='2026.09.25',
    variant='12px-proportional-zh_hans', scope='registered-pages-and-components', license='OFL-1.1',
    sourceUrl='https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.09.25',
    sourceSha256=sha(source.read_bytes()), subsetSha256=sha(runtime.read_bytes()),
    wxssSha256=sha(output.read_bytes()), bytes=runtime.stat().st_size,
    glyphCount=len(font.getBestCmap()), coverage=sorted(set(words)),
    fallback='ParkReplicaUI', fallbackCharacters=['›'], globalRollout=True)
(folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
print(f'FUSION_FONT_BUILT bytes={manifest["bytes"]} glyphs={manifest["glyphCount"]} scope=registered-pages-and-components')
