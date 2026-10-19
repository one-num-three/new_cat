'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),read=p=>fs.readFileSync(path.join(__dirname,p)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(read(p).toString().replace(/^\uFEFF/,''));
const runtime=json('runtime-after.json').result.result.result,permissions=json('permissions.json').result.result.result,consoleLog=json('console-after.json').result;
assert.equal(runtime.status,'ready');assert.ok(runtime.drawCount>0);assert.equal(runtime.error,'');assert.equal(runtime.simulated,false);
assert.equal(permissions.find(p=>p.kind==='setting').location,true);assert.equal(permissions.find(p=>p.kind==='privacy').needAuthorization,false);
assert.doesNotMatch(consoleLog,/\[error\]|type-uncompatible|quickfill|backgroundfetch/i);
const metadata=fs.readFileSync(path.join(root,'campus3d/assets/campus-meta.bin'));
assert.equal(sha(metadata),sha(read('before/campus3d/assets/campus.json')));
const model=JSON.parse(metadata);assert.equal(model.buildingComponents,331);assert.equal(model.meshSha256,sha(fs.readFileSync(path.join(root,'campus3d/assets/campus.bin'))));
const checks=[];for(const file of ['pages/index/index.js','pages/room/room.js','pages/map/map.js','pages/qrcode/qrcode.js','components/campus-model/campus-model.js','scripts/finalize-model-evidence.cjs','cat-mouse-server/v2/campus-model.test.js','cat-mouse-server/v2/pixel-ui.test.js']){const r=cp.spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,file+' '+r.stderr);checks.push({file,status:r.status});}
const files=[],sizes={};function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else{const relative=path.relative(path.join(__dirname,'release/MODIFIED_FILE'),file),data=fs.readFileSync(file);assert.equal(sha(data),sha(fs.readFileSync(path.join(root,relative))),relative);const group=relative.startsWith('campus3d')?'campus3d':relative.startsWith('venue-maps')?'venue-maps':'main';sizes[group]=(sizes[group]||0)+data.length;files.push({file:relative,bytes:data.length,sha256:sha(data)});}}}
walk(path.join(__dirname,'release/MODIFIED_FILE'));assert.ok(Object.values(sizes).every(n=>n<2097152));
assert.ok(files.some(f=>f.file.endsWith('campus-meta.bin')));assert.ok(!files.some(f=>f.file.endsWith('campus.json')));
assert.match(read('tests-full.log').toString(),/# pass 157/);assert.match(read('tests-full.log').toString(),/# fail 0/);
const screenshot=read('3d-cold-load-final.png');assert.equal(screenshot.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
fs.writeFileSync(path.join(__dirname,'package-manifest.json'),JSON.stringify(files,null,2));
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({tests:157,failures:0,checks,runtime,permissions,metadataBytes:metadata.length,metadataSha256:sha(metadata),metadataBytesUnchanged:true,meshSha256:model.meshSha256,localPackageBytes:sizes,packageFiles:files.length,screenshot:{file:'3d-cold-load-final.png',sha256:sha(screenshot),width:screenshot.readUInt32BE(16),height:screenshot.readUInt32BE(20),pixelsReviewed:true},userReportedPrivateLogsReproduced:false,phoneVerified:false,uploaded:false,deployed:false},null,2));
let diff='# 本轮源码对照\n\n仅对照本轮保存的9个文件；不是全仓快照。项目配置另新增一项显式资源包含规则。\n';
for(const file of ['pages/index/index.js','pages/room/room.js','pages/map/map.js','pages/qrcode/qrcode.js','components/campus-model/campus-model.js','campus3d/assets/campus.json','scripts/export-jiulonghu-runtime.py','scripts/finalize-model-evidence.cjs','cat-mouse-server/v2/campus-model.test.js']){const now=file==='campus3d/assets/campus.json'?'campus3d/assets/campus-meta.bin':file;const r=cp.spawnSync('git',['diff','--no-index','--',path.join(__dirname,'before',file),path.join(root,now)],{encoding:'utf8'});assert.ok(r.status===0||r.status===1);diff+='\n## '+file+'\n\n```diff\n'+r.stdout+'\n```\n';}
fs.writeFileSync(path.join(__dirname,'DIFF.md'),diff);console.log(JSON.stringify({tests:157,failures:0,localPackageBytes:sizes,packageFiles:files.length,metadataBytesUnchanged:true,runtimeStatus:runtime.status},null,2));
