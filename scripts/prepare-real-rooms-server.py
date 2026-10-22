"""Prepare a candidate and run acceptance in an isolated PostgreSQL database. No service switch."""
import json,os,subprocess,time
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit
base=Path('/opt/cat-mouse');release=base/'release-20261019-real-v1'
assert release.is_dir() and not release.is_symlink() and (release/'v2/server.js').is_file()
active=subprocess.check_output(['systemctl','show','catmouse-api.service','--property=WorkingDirectory','--value'],text=True).strip()
assert Path(active).resolve()!=release.resolve(), 'Refusing to prepare dependencies in the active service release'
env={}
for line in (base/'api.env').read_text().splitlines():
 if line and not line.startswith('#') and '=' in line:
  k,v=line.split('=',1);env[k]=v.strip().strip('\"\'')
subprocess.run(['chown','-R','catmouse:catmouse',str(release)],check=True)
subprocess.run(['runuser','-u','catmouse','--','env','npm_config_cache=/opt/cat-mouse/.npm','npm','ci','--omit=dev','--ignore-scripts','--prefix',str(release)],check=True)
db='catmouse_verify_20261019_'+str(int(time.time()))
subprocess.run(['runuser','-u','postgres','--','createdb','-O','catmouse',db],check=True)
try:
 u=urlsplit(env['DATABASE_URL']);isolated=urlunsplit((u.scheme,u.netloc,'/'+db,u.query,u.fragment))
 trial={**os.environ,**env,'DATABASE_URL':isolated,'NODE_ENV':'test','HOST':'127.0.0.1','ENABLE_LOCAL_TEST_IDENTITIES':'true'}
 result=release/'acceptance-postgres.json'
 subprocess.run(['node',str(release/'v2/acceptance.cjs'),str(result)],env=trial,cwd=release,check=True,timeout=90)
 # A second independent database is used for the existing 60-user short load simulation.
 load_db=db+'_loadtest';subprocess.run(['runuser','-u','postgres','--','createdb','-O','catmouse',load_db],check=True)
 try:
  load_url=urlunsplit((u.scheme,u.netloc,'/'+load_db,u.query,u.fragment))
  load_env={**trial,'LOAD_DATABASE_URL':load_url,'LOAD_ISOLATED_DB':'true'}
  subprocess.run(['node',str(release/'v2/load60.cjs'),str(release/'load60-postgres.json')],env=load_env,cwd=release,check=True,timeout=120)
 finally:subprocess.run(['runuser','-u','postgres','--','dropdb',load_db],check=True)
 print(json.dumps({'candidate':str(release),'acceptance':'PASS','productionServiceSwitched':False,'productionDataWritten':False}))
finally:subprocess.run(['runuser','-u','postgres','--','dropdb',db],check=True)
