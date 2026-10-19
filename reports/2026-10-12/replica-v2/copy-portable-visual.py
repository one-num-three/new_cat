from pathlib import Path
import re,shutil,hashlib,json
src=Path(r'C:/Users/Keke_/.codex/visualizations/2026/10/08/01a11c62-1472-7df3-b8a1-a6a4aff1d66b/final-readonly-audit')
dst=Path(r'D:/cat-mouse-miniprogram/reports/2026-10-12/replica-v2/visual')
for ext,out in [('html','compare.html'),('json','comparison.json'),('md','COMPARISON.md')]:
    shutil.copy2(src/('FINAL_VISUAL_COMPARISON.'+ext),dst/out)
refs=re.findall(r'<img[^>]+src="([^"]+)"',(dst/'compare.html').read_text(encoding='utf8'))
for name in refs:
    s=(src/name).resolve();assert s.is_relative_to(src.resolve()) and s.is_file()
    d=dst/name;d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(s,d)
    assert hashlib.sha256(d.read_bytes()).digest()==hashlib.sha256(s.read_bytes()).digest()
assert len(refs)==70
print('PORTABLE_VISUAL_REOPEN=PASS references='+str(len(refs)))
