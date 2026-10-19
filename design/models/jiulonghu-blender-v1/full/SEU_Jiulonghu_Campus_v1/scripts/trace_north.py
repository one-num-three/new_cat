"""Manual schematic footprint trace from the official 1375 x 867 plan.
Coordinates refer to original top-left image. This is NOT a survey."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
B=[]
def poly(id,name,g,p,h=24,status='existing',conf='estimated',note='体量高度估算；未取得逐栋实测或竣工高度。',**kw):
 B.append(dict(id=id,name_cn=name,group=g,status=status,footprint_px=p,height_m=h,height_confidence=conf,height_note=note,plan_label=g,**kw))
def rect(id,name,g,x1,y1,x2,y2,h=24,status='existing',**kw):poly(id,name,g,[[x1,y1],[x2,y1],[x2,y2],[x1,y2]],h,status,**kw)
# Northwest reception buildings and Zhongshan College, islands omitted from buildings.
poly('J1_main','接待中心一期','J1',[[145,181],[156,181],[156,188],[163,188],[163,203],[154,209],[146,209]],15)
rect('J2_north','接待中心二期北翼','J2',172,182,211,192,12,'planned')
poly('J2_east','接待中心二期东南翼','J2',[[205,194],[214,194],[214,218],[184,218],[184,210],[205,210]],12,'planned')
rect('J2_southwest','接待中心二期西南翼','J2',163,210,175,222,9,'planned')
# Zhongshan College orange footprint is construction, not established whole island.
rect('S_north','钟山书院北楼','S',206,277,224,290,18,'under_construction')
rect('S_west','钟山书院西楼','S',198,289,206,311,15,'under_construction')
rect('S_east','钟山书院东楼','S',218,293,233,302,15,'under_construction')
rect('S_south','钟山书院南楼','S',204,311,225,319,15,'under_construction')
rect('S_link','钟山书院连廊','S',207,289,219,294,9,'under_construction')
rect('X4_n','给水增压站','X4',348,238,359,248,6,'planned')
rect('X2_n','库房','X2',360,238,370,248,6,'planned')
# Planned research centre: open courts, not a full solid rectangle.
poly('R_west','科研中心西翼','R',[[383,202],[417,202],[417,224],[392,224],[392,233],[417,233],[417,257],[383,257],[383,248],[407,248],[407,242],[383,242],[383,216],[406,216],[406,211],[383,211]],24,'planned')
poly('R_east','科研中心东翼','R',[[483,202],[515,202],[515,211],[492,211],[492,219],[515,219],[515,243],[492,243],[492,250],[515,250],[515,258],[483,258],[483,234],[506,234],[506,228],[483,228]],24,'planned')
rect('R_nw','科研中心北西楼','R',391,179,406,193,18,'planned')
rect('R_center_w','科研中心中西楼','R',427,211,444,226,18,'planned')
rect('R_center_e','科研中心中东楼','R',455,211,472,226,18,'planned')
rect('R_axis','科研中心轴线连接','R',446,199,453,221,12,'planned')
rect('X1_main','变配电所','X1',493,175,518,196,8)
for k,xy in enumerate([(530,174,558,182),(584,174,609,182),(551,188,580,196),(610,189,633,198)]):rect('P15_'+str(k),'发展学科楼P15','P15',*xy,20,'planned')
# C18 biomedical. Tower location schematic within the plan footprint; floors verified only.
rect('C18_north','生医科研综合楼北裙楼','C18',527,225,553,237,16,conf='floor_derived',note='辅楼4层有官方依据，按4.0m/层估算；非实测高度。')
rect('C18_south','生医科研综合楼南裙楼','C18',527,253,556,263,16,conf='floor_derived',note='辅楼4层有官方依据，按4.0m/层估算。')
rect('C18_west_tower','生医科研综合楼主楼示意','C18',527,237,539,253,52,conf='floor_derived',note='主楼13层有官方依据；52m按4.0m/层估算；主辅楼分区位置待核实。',floors=13,source='https://fzwyh.seu.edu.cn/2021/0330/c12368a366808/page.htm')
# C19 information and electronics official total height applies to the main tower only.
rect('C19_main','信息电子教学综合楼主楼示意','C19',572,207,604,222,55.8,conf='source_height',note='官方建筑高度55.80m；女儿墙59.39m。主楼14层；此主楼与裙楼分区位置为总平图示意，待实测定位。',floors=14,parapet_m=59.39,source='https://radio.seu.edu.cn/2019/0130/c1589a262700/pagem.htm')
rect('C19_east','信息电子教学综合楼东裙楼','C19',604,213,620,260,12,conf='floor_derived',note='裙楼3层有依据；12m按4m/层估算。')
rect('C19_south','信息电子教学综合楼第二主楼示意','C19',574,250,604,261,55.8,conf='source_height',note='官方竣工照片有双高层主楼；项目建筑高度55.80m。双塔等高与所在翼段为示意，非逐塔测绘。',floors=14,source='https://jbjsc.seu.edu.cn/2023/0412/c18724a441552/page.htm')
rect('C19_west','信息电子教学综合楼西裙楼','C19',571,231,581,250,12,conf='floor_derived',note='裙楼3层有依据；12m按4m/层估算。')
# Northwest academic area
poly('C17_main','人文社科科研楼','C17',[[294,284],[371,284],[371,314],[333,314],[325,297],[294,297]],24)
# courtyard void kept clear by separate wings
rect('C17_north','人文社科科研楼北翼','C17',294,284,371,296,24)
# replace overlapping polygon with non-overlapping south/east wings
B=[b for b in B if b['id']!='C17_main']
rect('C17_east','人文社科科研楼东翼','C17',355,296,371,315,24)
poly('C17_south','人文社科科研楼南翼','C17',[[326,296],[336,296],[340,306],[355,306],[355,315],[334,315]],24)
for k,xy in enumerate([(329,326,352,337),(329,340,352,349)]):rect('C15_'+str(k),'文学院楼','C15',*xy,20)
# C16 and C11/13/14 use courtyard U patterns
for g,name,x,y,w,h,ht in [('C15_lower','文学院楼',329,350,24,29,24),('C11','材料学院楼',480,291,31,29,28),('C13','化工学院楼',480,330,31,29,24),('C14','材料化工综合楼',516,330,30,29,24),('C16','经管学院楼',358,342,25,37,20)]:
 rect(g+'_n',name,g.split('_')[0],x,y,x+w,y+9,ht)
 rect(g+'_s',name,g.split('_')[0],x,y+h-9,x+w,y+h,ht)
 rect(g+'_w',name,g.split('_')[0],x,y+9,x+8,y+h-9,ht)
 if g!='C11':rect(g+'_e',name,g.split('_')[0],x+w-7,y+9,x+w,y+h-9,ht)
# Planned P14 two courtyard bars between C17 and axis
poly('P14_n','发展学科楼P14北楼','P14',[[394,289],[419,289],[419,314],[394,314],[394,306],[411,306],[411,298],[394,298]],22,'planned')
poly('P14_s','发展学科楼P14南楼','P14',[[394,322],[419,322],[419,349],[394,349],[394,341],[411,341],[411,331],[401,331],[401,338],[394,338]],22,'planned')
rect('P14_bottom','发展学科楼P14南附楼','P14',394,354,419,365,18,'planned')
rect('U5_n','博物馆艺术中心U5北段','U5',440,290,458,319,14,'planned')
rect('U5_s','博物馆艺术中心U5南段','U5',440,338,458,366,14,'planned')
rect('U5_link','博物馆艺术中心U5连廊','U5',440,319,447,338,8,'planned')
# C12 north engineering experiment hall: void omitted at low-res scale.
rect('C12_north','土木交通试验平台北实验大厅','C12',520,285,562,323,16)
# C10 Civil & Transportation: verified floors, approximate wing assignment and conversion
rect('C10_north','土木交通学科楼北楼示意','C10',614,280,644,290,64,conf='floor_derived',note='北楼16层；按4.0m/层估算64m；分段定位来自低分辨率总平图。',floors=16,source='https://xxgk.seu.edu.cn/2015/0104/c10804a114263/page.htm')
rect('C10_south','土木交通学科楼南楼示意','C10',614,321,644,331,56,conf='floor_derived',note='南楼14层；按4.0m/层估算56m。',floors=14)
rect('C10_east','土木交通学科楼连接裙楼','C10',634,290,644,321,12,conf='floor_derived',note='连接楼3层；按4m/层估算。')
poly('C12_east_hall','土木交通试验平台东大厅','C12',[[580,281],[607,281],[607,330],[580,330],[580,315],[586,315],[586,297],[580,297]],16)
# Future technology building now construction, 5 floors official
poly('P13_main','未来技术楼','P13',[[513,364],[559,364],[565,371],[565,387],[510,387],[500,380],[500,374]],22,'under_construction',conf='floor_derived',note='规划地上5层，22m为示意换算；2026-08官方报告仍幕墙装修。',floors=5,source='https://www.ccgp.gov.cn/cggg/zygg/gkzb/202410/t20241010_23327982.htm')
poly('P17_main','发展学科楼P17','P17',[[589,342],[615,342],[615,352],[598,352],[598,359],[621,359],[621,370],[589,370]],22,'planned')
# Library: 2 courtyards and projecting east-west wings
rect('B_north','李文正图书馆北翼','B',417,410,481,423,25,conf='floor_derived',note='官方导览覆盖1–5层；25m为示意估算，非实测总高。',source='https://lib.seu.edu.cn/list.php?fid=797')
rect('B_south','李文正图书馆南翼','B',417,442,481,455,25,conf='floor_derived',note='官方导览覆盖1–5层；25m为示意估算。')
for id,x1,x2 in [('B_w',417,429),('B_m',443,455),('B_e',469,481)]:rect(id,'李文正图书馆主体','B',x1,423,x2,442,25,conf='floor_derived',note='5层导览；25m为估算。')
rect('B_annex_w','李文正图书馆西附翼','B',405,424,417,443,18)
rect('B_annex_e','李文正图书馆东附翼','B',481,424,493,443,18)
# Graduate teaching / Jizhong building separate from A1
rect('A2_north','纪忠楼/研究生教学楼北翼','A2',286,448,324,457,20)
rect('A2_south','纪忠楼/研究生教学楼南翼','A2',286,469,324,478,20)
rect('A2_west','纪忠楼/研究生教学楼西翼','A2',286,457,295,469,20)
rect('A2_east','纪忠楼/研究生教学楼东翼','A2',316,457,324,469,20)
rect('A2_entry','纪忠楼/研究生教学楼入口连接','A2',268,439,281,469,16)
rect('A2_lowwest','纪忠楼/研究生教学楼西附楼','A2',241,469,286,477,12)
rect('A2_loweast','纪忠楼/研究生教学楼东附楼','A2',324,459,333,470,12)
# Architecture school planned courtyard blocks west of lake
poly('C1_nw','建筑学院楼西北翼','C1',[[149,400],[176,400],[176,408],[158,408],[158,429],[174,429],[174,437],[149,437]],20,'planned')
rect('C1_ne','建筑学院楼东北翼','C1',176,401,210,411,20,'planned')
poly('C1_s','建筑学院楼南院','C1',[[175,437],[207,437],[207,447],[184,447],[184,464],[200,464],[200,474],[175,474]],20,'planned')
# Undergraduate teaching complex A1, eight instructional bars, schematic connectors
for k,xy in enumerate([(579,399,619,410),(586,425,620,435),(586,445,620,455),(586,468,620,480),(634,394,669,405),(634,415,669,425),(634,436,669,447),(634,458,669,470)]):
 rect('A1_bar_'+str(k+1),'本科生教学楼教学单元'+str(k+1),'A1',*xy,20,note='教学楼单元逐栋层数未核实；20m为统一初模估算，不代表测量。')
# lower three west bars connect, all east bars connect; preserve open courtyards
rect('A1_w_connector','本科生教学楼西侧连廊','A1',586,435,592,468,12)
rect('A1_e_w_connector','本科生教学楼东组西连廊','A1',634,405,640,458,12)
rect('A1_e_e_connector','本科生教学楼东组东连廊','A1',663,405,669,458,12)
rect('A1_w_entry1','本科生教学楼西南入口','A1',578,438,586,448,15)
rect('A1_w_entry2','本科生教学楼西北入口','A1',578,458,586,468,15)
rect('A1_e_entry1','本科生教学楼东组入口一','A1',669,405,678,415,15)
rect('A1_e_entry2','本科生教学楼东组入口二','A1',669,425,678,436,15)
rect('A1_e_entry3','本科生教学楼东组入口三','A1',669,447,678,458,15)
(ROOT/'data/north_buildings.json').write_text(json.dumps(B,ensure_ascii=False,indent=2))
print(len(B),'north/central building components')
