const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'design/2026-10-12/runtime-art');
const digest=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{const source=JSON.parse(fs.readFileSync(path.join(base,'source-lock.json'))),runtime=JSON.parse(fs.readFileSync(path.join(base,'runtime-lock.json')));
for(const r of [...source.records,...runtime.records])assert.equal(digest(path.join(root,r.path)),r.sha256,r.path);
for(const r of runtime.records){const m=await sharp(path.join(root,r.path)).metadata();assert.equal(m.width,r.width);assert.equal(m.height,r.height);if(r.hasAlpha){const {data}=await sharp(path.join(root,r.path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});let zero=0,full=0;for(let i=3;i<data.length;i+=4){if(data[i]===0)zero++;if(data[i]===255)full++;}assert.ok(zero>100&&full>100,r.id+' true-alpha');}}
console.log('REPLICA_ART_VERIFY source='+source.records.length+' runtime='+runtime.records.length+' alpha=6');})().catch(e=>{console.error(e);process.exitCode=1;});
