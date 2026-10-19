"""Apply the user's 2026-10-16 correction, retaining historical plan status."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
for fn in ['east_buildings.json','buildings.json']:
 p=R/'data'/fn;b=json.load(open(p))
 for o in b:
  o.setdefault('plan_status_2025',o['status'])
  if o['plan_label']in ['E3','E4','E5']:
   o['status']='existing'
   o['status_current']='existing_confirmed_by_user_2026_10_16'
   o['status_current_note']='用户2026-10-16查看全校预览后确认右上兰园宿舍已经建成；仅更正兰园宿舍E3/E4/E5，不连带改相邻设施。'
   o['status_confirmation_date']='2026-10-16'
   o['height_note']=o['height_note'].replace('保留2025总平面图橙色在建状态；','')
 p.write_text(json.dumps(b,ensure_ascii=False,indent=2))
print('Lan yuan E3/E4/E5: 11 massing components changed to existing, historical statuses preserved.')
