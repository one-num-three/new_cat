from pathlib import Path
import hashlib, json, re
from fontTools.ttLib import TTFont
from fontTools import subset

root = Path(__file__).resolve().parent
source = Path('C:/Windows/Fonts/NotoSansSC-VF.ttf')
font = TTFont(source)
words = ''.join((root / p).read_text(encoding='utf-8-sig') for p in ['replica.js', 'index.html'])
chars = set(re.findall(r'[\u4e00-\u9fff]', words)) | set(chr(i) for i in range(32, 127)) | set('·，。！：；、（）Ⅱ×−↻⇥▤⌂⚑◌●•↔')
options = subset.Options()
options.name_IDs = [0,1,2,3,4,6,13,14]
options.name_languages = ['*']
options.recalc_timestamp = False
worker = subset.Subsetter(options=options)
worker.populate(text=''.join(sorted(chars)))
worker.subset(font)
for record in font['name'].names:
    if record.nameID in [1,4,6]:
        record.string = 'ParkReplicaUI'.encode(record.getEncoding())
font.flavor = 'woff'
out = root / 'assets/ui-variable.woff'
font.save(out)
missing = sorted(c for c in chars if ord(c) not in font.getBestCmap())
manifest = {'source':str(source), 'sourceSHA256':hashlib.sha256(source.read_bytes()).hexdigest(), 'family':'ParkReplicaUI', 'axis':[{'tag':a.axisTag,'min':a.minValue,'max':a.maxValue} for a in font['fvar'].axes], 'glyphs':len(font.getBestCmap()), 'missing':missing,'outputSHA256':hashlib.sha256(out.read_bytes()).hexdigest(), 'reference':'https://github.com/adobe-fonts/source-han-sans'}
(root / 'font-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('FONT PASS: variable weights retained; Chinese missing=' + str(sum('\u4e00' <= c <= '\u9fff' for c in missing)))
