from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json, shutil, sys, html
source=Path(sys.argv[1]); out=Path(sys.argv[2]); out.mkdir(parents=True,exist_ok=True)
read=lambda n:json.loads((source/(n+'.json')).read_text(encoding='utf-8'))
result=read('result'); first=read('round-one-final'); final=read('final-state'); records=read('captures')
assert result['status']=='passed' and len(records)==21
assert first['match']['id'] != final['match']['id']
assert first['match']['outcome']=='cat_win' and first['match']['captured']==first['match']['target']==4
assert len(first['archivedResults'])==1 and first['archivedResults']==final['archivedResults']
assert all(not p['ready'] for p in first['roster'])
assert len(final['roster'])==8 and all(p['status']=='active' for p in final['roster'])
players=[]
for p in first['roster']:
    i=p['index']; next_p=next(q for q in final['roster'] if q['id']==p['id'])
    a=read(f'result-player-{i+1:02}'); b=read(f'next-player-{i+1:02}')
    assert a['view']['userId']==b['view']['userId']==p['id']
    assert a['view']['owner']==b['view']['owner']==(i==0)
    assert a['view']['viewerId']==b['view']['viewerId']==p['id']
    assert a['view']['uiState']=='catWin' and not a['view']['locationRunning']
    assert a['view']['canReplay'] and not a['view']['canScan'] and not a['view']['canShowCode']
    assert a['view']['match']['myStatus']==p['status']
    assert b['view']['match']['id']==final['match']['id'] and b['view']['match']['myRole']==next_p['role']
    assert b['view']['match']['myStatus']=='active' and b['view']['match']['captured']==0
    for state in [first,final]:
        peer=next(v for v in state['peerViews'] if v['index']==i)
        actor=next(v for v in state['roster'] if v['index']==i)
        assert peer['matchId']==state['match']['id'] and peer['version']==state['version'] and peer['phase']==state['match']['phase']
        assert peer['role']==actor['role'] and peer['status']==actor['status'] and peer['outcome']==state['match']['outcome']
        assert peer['viewerId']==p['id'] and peer['owner']==(i==0)
        assert peer['captured']==state['match']['captured'] and peer['target']==4
        assert sorted((q['id'],q['role'],q['status'],q['ready']) for q in peer['roster'])==sorted((q['id'],q['role'],q['status'],q['ready']) for q in state['roster'])
        assert all(next(p for p in state['roster'] if p['id']==pid)['role']==actor['role'] for pid in peer['visibleIds'])
    if p['role']=='cat': assert next_p['role']=='mouse'
    ready=read(f'next-ready-{i+1:02}'); assert ready['view']['ready']
    players.append(dict(player=p['nickname'],id=p['id'],oldRole=p['role'],oldStatus=p['status'],outcome='cat_win',newRole=next_p['role'],newStatus='active',consistent=True))
assert read('duplicate-scan-rejected')['server']['match']['captured']==1
assert read('mouse-captured')['view']['locationRunning'] is False
assert read('restore')==dict(restored=True,backupRemoved=True)
(out/'screenshots').mkdir(exist_ok=True); (out/'mcp').mkdir(exist_ok=True)
for r in records:
    for ext in ['png','json']: shutil.copy2(source/(r['name']+'.'+ext),out/'screenshots'/(r['name']+'.'+ext))
for name in ['result','captures','initial-state','round-one-final','round-two-start','final-state','scan-captures','duplicate-scan-rejected','restore','venue-warmup']:
    shutil.copy2(source/(name+'.json'),out/(name+'.json'))
