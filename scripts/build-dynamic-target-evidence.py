from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, shutil, sys, html

source=Path(sys.argv[1]); out=Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
read=lambda name:json.loads((source/(name+'.json')).read_text(encoding='utf-8'))
result=read('result'); final=read('final-state'); initial=read('initial-state'); records=read('captures')
assert result['status']=='passed' and len(records)==19
assert read('restore')==dict(restored=True,backupRemoved=True)
assert final['allOnlinePeersAligned'] and len(final['roster'])==12
assert final['match']['id']==initial['match']['id'] and final['match']['endsAt']==initial['match']['endsAt']
assert final['match']['captured']==1 and final['match']['target']==6 and final['match']['targetMouseCount']==9
for name,target,total in [('01-eight-original-mouse',4,8),('02-nine-same-mouse-updated',5,9),('03-nine-original-cat-updated',5,9),('04-ten-same-cat-updated',5,10),('05-twelve-same-cat-updated',6,12)]:
    v=read(name)['view']; assert v['match']['target']==target and len(v['roster'])==total and v['match']['captured']==0
for p in final['roster']:
    frame=next(q for q in final['peerViews'] if q['index']==p['index'])
    ui=read(f'player-{p["index"]+1:02}')['view']
    assert frame['connected'] and frame['viewerId']==ui['viewerId']==ui['userId']==p['id']
    assert frame['owner']==ui['owner']==(p['index']==0)
    assert ui['match']['myRole']==p['role'] and ui['match']['myStatus']=='active'
    assert ui['match']['target']==6 and frame['target']==6 and frame['captured']==1
    assert len(ui['roster'])==12
    for member in ui['roster']:
        live=next(q for q in final['roster'] if q['id']==member['id'])
        assert member['role']==live['role']
    assert all(next(q for q in final['roster'] if q['id']==uid)['role']==p['role'] for uid in frame['visibleIds'])
    if p['status']=='captured': assert not frame['visibleIds']
for uid,role in final['originalRoles'].items(): assert next(p for p in final['roster'] if p['id']==uid)['role']==role

(out/'screenshots').mkdir(exist_ok=True)
for r in records:
    assert '/' not in r['name'] and '\\' not in r['name']
    v=read(r['name'])['view']
    assert v['viewerId']==r['viewerId']==v['userId'] and not v['devPreview']
    for ext in ['png','json']: shutil.copy2(source/(r['name']+'.'+ext),out/'screenshots'/(r['name']+'.'+ext))
for name in ['result','final-state','initial-state','after-joins','restore','captures','before-init']:
    shutil.copy2(source/(name+'.json'),out/(name+'.json'))
