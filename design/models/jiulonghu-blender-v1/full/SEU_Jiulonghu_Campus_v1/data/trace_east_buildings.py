import json, math
from pathlib import Path
OUT=Path(__file__).resolve().parent
B=[]
PLAN='seu-jiulonghu-official-masterplan-2025.jpg; original image 1375 x 867 pixels'
def add(id,name,group,status,poly,height=20,label=None,note=None,confidence='estimated',**kw):
    obj={'id':id,'name_cn':name,'group':group,'status':status,'footprint_px':[[round(float(x),2),round(float(y),2)] for x,y in poly],'height_m':height,'height_confidence':confidence,'height_note':note or '概念体量估计，非测量高度；按建筑用途赋值。','plan_label':label or group,'footprint_note':'依2025年官方总平面图手工描摹的简化轮廓；保留主要凹口及庭院，不代表施工图精度。','source_image':PLAN}
    obj.update(kw);B.append(obj)
def rect(id,name,group,status,x0,y0,x1,y1,height=20,**kw):
    add(id,name,group,status,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)],height,**kw)
def interp(a,b,t):return (a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)
def bilerp(q,u,v):return interp(interp(q[0],q[1],u),interp(q[3],q[2],u),v)
def ring(id,name,group,status,q,tx=.17,ty=.25,height=20,label=None,note=None):
    # Four editable wings surround a true open courtyard; no overlapping ring faces.
    inn=[bilerp(q,tx,ty),bilerp(q,1-tx,ty),bilerp(q,1-tx,1-ty),bilerp(q,tx,1-ty)]
    for i,side in enumerate(['N','E','S','W']):
        j=(i+1)%4
        add(id+'_'+side,name+' · '+{'N':'北翼','E':'东翼','S':'南翼','W':'西翼'}[side],group,status,[q[i],q[j],inn[j],inn[i]],height,label=label,note=note)
def ringrect(id,name,group,status,x0,y0,x1,y1,height=20,tx=.17,ty=.25,**kw):
    ring(id,name,group,status,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)],tx,ty,height,**kw)
def oval(id,name,group,status,cx,cy,rx,ry,height,steps=24,**kw):
    add(id,name,group,status,[(cx+rx*math.cos(2*math.pi*i/steps),cy+ry*math.sin(2*math.pi*i/steps)) for i in range(steps)],height,**kw)

# Northeast services. Small M3 is a roof-like planned covered sports structure, not the adjacent open lawn.
rect('M3_NE','风雨操场（东北规划小体量）','M3','planned',665,178,680,187,8,note='低置信度概念高度8m；M3为风雨操场，图示很小，简化为有顶体育设施。',footprint_note='M3标记覆盖小型浅色轮廓，具体屋顶边界不清；未将周边草地体量化。')
add('L_01','医院','L','existing',[(658,195),(687,195),(691,199),(691,221),(684,221),(684,204),(658,204)],16)
add('N_01','保卫及后勤楼','N','existing',[(673,231),(687,231),(693,235),(694,241),(674,242)],12)

