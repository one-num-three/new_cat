'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const report=__dirname,repo=path.resolve(report,'../../..'),fixture=path.join(report,'rollback-fixture');
const sha=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
const fileHash=p=>sha(fs.readFileSync(p));
const bash='D:/Program Files/Git/bin/bash.exe';
const baseline=JSON.parse(fs.readFileSync(path.join(report,'baseline-hashes.json')));
const extras=['cat-mouse-server/v2/venue-ui.test.js','cat-mouse-server/v2/pixel-ui.test.js','components/pixel-action/pixel-action.js','components/venue-art/venue-art.js','utils/venue-camera.js','utils/pixel-theme.wxss','utils/pixel-font.wxss','assets/maps/xuanwu-lake-v3.png'];
const paths=[...baseline.map(item=>item.path),...extras];
const before=paths.map(relative=>({path:relative,sha256:fileHash(path.join(repo,relative))}));
for(const item of baseline){const hash=fileHash(path.join(fixture,item.path));if(hash!==before.find(p=>p.path===item.path).sha256)throw Error('Current fixture differs from live before restore '+item.path);}
fs.writeFileSync(path.join(report,'rollback-live-before.json'),JSON.stringify(before,null,2)+'\n',{flag:'wx'});
const runs=[];
function run(id,command,args,cwd,env={}){
 const result=cp.spawnSync(command,args,{cwd,env:{...process.env,...env},encoding:'utf8',maxBuffer:20*1024*1024,timeout:120000});
 const record={id,command,args,cwd,env,stdout:result.stdout||'',stderr:result.stderr||'',exitStatus:result.status,signal:result.signal,error:result.error?.message};
 runs.push(record);fs.writeFileSync(path.join(report,'rollback-'+id+'.txt'),'COMMAND='+JSON.stringify({command,args,cwd,env})+'\nSTDOUT:\n'+record.stdout+'\nSTDERR:\n'+record.stderr+'\nEXIT_STATUS='+record.exitStatus+'\n',{flag:'wx'});
 console.log(id+' EXIT_STATUS='+record.exitStatus);return record;
}
const executable=run('executable',bash,['-c','chmod +x ./ROLLBACK.sh && test -x ./ROLLBACK.sh && printf "EXECUTABLE=true\\n"'],report);
if(executable.exitStatus!==0)throw Error('Bash executable check failed');
const guard=run('guard',bash,['-c','./ROLLBACK.sh "$1"','--',repo],report);
if(guard.exitStatus!==1||!guard.stderr.includes('target must be this report rollback-fixture'))throw Error('Live target was not rejected');
for(const item of before)if(fileHash(path.join(repo,item.path))!==item.sha256)throw Error('Live changed during guard '+item.path);
const restore=run('restore',bash,['-c','./ROLLBACK.sh "$1"','--',fixture],report);
if(restore.exitStatus!==0)throw Error('Fixture restore failed');
const temp=path.join(fixture,'test-temp');fs.mkdirSync(temp);
const tests=run('tests',process.execPath,['--test','v2/client.test.js','v2/dev-preview.test.js','v2/integration.test.js','v2/presentation.test.js','v2/rules.test.js'],path.join(fixture,'cat-mouse-server'),{NODE_PATH:path.join(repo,'cat-mouse-server/node_modules'),TEMP:temp,TMP:temp,TMPDIR:temp});
const parsed={tests:Number(tests.stdout.match(/^# tests (\d+)\r?$/m)?.[1]),pass:Number(tests.stdout.match(/^# pass (\d+)\r?$/m)?.[1]),fail:Number(tests.stdout.match(/^# fail (\d+)\r?$/m)?.[1]),exitStatus:tests.exitStatus};
const restored=JSON.parse(fs.readFileSync(path.join(report,'rollback-restored-hashes.json')));
const proof=baseline.map(item=>{
 const initial=before.find(p=>p.path===item.path).sha256;
 const record={path:item.path,baselineSha256:item.sha256,currentBeforeSha256:initial,liveAfterSha256:fileHash(path.join(repo,item.path)),backupSha256:fileHash(path.join(fixture,'current-before-rollback',item.path)),restoredSha256:fileHash(path.join(fixture,item.path))};
 record.baselineValid=fileHash(path.join(report,'baseline',item.path))===item.sha256;record.liveUnchanged=record.liveAfterSha256===initial;record.backupMatches=record.backupSha256===initial;record.restored=record.restoredSha256===item.sha256;record.liveRemainsModified=record.liveAfterSha256!==item.sha256;
 const result=restored.find(r=>r.path===item.path);record.scriptEvidenceMatches=result.currentSha256===initial&&result.restoredSha256===item.sha256;
 return record;
});
const extraProof=before.filter(p=>extras.includes(p.path)).map(item=>({...item,afterSha256:fileHash(path.join(repo,item.path)),unchanged:fileHash(path.join(repo,item.path))===item.sha256}));
const output={managedFiles:baseline.length,baselineManifestSha256:fileHash(path.join(report,'baseline-hashes.json')),baselineValid:proof.filter(p=>p.baselineValid).length,liveUnchanged:proof.filter(p=>p.liveUnchanged).length,backupMatches:proof.filter(p=>p.backupMatches).length,restored:proof.filter(p=>p.restored).length,liveRemainsModified:proof.filter(p=>p.liveRemainsModified).length,extraLiveFilesUnchanged:extraProof.filter(p=>p.unchanged).length,restoredBehavior:{homeHasPreviousFaithfulArt:fs.readFileSync(path.join(fixture,'pages/index/index.wxml'),'utf8').includes('/assets/faithful-v2/hero-home.png'),mapHasPreviousPreviewMap:fs.readFileSync(path.join(fixture,'pages/map/map.wxml'),'utf8').includes('class="previewMap"'),newUIRegressionTestsPresent:extras.slice(0,2).filter(p=>fs.existsSync(path.join(fixture,p)))},tests:parsed,files:proof,extraFiles:extraProof,runs};
fs.writeFileSync(path.join(report,'rollback-verification.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(report,'rollback-execution.json'),JSON.stringify(runs,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({managedFiles:output.managedFiles,baselineValid:output.baselineValid,liveUnchanged:output.liveUnchanged,backupMatches:output.backupMatches,restored:output.restored,liveRemainsModified:output.liveRemainsModified,extraLiveFilesUnchanged:output.extraLiveFilesUnchanged,tests:parsed,restoredBehavior:output.restoredBehavior},null,2));
if(parsed.tests!==31||parsed.pass!==31||parsed.fail!==0||parsed.exitStatus!==0||proof.some(p=>!p.baselineValid||!p.liveUnchanged||!p.backupMatches||!p.restored||!p.scriptEvidenceMatches)||extraProof.some(p=>!p.unchanged))process.exitCode=1;
