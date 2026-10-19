"""Approximate roof footprints manually traced from official 2025 raster, pixels.
Scope: southwest x<650,y>=497; P8 is represented in the eastern data file.
Courtyard buildings are split into wings. Roof/shadow edges have several-pixel uncertainty, not statistically measured.
"""
import json
from pathlib import Path
B=[]
NOTE='Height estimated from building function, not measured; footprint manually traced from 2025 official plan (several-pixel outline uncertainty; not statistically measured).'
NAMES={'E1':'橘园宿舍一组','E2':'橘园宿舍二组','C2':'机械工程学院楼','C3':'工科大楼','C4':'工培中心A','C5':'能环科研综合楼（科远楼）','C6':'机械动力平台','C7':'计算机科学与工程学院楼（含软件学院）','C8':'电工电子中心及信息平台','C9':'物理学院楼','G1':'橘园食堂','D1':'校行政用房','D2':'师生服务楼','K1':'师生服务中心','M3':'风雨操场','W2':'停车楼','T':'百笙堂','U1':'博物馆、艺术中心U1','U2':'博物馆、艺术中心U2','U3':'博物馆、艺术中心U3','U4':'博物馆、艺术中心U4'}
def poly(label,part,points,status='existing',h=24,group='academic',note=None,confidence='estimated'):
 B.append(dict(id=f'SW-{label}-{part}',name_cn=f'{NAMES.get(label,"发展学科楼"+label)}·{part}',group=group,status=status,footprint_px=[list(p) for p in points],height_m=h,height_confidence=confidence,height_note=note or NOTE,plan_label=label))
def rect(label,part,x0,y0,x1,y1,**kw):
 poly(label,part,[(x0,y0),(x1,y0),(x1,y1),(x0,y1)],**kw)
def ring(label,part,outer,inner,**kw):
 x0,y0,x1,y1=outer;a,b,c,d=inner
 rect(label,part+'-N',x0,y0,x1,b,**kw);rect(label,part+'-S',x0,d,x1,y1,**kw)
 rect(label,part+'-W',x0,b,a,d,**kw);rect(label,part+'-E',c,b,x1,d,**kw)
# W2 planned parking mass; the gap around the label is an open landscaped court.
poly('W2','west',[(162,509),(188,509),(188,519),(179,519),(179,538),(162,538)],status='planned',h=15,group='parking')
rect('W2','east',197,515,211,538,status='planned',h=15,group='parking')
rect('W2','link',188,513,198,518,status='planned',h=9,group='parking')
# E2 repeated slim north-south dormitory arrangement; open gaps remain open.
for i,(ya,yb,l0,l1,r0,r1) in enumerate([(550,557,151,178,184,210),(568,575,153,179,184,211),(583,590,154,179,186,211),(599,606,156,181,188,212),(612,618,157,182,189,213)],1):
 rect('E2',f'west-{i}',l0,ya,l1,yb,h=20,group='dormitory')
 rect('E2',f'east-{i}',r0,ya,r1,yb,h=20,group='dormitory')
rect('E2','east-link-1',209,556,214,569,h=12,group='dormitory')
rect('E2','east-link-2',210,575,215,583,h=12,group='dormitory')
rect('E2','east-link-3',211,590,216,599,h=12,group='dormitory')
rect('E2','east-link-4',212,606,217,613,h=12,group='dormitory')
# E1 paired courtyard dormitory blocks. Wings retain all eight courtyard voids.
for i,(outer,inner1,inner2) in enumerate([
 ((172,668,231,689),(178,675,195,682),(204,675,224,682)),
 ((179,699,235,717),(185,704,202,710),(209,704,229,710)),
 ((184,726,239,747),(190,732,205,740),(214,732,233,740)),
 ((189,755,237,774),(195,762,209,769),(219,762,232,769)),
],1):
 x0,y0,x1,y1=outer;a,b,c,d=inner1;e,f,g,h=inner2
 rect('E1',f'{i}-north',x0,y0,x1,b,h=20,group='dormitory')
 rect('E1',f'{i}-south-west',x0,d,c+3,y1,h=20,group='dormitory')
 rect('E1',f'{i}-south-east',e-3,h,x1,y1,h=20,group='dormitory')
 rect('E1',f'{i}-west',x0,b,a,d,h=20,group='dormitory')
 rect('E1',f'{i}-middle',c,b,e,d,h=20,group='dormitory')
 rect('E1',f'{i}-east',g,b,x1,d,h=20,group='dormitory')
