from pathlib import Path
import json,io,math,hashlib,html
from PIL import Image,ImageDraw,ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from pypdf import PdfReader

root=Path('D:/cat-mouse-miniprogram')
report=root/'reports/2026-10-19/product-handoff-v1'
rows=json.loads((report/'screenshots.json').read_text(encoding='utf8'))
assert len(rows)==33
assert all(r['manualReview'] for r in rows)
output=root/'output/pdf';output.mkdir(parents=True,exist_ok=True)
pdf=output/'猫鼠行动-产品页面总览-2026-10-19.pdf'
pdfmetrics.registerFont(TTFont('UI','C:/Windows/Fonts/msyh.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('UIB','C:/Windows/Fonts/msyhbd.ttc',subfontIndex=0))
W,H=A4
PAPER=colors.HexColor('#faf8ee');INK=colors.HexColor('#223c32');MUTED=colors.HexColor('#61736a');GREEN=colors.HexColor('#337757');ORANGE=colors.HexColor('#da7339');LINE=colors.HexColor('#d9e0d5')
c=canvas.Canvas(str(pdf),pagesize=A4,pageCompression=1)
c.setTitle('猫鼠行动 | 产品页面与状态总览 | 2026-10-19')
c.setAuthor('猫鼠行动项目')
styles={'body':ParagraphStyle('body',fontName='UI',fontSize=10,leading=16,textColor=INK,wordWrap='CJK'),
        'small':ParagraphStyle('small',fontName='UI',fontSize=8.5,leading=13,textColor=MUTED,wordWrap='CJK')}
page_count=len(rows)+3

def text(x,y,s,size=10,bold=False,color=INK):
 c.setFillColor(color);c.setFont('UIB' if bold else 'UI',size);c.drawString(x,y,s)
def para(s,x,y,width,kind='body'):
 p=Paragraph(html.escape(s).replace('\n','<br/>'),styles[kind]);_,h=p.wrap(width,H);p.drawOn(c,x,y-h);return y-h

def base(num,section):
 c.setFillColor(PAPER);c.rect(0,0,W,H,fill=1,stroke=0)
 text(18*mm,H-16*mm,'猫鼠行动',10,True)
 text(110*mm,H-16*mm,section,9,color=MUTED)
 c.setStrokeColor(LINE);c.line(18*mm,18*mm,W-18*mm,18*mm)
 text(18*mm,11*mm,'本地开发版实拍 · 2026-10-19',8,color=MUTED)
 c.setFillColor(MUTED);c.setFont('UI',8);c.drawRightString(W-18*mm,11*mm,f'{num:02d} / {page_count:02d}')

def picture(file,x,y,width,height):
 im=Image.open(file).convert('RGB');buf=io.BytesIO();im.save(buf,'JPEG',quality=94,subsampling=0,optimize=True)
 c.drawImage(ImageReader(buf),x,y,width=width,height=height,preserveAspectRatio=True,anchor='c',mask='auto')

base(1,'产品交接 / 页面现状')
text(18*mm,H-39*mm,'猫鼠行动',32,True)
text(18*mm,H-55*mm,'页面与状态总览',25,True)
text(18*mm,H-70*mm,'7 个可见页面 · 33 张微信截图 · 关键流程与异常状态',12,color=GREEN)
y=H-91*mm
for title,body in [
 ('交付目的','供产品经理检查当前界面、关键动作和流程覆盖，逐项批注后安排下一轮开发。截图来自现有微信小程序，不是生图概念稿。'),
 ('版本范围','截图日期2026-10-19。使用当前本地代码、像素风格与Fusion Pixel字体；地图包含九龙湖、四牌楼和玄武湖。'),
 ('证据边界','全部在微信开发工具中拍摄，使用显式开发样例。阵营、名单、事件、二维码、对局结果和断线均为演示状态。本人定位示例明确是电脑模拟。不是本轮真实联机、抓捕或真机GPS验收。'),
 ('使用方法','先看下一页目录，再按截图编号查看用途、主要交互和检查点。原始PNG、HTML总览及截图清单保留在交接目录中。PDF可单独转发，不依赖附件。')]:
 text(18*mm,y,title,12,True);y=para(body,18*mm,y-7*mm,174*mm)-13*mm
text(18*mm,48*mm,'当前示例：8人 = 2猫 + 6鼠，猫捕获目标4人',12,True,color=ORANGE)
para('30秒躲藏，6分钟追逐。取消不计胜负。积分商店与技能尚未在当前玩法中启用。',18*mm,40*mm,174*mm,'small')
c.showPage()

base(2,'阅读目录 / 按流程编号')
text(18*mm,H-34*mm,'页面索引',22,True)
para('同一路由中的展开、抽屉、异常和结算分开截图；长页面保留上下屏。内部资源加载页立即跳转，不是独立产品页面。',18*mm,H-44*mm,174*mm,'small')
y=H-67*mm
for i,r in enumerate(rows):
 if i==16:y=H-67*mm
 col=0 if i<16 else 1;x=(18+90*col)*mm
 title=r['title'];label=r['id'][:2]+'  '+title
 text(x,y,label,8.5)
 c.linkRect('',r['id'],(x,y-2*mm,x+84*mm,y+4*mm),relative=0,thickness=0)
 y-=11*mm
c.showPage()

issues=[
 ('需修正','首页滚动后的自定义顶栏','第02图中，页面滚动后标题与系统状态栏发生挤压。保留原样截图作为问题证据，未为交接临时修饰。'),
 ('需修正','对局地图的首次视角','第09图中，本人蓝爪位于初始地图视口左边缘且被裁切。需检查对局首次进入时的本人聚焦，不能只验证坐标已成功投影。'),
 ('需决策','动态码的两种呈现','当前同时保留地图弹层与独立动态码页（16、17）。请确认是否统一主入口，独立页是否继续对外可达。'),
 ('需决策','人数开放与试点规模','UI当前允许2–60人、猫鼠各至少1人且相加相等；主试点建议6–12人。人数配置上限不是实际并发或体验承诺。'),
 ('需决策','场地范围与定位参考','创建页活动半径固定200米。九龙湖参考网覆盖保存校界，不能据此推导整校都适合追逐。请确认组织者确认流程。'),
 ('待现场验证','定位、手势和重连','本材料只有模拟器截图；真实定位偏差、持续刷新、后台与断网重连体验需手机实测。'),
 ('待单独设计','积分商店与技能','当前页面没有启用积分购买、背包或三级技能，不能把历史草案当成已实现。后续先确认积分来源和一次选购多份的使用规则。')]
base(3,'交接重点 / 不以截图代替验收')
text(18*mm,H-34*mm,'产品经理优先检查',22,True);y=H-49*mm
for tag,title,body in issues:
 text(18*mm,y,tag,9,True,color=ORANGE if tag.startswith('需') else GREEN)
 text(44*mm,y,title,11,True)
 y=para(body,44*mm,y-5*mm,148*mm,'small')-11*mm
para('状态记录：前一轮2026-10-18已有144项回归与官方编译证据。本轮任务是页面截图与文档整理，未重跑业务全量测试，也未发布或修改线上数据。',18*mm,40*mm,174*mm,'small')
c.showPage()

for index,r in enumerate(rows,start=4):
 base(index,r['group'])
 c.bookmarkPage(r['id']);c.addOutlineEntry(r['id'][:2]+' '+r['title'],r['id'],level=0,closed=False)
 text(18*mm,H-33*mm,r['id'][:2]+'  '+r['title'],18,True)
 img_path=report/'screenshots'/r['screenshot'];im=Image.open(img_path)
 height=224*mm;width=height*im.width/im.height
 x=18*mm;y=H-46*mm-height
 c.setFillColor(colors.HexColor('#e5e8dd'));c.roundRect(x-1*mm,y-1*mm,width+2*mm,height+2*mm,4*mm,fill=1,stroke=0)
 picture(img_path,x,y,width,height)
 tx=132*mm;tw=60*mm;ty=H-51*mm
 for title,body in [('页面用途',r['purpose']),('产品检查点',r['review']),('画面来源','当前微信开发工具实拍。开发样例/演示状态，非真实玩家对局。'),('截图规格',f"{r['screenshotWidth']} × {r['screenshotHeight']} 像素，画面等比保留；逻辑窗口 {r['window']['windowWidth']} × {r['window']['windowHeight']}。")]:
  text(tx,ty,title,10,True,color=GREEN);ty=para(body,tx,ty-6*mm,tw,'small')-12*mm
 route=r.get('launchRoute',r['route']).split('?')[0]
 text(tx,ty,'页面路由',10,True,color=GREEN);ty=para(route,tx,ty-6*mm,tw,'small')-10*mm
 if r.get('observedIssue'):
  text(tx,ty,'截图发现',10,True,color=ORANGE);ty=para(r['observedIssue'],tx,ty-6*mm,tw,'small')-5*mm
 assert ty>24*mm,(r['id'],ty)
 c.showPage()
c.save()
reader=PdfReader(str(pdf));assert len(reader.pages)==page_count
for i,r in enumerate(rows,start=3):
 t=reader.pages[i].extract_text();assert r['title'] in t,(i,r['title'])

# One visual index; original screenshots remain untouched.
font=ImageFont.truetype('C:/Windows/Fonts/msyh.ttc',20);big=ImageFont.truetype('C:/Windows/Fonts/msyhbd.ttc',36)
cols=6;cellw=280;cellh=655;gap=24;header=132;nr=math.ceil(len(rows)/cols)
sheet=Image.new('RGB',(gap+(cellw+gap)*cols,header+nr*cellh+42),'#faf8ee');d=ImageDraw.Draw(sheet)
d.text((gap,22),'猫鼠行动 · 全页面截图索引',font=big,fill='#223c32')
d.text((gap,78),'2026-10-19 / 微信模拟器实拍 / 开发样例，不代表真机验收',font=font,fill='#61736a')
for i,r in enumerate(rows):
 x=gap+(i%cols)*(cellw+gap);y=header+(i//cols)*cellh
 im=Image.open(report/'screenshots'/r['screenshot']).convert('RGB');im.thumbnail((cellw,590))
 sheet.paste(im,(x+(cellw-im.width)//2,y));label=r['id'][:2]+' '+r['title']
 while d.textlength(label,font=font)>cellw:label=label[:-2]+'…'
 d.text((x,y+600),label,font=font,fill='#223c32')
sheet.save(report/'全页面截图索引.png')
manifest={'pdf':str(pdf),'pages':page_count,'screenshots':len(rows),'bytes':pdf.stat().st_size,'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(),'textChecksPassed':True,'visualReviewPending':True}
(report/'pdf-verification.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(manifest,ensure_ascii=False))
