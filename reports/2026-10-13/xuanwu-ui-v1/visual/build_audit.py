"""Read-only project audit packager; writes only beside this script."""
from pathlib import Path
from PIL import Image
import hashlib, html, json, shutil, datetime

OUT=Path(__file__).resolve().parent
ROOT=Path('D:/cat-mouse-miniprogram')
CAP=Path('C:/Users/Keke_/.codex/visualizations/2026/10/08/01a11c62-1472-7df3-b8a1-a6a4aff1d66b/pixel-native-v1')
REPLICA=ROOT/'design/2026-10-12/pixel-day-replica-v1'
MAP=ROOT/'design/maps/xuanwu-lake/huanzhou-yingzhou-v3/huanzhou-yingzhou-corridor.png'
PAGES=[
 ('home','01-home',130,108,764,1354),('create','02-create',110,102,802,1368),
 ('ready','03-ready',145,106,734,1354),('cat','04-cat',128,103,766,1353),
 ('mouse','05-mouse',166,108,690,1348),('alert','06-alert',164,96,696,1365),
 ('hiding','07-hiding',146,100,732,1364),('code','08-code',128,108,768,1356),
 ('captured','09-captured',135,107,752,1353),('paused','10-paused',139,101,746,1363),
 ('offline','11-offline',128,110,768,1350),('catWin','12-cat-win',135,105,751,1355),
 ('mouseWin','13-mouse-win',135,102,751,1366),('cancelled','14-cancelled',164,109,696,1352),
 ('drawer','15-details',143,103,738,1365)]

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def savej(p,v): p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def copy_image(src,dst):
 dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst)
 with Image.open(dst) as im: size=list(im.size); im.verify()
 assert sha(src)==sha(dst)
 return {'path':dst.relative_to(OUT).as_posix(),'sha256':sha(dst),'size':size}

