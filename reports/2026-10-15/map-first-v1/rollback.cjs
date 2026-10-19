const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const target=fs.realpathSync(process.argv[2]),live=fs.realpathSync(path.resolve(__dirname,'../../..'));
assert.notEqual(target.toLowerCase(),live.toLowerCase(),'refuse live checkout');assert.equal(fs.readFileSync(path.join(target,'.map-first-rollback'),'utf8'),'isolated map first rollback');
const records=require('./baseline.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const r of records){const source=path.join(__dirname,'baseline',r.path),dest=path.resolve(target,r.path);assert.ok(dest.toLowerCase().startsWith(target.toLowerCase()+path.sep));assert.equal(sha(fs.readFileSync(source)),r.sha256);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(source,dest);assert.equal(sha(fs.readFileSync(dest)),r.sha256);}
console.log('ROLLBACK_BYTES_RESTORED='+records.length+'/'+records.length);console.log('LIVE_WRITES=0');
