"""Prepare/test an inactive candidate, then explicitly deploy. No credentials leave the host."""
import json,os,subprocess,sys,time,urllib.request
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
base=Path('/opt/cat-mouse');release=base/'release-20261019-join-sync-v1'
unit=Path('/etc/systemd/system/catmouse-api.service')
assert release.is_dir() and not release.is_symlink()
active=subprocess.check_output(['systemctl','show','catmouse-api.service','--property=WorkingDirectory','--value'],text=True).strip()
assert Path(active).resolve()!=release.resolve(),'CANDIDATE_IS_ALREADY_ACTIVE'
if sys.argv[1]=='prepare':
 subprocess.run(['chown','-R','catmouse:catmouse',str(release)],check=True)
 subprocess.run(['runuser','-u','catmouse','--','env','npm_config_cache=/opt/cat-mouse/.npm','npm','ci','--omit=dev','--ignore-scripts','--prefix',str(release)],check=True)
 env={}
 for line in (base/'api.env').read_text().splitlines():
  if line and not line.startswith('#') and '=' in line:
   k,v=line.split('=',1);env[k]=v.strip().strip('"\'')
 db='catmouse_verify_20261019_'+str(int(time.time()))
 subprocess.run(['runuser','-u','postgres','--','createdb','-O','catmouse',db],check=True)
 try:
  u=urlsplit(env['DATABASE_URL']);url=urlunsplit((u.scheme,u.netloc,'/'+db,u.query,u.fragment))
  with (release/'join-postgres.log').open('w') as log:
   subprocess.run(['node','--test','--test-name-pattern=^live reinforcements','v2/late-join.test.js'],cwd=release,env={**os.environ,'NODE_ENV':'test','JOIN_VERIFY_DATABASE_URL':url},stdout=log,stderr=subprocess.STDOUT,check=True,timeout=90)
  result={'status':'PASS','storage':'isolated real PostgreSQL','initialPlayers':8,'simultaneousLatePlayers':2,'authorizedWebSockets':10,'acceleratedClock':True,'productionDataWritten':False,'phoneCamera':False,'fieldGps':False}
  (release/'join-postgres.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
 finally:subprocess.run(['runuser','-u','postgres','--','dropdb',db],check=True)
elif sys.argv[1]=='deploy':
 assert json.loads((release/'join-postgres.json').read_text())['status']=='PASS'
 assert active=='/opt/cat-mouse/release-20261019-real-v1'
 count=subprocess.check_output(['runuser','-u','postgres','--','psql','-d','catmouse','-Atc',"SELECT count(*) FROM rooms WHERE state->'match'->>'phase' IN ('HIDING','CHASING','PAUSED')"],text=True).strip()
 assert count=='0','ACTIVE_MATCHES_REQUIRE_A_SCHEDULED_SWITCH'
 old=unit.read_bytes();stamp=str(int(time.time()));backup=base/('backup-before-join-sync-'+stamp+'.dump');saved=base/('unit-before-join-sync-'+stamp+'.service')
 with backup.open('wb') as output:subprocess.run(['runuser','-u','postgres','--','pg_dump','-Fc','catmouse'],stdout=output,check=True)
 os.chmod(backup,0o600);subprocess.run(['pg_restore','--list',str(backup)],stdout=subprocess.DEVNULL,check=True);saved.write_bytes(old);os.chmod(saved,0o600)
 needle=('WorkingDirectory='+active).encode();assert old.count(needle)==1
 try:
  unit.write_bytes(old.replace(needle,('WorkingDirectory='+str(release)).encode()));subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','catmouse-api.service'],check=True)
  status={};ready={}
  for _ in range(12):
   try:
    ready=json.load(urllib.request.urlopen('http://127.0.0.1:4000/ready',timeout=2));status=json.load(urllib.request.urlopen('http://127.0.0.1:4000/api/version',timeout=2))
    if ready.get('ready') and status.get('version')=='0.5.0':break
   except Exception:pass
   time.sleep(1)
  assert ready.get('ready') and status.get('version')=='0.5.0' and status['capabilities']['lateJoin']=='reinforce-v1'
  result={'status':'DEPLOYED','release':str(release),'previousRelease':active,'backup':str(backup),'unitBackup':str(saved),'version':status,'activeMatchesBeforeSwitch':0,'credentialsChanged':False}
  (release/'deployment.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
 except BaseException:
  unit.write_bytes(old);subprocess.run(['systemctl','daemon-reload'],check=True);subprocess.run(['systemctl','restart','catmouse-api.service'],check=True);raise
else:raise SystemExit('Expected prepare or deploy')
