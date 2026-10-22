"""Back up, switch one systemd WorkingDirectory, verify; restore unit on failure."""
import json,os,subprocess,time,urllib.request
from pathlib import Path
base=Path('/opt/cat-mouse');release=base/'release-20261019-real-v1';unit=Path('/etc/systemd/system/catmouse-api.service')
assert release.is_dir() and not release.is_symlink()
assert json.loads((release/'acceptance-postgres.json').read_text())['status']=='PASS'
stats=subprocess.check_output(['runuser','-u','postgres','--','psql','-d','catmouse','-Atc',"SELECT count(*) FROM rooms WHERE state->'match'->>'phase' IN ('HIDING','CHASING','PAUSED')"],text=True).strip()
assert stats=='0','ACTIVE_MATCHES_REQUIRE_A_SCHEDULED_SWITCH'
old=unit.read_bytes();old_text=old.decode();assert 'WorkingDirectory=/opt/cat-mouse/release-20261011b' in old_text
stamp=str(int(time.time()));backup=base/('backup-before-real-rooms-'+stamp+'.dump');unit_backup=base/('unit-before-real-rooms-'+stamp+'.service')
subprocess.run(['runuser','-u','postgres','--','pg_dump','-Fc','catmouse'],stdout=backup.open('wb'),check=True);os.chmod(backup,0o600)
subprocess.run(['pg_restore','--list',str(backup)],stdout=subprocess.DEVNULL,check=True);unit_backup.write_bytes(old);os.chmod(unit_backup,0o600)
new=old_text.replace('WorkingDirectory=/opt/cat-mouse/release-20261011b','WorkingDirectory='+str(release)).encode()
try:
 unit.write_bytes(new);subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','catmouse-api.service'],check=True)
 status=None;ready={}
 for i in range(12):
  try:
   ready=json.load(urllib.request.urlopen('http://127.0.0.1:4000/ready',timeout=2));status=json.load(urllib.request.urlopen('http://127.0.0.1:4000/api/version',timeout=2))
   if ready.get('ready') and status.get('version')=='0.4.0':break
  except Exception:pass
  time.sleep(1)
 assert status and status.get('version')=='0.4.0' and ready.get('ready'),'HEALTH_CHECK_FAILED'
 assert status['capabilities']['mapCatalog'] and status['capabilities']['roomInvites']
 result={'status':'DEPLOYED','release':str(release),'backup':str(backup),'unitBackup':str(unit_backup),'version':status,'activeMatchesBeforeSwitch':0,'keysReplaced':False}
 (release/'deployment.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
except BaseException:
 unit.write_bytes(old);subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','catmouse-api.service'],check=True);print('ROLLED_BACK_TO_PREVIOUS_UNIT');raise