# Lanyuan graduate housing: plan is orange, even though later official reporting says it opened in August 2025.
e3note='高度24m仅为统一示意值，非实测。项目官方报道为5栋、最高18层及地下1层，未能将具体楼栋层数与本图逐一对应，因此未把全部楼栋建为18层。'
e3extra={'status_current':'existing_reported_2025_08','status_current_note':'保留2025总平面图橙色在建状态；学校2025-08-25报道兰园公寓已正式启用。','status_source':'https://xxgk.seu.edu.cn/2025/0825/c10804a537033/page.htm','height_source':'https://www.sbc-mcc.com/mtzx/xmdt/202507/t20250729_296751.html'}
add('E3_NW','兰园宿舍1 · 西北体量','E3','under_construction',[(701,175),(705,175),(705,170),(722,170),(726,173),(723,185),(702,185)],24,note=e3note,**e3extra)
add('E3_E','兰园宿舍1 · 东侧折线体量','E3','under_construction',[(732,169),(765,169),(765,212),(761,217),(757,213),(757,204),(744,201),(741,193),(756,193),(756,178),(732,178)],24,note=e3note,**e3extra)
add('E3_SW','兰园宿舍1 · 西南庭院翼','E3','under_construction',[(706,200),(731,200),(734,209),(720,209),(724,229),(746,225),(751,235),(715,239)],24,note=e3note,**e3extra)
add('E4_NW','兰园宿舍2 · 西北翼','E4','planned',[(783,168),(811,168),(807,177),(783,177)],24)
add('E4_NE','兰园宿舍2 · 东北折翼','E4','planned',[(817,168),(838,168),(838,191),(831,191),(831,177),(814,177)],24)
rect('E4_S','兰园宿舍2 · 东南翼','E4','planned',816,192,838,200,24)
add('E4_DIAG','兰园宿舍2 · 斜向连翼','E4','planned',[(807,178),(813,178),(801,192),(795,192)],16)
rect('I_01','教师公寓','I','existing',782,193,805,201,20,footprint_note='I标记位于E4南侧蓝灰窄翼；E4及I分界受图例标记遮挡，边界为近似。')
# Q innovation center: four wings deliberately leave central courtyard open.
add('Q_N','创新中心 · 北翼','Q','planned',[(865,171),(880,171),(880,183),(889,183),(897,196),(890,198),(883,188),(865,188)],24)
add('Q_W','创新中心 · 西翼','Q','planned',[(859,185),(865,188),(865,225),(857,225)],24)
add('Q_S','创新中心 · 南翼','Q','planned',[(853,224),(880,224),(880,229),(888,230),(888,235),(854,235)],24)
rect('Q_E','创新中心 · 东翼','Q','planned',882,211,901,226,24)
rect('G6_01','兰园食堂','G6','planned',847,250,860,279,10)
rect('E5_N','兰园宿舍3 · 北翼','E5','planned',868,251,897,259,20)
rect('E5_M','兰园宿舍3 · 中翼','E5','planned',865,263,895,270,20)
rect('E5_S','兰园宿舍3 · 南翼','E5','planned',868,273,897,281,20)
rect('E5_E','兰园宿舍3 · 东连翼','E5','planned',892,257,898,276,20)

# Taoyuan undergraduate courtyard dormitory blocks. Six-storey/20m is a massing assumption.
dormnote='旧宿舍概念体量高度估计20m，约相当于六层；未查得逐栋实测高度，不作为层数或高度的事实断言。'
groups=[
('NW','桃园西北片',[
[(665,264),(687,260),(691,278),(668,282)],[(690,259),(709,255),(714,273),(694,278)],
[(670,290),(693,286),(697,305),(674,309)],[(696,285),(718,281),(721,299),(699,304)]]),
('NC','桃园中北片',[
[(719,255),(744,251),(746,268),(719,272)],[(747,251),(769,247),(772,263),(749,267)],
[(721,282),(746,278),(749,297),(723,301)],[(749,278),(774,274),(776,292),(752,297)]]),
('NE','桃园东北片',[
[(782,248),(805,248),(805,264),(782,265)],[(808,248),(832,248),(831,264),(808,264)],
[(782,275),(805,275),(805,292),(782,293)],[(808,275),(832,275),(831,292),(808,292)]]),
('ME','桃园中东片',[
[(778,309),(801,309),(801,325),(778,326)],[(804,309),(827,309),(827,325),(804,325)],
[(777,336),(801,336),(801,353),(777,353)],[(804,336),(827,336),(827,353),(804,353)]]),
('SE','桃园东南片',[
[(775,366),(798,366),(798,383),(775,384)],[(801,366),(823,366),(823,383),(801,383)],
[(774,394),(798,394),(798,410),(774,410)],[(801,394),(823,394),(823,410),(801,410)]])]
for loc,name,qs in groups:
    for j,q in enumerate(qs,1):ring(f'F1_{loc}_{j:02}',name+f'{j}号院','F1','existing',q,.16,.27,20,label='F1',note=dormnote)
for label,cx,cy in [('F1c',805.5,269.5),('F1b',802.5,329.5),('F1a',799.5,389.5)]:
    oval(label+'_ADD','桃园宿舍书院增建 · '+label,label,'under_construction',cx,cy,5,5.5,8,8,note='橙黄色书院增建小体量，8m为示意估计。')

