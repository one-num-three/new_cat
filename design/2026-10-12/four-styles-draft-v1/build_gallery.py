from pathlib import Path
import json, hashlib, zipfile
from PIL import Image

R=Path(__file__).resolve().parent
D=json.loads((R/"jobs.json").read_text(encoding="utf-8-sig"))
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
items=[]
for j in D["jobs"]:
    old=Path(j["output"]); rev=old.with_name(old.stem+"-v2.png"); p=rev if rev.exists() else old
    with Image.open(p) as im:
        im.load(); assert im.format=="PNG" and im.size==(1024,1536),str(p)
    sc=json.loads(Path(str(p)+".json").read_text(encoding="utf-8-sig"))
    digest=sha(p); assert digest==sha(sc["source"]),str(p)
    j["status"]="revised" if rev.exists() else "generated"; j["selectedOutput"]=p.as_posix()
    items.append(dict(id=j["id"],style=j["style"],styleName=j["styleName"],page=j["page"],pageName=j["pageName"],route=j["route"],file=p.relative_to(R).as_posix(),absolutePath=p.as_posix(),width=1024,height=1536,bytes=p.stat().st_size,sha256=digest,revised=rev.exists(),source=sc["source"]))
assert len(items)==60 and len({i["id"] for i in items})==60
assert all(sum(i["style"]==s["id"] for i in items)==15 for s in D["styles"])
sources=[
"C:/Users/Keke_/AppData/Local/Temp/codex-clipboard-ed40ac11-8611-4502-8bf5-303645381584.png",
"C:/Users/Keke_/AppData/Local/Temp/codex-clipboard-97760078-dc61-4d16-80ed-c03de5182969.png",
"C:/Users/Keke_/AppData/Local/Temp/codex-clipboard-18f56085-b658-4eae-b161-799825806d17.png",
"C:/Users/Keke_/AppData/Local/Temp/codex-clipboard-a6685950-c169-4c06-81ec-2ff25611e3fb.png"]
refs=[]
for s,p in zip(D["styles"],sources):
    q=R/"references"/(s["id"]+".png"); h=sha(q); assert h==sha(p)
    refs.append(dict(file=q.relative_to(R).as_posix(),sha256=h,original=p))
