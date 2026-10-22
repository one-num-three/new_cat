"""Run through SSH stdin: python3 - preflight|prepare|deploy. Never prints secrets."""
import hashlib,json,os,subprocess,sys,time,urllib.request
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit

BASE=Path('/opt/cat-mouse')
RELEASE=BASE/'release-20261019-dynamic-target-v1'
UNIT=Path('/etc/systemd/system/catmouse-api.service')
MODE=sys.argv[1]
def run(args,**kwargs): return subprocess.run(args,check=True,**kwargs)
def output(args): return subprocess.check_output(args,text=True).strip()
def query(sql,database='catmouse'): return output(['runuser','-u','postgres','--','psql','-d',database,'-Atc',sql])
def active_release(): return output(['systemctl','show','catmouse-api.service','--property=WorkingDirectory','--value'])
def active_matches(): return int(query("SELECT count(*) FROM rooms WHERE state->'match'->>'phase' IN ('HIDING','CHASING','PAUSED')"))
def get(path): return json.load(urllib.request.urlopen('http://127.0.0.1:4000'+path,timeout=3))
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def write(name,data): (RELEASE/name).write_text(json.dumps(data,indent=2))
def facts():
    return {"rooms":int(query('SELECT count(*) FROM rooms')),"sessions":int(query('SELECT count(*) FROM sessions')),"results":int(query('SELECT count(*) FROM match_results')),"roomStateDigest":hashlib.sha256(query("SELECT id::text||':'||md5(state::text) FROM rooms ORDER BY id").encode()).hexdigest()}
def inactive_candidate():
    assert RELEASE.is_dir() and not RELEASE.is_symlink() and RELEASE.parent.resolve()==BASE.resolve()
    assert Path(active_release()).resolve()!=RELEASE.resolve(),'CANDIDATE_IS_ACTIVE'
    manifest=json.loads((RELEASE/'source-manifest.json').read_text())
    for entry in manifest:
        p=RELEASE/entry['path'];assert p.resolve().is_relative_to(RELEASE.resolve())
        assert p.is_file() and sha(p)==entry['sha256'],'SOURCE_MISMATCH'
    return manifest

if MODE=='preflight':
    print(json.dumps(dict(activeRelease=active_release(),version=get('/api/version'),ready=get('/ready'),activeMatches=active_matches(),data=facts(),credentialsConfigured=(BASE/'api.env').is_file(),candidateExists=RELEASE.exists())))
elif MODE=='prepare':
    manifest=inactive_candidate()
    run(['chown','-R','catmouse:catmouse',str(RELEASE)])
    run(['runuser','-u','catmouse','--','env','npm_config_cache=/opt/cat-mouse/.npm','npm','ci','--omit=dev','--ignore-scripts','--prefix',str(RELEASE)])
    env={}
    for line in (BASE/'api.env').read_text().splitlines():
        if line and not line.startswith('#') and '=' in line:
            k,v=line.split('=',1);env[k]=v.strip().strip('"\'')
    db='catmouse_verify_20261019_'+str(int(time.time()))
    run(['runuser','-u','postgres','--','createdb','-O','catmouse',db])
    try:
        u=urlsplit(env['DATABASE_URL']);isolated=urlunsplit((u.scheme,u.netloc,'/'+db,u.query,u.fragment))
        trial={**os.environ,'DATABASE_URL':isolated,'JOIN_VERIFY_DATABASE_URL':isolated,'NODE_ENV':'test','ENABLE_LOCAL_TEST_IDENTITIES':'true','HOST':'127.0.0.1','TMPDIR':'/opt/cat-mouse/.verify-tmp'}
        Path(trial['TMPDIR']).mkdir(exist_ok=True)
        with (RELEASE/'postgres-tests.log').open('w') as log:
            run(['node','--test','--test-name-pattern=^live reinforcements','v2/late-join.test.js'],cwd=RELEASE,env=trial,stdout=log,stderr=subprocess.STDOUT,timeout=90)
            run(['node',str(RELEASE/'v2/acceptance.cjs'),str(RELEASE/'acceptance-postgres.json')],cwd=RELEASE,env=trial,stdout=log,stderr=subprocess.STDOUT,timeout=90)
        # Dedicated dynamic target cases use the same Service/Store with an explicit PG URL.
        with (RELEASE/'dynamic-postgres.log').open('w') as log:
            run(['node','--test','v2/dynamic-target.test.js'],cwd=RELEASE,env={**trial,'DYNAMIC_VERIFY_DATABASE_URL':isolated},stdout=log,stderr=subprocess.STDOUT,timeout=90)
        result=dict(status='PASS',storage='isolated real PostgreSQL',lateJoinWebSockets=10,dynamicTargetCases=3,captureAcceptance=json.loads((RELEASE/'acceptance-postgres.json').read_text()),sourceFiles=len(manifest),productionDataWritten=False)
        write('prepare.json',result);print(json.dumps(result))
    finally:run(['runuser','-u','postgres','--','dropdb',db])