# Two old Taoyuan dining halls: official dining-service page identifies 2F, height still estimated.
dining_note='官方餐饮服务介绍桃园北、南食堂各2层；屋顶高度仍按约10m估计，非测量高度。'
add('G3_01','桃园食堂2（北）','G3','existing',[(690,322),(719,316),(728,348),(696,351)],10,note=dining_note,height_source='https://zwc.seu.edu.cn/_t3170/cyfw_61983/list.psp')
add('G2_01','桃园食堂1（南）','G2','existing',[(718,350),(730,350),(731,364),(734,368),(733,386),(700,386),(699,376),(693,372),(693,363),(718,363)],10,note=dining_note,height_source='https://zwc.seu.edu.cn/_t3170/cyfw_61983/list.psp')
add('H_01','大学生活动中心（焦廷标馆）','H','existing',[(704,397),(731,397),(731,394),(745,394),(749,400),(748,428),(744,432),(727,432),(725,423),(715,423),(710,427),(705,427),(702,424),(700,418),(703,413),(708,407),(705,403)],22)
# Sports halls. Swimming hall exact reported height; M1 wings estimated.
oval('M1_MAIN','体育馆 · 主馆','M1','existing',757,488.5,22,22,22,32,note='体育馆高度22m为示意估计；中央近圆形屋顶按平面图简化。')
rect('M1_W','体育馆 · 西耳房','M1','existing',725,480,738,497,12)
rect('M1_E','体育馆 · 东耳房','M1','existing',776,480,789,497,12)
add('M1_NW','体育馆 · 西北翼','M1','existing',[(719,456),(750,456),(754,459),(754,467),(718,468),(715,464)],12)
add('M1_NE','体育馆 · 东北翼','M1','existing',[(762,457),(792,457),(797,462),(796,466),(762,468)],12)
add('M1_SW','体育馆 · 西南翼','M1','existing',[(717,509),(749,507),(754,510),(754,518),(721,518)],12)
add('M1_SE','体育馆 · 东南翼','M1','existing',[(762,508),(790,509),(798,512),(795,518),(762,518)],12)
rect('M1_NLINK','体育馆 · 北连廊','M1','existing',753,459,762,470,12)
rect('M1_SLINK','体育馆 · 南连廊','M1','existing',753,507,762,517,12)
add('M2_01','游泳馆','M2','existing',[(776,419),(811,419),(817,423),(818,433),(814,438),(776,438),(771,434),(770,424)],11.05,confidence='official_reported',note='东南大学官方报道：地上2层、地下1层，建筑高度11.05m。',height_source='https://news.seu.edu.cn/2019/0430/c5486a271243/page.htm')

# East faculty courtyard plots. Label P11 is somewhat obscured in source raster.
ringrect('P11_01','发展学科楼（北侧，图标近似P11）','P11','planned',842,446,882,473,24,tx=.22,ty=.25,note='24m为规划体量示意估计；北侧图标小字疑似P11，待高清源核对。')
ringrect('P18_01','发展学科楼（南侧）','P18','planned',842,503,882,532,24,tx=.25,ty=.26)

# Meiyuan dormitory mixed-use complex: orange massing only; central courts remain open.
rect('F3_NW_N','梅园宿舍综合体 · 西北北翼','F3','under_construction',696,541,748,549,26)
rect('F3_NW_S','梅园宿舍综合体 · 西北南翼','F3','under_construction',696,568,748,575,26)
rect('F3_NW_M1','梅园宿舍综合体 · 西北中西翼','F3','under_construction',716,547,720,570,26)
rect('F3_NW_M2','梅园宿舍综合体 · 西北中东翼','F3','under_construction',727,547,731,570,26)
rect('F3_NE_N','梅园宿舍综合体 · 东北北翼','F3','under_construction',764,541,818,549,26)
rect('F3_NE_S','梅园宿舍综合体 · 东北南翼','F3','under_construction',764,568,818,575,26)
rect('F3_NE_M1','梅园宿舍综合体 · 东北中西翼','F3','under_construction',782,547,786,570,26)
rect('F3_NE_M2','梅园宿舍综合体 · 东北中东翼','F3','under_construction',793,547,797,570,26)
rect('F3_SE_N','梅园宿舍综合体 · 东南北翼','F3','under_construction',764,592,819,600,26)
rect('F3_SE_S','梅园宿舍综合体 · 东南南翼','F3','under_construction',764,620,819,627,26)
rect('F3_SE_M','梅园宿舍综合体 · 东南中翼','F3','under_construction',782,599,785,621,26)
add('G5_01','梅园食堂2（北）','G5','under_construction',[(701,586),(744,586),(744,594),(723,594),(723,608),(701,608)],12,note='新建食堂体量高度估计12m；未沿用旧梅园食堂2层证据。')
add('G4_01','梅园食堂1（南）','G4','existing',[(726,595),(739,595),(739,616),(743,620),(742,637),(715,637),(709,633),(708,618),(726,618)],10,note='按旧食堂约2层体量估计10m；图示蓝灰色既有建筑。')

