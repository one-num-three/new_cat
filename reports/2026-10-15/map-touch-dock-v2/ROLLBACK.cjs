'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'rollback-manifest.json'),'utf8'));
const n=process.argv.indexOf('--root'),root=path.resolve(n>=0?process.argv[n+1]:path.join(__dirname,'../../..'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const entries=manifest.map(e=>{const target=path.resolve(root,e.path),source=path.resolve(__dirname,'baseline',e.path);if(!target.startsWith(root+path.sep)||!source.startsWith(path.join(__dirname,'baseline')+path.sep))throw Error('Path outside rollback root');const saved=fs.readFileSync(source);if(sha(saved)!==e.before)throw Error('Baseline changed '+e.path);const current=sha(fs.readFileSync(target));if(current!==e.before&&current!==e.after)throw Error('Later user changes detected; no files restored: '+e.path);return {target,saved};});
for(const e of entries)fs.writeFileSync(e.target,e.saved);
console.log('ROLLBACK_PASS restored='+entries.length+' root='+root+'; no files deleted');