shutil.copy2(source/'fixture-events.jsonl',out/'fixture-events.jsonl')
font_path='C:/Windows/Fonts/msyh.ttc'
font=ImageFont.truetype(font_path,19); titlefont=ImageFont.truetype(font_path,24)
labels={'01-eight-original-mouse':'8人 · 2猫6鼠 · 0/4','02-nine-same-mouse-updated':'补1鼠 · 原鼠端自动变0/5','03-nine-original-cat-updated':'原猫端 · 同步为0/5','04-ten-same-cat-updated':'补1猫 · 3猫7鼠 · 0/5','05-twelve-same-cat-updated':'12人 · 3猫9鼠 · 0/6','06-cat-captured-one':'猫端 · 捕获后1/6','07-captured-mouse-updated':'被捕鼠端 · 同步1/6'}
def contact(names,filename,cols=4):
    width=290; gap=16; header=63
    imgs=[Image.open(out/'screenshots'/(name+'.png')).convert('RGB') for name in names]
    heights=[round(im.height*width/im.width) for im in imgs]; cell=max(heights)+header
    canvas=Image.new('RGB',(gap+(width+gap)*min(cols,len(names)),gap+((len(names)+cols-1)//cols)*(cell+gap)), '#f8f5e9'); draw=ImageDraw.Draw(canvas)
    for i,(name,im,h) in enumerate(zip(names,imgs,heights)):
        x=gap+(i%cols)*(width+gap); y=gap+(i//cols)*(cell+gap)
        r=next(r for r in records if r['name']==name)
        label=labels.get(name,r['player']+' · '+('猫' if r['role']=='cat' else '鼠')+' · 0/6')
        draw.text((x,y),label,font=font,fill='#24382d'); draw.text((x,y+28),f'{r["cats"]}猫 {r["mice"]}鼠 / {r["total"]}人',font=font,fill='#536c5c')
        canvas.paste(im.resize((width,h),Image.Resampling.LANCZOS),(x,y+header))
    canvas.save(out/filename)
contact(['01-eight-original-mouse','02-nine-same-mouse-updated','04-ten-same-cat-updated','05-twelve-same-cat-updated'],'target-overview.png')
contact([f'player-{i:02}' for i in range(1,13)],'players-overview.png')
contact(['06-cat-captured-one','07-captured-mouse-updated'],'capture-overview.png',2)
# Explicit HUD crops, never substitute them for the original full screenshots.
hud_names=['01-eight-original-mouse','02-nine-same-mouse-updated','05-twelve-same-cat-updated','06-cat-captured-one']
hud=Image.new('RGB',(1240,360),'#f8f5e9'); hd=ImageDraw.Draw(hud)
for i,name in enumerate(hud_names):
    im=Image.open(out/'screenshots'/(name+'.png')).convert('RGB'); crop=im.crop((13,150,635,265)); x=16+(i%2)*612; y=14+(i//2)*180
    hd.text((x,y),labels[name],font=titlefont,fill='#24382d'); w=590; h=round(crop.height*w/crop.width); hud.paste(crop.resize((w,h),Image.Resampling.LANCZOS),(x,y+48))
hud.save(out/'hud-overview.png')
esc=html.escape
def card(r):
    label=labels.get(r['name'],r['player'])
    return f'<article><a href="screenshots/{r["screenshot"]}" target="_blank"><img loading="lazy" src="screenshots/{r["screenshot"]}" alt="{esc(label)}"></a><h3>{esc(label)}</h3><p>{"猫" if r["role"]=="cat" else "鼠"} · {r["status"]} · {r["captured"]}/{r["target"]}<br>{r["total"]}人：{r["cats"]}猫{r["mice"]}鼠</p><a href="screenshots/{r["name"]}.json">对应授权状态</a></article>'
stages=[r for r in records if not r['name'].startswith('player-')]; players=[r for r in records if r['name'].startswith('player-')]
(out/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>补员动态目标 · MCP实测</title><style>*{box-sizing:border-box}body{margin:0;background:#f8f5e9;color:#24382d;font:16px/1.7 system-ui,'Microsoft YaHei',sans-serif}main{max-width:1400px;margin:auto;padding:28px}h1{margin:0;font-size:30px}h2{margin-top:36px}.note{padding:18px;background:#dfeddb;border-left:5px solid #507f54}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px}article{padding:12px;background:#fffdf5;border:1px solid #c5d4be;border-radius:8px}img{display:block;width:100%;height:auto}article h3{font-size:17px;margin:10px 0 0}article p,article a{font-size:14px}a{color:#235f51}table{width:100%;border-collapse:collapse;background:#fffdf5}th,td{text-align:left;padding:10px;border-bottom:1px solid #d6dfcd}</style><main><h1>补员后动态捕获目标</h1><p>2026-10-19 · API 0.5.2 / reinforce-v2 · 原页面自动更新</p><div class="note"><b>0/4 → 0/5 → 0/6：已通过微信 MCP 实测。</b><br>同一对局、原阵营与截止时间保持。12条授权WS的目标/捕获数/成员状态一致，12个身份各有真实小程序截图。全部19张截图保持原始宽高比例。</div><h2>这次怎么更新</h2><table><tr><th>阶段</th><th>阵营人数</th><th>所有人的右上角</th></tr><tr><td>8人开局</td><td>2猫6鼠</td><td>0/4</td></tr><tr><td>第9人补鼠</td><td>2猫7鼠</td><td>0/5</td></tr><tr><td>第10人补猫</td><td>3猫7鼠</td><td>0/5</td></tr><tr><td>再补2只鼠</td><td>3猫9鼠</td><td>0/6</td></tr><tr><td>捕获1只鼠</td><td>3猫9鼠，1鼠被捕</td><td>1/6</td></tr></table><p>目标=ceil(本局累计加入鼠人数×60%)。新猫同步人数，鼠数不变时目标不变；退出、掉线、入场超时不会减目标，重连不重复加。已终局不改写。</p><h2>原页面更新与捕获后同步</h2><p>第9、10、11–12人加入时，当前原成员地图保持打开，不重新导航或刷新。加入经真实会话API和SQL事务提交，MCP读取并截图原页收到的新授权状态。</p><section class="grid">'''+''.join(card(r) for r in stages)+'''</section><h2>12人逐一核对</h2><p>每个身份均检查viewerId、房主标志、原角色、活跃状态、12人名单和0/6，随后12条同时在线WS共同确认捕获后1/6。没有向页面注入目标/阵营/赢家。</p><section class="grid">'''+''.join(card(r) for r in players)+'''</section><h2>测试与范围</h2><ul><li>184/184自动回归通过，新增3项涵盖并发、抓捕竞争、数据库失败、截止、历史结果和重启；地图WXML官方编译通过。</li><li>1个微信模拟器轮换12个本地测试会话＋12个授权原生WS，真实本机规则服务/隔离PGlite、标准30秒躲藏/6分钟追逐。GPS为模拟，本轮抓捕使用真实动态凭据API，没有再次验相机。</li><li>当前本地0.5.2；线上仍0.5.0，未部署、上传或发布。原微信会话及生产HTTPS/WSS已恢复，临时数据库已清理。</li></ul><p><a href="README.md">规则与复现说明</a> · <a href="verification.json">验证汇总</a> · <a href="result.json">MCP结果</a> · <a href="tests.log">自动化日志</a> · <a href="final-state.json">12条WS最终状态</a></p></main></html>''',encoding='utf-8')
page=out/'index.html'; content=page.read_text(encoding='utf-8')
content=content.replace('<h2>这次怎么更新</h2>','<h2>右上角裁切对照</h2><p>仅裁切顶部HUD，原始完整截图保留在下方。首张地图仍加载中，本轮验证目标及名单同步，不作为地图加载性能通过。</p><img src="hud-overview.png" alt="0/4到0/5、0/6及捕获后1/6的顶部裁切对照"><h2>这次怎么更新</h2>')
page.write_text(content,encoding='utf-8')
print(json.dumps(dict(status='passed',screenshots=len(records),players=12,output=str(out)),ensure_ascii=False))