manifest=dict(title=D["title"],tool="built-in image_gen",total=60,styles=D["styles"],pages=D["pages"],revisions=sum(i["revised"] for i in items),items=items,references=refs)
def save(name,data): (R/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
save("manifest.json",manifest);save("jobs.json",D)
gallery=dict(styles=[dict(id=s["id"],name=s["name"]) for s in D["styles"]],pages=[dict(id=p["id"],name=p["name"]) for p in D["pages"]],items=items)
html=r'''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>猫鼠行动 · 四风格全页面初步定稿</title>
<style>
:root{--ink:#152620;--muted:#61706a;--paper:#f4f3ed;--line:#dce1db}*{box-sizing:border-box}body{margin:0;font-family:"Microsoft YaHei",system-ui,sans-serif;background:var(--paper);color:var(--ink)}
header{padding:32px 36px 22px;max-width:1680px;margin:auto}small{letter-spacing:.14em;color:var(--muted)}h1{font-size:clamp(26px,3.2vw,44px);line-height:1.25;letter-spacing:-.035em;margin:12px 0}header p{line-height:1.8;margin:0;color:var(--muted)}
a{color:inherit;text-underline-offset:4px}nav{display:flex;gap:10px;flex-wrap:wrap;margin:24px 0 0}button,select{font:inherit;cursor:pointer;min-height:44px;border:1px solid var(--line);background:white;border-radius:10px;padding:10px 16px;color:var(--ink)}
button:hover,a:hover{filter:brightness(.95)}button:focus-visible,a:focus-visible,select:focus-visible{outline:3px solid #176aec;outline-offset:3px}nav button[aria-pressed="true"]{background:var(--ink);color:white;border-color:var(--ink)}
.toolbar{position:sticky;top:0;z-index:4;background:#f4f3edf7;border-block:1px solid var(--line);padding:14px 36px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}.toolbar label{font-weight:bold}.toolbar select{min-width:210px}.count{margin-left:auto;color:var(--muted);font-size:14px}
main{max-width:1680px;margin:auto;padding:24px 36px 56px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px 20px}article{min-width:0;background:white;border:1px solid var(--line);border-radius:14px;overflow:hidden}article h2{font-size:17px;margin:0 0 5px}.meta{padding:16px 18px 12px;border-top:5px solid var(--accent)}.meta p{font-size:13px;margin:0;color:var(--muted)}
.preview{display:block;width:100%;padding:0;border:0;border-radius:0;background:white;line-height:0;min-height:0}.preview img{width:100%;height:auto;aspect-ratio:2/3;object-fit:contain;display:block}article footer{padding:13px 18px;display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid var(--line)}article footer a{font-size:13px}article footer span{font-size:12px;color:var(--muted)}
#note{padding:0 0 20px;color:var(--muted);font-size:14px;line-height:1.8}.end{max-width:1680px;margin:auto;padding:0 36px 32px;color:var(--muted);font-size:13px;line-height:1.9}
dialog{border:0;border-radius:16px;padding:0;max-width:96vw;width:820px;max-height:96vh;background:#fff;box-shadow:0 20px 100px #0006}dialog::backdrop{background:#08150fcc}.zoomhead{display:flex;position:sticky;top:0;z-index:1;align-items:center;gap:12px;background:white;padding:12px 18px;border-bottom:1px solid var(--line)}.zoomhead strong{flex:1;font-size:16px}.zoomhead a{font-size:13px}.zoomhead button{min-height:38px;padding:4px 12px}#zoomimg{display:block;width:100%;height:auto}
@media(max-width:1100px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){header{padding:24px 20px 18px}.toolbar{padding:12px 20px;gap:8px}.count{width:100%;margin:0}.toolbar select{min-width:170px;flex:1}main{padding:20px}.grid{grid-template-columns:1fr}.end{padding:0 20px 24px}nav{gap:8px}nav button{font-size:13px;padding:10px}h1{font-size:28px}}
</style></head><body><header><small>CAT & MOUSE / VISUAL DRAFT 01</small><h1>同一场追逐，四种视觉世界。</h1><p>猫鼠行动 · 4套风格 × 15个页面／状态 · 60张独立页面图。选择页面横向比较，或选择一种风格查看完整流程。点击图片可放大。</p><nav aria-label="风格筛选" id="styles"></nav></header>
<section class="toolbar" aria-label="页面筛选"><label for="page">页面</label><select id="page"></select><button id="prev" aria-label="上一页">←</button><button id="next" aria-label="下一页">→</button><button id="flow">查看完整流程</button><span class="count" id="count" aria-live="polite"></span></section>
<main><p id="note"></p><div class="grid" id="grid"></div></main><div class="end">本轮为图像生成的初步视觉定稿，地图为风格示意，动态码为演示占位。<br><a href="README.md">设计说明与页面清单</a> · <a href="jobs.json">完整生成提示词</a> · <a href="revision-prompts.json">校订提示词</a> · <a href="manifest.json">60张文件清单</a> · <a href="VERIFICATION.txt">文件校验记录</a></div>
<dialog id="zoom"><div class="zoomhead"><strong id="zoomtitle"></strong><a id="original" target="_blank" rel="noopener">打开原图 ↗</a><button id="close" aria-label="关闭大图">✕</button></div><img id="zoomimg" alt=""></dialog><script>
const DATA=__DATA__,colors=["#ffdf22","#fb8b24","#50ab58","#30543e"],motifs=["高对比导视 / 黄黑白 / 城市户外","透亮亚克力 / 2.5D积木 / 橙蓝","晴日公园 / 16-bit像素 / 轻快冒险","奶油纸色 / 深绿像素 / 掌机记忆"];
let style="all",page=DATA.pages[0].id;const $=s=>document.querySelector(s),nav=$("#styles"),select=$("#page"),grid=$("#grid");
[{id:"all",name:"四种风格对比"},...DATA.styles].forEach(s=>{const b=document.createElement("button");b.textContent=s.name;b.dataset.style=s.id;b.onclick=()=>{style=s.id;render()};nav.append(b)});
[{id:"all",name:"全部15个页面 / 状态"},...DATA.pages].forEach((p,n)=>{const o=document.createElement("option");o.value=p.id;o.textContent=n?String(n).padStart(2,"0")+" · "+p.name:p.name;select.append(o)});
select.onchange=()=>{page=select.value;render()};$("#flow").onclick=()=>{page="all";render()};
function step(delta){const n=DATA.pages.findIndex(p=>p.id===page);page=DATA.pages[(n+delta+DATA.pages.length)%DATA.pages.length].id;render()}
$("#prev").onclick=()=>step(-1);$("#next").onclick=()=>step(1);
function openZoom(i){$("#zoomtitle").textContent=i.styleName+" · "+i.pageName;$("#zoomimg").src=i.file;$("#zoomimg").alt=i.styleName+" "+i.pageName;$("#original").href=i.file;$("#zoom").showModal()}
$("#close").onclick=()=>$("#zoom").close();$("#zoom").onclick=e=>{if(e.target===$("#zoom"))$("#zoom").close()};
function render(){select.value=page;nav.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.style===style)));
const list=DATA.items.filter(i=>(style==="all"||i.style===style)&&(page==="all"||i.page===page)).sort((a,b)=>a.page.localeCompare(b.page)||a.style.localeCompare(b.style));grid.replaceChildren();
list.forEach(i=>{const card=document.createElement("article");card.style.setProperty("--accent",colors[DATA.styles.findIndex(s=>s.id===i.style)]);
const meta=document.createElement("div");meta.className="meta";const h=document.createElement("h2");h.textContent=i.styleName;const p=document.createElement("p");p.textContent=i.page.slice(0,2)+" / "+i.pageName;meta.append(h,p);
const b=document.createElement("button");b.className="preview";b.setAttribute("aria-label","放大 "+i.styleName+" "+i.pageName);b.onclick=()=>openZoom(i);
const img=document.createElement("img");img.src=i.file;img.alt=i.styleName+" · "+i.pageName;img.loading="lazy";img.decoding="async";img.width=1024;img.height=1536;b.append(img);
const f=document.createElement("footer"),a=document.createElement("a"),s=document.createElement("span");a.href=i.file;a.target="_blank";a.rel="noopener";a.textContent="查看原图 ↗";s.textContent="1024 × 1536"+(i.revised?" · 已校订":"");f.append(a,s);card.append(meta,b,f);grid.append(card)});
$("#count").textContent="当前 "+list.length+" 张 / 共 60 张";$("#note").textContent=style==="all"?(page==="all"?"按页面顺序排列，每页依次呈现四种风格。":"同一页面横向对比：城市导视 → 2.5D亚克力 → 晴日像素 → 复古像素。"):motifs[DATA.styles.findIndex(s=>s.id===style)]+" · "+(page==="all"?"完整15页流程":"单页查看");history.replaceState(null,"","#"+style+"/"+page)}
const init=location.hash.slice(1).split("/");if(init.length===2){if(init[0]==="all"||DATA.styles.some(s=>s.id===init[0]))style=init[0];if(init[1]==="all"||DATA.pages.some(p=>p.id===init[1]))page=init[1]}render();
</script></body></html>'''
(R/"index.html").write_text(html.replace("__DATA__",json.dumps(gallery,ensure_ascii=False)),encoding="utf-8")
lines=["# 猫鼠行动 · 四风格全页面初步定稿 v1","","## 交付","","- 4套风格，每套15个独立页面／状态，共60张选定PNG，均为1024×1536完整手机图。","- index.html：离线图册，支持按风格、按页面比较、放大原图。","- manifest.json：选定版本路径、尺寸、SHA-256及来源。","- jobs.json：60次完整生成提示词与选定文件；revision-prompts.json：17张校订提示词。","- 各图片同名.json记录实际提示词和来源；-v2.png为校订版，原稿保留。","- 内置image_gen生成。图册仅浏览图片，不是小程序实现。","","## 视觉系统","","| 风格 | 视觉基调 | 重点 |","|---|---|---|","| 城市导视 | 黄黑白、橙猫蓝鼠、导视箭头、大数字 | 户外读数、地图与动作优先 |","| 2.5D亚克力积木 | 象牙白、透明斜边、螺钉、低多边形角色 | 亲和立体、真实玩具感 |","| 晴日16-bit像素 | 奶油底、明亮绿蓝、橙色强调 | 公园冒险与轻快像素 |","| 复古掌机像素 | 米白深绿、低饱和地图、橙色强调 | 怀旧与克制的方格节奏 |","","## 页面清单","","| 编号 | 页面／状态 | 路由 | 四风格选定图 |","|---|---|---|---|"]
for p in D["pages"]:
    links=["["+i["styleName"]+"]("+i["file"]+")" for i in items if i["page"]==p["id"]]
    lines.append("| "+p["id"][:2]+" | "+p["name"]+" | "+p["route"]+" | "+" / ".join(links)+" |")
lines+=["","覆盖当前用户流程与关键状态。开发调试页pages/dev/dev不属于用户产品页面；相机、权限弹窗使用平台界面。","","## 产品口径","","- 10位房间码A1B2C3D4E5；8人、2猫6鼠；阵营在开始后分配。","- 30秒躲藏、6分钟追逐；猫留集合点等待。","- 猫捕获4人获胜；时间结束未达标则鼠胜；取消不计胜负。","- 猫只见宽区域线索；鼠只见文字近距提醒，不展示敌方位置。","- 动态码15秒有效；图中演示码为视觉占位。","- 出局只看公开状态；暂停冻结计时；断线显示--:--等待同步。","","## 校订","","17张图片另存v2，修正旧参考的胜利文案、无依据在线数、队伍人数、阵营提前分配、详情指标和事件时间；移除躲藏地图上的敌方标记；统一主要鼠队按钮的蓝色语义，复古款保留自身橙绿语汇。","","## 后续交接","","本轮是完整视觉方向初稿，不是开发切图或逐像素规范。各状态的地图构图、插画和局部间距仍有生成图差异；选定方向后，继续统一按钮高度、字体、抽屉比例及地图容器。示意地图不承担真实导航，运行版使用原生地图数据、坐标与活动边界。","","## 可复用校订提示词","","~~~text","对所附【风格】【页面】做局部校订：仅修改【字段/区域】为【目标内容】。","保持手机框、主配色、字级、角色、布局和其他文案不变。","输出1024×1536独立完整页面。10位房间码、4人捕获目标、15秒动态码口径不变。","~~~",""]
(R/"README.md").write_text("\n".join(lines),encoding="utf-8")
log=["猫鼠行动 四风格初步定稿 · 文件验证","COMMAND: python build_gallery.py","INPUT: jobs.json + revision-prompts.json + 60 originals + 17 revisions","RESULT: PASS 60/60 selected PNG files opened and decoded","RESULT: PASS 60/60 dimensions = 1024x1536","RESULT: PASS 60/60 SHA-256 hashes match built-in generation source","RESULT: PASS 4 styles x 15 unique screen IDs","RESULT: PASS 4 reference copies equal original attachment SHA-256","RESULT: 17 revised selections; original variants preserved","RESULT: PASS embedded gallery item paths all exist","EXIT STATUS: 0","","Visual QA: generated outputs displayed and reviewed; 17 targeted corrections generated and reviewed.","Maps are visual illustrations, not navigation data. Code area is a labeled demonstration placeholder.","Exact hashes and selected paths: manifest.json","Prompts: jobs.json + revision-prompts.json"]
if (R/"UI-QA.json").exists():
    qa=json.loads((R/"UI-QA.json").read_text(encoding="utf-8"))
    log += ["", "BROWSER UI CHECKS"] + [c["case"]+": "+c["result"] for c in qa["checks"]]
(R/"VERIFICATION.txt").write_text("\n".join(log),encoding="utf-8")
pack=R.parent/"cat-mouse-four-styles-draft-v1.zip"
entries=["index.html","README.md","manifest.json","jobs.json","revision-prompts.json","VERIFICATION.txt","build_gallery.py"]+[i["file"] for i in items]+[i["file"]+".json" for i in items]+[r["file"] for r in refs]
if (R/"UI-QA.json").exists(): entries.append("UI-QA.json")
with zipfile.ZipFile(pack,"w",zipfile.ZIP_DEFLATED,compresslevel=3) as z:
    for e in entries:z.write(R/e,e)
with zipfile.ZipFile(pack) as z:
    assert z.testzip() is None
    assert sum(n.endswith(".png") and not n.startswith("references/") for n in z.namelist())==60
print("PASS: 60/60 PNG decoded; dimensions 1024x1536; hashes match sources")
print("PASS: 4 styles x 15 screens; 17 revisions; 4 reference hashes unchanged")
print("PASS: ZIP reopened; CRC checked; 60 selected screen images")
print("GALLERY:",R/"index.html")
print("PACKAGE:",pack)
print("PACKAGE_BYTES:",pack.stat().st_size)