# Meiyuan existing dormitories: one northern pair plus two 3-row clusters.
for i,(x0,x1) in enumerate([(761,785),(789,812)],1):
    ringrect(f'F2_N_{i}','梅园宿舍1 · 北部庭院'+str(i),'F2','existing',x0,644,x1,660,20,note=dormnote)
for col,(xa,xb) in enumerate([(700,748),(760,808)],1):
    for row,(ya,yb) in enumerate([(673,690),(701,718),(729,746)],1):
        for j in range(2):
            x0=xa+j*25;x1=x0+23
            ringrect(f'F2_{col}_{row}_{j+1}','梅园宿舍1 · '+str(col)+'区'+str(row)+'排'+str(j+1)+'号院','F2','existing',x0,ya,x1,yb,20,note=dormnote)
for label,cx,cy in [('F2a',724.5,721.5),('F2b',782.5,722.5)]:
    oval(label+'_ADD','梅园宿舍书院增建 · '+label,label,'under_construction',cx,cy,5,5.5,8,8,note='橙黄色书院增建小体量，8m为示意估计。')

# Southeast parking and faculty plot.
rect('W1_01','停车楼','W1','planned',831,679,858,691,12)
rect('P9_NE','发展学科楼 · 东北楼','P9','planned',865,683,886,695,24)
add('P9_W','发展学科楼 · 西北折楼','P9','planned',[(832,705),(846,705),(846,716),(839,716),(839,727),(832,727)],24)
rect('P9_E','发展学科楼 · 东中楼','P9','planned',858,710,879,721,24)
rect('P9_SW','发展学科楼 · 西南楼','P9','planned',831,734,851,745,24)
rect('P9_SE','发展学科楼 · 东南楼','P9','planned',859,733,878,743,24)
add('P9_LINK','发展学科楼 · 连廊','P9','planned',[(845,702),(860,702),(860,708),(876,708),(876,711),(854,711),(854,723),(851,723),(851,708),(845,708)],10,note='连廊10m为示意估计；灰色连接区与屋顶阴影分界模糊。')

# Full P8 plot assigned across quadrant boundary, with two principal open courts.
ringrect('P8_N','发展学科楼P8 · 北庭院','P8','planned',631,504,676,532,24,tx=.19,ty=.25)
rect('P8_MLINK','发展学科楼P8 · 中连楼','P8','planned',657,532,667,547,24)
rect('P8_M','发展学科楼P8 · 中横楼','P8','planned',640,548,677,557,24)
rect('P8_W','发展学科楼P8 · 中西翼','P8','planned',635,553,644,575,24)
rect('P8_E','发展学科楼P8 · 中东翼','P8','planned',658,556,665,579,24)
add('P8_S','发展学科楼P8 · 南折翼','P8','planned',[(636,580),(663,580),(663,600),(654,600),(654,588),(636,588)],24)
rect('P8_SW','发展学科楼P8 · 西南翼','P8','planned',622,597,641,606,24,footprint_note='P8西南浅色短翼跨出东区边界，整体归P8以保持完整。')

# Validate footprints and serialize.
ids=set()
for b in B:
    assert b['id'] not in ids,b['id'];ids.add(b['id'])
    p=b['footprint_px'];assert len(p)>=3
    area=abs(sum(p[i][0]*p[(i+1)%len(p)][1]-p[(i+1)%len(p)][0]*p[i][1] for i in range(len(p)))/2)
    assert area>1,(b['id'],area)
    b['footprint_area_px2']=round(area,2)
# Retain2025source states, then apply2026-10-16 confirmed Lan yuan dormitory completion.
for obj in B:
    obj['plan_status_2025']=obj['status']
    if obj['plan_label'] in ['E3','E4','E5']:
        obj['status']='existing'
        obj['status_current']='existing_confirmed_by_user_2026_10_16'
        obj['status_current_note']='用户2026-10-16确认右上角兰园宿舍已经建成；高度仍为估算。'
OUT.mkdir(exist_ok=True,parents=True)
(OUT/'east_buildings.json').write_text(json.dumps(B,ensure_ascii=False,indent=2)+'\n')
from collections import Counter
print('Components:',len(B));print('Statuses:',dict(Counter(b['status'] for b in B)));print('Groups:',dict(Counter(b['group'] for b in B)))
