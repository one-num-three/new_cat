"""One-page Fusion Pixel trial; original upstream and OFL preserved in design/."""
from pathlib import Path
import base64, hashlib, json, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parents[1]
folder = root / 'design/2026-10-13/fusion-font-v1'
source = folder / 'upstream-zh-hans.woff'
output = root / 'pages/dev/fusion-font.wxss'
sha = lambda b: hashlib.sha256(b).hexdigest()
if '--verify' in sys.argv:
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf8'))
    assert sha(source.read_bytes()) == manifest['sourceSha256']
    assert sha(output.read_bytes()) == manifest['wxssSha256']
    print('FUSION_FONT_VERIFY_PASS scope=pages/dev version=2026.09.25')
    sys.exit(0)

words = (root / 'pages/dev/dev.wxml').read_text(encoding='utf8')
words += (root / 'utils/dev-preview.js').read_text(encoding='utf8')
words = ''.join(sorted(set(re.findall(r'[\u3400-\u9fff]', words))))
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
        name.string = 'CatMouseFusionTrial'.encode(name.getEncoding())
if 'CFF ' in font:
    cff = font['CFF '].cff
    cff.fontNames = ['CatMouseFusionTrial']
    cff.topDictIndex[0].FullName = 'CatMouseFusionTrial'
    cff.topDictIndex[0].FamilyName = 'CatMouseFusionTrial'
font.flavor = 'woff'
runtime = folder / 'dev-subset.woff'
font.save(runtime)
data = base64.b64encode(runtime.read_bytes()).decode('ascii')
output.write_text('/* Fusion Pixel 12px proportional zh-Hans, v2026.09.25. SIL OFL1.1; original and licenses: design/2026-10-13/fusion-font-v1. One-page static-label subset, not a global font. */\n@font-face{font-family:CatMouseFusionTrial;font-style:normal;font-weight:400;src:url("data:font/woff;base64,' + data + '") format("woff");font-display:swap;}\n', encoding='utf8')
manifest = dict(family='CatMouseFusionTrial', upstreamFamily='Fusion Pixel', version='2026.09.25',
    variant='12px-proportional-zh_hans', scope='pages/dev', license='OFL-1.1',
    sourceUrl='https://github.com/TakWolf/fusion-pixel-font/releases/tag/2026.09.25',
    sourceSha256=sha(source.read_bytes()), subsetSha256=sha(runtime.read_bytes()),
    wxssSha256=sha(output.read_bytes()), bytes=runtime.stat().st_size,
    glyphCount=len(font.getBestCmap()), coverage=sorted(set(words)),
    fallback='ParkReplicaUI', fallbackCharacters=['›'], globalRollout=False)
(folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf8')
print(f'FUSION_FONT_BUILT bytes={manifest["bytes"]} glyphs={manifest["glyphCount"]} scope=pages/dev')
