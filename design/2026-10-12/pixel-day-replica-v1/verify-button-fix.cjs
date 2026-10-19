const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=__dirname,read=p=>fs.readFileSync(path.join(root,p)),json=p=>JSON.parse(read(p).toString().replace(/^\uFEFF/,''));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const files=['replica.js','replica.css','serve.cjs'],mode=process.argv[2];
const manifest=json('baseline/button-fix-v1/hashes.json');
for(const f of files){const item=manifest.find(x=>path.basename(x.Path)===f);assert.equal(hash(read('baseline/button-fix-v1/'+f)),item.Hash);}
if(mode==='baseline'){
 assert.ok(read('baseline/button-fix-v1/replica.js').toString().includes('function skinEdges('));
 assert.ok(read('baseline/button-fix-v1/replica.css').toString().includes('font-weight:900'));
 console.log('BASELINE PASS: 3 original hashes; four-strip button renderer; weight 900');
}else if(mode==='modified'){
 cp.execFileSync(process.execPath,['--check',path.join(root,'replica.js')]);
 assert.ok(!read('replica.js').toString().includes('skinEdges'));
 assert.ok(read('replica.js').toString().includes('function sourceButton('));
 const qa=json('evidence/button-fix-geometry.json');assert.equal(qa.length,15);let count=0;
 for(const p of qa){assert.equal(p.oldStrips,0);assert.equal(p.overflow.length,0);for(const b of p.buttons){assert.equal(b.art,1);assert.equal(b.render,'single-source');assert.ok(b.name);count++;}}
 assert.equal(count,34);
 const tests=json('evidence/button-fix-interactions.json');assert.equal(tests.length,6);for(const t of tests)assert.equal(t.result,'PASS');
 const font=json('font-manifest.json');assert.equal(font.missing.filter(c=>/[\u4e00-\u9fff]/.test(c)).length,0);assert.equal(font.axis[0].min,100);assert.equal(font.axis[0].max,900);assert.equal(hash(read('assets/ui-variable.woff')).toLowerCase(),font.outputSHA256);
 console.log('MODIFIED PASS: 15 states; 34 seamless source buttons; 6 interactions; variable font 100-900; 0 missing Chinese glyphs');
}else if(mode==='rollback'){
 for(const f of files)assert.equal(hash(read('evidence/button-fix-rollback/'+f)),hash(read('baseline/button-fix-v1/'+f)));
 assert.notEqual(hash(read('replica.js')),hash(read('baseline/button-fix-v1/replica.js')));
 console.log('ROLLBACK PASS: 3 test copies restored; old renderer recovered; active fix retained');
}else throw Error('Expected baseline, modified or rollback');
