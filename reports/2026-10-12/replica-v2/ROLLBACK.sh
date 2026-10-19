#!/usr/bin/env bash
set -euo pipefail
# Deliberately fixture-only: does not delete files or operate on Git/live UI.
[[ $# -eq 1 ]] || { printf '%s\n' 'ROLLBACK_GUARD expected exactly one fixture argument' >&2; exit 2; }
REPORT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
node - "$REPORT_DIR" "$1" <<'NODE'
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const report=path.resolve(process.argv[2]),fixture=path.resolve(process.argv[3]);
const expected=path.join(report,'rollback-fixture');
const normalize=p=>path.resolve(p).replaceAll('\\','/').toLowerCase();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=message=>{throw new Error('ROLLBACK_GUARD '+message);};
const beneath=(root,p)=>normalize(p).startsWith(normalize(root)+'/');
function ordinaryPath(root,p,allowMissing=false){
  if(!beneath(root,p))fail('path escaped fixture/baseline');
  const parts=path.relative(root,p).split(path.sep);let at=root;
  for(const part of parts){at=path.join(at,part);if(fs.existsSync(at)){if(fs.lstatSync(at).isSymbolicLink())fail('managed path contains a link');}else if(!allowMissing)fail('managed file missing '+p);}
}
try{
  if(normalize(fixture)!==normalize(expected))fail('target must equal report/rollback-fixture');
  if(!fs.existsSync(fixture)||!fs.lstatSync(fixture).isDirectory()||fs.lstatSync(fixture).isSymbolicLink())fail('fixture must be an ordinary existing directory');
  if(normalize(fs.realpathSync(fixture))!==normalize(expected))fail('fixture canonical path changed');
  const markerPath=path.join(fixture,'.rollback-fixture-marker.json');ordinaryPath(fixture,markerPath);
  const marker=JSON.parse(fs.readFileSync(markerPath,'utf8'));
  if(marker.kind!=='cat-mouse-replica-v2-rollback-fixture'||marker.fixtureOnly!==true||normalize(marker.root)!==normalize(fixture))fail('fixture marker mismatch');
  const manifestPath=path.join(report,'baseline-hashes.json'),manifestBytes=fs.readFileSync(manifestPath);
  if(sha(manifestBytes)!=='c0a88cd082bb72ce6648c038b136183269c51f9475690b2110aae05a73c159df')fail('baseline hash list changed');
  const items=JSON.parse(manifestBytes.toString('utf8'));
  if(items.length!==42||new Set(items.map(i=>i.path)).size!==42)fail('expected 42 unique baseline records');
  const baseline=path.join(report,'baseline'),prepared=[];
  // Validate every saved source and every destination before writing any byte.
  for(const item of items){
    if(typeof item.path!=='string'||path.isAbsolute(item.path)||item.path.includes('\\')||item.path.split('/').some(part=>!part||part==='.'||part==='..'||part==='.git'||part==='node_modules'))fail('invalid managed relative path');
    if(!/^[a-f0-9]{64}$/.test(item.sha256))fail('invalid SHA record');
    const source=path.join(baseline,item.path),target=path.join(fixture,item.path);
    ordinaryPath(baseline,source);ordinaryPath(fixture,target);
    if(!fs.lstatSync(source).isFile()||!fs.lstatSync(target).isFile())fail('managed path must be a file');
    const bytes=fs.readFileSync(source),current=fs.readFileSync(target);
    if(sha(bytes)!==item.sha256)fail('baseline SHA mismatch '+item.path);
    prepared.push({...item,source,target,bytes,current,currentSha256:sha(current)});
  }
  const backup=path.join(fixture,'current-before-rollback');
  if(fs.existsSync(backup)&&fs.lstatSync(backup).isSymbolicLink())fail('current-copy backup is linked');
  for(const item of prepared){
    const saved=path.join(backup,item.path);ordinaryPath(fixture,saved,true);
    fs.mkdirSync(path.dirname(saved),{recursive:true});fs.writeFileSync(saved,item.current);
    if(sha(fs.readFileSync(saved))!==item.currentSha256)fail('current copy preservation failed '+item.path);
  }
  for(const item of prepared)fs.writeFileSync(item.target,item.bytes);
  const reopened=prepared.map(item=>({path:item.path,currentSha256:item.currentSha256,restoredSha256:sha(fs.readFileSync(item.target)),baselineSha256:item.sha256}));
  if(reopened.some(i=>i.restoredSha256!==i.baselineSha256))fail('restored byte verification mismatch');
  const home=fs.readFileSync(path.join(fixture,'pages/index/index.wxml'),'utf8');
  const map=fs.readFileSync(path.join(fixture,'pages/map/map.wxml'),'utf8');
  if(!home.includes('/assets/replica-v1/home-landscape.png')||home.includes('/assets/faithful-v2/'))fail('old home behavior not restored');
  if(!/<image class="parkArt" src="\/assets\/replica-v1\/preview-park\.png" mode="scaleToFill"/.test(map))fail('old map behavior not restored');
  const result=[
    'ROLLBACK_INPUT='+fixture.replaceAll('\\','/'),
    'BASELINE_SHA_VALIDATED=42/42',
    'CURRENT_BYTES_PRESERVED=42/42',
    'ROLLBACK_RESTORED=42/42',
    'RESTORED_HOME=/assets/replica-v1/home-landscape.png',
    'RESTORED_MAP=scaleToFill',
    'LIVE_FILES_WRITTEN=0',
    'DELETED_FILES=0',
    'EXIT_STATUS=0',
    ...reopened.map(i=>'HASH '+i.path+' CURRENT='+i.currentSha256+' RESTORED='+i.restoredSha256+' BASELINE='+i.baselineSha256),
    ''
  ].join('\n');
  fs.writeFileSync(path.join(report,'rollback-result.txt'),result);
  fs.writeFileSync(path.join(report,'rollback-restored-hashes.json'),JSON.stringify(reopened,null,2)+'\n');
  console.log('ROLLBACK_RESTORED=42/42 home=replica-v1 map=scaleToFill currentPreserved=42 deleted=0 liveWritten=0');
}catch(error){console.error(error.message);process.exitCode=1;}
NODE
