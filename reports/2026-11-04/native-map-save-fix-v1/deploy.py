"""Versioned 0.6.1 deployment; execute over SSH stdin. Credentials remain on host."""
import hashlib,json,os,subprocess,sys,time,urllib.request
from pathlib import Path
from urllib.parse import urlsplit,urlunsplit

BASE=Path('/opt/cat-mouse')
RELEASE=BASE/'release-20261104-native-v1'
EXPECTED_PREVIOUS=BASE/'release-20261023-gps50-v1'
UNIT=Path('/etc/systemd/system/catmouse-api.service')
MODE=sys.argv[1]
def run(args,**kwargs):return subprocess.run(args,check=True,**kwargs)
def output(args):return subprocess.check_output(args,text=True).strip()
def query(sql,db='catmouse'):return output(['runuser','-u','postgres','--','psql','-d',db,'-Atc',sql])
def active():return Path(output(['systemctl','show','catmouse-api.service','--property=WorkingDirectory','--value']))
def active_matches():return int(query("SELECT count(*) FROM rooms WHERE state->'match'->>'phase' IN ('HIDING','CHASING','PAUSED')"))
def get(path):return json.load(urllib.request.urlopen('http://127.0.0.1:4000'+path,timeout=3))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(name,data):(RELEASE/name).write_text(json.dumps(data,indent=2))
def facts(db='catmouse'):
    counts={t:int(query('SELECT count(*) FROM '+t,db)) for t in ['rooms','sessions','match_results','events','commands','operation_commands']}
    counts['roomStateDigest']=hashlib.sha256(query("SELECT id::text||':'||md5(state::text) FROM rooms ORDER BY id",db).encode()).hexdigest()
    counts['resultDigest']=hashlib.sha256(query("SELECT match_id::text||':'||md5(result::text) FROM match_results ORDER BY match_id",db).encode()).hexdigest()
    return counts
def env():
    data={}
    for line in (BASE/'api.env').read_text().splitlines():
        if line and not line.startswith('#') and '=' in line:
            k,v=line.split('=',1);data[k]=v.strip().strip('"\'')
    return data
def trial_env(db):
    u=urlsplit(env()['DATABASE_URL']);isolated=urlunsplit((u.scheme,u.netloc,'/'+db,u.query,u.fragment))
    return {**os.environ,'DATABASE_URL':isolated,'JOIN_VERIFY_DATABASE_URL':isolated,'DYNAMIC_VERIFY_DATABASE_URL':isolated,'NODE_ENV':'test','ENABLE_LOCAL_TEST_IDENTITIES':'true','HOST':'127.0.0.1','TMPDIR':'/opt/cat-mouse/.verify-tmp'}
def candidate():
    assert RELEASE.is_dir() and not RELEASE.is_symlink() and RELEASE.parent.resolve()==BASE.resolve()
    assert active().resolve()!=RELEASE.resolve(),'CANDIDATE_ALREADY_ACTIVE'
    manifest=json.loads((RELEASE/'source-manifest.json').read_text())
    for e in manifest:
        p=RELEASE/e['path'];assert p.resolve().is_relative_to(RELEASE.resolve()) and p.is_file() and sha(p)==e['sha256'],'SOURCE_MISMATCH'
    return manifest
def isolated(number,callback):
    db='catmouse_verify_20261023_'+str(int(time.time()))+'_'+str(number)
    run(['runuser','-u','postgres','--','createdb','-O','catmouse',db])
    try:return callback(db)
    finally:run(['runuser','-u','postgres','--','dropdb',db])

if MODE=='preflight':
    print(json.dumps(dict(activeRelease=str(active()),version=get('/api/version'),ready=get('/ready'),activeMatches=active_matches(),data=facts(),candidateExists=RELEASE.exists())))
elif MODE=='prepare':
    manifest=candidate();Path('/opt/cat-mouse/.verify-tmp').mkdir(exist_ok=True)
    run(['chown','-R','catmouse:catmouse',str(RELEASE)])
    with (RELEASE/'npm-ci.log').open('w') as log:
        run(['runuser','-u','catmouse','--','env','npm_config_cache=/opt/cat-mouse/.npm','npm','ci','--omit=dev','--ignore-scripts','--prefix',str(RELEASE)],stdout=log,stderr=subprocess.STDOUT,timeout=180)
    jobs=[('native-acceptance',['node','v2/native-acceptance.cjs',str(RELEASE/'native-acceptance.json')]),('capture-acceptance',['node','v2/acceptance.cjs',str(RELEASE/'capture-acceptance.json')]),('tracks-acceptance',['node','v2/tracks-acceptance.cjs',str(RELEASE/'tracks-acceptance.json')]),('late-join',['node','--test','--test-name-pattern=^live reinforcements','v2/late-join.test.js']),('dynamic-target',['node','--test','v2/dynamic-target.test.js'])]
    for i,(name,args) in enumerate(jobs):
        def check(db):
            with (RELEASE/(name+'.log')).open('w') as log:run(args,cwd=RELEASE,env=trial_env(db),stdout=log,stderr=subprocess.STDOUT,timeout=120)
        isolated(i,check)
    result=dict(status='PASS',storage='isolated real PostgreSQL',sourceManifestSha256=sha(RELEASE/'source-manifest.json'),sourceFiles=len(manifest),checks=[name for name,_ in jobs],capture=json.loads((RELEASE/'capture-acceptance.json').read_text()),tracks=json.loads((RELEASE/'tracks-acceptance.json').read_text()),productionDataWritten=False)
    write('prepare.json',result);print(json.dumps(result))
