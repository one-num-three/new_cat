import html, json, os, struct
from pathlib import Path
root=Path(__file__).resolve().parents[1]; out=root/'reports/2026-10-12/replica'
cases=[('home','01-home.png','首页与加入','空表单、原生输入和双动作；首页 v2 增加标题留白。'),('create','02-create.png','创建活动','人数与场地为真实控件；示例场地 200 米，非自动定位成功声明。'),('ready','03-ready.png','房间准备','8 人样例；长昵称截断；房间码 / 复制分离，未齐 / 未准备禁止开局。'),('hiding','04-hiding-v2.png','躲藏','未追逐、不开放抓捕；本人靠集合点，展示阶段剩余时间。'),('cat','05-cat.png','猫地图','蓝点本人 / 旗帜集合点 / 无中心点的橘色区域线索；实际对局原生地图。'),('mouse','06-mouse-v2.png','鼠地图','无敌方实时位置；停下展示动态码，队伍 / 规则进入抽屉。'),('alert','07-alert.png','近距预警','只提示接近，不新增猫的方位、距离或身份。'),('code','08-code.png','动态码','原生文字和二维码容器；开发样例不可扫描，真实二维码由服务器签发。'),('captured','09-captured.png','本轮出局','新增公开状态条，移除战术位置和捕获动作，返回集合点等待。'),('paused','10-paused.png','本局暂停','04:45 冻结样例、暂停原因；恢复仅组织者可见。'),('offline','11-offline.png','断线重连','清旧倒计时 / 位置，标题两行，主动作关闭；等待授权快照恢复。'),('catWin','12-catWin.png','猫队获胜','服务器确认目标达成，4 / 6 捕获；双角色插画，无客户端指定胜方。'),('mouseWin','13-mouseWin.png','鼠队获胜','服务器确认时间到，3 / 6 未达标；本轮结果保留。'),('cancelled','14-cancelled.png','本局取消','不计胜负；无胜利勾选或奖杯；重新准备由组织者管理。'),('gallery','15-dev.png','界面调试台','常规三列 / 大字体两列；统一猫橘鼠绿，所有入口可达。'),('drawer','16-drawer.png','对局详情','单层抽屉，名单 / 事件 / 规则；关闭靠右，操作按角色裁剪。')]
normal=json.loads((out/'verified/metrics.json').read_text()); large=json.loads((out/'large/metrics.json').read_text())
assert normal['status']==large['status']=='PASS'; assert len(normal['records'])==len(large['records'])==16
parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>02-01 设计与实际页面对照</title><style>body{margin:0;background:#f5faf1;color:#102f36;font:16px/1.6 system-ui,sans-serif}header,main{max-width:1080px;margin:auto;padding:24px}h1{font-size:30px}article{background:white;border:1px solid #d5e4d7;border-radius:20px;padding:20px;margin-bottom:24px}.screens{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}figure{margin:0}figcaption{font-weight:700;text-align:center}img{display:block;width:100%;height:580px;object-fit:contain;background:#f5faf1;border-radius:12px}a{color:#175c35}p{color:#607481}@media(max-width:700px){.screens{grid-template-columns:1fr}img{height:auto}}</style><header><h1>02-01 · 设计与微信实际页面对照</h1><p>左：模型设计稿；中：微信 IDE 实际截图；右：应用文字倍率 1.3。字形 / 派生插画不是逐像素相同；真实对局使用真实地图。正常 16、文字倍率 16、处理器集成 8 项，详细证据见 <a href="VERIFICATION.txt">VERIFICATION.txt</a>。</p><nav>']
for id,_,title,_ in cases: parts.append(f'<a href="#{id}">{html.escape(title)}</a> · ')
parts.append('</nav></header><main>')
for i,(id,ref,title,note) in enumerate(cases,1):
    paths=[root/'design/2026-10-11/page-concepts-v1'/ref,out/'verified'/f'{id}.png',out/'large'/f'{id}.png']
    parts.append(f'<article id="{id}"><h2>{i:02d} · {html.escape(title)}</h2><p>{html.escape(note)}</p><div class="screens">')
    for label,p in zip(['设计稿','实际页面 · 390×844','应用文字倍率 · 1.3'],paths):
        assert p.is_file(); b=p.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n'; w,h=struct.unpack('>II',b[16:24]);assert w>0 and h>0
        uri=os.path.relpath(p,out).replace('\\','/')
        parts.append(f'<figure><figcaption>{label}</figcaption><a href="{uri}"><img loading="lazy" src="{uri}" alt="{html.escape(title+label)}"></a></figure>')
    parts.append('</div></article>')
parts.append('<h2>大字体滚动可达</h2><p>处理器 / 渲染集成检查已验证滚动后底部返回动作可达，不缩小文字硬塞一屏。</p><img src="interactions/gallery-bottom.png" alt="大字体调试台滚动至底部"><p>真机、320px 实际设备、系统字体现尚待验证。没有用模型图替代这些验收。</p></main></html>')
(out/'compare.html').write_text(''.join(parts),encoding='utf-8'); print('COMPARISON_VERIFY=16 groups / 48 PNG references PASS')
