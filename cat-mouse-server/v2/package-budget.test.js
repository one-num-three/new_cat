const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),budget=require('../../scripts/check-package-budget.cjs'),catalog=require('../../utils/venue-catalog');
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
test('editor package is below 1.5 decimal MB with maps isolated and originals/docs excluded',()=>{
 const result=budget.check(budget.scan(root)),image=catalog.get();
 assert.equal(JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')).lazyCodeLoading,'requiredComponents');
 assert.ok(result.rawLocalBytes.main<1200000,'retain at least 300 KB headroom');
 assert.equal(image.subpackage,'venue-xuanwu');assert.equal(hash(image.src.slice(1)),image.sha256);assert.equal(hash('assets/maps/xuanwu-lake-v4.jpg'),image.sha256);
 assert.equal(result.files.some(f=>f.file.startsWith('assets/maps/')||f.file.endsWith('.md')),false);
 assert.equal(result.files.filter(f=>f.file.endsWith('xuanwu-lake-v4.jpg')).length,1);
 assert.equal(result.files.find(f=>f.file.endsWith('xuanwu-lake-v4.jpg')).package,'venue-xuanwu');
 const shipped=new Map(result.files.map(f=>[f.file,f.package]));
 for(const f of result.files.filter(f=>f.file.endsWith('.js'))){for(const [,name]of fs.readFileSync(path.join(root,f.file),'utf8').matchAll(/require\(['"]([^'"]+)['"]\)/g)){
  assert.ok(name.startsWith('.'),'no npm or Node imports in mobile package');
  const target=path.relative(root,path.resolve(root,path.dirname(f.file),name)+(name.endsWith('.js')?'':'.js')).split(path.sep).join('/');
  assert.ok(shipped.has(target),f.file+' imports excluded '+target);assert.ok(shipped.get(target)==='main'||shipped.get(target)===f.package,'no synchronous imports from another subpackage');
 }}
});
test('different map packages serialize native bootstrap navigation and keep readiness isolated',async()=>{
 const module={exports:{}},calls=[];vm.runInNewContext(fs.readFileSync(path.join(root,'utils/venue-resources.js'),'utf8'),{module,require:()=>catalog,wx:{navigateTo:o=>calls.push(o)}});const r=module.exports;
 const first=r.ensure('xuanwu-v4'),again=r.ensure('xuanwu-v4'),campus=r.ensure('seu-jiulonghu-v1');assert.equal(first,again);assert.equal(calls.length,1);assert.match(calls[0].url,/^\/venue-xuanwu\//);assert.equal(r.ready('seu-jiulonghu-v1'),false);
 r.markLoaded('unknown');assert.equal(calls.length,1);r.markLoaded('venue-xuanwu');await first;assert.equal(calls.length,2);assert.match(calls[1].url,/^\/venue-maps\//);assert.equal(r.ready('xuanwu-v4'),true);assert.equal(r.ready('seu-jiulonghu-v1'),false);calls[1].fail();await assert.rejects(campus,/加载失败/);
 const retry=r.ensure('seu-sipailou-v1');assert.equal(calls.length,3);r.markLoaded('venue-maps');await retry;assert.equal(r.ready('seu-jiulonghu-v1'),true);assert.equal(r.ready('seu-sipailou-v1'),true);
});
test('bootstrap acknowledges resource availability after returning to its caller',()=>{
 let page,back,ready=0;vm.runInNewContext(fs.readFileSync(path.join(root,'venue-xuanwu/pages/open/open.js'),'utf8'),{Page:p=>page=p,require:()=>({markLoaded:n=>{assert.equal(n,'venue-xuanwu');ready++;}}),wx:{navigateBack:o=>back=o,redirectTo:()=>assert.fail('unexpected redirect')}});
 page.onLoad({resource:'1'});assert.equal(ready,0);back.success();assert.equal(ready,1);
});