# Western faculties. C2/C4 courtyards are roof-free.
ring('C4','court',(237,502,269,534),(244,512,260,523))
ring('C2','court',(281,502,321,534),(289,513,312,522))
rect('C2','east-lobby',321,513,327,524,h=12)
# C5 source-supported vertical hierarchy. Only the overall 57m/north 14F is exact.
rect('C5','north-tower',240,547,271,558,h=57,confidence='source_supported',note='Official SEU sources report north wing 14 floors and overall height 57 m; 57 m assigned to this north mass. Roof outline approximate. https://jbjsc.seu.edu.cn/2019/0812/c18325a282290/page.htm ; https://power.seu.edu.cn/2024/0118/c9515a479596/pagem.htm')
rect('C5','south-wing',241,570,271,580,h=36,note='Official source reports south wing 9 floors; 36 m is an estimated massing height (4 m/floor), not a measured height. https://power.seu.edu.cn/2024/0118/c9515a479596/pagem.htm')
rect('C5','west-podium',232,557,242,589,h=12,note='Official source reports western podium 3 floors; 12 m is estimated, not measured. https://power.seu.edu.cn/2024/0118/c9515a479596/pagem.htm')
rect('C5','east-link',263,558,271,570,h=24,note='East courtyard connecting wing height is estimated; no exact wing-specific source verified.')
rect('C6','north',254,582,286,590)
rect('C6','east',278,590,286,608)
rect('C6','south',255,600,278,608)
rect('C6','west-low',241,589,254,603,h=12)
# C3 orange construction complex. Six polygon strips preserve two landscaped atria.
c3note='2025 plan marks construction. Main wings use an estimated 32 m massing height; contractor reports structural maximum 47.7 m, which is not a uniform roof height. Tower position is not reliably identifiable, so no 85 m tower is invented. https://ccusc.cscec.com/dxxinwenzhongxin/xwkx11/202411/3827067.html ; 2026 construction update https://jbjsc.seu.edu.cn/2026/0826/c44715a580451/page.htm'
kw=dict(status='under_construction',h=32,note=c3note)
poly('C3','upper-west',[(299,555),(310,547),(310,558),(312,569),(312,585),(321,590),(321,598),(309,602),(301,596)],**kw)
poly('C3','upper-north',[(310,547),(337,547),(347,563),(339,571),(329,556),(313,568),(310,558)],**kw)
poly('C3','upper-east',[(339,571),(347,563),(359,573),(353,575),(348,575),(346,584),(336,591),(324,598),(321,590),(332,583)],**kw)
poly('C3','upper-east-annex',[(359,573),(363,578),(366,587),(361,593),(347,592),(346,584),(348,584),(355,583),(358,580),(353,575)],**kw)
poly('C3','lower-west',[(309,602),(321,598),(335,593),(346,592),(343,601),(336,613),(338,621),(345,627),(340,638),(331,631),(324,619),(324,611),(316,614)],**kw)
poly('C3','lower-east-south',[(347,592),(361,588),(379,592),(379,628),(367,638),(357,641),(340,638),(345,627),(357,628),(368,622),(367,608),(357,600),(343,601)],**kw)
# G1 cafeteria.
poly('G1','main',[(171,632),(199,632),(199,649),(208,649),(208,654),(171,654)],h=16,group='dining')
# Planned museum/art center pavilions on the southern crescent; no fictitious U5.
poly('U2','main',[(355,511),(374,507),(386,533),(367,547)],status='planned',h=18,group='culture')
poly('U1','main',[(405,550),(424,558),(417,580),(391,568)],status='planned',h=18,group='culture')
poly('U3','main',[(476,558),(494,549),(510,568),(483,580)],status='planned',h=18,group='culture')
poly('U4','main',[(516,507),(538,513),(527,547),(505,532)],status='planned',h=18,group='culture')
rect('T','hall',440,566,457,581,status='planned',h=15,group='culture')
# Existing faculties either side of the south ceremonial spine.
ring('C7','court',(393,610,430,641),(402,623,420,632))
ring('C8','court',(479,610,516,643),(487,622,507,631))
ring('C9','court',(565,626,601,655),(575,636,592,646))
# Planned P1 and west satellite.
pkw=dict(status='planned',h=24,group='academic')
poly('P1','west-satellite-north',[(293,663),(311,645),(321,653),(316,658),(310,654),(299,667)],**pkw)
poly('P1','west-satellite-east',[(321,653),(330,662),(330,680),(324,680),(324,665),(316,658)],**pkw)
rect('P1','west-satellite-south',294,672,324,680,**pkw)
rect('P1','main-south',350,674,380,681,**pkw)
poly('P1','main-north-west',[(348,650),(369,650),(369,658),(357,658),(357,668),(348,668)],**pkw)
poly('P1','round-east',[(375,650),(380,652),(382,657),(380,662),(376,664),(371,662),(369,657),(371,652)],**pkw)
rect('P1','east-link',374,663,378,674,h=12,status='planned')
ring('P2','court',(394,651,432,681),(402,660,422,671),**pkw)
# P3/P4 share a southern bar, while the northern P4 plot is left open.
poly('P3','north-west',[(481,651),(514,651),(514,661),(490,661),(490,669),(481,669)],**pkw)
rect('P3','east',508,661,516,671,**pkw)
rect('P3','south',481,673,517,681,**pkw)
rect('P4','south-wing',517,670,549,681,**pkw)
# P5 low southern block and east triangular planned partner.
rect('P5','south',565,669,603,677,**pkw)
rect('P5','west',565,659,573,669,**pkw)
rect('P5','east',593,660,603,669,**pkw)
poly('P5','east-partner-north',[(612,646),(624,648),(640,660),(635,664),(623,655),(617,654)],**pkw)
rect('P5','east-partner-west',612,646,618,676,**pkw)
poly('P5','east-partner-south',[(618,668),(640,668),(640,661),(646,666),(646,678),(618,678)],**pkw)
# P6 triangular courtyard and lower gate wing.
poly('P6','north',[(527,613),(547,597),(558,606),(552,611),(547,606),(534,617)],**pkw)
rect('P6','west',527,616,535,638,**pkw)
rect('P6','east',552,611,559,631,**pkw)
rect('P6','south',535,632,559,641,**pkw)
poly('P6','east-annex',[(566,608),(578,614),(578,620),(563,620)],**pkw)
rect('P6','annex-link',559,614,566,618,h=12,status='planned')
# P7 north and south courts, both within western scope. P8 is defined in the eastern data file.
ring('P7','north-court',(579,503,615,533),(588,513,605,524),**pkw)
rect('P7','northwest-link',580,533,587,549,h=12,status='planned')
rect('P7','northeast-link',607,533,613,549,h=12,status='planned')
rect('P7','south-court-north',578,550,613,558,**pkw)
poly('P7','south-court-west',[(578,550),(586,554),(578,568),(594,578),(590,584),(568,571)],**pkw)
poly('P7','south-court-east',[(605,558),(613,558),(613,577),(601,592),(593,587),(605,571)],**pkw)
# Administrative / student service district around south gate.
poly('D1','north',[(371,702),(385,702),(385,699),(420,699),(420,717),(371,717)],h=24,group='administration')
rect('D1','south-stem',387,717,397,735,h=24,group='administration')
poly('D2','main',[(348,720),(358,720),(358,741),(389,741),(389,755),(348,755)],status='planned',h=20,group='service')
rect('D2','link',358,731,387,738,status='planned',h=9,group='service')
# K1 planned service center: preserve inner court.
poly('K1','north-west',[(482,700),(516,700),(516,706),(528,706),(528,717),(509,717),(509,712),(492,712),(492,725),(482,725)],status='planned',h=20,group='service')
rect('K1','middle-west',482,725,515,732,status='planned',h=20,group='service')
rect('K1','middle-east',537,707,544,731,status='planned',h=20,group='service')
rect('K1','middle-link',515,722,537,728,status='planned',h=9,group='service')
poly('K1','south',[(506,731),(515,731),(515,737),(545,737),(545,750),(506,750)],status='planned',h=20,group='service')
# M3 is a roofed gym/sports hall. Adjacent M4 track and fields deliberately omitted.
poly('M3','hall',[(296,701),(333,701),(337,705),(337,717),(333,720),(296,720),(293,716),(293,706)],status='planned',h=16,group='sports')
# Validate the southwest bounding box and all polygon vertices.
for b in B:
 assert len(b['footprint_px'])>=3
 assert all(0<=x<650 and y>=497 for x,y in b['footprint_px']),(b['id'],b['footprint_px'])
 assert len(set(map(tuple,b['footprint_px'])))>=3
 assert b['status'] in {'existing','planned','under_construction'}
Path(__file__).with_name('southwest_buildings.json').write_text(json.dumps(B,ensure_ascii=False,indent=2)+'\n')
from collections import Counter
print(len(B),'components;',dict(Counter(b['status'] for b in B)))
