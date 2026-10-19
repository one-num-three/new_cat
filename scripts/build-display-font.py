from pathlib import Path
import hashlib,json,re,base64
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
root=Path(__file__).resolve().parents[1]
source=Path('C:/Windows/Fonts/NotoSansSC-VF.ttf')
f=TTFont(source); names=[(n.nameID,n.toUnicode()) for n in f['name'].names if n.nameID in [0,13,14]]
assert any('SIL Open Font License' in t for _,t in names)
f=instantiateVariableFont(f,{'wght':900},inplace=True)
words='猫鼠行动和熟人到户外玩一场分钟的追逐创建活动邀请伙伴先取个名字加入房间我来组织开始游戏准备本局结算记录队获胜取消不计胜负已达到捕获目标时间停下展示动态码附近有注意观察鼠先躲藏本轮出局暂停连接中断正在重连队伍规则操作扫码确认抓捕橘色区域仅代表大致线索留意周围环境动态码界面调试台活动准备游戏进行异常状态结果我的昵称复制房间码人数配置场地确认位置信息试点版紧急返回首页分享朋友全员你来打开成员名单抓获玩家退出信息恢复失效等待同步授权服务已结束追逐剩余集合点已准备未准备查看详情再一局结束结果已确认重连中躲藏阶段00:4518262/46309·，。! ' + 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
options=subset.Options(); options.flavor='woff'; options.name_IDs=[0,1,2,3,4,6,13,14]; options.name_legacy=True; options.name_languages=['*']; options.recalc_timestamp=False
words += '每个状态，都能预览开发预览组织一场追逐伙伴到齐，就出发房间码玩家准备本局人数集合点与活动范围'
s=subset.Subsetter(options=options);s.populate(text=words);s.subset(f)
for n in f['name'].names:
    if n.nameID in [1,4,6]: n.string=('CatMouseDisplay' if n.nameID!=4 else 'CatMouse Display Black').encode(n.getEncoding())
f.flavor='woff'; out=root/'assets/faithful-v2/display-black.woff'; f.save(out)
(root/'utils/display-font.wxss').write_text('/* CatMouseDisplay: subset of Noto Sans SC Black; SIL OFL 1.1. License: assets/faithful-v2/FONT-LICENSE.txt. Static UI titles only; user text uses system fallback. */\n@font-face{font-family:CatMouseDisplay;font-style:normal;font-weight:900;src:url("data:font/woff;base64,'+base64.b64encode(out.read_bytes()).decode('ascii')+'") format("woff");font-display:swap;}\n',encoding='utf8')
manifest={'family':'CatMouseDisplay','weight':900,'source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'path':out.relative_to(root).as_posix(),'bytes':out.stat().st_size,'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'staticDisplayOnly':True,'sourceLicenseMetadata':names,'coverage':sorted(set(words))}
(root/'design/2026-10-12/faithful-art/font.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
print('DISPLAY_FONT_SUBSET bytes='+str(out.stat().st_size)+' glyphs='+str(len(f.getBestCmap())))

