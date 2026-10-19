const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const target=path.resolve(process.argv[2]),live=path.resolve(__dirname,'../../..');
assert.notEqual(target.toLowerCase(),live.toLowerCase());
assert.equal(fs.readFileSync(path.join(target,'.font-trial-fixture'),'utf8'),'isolated font trial');
const records=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const r of records){const p=path.join(__dirname,'baseline',r.path);assert.equal(sha(fs.readFileSync(p)),r.sha256);fs.copyFileSync(p,path.join(target,r.path));}
const css=fs.readFileSync(path.join(target,'pages/dev/dev.wxss'),'utf8'),wxml=fs.readFileSync(path.join(target,'pages/dev/dev.wxml'),'utf8');
assert.ok(!css.includes('fusion-font.wxss')&&!css.includes('CatMouseFusionTrial'));assert.ok(!wxml.includes('字体试样'));
for(const r of records)assert.equal(sha(fs.readFileSync(path.join(target,r.path))),r.sha256);
console.log('ROLLBACK_RESTORED=2/2');console.log('RESTORED_FONT=ParkReplicaUI');console.log('LIVE_WRITES=0');