elif MODE=='deploy':
    inactive_candidate();assert json.loads((RELEASE/'prepare.json').read_text())['status']=='PASS'
    active=active_release();assert active=='/opt/cat-mouse/release-20261019-join-sync-v1','UNEXPECTED_ACTIVE_RELEASE'
    assert active_matches()==0,'ACTIVE_MATCHES_REQUIRE_WAITING'
    old=UNIT.read_bytes();needle=('WorkingDirectory='+active).encode();assert old.count(needle)==1
    credentials=sha(BASE/'api.env');stamp=str(int(time.time()))
    backup=BASE/('backup-before-dynamic-target-'+stamp+'.dump');saved=BASE/('unit-before-dynamic-target-'+stamp+'.service')
    stopped=False;switched=False
    try:
        # Stop writes before the final gate and backup; do not interrupt a newly started match.
        run(['systemctl','stop','catmouse-api.service']);stopped=True
        assert active_matches()==0,'MATCH_STARTED_DURING_PREPARATION'
        before=facts()
        with backup.open('wb') as handle:run(['runuser','-u','postgres','--','pg_dump','-Fc','catmouse'],stdout=handle)
        os.chmod(backup,0o600);run(['pg_restore','--list',str(backup)],stdout=subprocess.DEVNULL)
        saved.write_bytes(old);os.chmod(saved,0o600)
        # A real restore in an independent database verifies backup usability.
        restore_db='catmouse_verify_20261019_'+stamp+'_restore'
        run(['runuser','-u','postgres','--','createdb',restore_db])
        try:
            with backup.open('rb') as handle:run(['runuser','-u','postgres','--','pg_restore','--no-owner','--no-privileges','--dbname',restore_db],stdin=handle,stdout=subprocess.DEVNULL)
            restored_rooms=int(query('SELECT count(*) FROM rooms',restore_db));restored_results=int(query('SELECT count(*) FROM match_results',restore_db))
            restored_digest=hashlib.sha256(query("SELECT id::text||':'||md5(state::text) FROM rooms ORDER BY id",restore_db).encode()).hexdigest()
            assert restored_rooms==before['rooms'] and restored_results==before['results'] and restored_digest==before['roomStateDigest']
        finally:run(['runuser','-u','postgres','--','dropdb',restore_db])
        UNIT.write_bytes(old.replace(needle,('WorkingDirectory='+str(RELEASE)).encode()));run(['systemctl','daemon-reload']);switched=True
        run(['systemctl','start','catmouse-api.service']);stopped=False
        status=None
        for _ in range(12):
            try:
                if get('/ready').get('ready'):
                    status=get('/api/version')
                    if status.get('version')=='0.5.2':break
            except Exception:pass
            time.sleep(1)
        assert status and status['version']=='0.5.2' and status['capabilities']['lateJoin']=='reinforce-v2'
        assert status['capabilities']['dynamicCaptureTarget']=='joined-mice-60-v1' and status['capabilities']['roundReadiness']=='fresh-v1' and status['capabilities']['snapshotViewer']
        assert sha(BASE/'api.env')==credentials and facts()==before,'PRODUCTION_DATA_CHANGED'
        result=dict(status='DEPLOYED',version=status,release=str(RELEASE),previousRelease=active,backup=str(backup),unitBackup=str(saved),backupRestoreVerified=True,activeMatchesBeforeSwitch=0,credentialsChanged=False,dataBefore=before,dataAfter=facts())
        write('deployment.json',result);print(json.dumps(result))
    except BaseException:
        if switched:UNIT.write_bytes(old);run(['systemctl','daemon-reload'])
        if stopped or switched:run(['systemctl','restart','catmouse-api.service'])
        raise
else:raise SystemExit('Expected preflight, prepare or deploy')