elif MODE=='deploy':
    candidate();prepared=json.loads((RELEASE/'prepare.json').read_text())
    assert prepared['status']=='PASS' and prepared['sourceManifestSha256']==sha(RELEASE/'source-manifest.json')
    assert active()==EXPECTED_PREVIOUS,'UNEXPECTED_ACTIVE_RELEASE'
    assert active_matches()==0,'ACTIVE_MATCHES_REQUIRE_WAITING'
    old=UNIT.read_bytes();needle=('WorkingDirectory='+str(EXPECTED_PREVIOUS)).encode();assert old.count(needle)==1
    stamp=str(int(time.time()));backup=BASE/('backup-before-native-'+stamp+'.dump');saved=BASE/('unit-before-native-'+stamp+'.service')
    credential_digest=sha(BASE/'api.env');stopped=False;switched=False
    try:
        run(['systemctl','stop','catmouse-api.service']);stopped=True
        assert active_matches()==0,'MATCH_STARTED_DURING_PREPARATION'
        before=facts()
        with backup.open('wb') as handle:run(['runuser','-u','postgres','--','pg_dump','-Fc','catmouse'],stdout=handle)
        os.chmod(backup,0o600);saved.write_bytes(old);os.chmod(saved,0o600)
        run(['pg_restore','--list',str(backup)],stdout=subprocess.DEVNULL)
        def restore_check(db):
            with backup.open('rb') as handle:run(['runuser','-u','postgres','--','pg_restore','--no-owner','--no-privileges','--role=catmouse','--dbname',db],stdin=handle,stdout=subprocess.DEVNULL)
            assert facts(db)==before,'BACKUP_RESTORE_MISMATCH'
            script="const {Store}=require('./v2/store');(async()=>{const s=new Store({url:process.env.DATABASE_URL});try{await s.init();const r=await s.query('SELECT count(*) AS n FROM match_track_points');if(!Number.isFinite(Number(r.rows[0].n)))throw Error('INVALID_TRACK_COUNT');}finally{await s.close();}})().catch(()=>{console.error('ISOLATED_MIGRATION_FAILED');process.exitCode=1});"
            run(['node','-e',script],cwd=RELEASE,env=trial_env(db),timeout=30)
            assert facts(db)==before,'MIGRATION_CHANGED_LEGACY_DATA'
        isolated(9,restore_check)
        UNIT.write_bytes(old.replace(needle,('WorkingDirectory='+str(RELEASE)).encode()));run(['systemctl','daemon-reload']);switched=True
        run(['systemctl','start','catmouse-api.service']);stopped=False;status=None
        for _ in range(15):
            try:
                if get('/ready').get('ready'):
                    status=get('/api/version')
                    if status.get('version')=='0.6.1':break
            except Exception:pass
            time.sleep(1)
        assert status and status['version']=='0.6.1','VERSION_CHECK_FAILED'
        for key,value in [('mouseTeamVision','vision-share-v1'),('trackExport','tracks-v1'),('trackHighlights','track-highlights-v1'),('matchBoundLocation',True)]:assert status['capabilities'][key]==value,'CAPABILITY_CHECK_FAILED'
        assert sha(BASE/'api.env')==credential_digest,'CREDENTIALS_CHANGED'
        assert query("SELECT to_regclass('public.match_track_points')")=='match_track_points','TRACK_TABLE_MISSING'
        after=facts();assert after==before,'LEGACY_DATA_CHANGED'
        result=dict(status='DEPLOYED',version=status,release=str(RELEASE),previousRelease=str(EXPECTED_PREVIOUS),backup=str(backup),unitBackup=str(saved),backupRestoreVerified=True,migrationVerifiedOnRestoredDatabase=True,trackRows=int(query('SELECT count(*) FROM match_track_points')),activeMatchesBeforeSwitch=0,credentialsChanged=False,dataBefore=before,dataAfter=after)
        write('deployment.json',result);print(json.dumps(result))
    except BaseException:
        if switched:UNIT.write_bytes(old);run(['systemctl','daemon-reload'])
        if stopped or switched:run(['systemctl','restart','catmouse-api.service'])
        raise
else:raise SystemExit('Expected preflight, prepare or deploy')
