'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const report=__dirname,expected=path.join(report,'rollback-fixture'),baseline=path.join(report,'baseline');
const expectedManifest='b5953497ee187de27bf88341c0ea26d7acd7b972d853e7b439a8d00b8b606980';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const norm=p=>path.resolve(p).replaceAll('\\','/').toLowerCase();
const fail=message=>{throw Error('ROLLBACK_GUARD '+message);};
function ordinary(root,relative){
 if(typeof relative!=='string'||path.isAbsolute(relative)||relative.includes('\\')||relative.split('/').some(p=>!p||p==='.'||p==='..'||p==='node_modules'||p==='.git'))fail('invalid relative path');
 let current=root;
 for(const part of relative.split('/')){current=path.join(current,part);if(!fs.existsSync(current)||fs.lstatSync(current).isSymbolicLink())fail('missing or linked '+relative);}
 if(!fs.lstatSync(current).isFile())fail('not regular '+relative);return current;
}
try{
 if(process.argv.length!==3||norm(process.argv[2])!==norm(expected))fail('target must be this report rollback-fixture');
 if(!fs.existsSync(expected)||fs.lstatSync(expected).isSymbolicLink()||!fs.lstatSync(expected).isDirectory()||norm(fs.realpathSync(expected))!==norm(expected))fail('fixture is not an ordinary report directory');
 const marker=JSON.parse(fs.readFileSync(ordinary(expected,'.rollback-fixture-marker.json'),'utf8'));
 if(marker.kind!=='xuanwu-pixel-ui-v1-rollback-fixture'||marker.fixtureOnly!==true||norm(marker.root)!==norm(expected))fail('fixture marker mismatch');
 const manifestBytes=fs.readFileSync(path.join(report,'baseline-hashes.json'));
 if(sha(manifestBytes)!==expectedManifest)fail('baseline manifest hash mismatch');
 const manifest=JSON.parse(manifestBytes);
 if(manifest.length!==33||new Set(manifest.map(item=>item.path)).size!==33)fail('expected 33 unique baseline paths');
 // Read and validate ALL baseline and current bytes before any backup/restore write.
 const snapshots=manifest.map(item=>{
  const bytes=fs.readFileSync(ordinary(baseline,item.path));
  if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)fail('baseline hash mismatch '+item.path);
  const target=ordinary(expected,item.path),current=fs.readFileSync(target);
  return {...item,baselineBytes:bytes,target,currentBytes:current,currentSha256:sha(current)};
 });
 const backup=path.join(expected,'current-before-rollback');if(fs.existsSync(backup))fail('backup already exists; preserve earlier evidence');
 fs.mkdirSync(backup);
 for(const item of snapshots){const dest=path.join(backup,item.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,item.currentBytes,{flag:'wx'});}
 for(const item of snapshots)if(sha(fs.readFileSync(ordinary(backup,item.path)))!==item.currentSha256)fail('backup readback mismatch '+item.path);
 for(const item of snapshots){ordinary(expected,item.path);fs.writeFileSync(item.target,item.baselineBytes);}
 const restored=snapshots.map(item=>{
  const restoredSha256=sha(fs.readFileSync(ordinary(expected,item.path)));if(restoredSha256!==item.sha256)fail('restore mismatch '+item.path);
  return {path:item.path,currentSha256:item.currentSha256,backupSha256:sha(fs.readFileSync(ordinary(backup,item.path))),baselineSha256:item.sha256,restoredSha256};
 });
 fs.writeFileSync(path.join(report,'rollback-restored-hashes.json'),JSON.stringify(restored,null,2)+'\n',{flag:'wx'});
 console.log('BASELINE_SHA_VALIDATED=33/33');console.log('CURRENT_BYTES_BACKED_UP=33/33');console.log('ROLLBACK_RESTORED=33/33');
 for(const item of restored)console.log('HASH '+item.path+' '+item.restoredSha256);
 console.log('TARGET='+expected);console.log('LIVE_WRITES=0');
}catch(error){console.error(error.message);process.exitCode=1;}