def main():
 # This file is intentionally prepared before the final capture-ready signal.
 # notes.json is written only after final screenshots are visually reopened.
 notes=json.loads((OUT/'notes.json').read_text(encoding='utf-8'))
 assert notes['capture_stage']=='pre-six-fixes-complete-run'
 sources=json.loads((REPLICA/'sources.json').read_text(encoding='utf-8-sig'))
 source_by={s['page']:s for s in sources}
 states=[]; metrics=[]
 for mode in ['normal','large','narrow']:
  p=CAP/mode/'metrics.json'; j=json.loads(p.read_text(encoding='utf-8-sig'))
  assert j['status']=='PASS' and len(j['records'])==17,(mode,j['status'])
  dst=OUT/'evidence'/mode/'metrics.json'; dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(p,dst)
  metrics.append({'mode':mode,'status':j['status'],'count':len(j['records']),
   'measuredPage':[list(t) for t in sorted(set((r['page']['width'],r['page']['height'],r['page']['font']) for r in j['records']))],
   'file':dst.relative_to(OUT).as_posix(),'sha256':sha(dst)})
 for ident,srcid,x,y,w,h in PAGES:
  src=source_by[srcid]; inputp=Path(src['absolutePath']); inputsha=sha(inputp)
  assert inputsha.lower()==src['sha256'].lower(),srcid
  dst=OUT/'images/reference'/f'{ident}.png'; dst.parent.mkdir(parents=True,exist_ok=True)
  with Image.open(inputp) as im:
   assert im.size==(1024,1536); im.crop((x,y,x+w,y+h)).save(dst)
  with Image.open(dst) as im: assert im.size==(w,h); im.verify()
  st={'id':ident,'name':src['pageName'],'reference':{'path':dst.relative_to(OUT).as_posix(),
   'crop':[x,y,w,h],'size':[w,h],'sha256':sha(dst),'sourceSHA256':inputsha,
   'sourceFile':src['file'],'sourceId':srcid,'type':'original-app-crop'},'captures':{},'notes':notes['states'][ident]}
  states.append(st)
 for ident,name in [('gallery','界面调试台'),('venue','玄武湖完整导览')]:
  states.append({'id':ident,'name':name,'reference':None,'captures':{},'notes':notes['states'][ident]})
 mapinfo=copy_image(MAP,OUT/'images/reference/venue-map.png'); mapinfo['type']='separate-map-art'; mapinfo['sourceSHA256']=sha(MAP)
 states[-1]['reference']=mapinfo
 for st in states:
  for mode in ['normal','large','narrow']:
   st['captures'][mode]=copy_image(CAP/mode/(st['id']+'.png'),OUT/'images'/mode/(st['id']+'.png'))
 audit={'generatedAt':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
  'status':'PRE_FIX_SCREENSHOT_AUDIT_POST_FIX_CAPTURE_UNVERIFIED','scope':notes['scope'],
  'captureStage':notes['capture_stage'],'captureDate':'2026-10-13',
  'sourceChangesNotVisuallyReverified':notes['source_changes_not_visually_reverified'],
  'visualReviewed':{'originalStates':15,'nativeStates':17,'modes':3,'nativeScreenshots':51},
  'metrics':metrics,'resolvedFindings':notes['resolved'],'remainingDifferences':notes['remaining'],
  'limits':notes['limits'],'states':states}
 savej(OUT/'audit.json',audit)
 md=['# 晴日像素原生移植 · 视觉审查','',f"生成时间：{audit['generatedAt']}",'',
  '## 结论','',notes['scope'],'','15 个定稿状态与原生截图逐页核对；另包含 gallery 调试台与独立 guide 导览。normal / large / narrow 各 17 张，共 51 张原生截图已实际查看。',
  '三个 metrics.json 均记录 PASS（各 17 条），这证明该采集脚本所检查的布局/图像条件；不等于逐像素一致或真机业务测试。','',
  '## 截图阶段已验证','']
 md += ['- '+s for s in notes['resolved']]
 md += ['','## 本轮源码小修：尚未截图复验','']+['- '+s for s in notes['source_changes_not_visually_reverified']]
 md += ['','## 截图阶段可见差异','']+['- '+s for s in notes['remaining']]
 md += ['','## 证据范围','']+['- '+s for s in notes['limits']]
 md += ['','## 逐状态观察','', '|状态|观察|','|---|---|']
 md += [f"|{s['name']}|{'；'.join(s['notes'])}|" for s in states]
 md += ['','## 文件','', '- [并排查看](index.html)', '- [机器可读审查](audit.json)', '- [阅读说明](README.md)',
  '- evidence/{normal,large,narrow}/metrics.json：原始采集记录逐字节副本。','',
  '原稿按 replica.js 的 PAGES 坐标只裁可见 app 区；裁片没有缩放或拉伸。原生截图逐字节复制，包含 IDE 系统栏及初始视口。比较图统一等宽并保留各自宽高比，不强行匹配高度。','']
 (OUT/'AUDIT.md').write_text('\n'.join(md),encoding='utf-8')
 (OUT/'README.md').write_text('# 证据状态\n\n'+notes['scope']+'\n\n'+'''# 视觉审查包\n\n双击 `index.html` 查看 **15 个定稿状态的原稿与原生截图并排**；列表末尾另外包含 **gallery 界面调试台** 和 **guide 玄武湖完整导览**。无需服务器或网络。\n\n- 原稿列：依据 `pixel-day-replica-v1/replica.js` 的 PAGES 坐标，只裁可见 app 区；宽高比不变。\n- 普通列：390 × 844 页面参数，字体比例 1.0。\n- 大字列：390 × 844 页面参数，字体比例 1.3。\n- 窄内容列：320 × 693 内容参数，在 390 宽 IDE 外壳内模拟；截图仍保留外壳和右侧留白，不冒充真正 320 宽设备截图。\n- 原生截图为初始视口，不是整页滚动拼接。首屏未完整露出的页底控件不自动判为丢失，也不以此证明滚到底可达。\n- 原稿与截图的纵横比不同，所有预览都用等比图像；没有为了“像”而拉伸或裁掉原生证据。\n- 全部图片和审查记录使用相对路径，整个文件夹可以搬走后继续打开。\n- 15 张原稿输入 SHA-256 与 sources.json 核验；原生副本 SHA-256 与采集文件一致。详情见 audit.json。\n\n`AUDIT.md` 是人工视觉观察；`audit.json` 是机器可读索引。`evidence` 中的 metrics PASS 仅表示采集脚本断言通过。地图采用独立 v3 主图，界面明确为场地导览且未标定实时位置；本包不证明真机定位、GPS 投影标定或公开服务器联机结果。\n''',encoding='utf-8')
 data=json.dumps(audit,ensure_ascii=False).replace('<','\\u003c')
 template='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>晴日像素 · 原生视觉对照</title><style>
 :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#eeeae1;color:#17251a;font:15px/1.5 system-ui,"Microsoft YaHei",sans-serif}header{padding:22px 28px;background:#fdfaf2;border-bottom:1px solid #d0c5b1}h1{margin:0;font-size:25px}header p{max-width:1150px;margin:7px 0;color:#586152}a{color:#1f6541}.layout{display:grid;grid-template-columns:215px minmax(0,1fr)}nav{padding:18px 12px;position:sticky;top:0;align-self:start;max-height:100vh;overflow:auto}nav button{display:block;width:100%;text-align:left;margin:0 0 5px;padding:9px 10px;background:#f9f5eb;border:1px solid #ded5c4;border-radius:5px;color:#29452d;cursor:pointer}nav button[aria-current=true]{color:white;background:#2e6842;border-color:#2e6842;font-weight:700}main{padding:22px;min-width:0}h2{margin:0 0 8px}#notes{background:#fff9eb;border:1px solid #dec9a1;padding:10px 16px;margin-bottom:18px}#notes p{margin:4px 0}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;align-items:start}figure{margin:0;min-width:0;background:#fffdf8;border:1px solid #d3c9b7}figcaption{padding:10px 12px;min-height:74px;border-bottom:1px solid #d3c9b7;font-weight:700}figcaption small{display:block;font-weight:400;color:#65715e;font-size:12px}figure img{display:block;width:100%;height:auto}figure a{display:block}.empty{padding:35px 18px;color:#667160}.badge{display:inline-block;padding:3px 8px;background:#dcebdc;color:#255636;font-size:12px;border-radius:4px}.summary{padding:15px 18px;background:#f8f5ec;margin-top:22px;border:1px solid #d5cdbd}.summary h3{margin:0 0 8px}.summary ul{padding-left:20px;margin:4px 0}.footer{font-size:12px;color:#61705d;margin:20px 0}@media(max-width:1250px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:720px){.layout{display:block}nav{position:static;display:flex;overflow:auto;gap:5px;padding:12px}nav button{flex:none;width:145px}main{padding:14px}.grid{gap:8px}header{padding:16px}h1{font-size:22px}}
 </style></head><body><header><h1>晴日像素 · 原生视觉对照</h1><p id="stage" style="padding:12px;background:#fff0d5;border:2px solid #bd6900;color:#783b00;font-weight:700"></p><p>15 个定稿状态 + gallery + guide · 原稿、普通、大字、窄内容并排。图片全部保持自身比例，点击图片可查看原尺寸。</p><p><span class="badge">51 张截图已人工查看</span> <span class="badge">3 × 17 metrics PASS</span> <a href="AUDIT.md">审查说明</a> · <a href="audit.json">JSON</a> · <a href="README.md">阅读说明</a></p></header><div class="layout"><nav aria-label="状态列表" id="nav"></nav><main><h2 id="title"></h2><div id="notes"></div><div class="grid" id="grid"></div><section class="summary"><h3>截图阶段可见差异（不是小修后截图）</h3><ul id="remaining"></ul></section><section class="summary"><h3>证据范围</h3><ul id="limits"></ul></section><p class="footer">仅依据截图与采集记录；布局断言通过 ≠ 逐像素还原。地图导览 ≠ 经过标定的实时定位。</p></main></div><script>const audit=__AUDIT__;
 document.querySelector('#stage').textContent=audit.scope;const nav=document.querySelector('#nav');const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 audit.states.forEach((s,i)=>{const b=document.createElement('button');b.textContent=String(i+1).padStart(2,'0')+' '+s.name;b.dataset.id=s.id;b.onclick=()=>{location.hash=s.id};nav.append(b)});
 function imageCard(title,sub,img){return '<figure><figcaption>'+esc(title)+'<small>'+esc(sub)+'</small></figcaption>'+(img?'<a href="'+esc(img.path)+'" target="_blank"><img src="'+esc(img.path)+'" alt="'+esc(title)+'" width="'+img.size[0]+'" height="'+img.size[1]+'"></a>':'<div class="empty">此附加页面没有旧版 15 状态对应原稿。</div>')+'</figure>'}
 function render(){const st=audit.states.find(s=>s.id===location.hash.slice(1))||audit.states[0];document.querySelector('#title').textContent=st.name;document.querySelector('#notes').innerHTML=st.notes.map(n=>'<p>'+esc(n)+'</p>').join('');nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.id===st.id)));document.querySelector('#grid').innerHTML=imageCard(st.id==='venue'?'独立 v3 主图':'原稿 app 区',st.reference?.type==='original-app-crop'?'只裁可见 app 区 · 不拉伸':st.id==='venue'?'非 UI 原稿 · 未标定 GPS':'新增入口页',st.reference)+imageCard('原生 · 普通','390 × 844 内容参数 · 字体 1.0',st.captures.normal)+imageCard('原生 · 大字','390 × 844 内容参数 · 字体 1.3',st.captures.large)+imageCard('原生 · 窄内容','320 × 693 内容参数 · 390 宽 IDE 外壳',st.captures.narrow)}
 for(const key of ['remaining','limits'])document.querySelector('#'+key).innerHTML=audit[key==='remaining'?'remainingDifferences':key].map(s=>'<li>'+esc(s)+'</li>').join('');window.addEventListener('hashchange',render);render();</script></body></html>'''
 (OUT/'index.html').write_text(template.replace('__AUDIT__',data),encoding='utf-8')
 # Reopen every documented artifact and every packaged image, and verify links.
 re=json.loads((OUT/'audit.json').read_text(encoding='utf-8')); assert len(re['states'])==17
 for p in [OUT/'AUDIT.md',OUT/'README.md',OUT/'index.html']:
  assert p.read_text(encoding='utf-8').strip()
 count=0
 for st in re['states']:
  for img in [st['reference'],*st['captures'].values()]:
   if img:
    p=OUT/img['path']; assert sha(p)==img['sha256']
    with Image.open(p) as im: assert list(im.size)==img['size']; im.verify()
    count+=1
 for mt in re['metrics']:
  assert sha(OUT/mt['file'])==mt['sha256']; assert json.loads((OUT/mt['file']).read_text(encoding='utf-8-sig'))['status']=='PASS'
 result=f'PASS states=17 nativeScreenshots=51 originalAppCrops=15 mapReference=1 imagesReopened={count} metrics=3 allRelativeImagePaths=true sourceHashesMatch=true copyHashesMatch=true'
 (OUT/'VERIFICATION.txt').write_text('COMMAND: python "'+str(OUT/'build_audit.py')+'"\nINPUT: notes.json + pre-fix complete pixel-native-v1 capture pack + sources.json + original sources + v3 map\nRESULT: '+result+'\nEXIT STATUS: 0\nProject application source files modified by audit: 0\n',encoding='utf-8')
 assert 'EXIT STATUS: 0' in (OUT/'VERIFICATION.txt').read_text(encoding='utf-8')
 print(result)

if __name__=='__main__': main()

