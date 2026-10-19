const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=__dirname, original=path.resolve(root,'../four-styles-draft-v1');
const read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p).toString().replace(/^\uFEFF/,''));
const hash=p=>crypto.createHash('sha256').update(read(p)).digest('hex');
const baseHash='d744785adf7e16aa65c4eb403482ad1cae61d1c381d1db e8eb7e514f58de9883'.replace(/ /g,'');
const mode=process.argv[2];
assert.equal(hash(path.join(original,'index.html')),baseHash);
assert.equal(hash(path.join(root,'baseline/index.html')),baseHash);
const sources=json(path.join(root,'sources.json'));
assert.equal(sources.length,15);
for(const s of sources){assert.equal(hash(s.absolutePath),s.sha256.toLowerCase());assert.equal(hash(path.join(root,'assets',s.page+'.png')),s.sha256.toLowerCase());}
const products=json(path.join(root,'baseline/product-hashes.json'));
for(const p of products)assert.equal(hash(p.path),p.sha256.toLowerCase());
if(mode==='baseline'){
 console.log('BASELINE PASS: gallery hash preserved; 15 source copies exact; product files unchanged');
}else if(mode==='modified'){
 const script=path.join(root,'replica.js');cp.execFileSync(process.execPath,['--check',script]);
 const text=read(script).toString();assert.equal((text.split('].map(')[0].match(/\['\d\d-[a-z-]+','/g)||[]).length,15);
 for(const f of ['replica.css','replica.js'])assert.ok(read(path.join(root,'index.html')).toString().includes(f));
 const geometry=json(path.join(root,'evidence/browser-geometry.json'));assert.equal(geometry.length,15);assert.equal(new Set(geometry.map(x=>x.page)).size,15);for(const r of geometry){assert.equal(r.overflow.length,0);assert.ok(r.controls>0);}
 const interactions=json(path.join(root,'evidence/interactions.json'));assert.ok(interactions.length>=17);for(const c of interactions)assert.equal(c.result,'PASS');
 const mobile=json(path.join(root,'evidence/mobile-geometry.json'));assert.equal(mobile.length,30);for(const r of mobile)assert.ok(r.scroll<=r.viewport);
 for(const s of sources)assert.ok(read(path.join(root,'evidence',s.page+'-compare.png')).length>1000);
 assert.notEqual(hash(path.join(root,'index.html')),baseHash);
 console.log('MODIFIED PASS: 15 states; 17 interaction checks; 30 narrow-layout checks; 0 bounds overflows; product files unchanged');
}else if(mode==='rollback'){
 assert.equal(hash(path.join(root,'evidence/rollback-test.html')),baseHash);
 assert.notEqual(hash(path.join(root,'index.html')),baseHash);
 console.log('ROLLBACK PASS: test copy restored byte-for-byte to baseline gallery; active replica remains changed');
}else throw Error('Usage: node verify.cjs baseline|modified|rollback');
