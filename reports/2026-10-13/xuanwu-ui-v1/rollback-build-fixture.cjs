'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const report=__dirname,repo=path.resolve(report,'../../..'),fixture=path.join(report,'rollback-fixture');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(report,'baseline-hashes.json')));
if(manifest.length!==33)throw Error('Expected 33 baseline files');
for(const record of manifest){const buffer=fs.readFileSync(path.join(report,'baseline',record.path));if(sha(buffer)!==record.sha256||buffer.length!==record.bytes)throw Error('Baseline mismatch '+record.path);}
if(fs.existsSync(fixture))throw Error('Fixture already exists; preserve existing evidence');
const files=new Set(manifest.map(record=>record.path));
function addFiles(relative){for(const item of fs.readdirSync(path.join(repo,relative),{withFileTypes:true})){if(item.isSymbolicLink())throw Error('Linked dependency');if(item.isFile())files.add(relative+'/'+item.name);}}
for(const name of ['index','room','map','qrcode','dev'])addFiles('pages/'+name);
addFiles('utils');addFiles('components/nav-bar');addFiles('cat-mouse-server/v2');
files.delete('cat-mouse-server/v2/venue-ui.test.js');files.delete('cat-mouse-server/v2/pixel-ui.test.js');
files.add('cat-mouse-server/package.json');
for(const relative of ['design/2026-10-12/runtime-art/runtime-lock.json','design/2026-10-12/faithful-art/manifest.json','design/2026-10-12/faithful-art/font.json']){
 files.add(relative);const lock=JSON.parse(fs.readFileSync(path.join(repo,relative)));
 for(const record of [...(lock.records||[]),...(lock.assets||[]),...(lock.sources||[])])if(record.path)files.add(record.path);
 if(lock.path)files.add(lock.path);
}
files.add('assets/faithful-v2/FONT-LICENSE.txt');
fs.mkdirSync(fixture);
const inventory=[];
for(const relative of [...files].sort()){
 if(path.isAbsolute(relative)||relative.includes('..')||relative.includes('node_modules'))throw Error('Unexpected dependency '+relative);
 const source=path.join(repo,relative),target=path.join(fixture,relative),buffer=fs.readFileSync(source);
 if(fs.lstatSync(source).isSymbolicLink())throw Error('Linked source '+relative);
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,buffer,{flag:'wx'});
 if(sha(fs.readFileSync(target))!==sha(buffer))throw Error('Copy mismatch '+relative);
 inventory.push({path:relative,source,sha256:sha(buffer),bytes:buffer.length});
}
fs.writeFileSync(path.join(fixture,'.rollback-fixture-marker.json'),JSON.stringify({kind:'xuanwu-pixel-ui-v1-rollback-fixture',fixtureOnly:true,root:fixture},null,2)+'\n',{flag:'wx'});
fs.writeFileSync(path.join(report,'rollback-fixture-inventory.json'),JSON.stringify({fixture,excludedNewTests:['venue-ui.test.js','pixel-ui.test.js'],nodeModulesCopied:false,files:inventory},null,2)+'\n',{flag:'wx'});
console.log('FIXTURE_FILES_COPIED='+inventory.length);console.log('BASELINE_VALID=33/33');console.log('NEW_UI_TESTS_EXCLUDED=2');console.log('NODE_MODULES_COPIED=0');console.log('FIXTURE='+fixture);
