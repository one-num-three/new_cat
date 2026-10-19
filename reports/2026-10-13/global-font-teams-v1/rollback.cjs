const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const dir=path.resolve(process.argv[2]);assert.notEqual(dir.toLowerCase(),path.resolve(__dirname,'../../..').toLowerCase());assert.equal(fs.readFileSync(path.join(dir,'.rollback-fixture'),'utf8'),'isolated global-font teams fixture');const records=require('./baseline.json');const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const r of records){const from=path.join(__dirname,'baseline',r.path);assert.equal(sha(fs.readFileSync(from)),r.sha256);const to=path.join(dir,r.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);assert.equal(sha(fs.readFileSync(to)),r.sha256);}
const rules=require(path.join(dir,'cat-mouse-server/v2/rules.js'));assert.equal(rules.preset(8).cats,2);assert.equal(rules.preset(8).version,'pilot-0.2');assert.throws(()=>rules.preset(3,false,{cats:1,mice:2}),/INVALID_PRESET/);
assert.ok(!fs.readFileSync(path.join(dir,'utils/pixel-theme.wxss'),'utf8').includes('CatMouseFusionUI'));
assert.ok(!fs.readFileSync(path.join(dir,'pages/room/room.wxml'),'utf8').includes('bindinput="teamInput"'));
console.log('ROLLBACK_RESTORED='+records.length+'/'+records.length);console.log('RESTORED=single-page trial + fixed presets pilot-0.2');console.log('LIVE_WRITES=0');