for i in range(1,9):shutil.copy2(source/f'next-ready-{i:02}.json',out/f'next-ready-{i:02}.json')
shutil.copy2(source/'fixture-events.jsonl',out/'fixture-events.jsonl')
summary={**result,'uiInteraction':'official MCP evaluates existing Page event handlers; native pointer hit-testing not verified','playersVerified':players,'viewerIdentityAndOwnerVerified':True,'cameraHardwareVerified':False,'phoneVerified':False,'publicNetworkVerified':False,'storage':'isolated local PGlite','originalSessionRestored':True}
(out/'mcp/result.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
role=lambda r:'猫' if r=='cat' else '鼠'
status=lambda s:'已被捕获' if s=='captured' else '活跃'
labels={'mouse-dynamic-code':'鼠展示动态码','cat-first-capture':'猫确认抓捕 · 1/4','mouse-captured':'鼠端出局 · 停止定位','ready-first-player':'重新准备 · 1/8','ready-all-eight':'重新准备 · 8/8'}
escape=html.escape
def cards(rows):
    items=[]
    for r in rows:
        detail=(f'重新定位和准备 · {read(r["name"])["view"]["readyCount"]}/8' if r.get('room') else f'{role(r["role"])}队 · {status(r["status"])} · {r["phase"]}<br>{r["captured"]}/{r["target"]} · {r["outcome"] or "本局进行中"}')
        items.append(f'<article><a href="screenshots/{r["screenshot"]}" target="_blank"><img loading="lazy" src="screenshots/{r["screenshot"]}" alt="{escape(labels.get(r["name"],r["player"]))}"></a><h3>{escape(labels.get(r["name"],r["player"]))}</h3><p>{detail}</p><a href="screenshots/{r["name"]}.json">对应状态 JSON</a></article>')
    return ''.join(items)

table=''.join(f'<tr><td>{escape(p["player"])}</td><td>{role(p["oldRole"])} / {status(p["oldStatus"])}</td><td>猫队胜 · 4/4</td><td>{role(p["newRole"])} / 活跃</td><td>一致</td></tr>' for p in players)
sections=[('扫码与被捕',[r for r in records if r['name'] in ['mouse-dynamic-code','cat-first-capture','mouse-captured']]),('8 人结算视角',[r for r in records if r['name'].startswith('result-player')]),('全员重新定位和准备',[r for r in records if r['name'].startswith('ready-')]),('8 人新一轮身份',[r for r in records if r['name'].startswith('next-player')])]
(out/'index.html').write_text('''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>扫码抓捕、全员结算与下一局 · MCP</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f4eb;color:#213638;font:16px/1.6 system-ui,'Microsoft YaHei',sans-serif}main{max-width:1380px;margin:auto;padding:28px}h1{font-size:30px;margin:0}h2{margin-top:34px}p{margin:8px 0 14px}.note{padding:16px;background:#e4efdf;border-left:5px solid #477f60}table{width:100%;border-collapse:collapse;background:#fffdf5}th,td{text-align:left;padding:10px;border-bottom:1px solid #d7decf}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:18px}article{background:#fffdf5;border:1px solid #ccd5c1;padding:10px;border-radius:8px}article img{width:100%;height:auto;display:block}article h3{font-size:17px;margin:10px 0 0}article p,article a{font-size:14px}a{color:#235f51}.mono{word-break:break-all;font-family:monospace;font-size:14px}</style><main><h1>猫扫码抓鼠 → 全员结算 → 再来一局</h1><p>2026-10-19 · 标准8人，2猫6鼠，抓满4人猫胜</p><div class="note">已核对8个身份的结算和新一轮页面，共21张原始MCP截图。<br>1个微信模拟器轮换身份＋8个同时在线的授权WebSocket。本机隔离PGlite，模拟GPS；扫码回传来自实际动态码PNG的解码结果，相机硬件未验证。UI由MCP调用原有Page事件处理器，未验证物理点击命中。</div><h2>全员状态核对</h2><table><thead><tr><th>身份</th><th>上一局阵营 / 状态</th><th>结算</th><th>下一局阵营 / 状态</th><th>核对</th></tr></thead><tbody>'''+table+'''</tbody></table><p>原两名猫轮换为鼠；新猫由原鼠队成员产生。新一轮捕获进度归零，之前被捕的玩家仅在新对局开始后恢复活跃。</p><p class="mono">上一局：'''+escape(first['match']['id'])+'''<br>下一局：'''+escape(final['match']['id'])+'''</p><p>旧结果独立保存且未被覆盖；重复扫码仍为1次捕获。所有人重新定位、准备后才由房主开局。</p>'''+''.join('<h2>'+title+'</h2><section class="grid">'+cards(rows)+'</section>' for title,rows in sections)+'''<h2>证据与验证边界</h2><p><a href="README.md">复现说明</a> · <a href="mcp/result.json">逐人核对</a> · <a href="verification.json">181项回归及编译</a> · <a href="scan-captures.json">4次PNG解码与服务端记录</a></p><p>本地修复：普通玩家可回房准备；终局事务清除全员旧准备标记。API本地0.5.1，线上仍0.5.0，尚未部署或微信发布。真实相机、手机GPS、前后台与公网仍待验。</p></main></html>''',encoding='utf-8')
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',18); small=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',15); titlefont=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',26)
def contact(names,name,heading,cols,width):
    h=round(width*1402/648); gap=16; top=85; margin=20; footer=65
    image=Image.new('RGB',(2*margin+cols*width+(cols-1)*gap,top+((len(names)+cols-1)//cols)*(h+footer+gap)+margin),'#f5f4eb');d=ImageDraw.Draw(image)
    d.text((margin,14),heading,font=titlefont,fill='#213638');d.text((margin,51),'微信 MCP · 1 个模拟器 / 8 个授权 WS · 模拟 GPS / 相机回传',font=small,fill='#596760')
    for i,n in enumerate(names):
        r=next(r for r in records if r['name']==n); x=margin+i%cols*(width+gap); y=top+i//cols*(h+footer+gap)
        raw=Image.open(out/'screenshots'/r['screenshot']).convert('RGB'); raw=raw.resize((width,round(width*raw.height/raw.width)),Image.Resampling.LANCZOS);image.paste(raw,(x,y))
        d.text((x,y+h+5),labels.get(n,r['player']),font=font,fill='#213638'); d.text((x,y+h+32),f'{role(r["role"])}队 · {status(r["status"])} · {r["captured"]}/{r["target"]}',font=small,fill='#596760')
    image.save(out/name)
contact(['mouse-dynamic-code','cat-first-capture','mouse-captured','result-player-01'],'capture-overview.png','实际动态码 → 猫确认 → 鼠出局 → 猫队胜',4,280)
contact([f'result-player-{i:02}' for i in range(1,9)],'results-overview.png','8 人结算 · 猫队胜 · 4/4',4,270)
contact([f'next-player-{i:02}' for i in range(1,9)],'next-round-overview.png','新 matchId · 重新分配阵营 · 全员活跃',4,270)
print(json.dumps(dict(status='passed',screenshots=len(records),players=len(players),output=str(out)),ensure_ascii=False))
