'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'reports/2026-10-19/venue-boundary-v1'),pack=path.join(out,process.argv[3]||'release-final/MODIFIED_FILE');
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const app=JSON.parse(read('app.json')),pages=[...app.pages,...app.subPackages.flatMap(g=>g.pages.map(p=>g.root+'/'+p))],components=fs.readdirSync(path.join(root,'components')).map(n=>'components/'+n+'/'+n);
const compiler='D:/Program Files (x86)/微信web开发者工具/resources/app.asar.unpacked/node_modules/wcc-exec/';
const compilation={};
for(const type of ['wxml','wxss']){
 const entries=[...pages,...components].map(p=>p+'.'+type);if(type==='wxss')entries.unshift('app.wxss');
 const files=new Set(entries),jobs=type==='wxml'?[entries]:entries.map(entry=>{
  // wcsc 默认只输出首个根文件；每个入口单独编译，不能只统计输入文件数。
  const graph=new Set([entry]);const visit=f=>{for(const [,name]of read(f).matchAll(/@import\s+["']([^"']+)["']/g)){
   const imported=path.posix.normalize(path.posix.join(path.posix.dirname(f),name));if(!graph.has(imported)){graph.add(imported);files.add(imported);visit(imported);}
  }};visit(entry);return [...graph];
 });
 const results=jobs.map(inputs=>{const r=cp.spawnSync(compiler+(type==='wxml'?'wcc.exe':'wcsc.exe'),inputs,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
  const result={entry:inputs[0],status:r.status,outputBytes:Buffer.byteLength(r.stdout||''),stderr:r.stderr,error:r.error?.message};assert.equal(r.status,0,inputs[0]+' '+(r.stderr||r.error?.message));return result;
 });
 compilation[type]={status:0,files:[...files],entries:entries.length,results,outputBytes:results.reduce((n,r)=>n+r.outputBytes,0)};
 fs.writeFileSync(path.join(out,'compile-'+type+'.json'),JSON.stringify(compilation[type],null,2));
}
const syntaxFiles=[...pages.map(p=>p+'.js'),...components.map(p=>p+'.js'),'app.js','utils/location-v2.js','utils/venue-boundary.js','utils/qr-protocol.js','utils/capture-flow.js','utils/room-live.js','utils/snapshot-v2.js','utils/model-map.js','utils/v2.js','cat-mouse-server/shared/venue-boundary.js','cat-mouse-server/v2/service.js','cat-mouse-server/v2/server.js','cat-mouse-server/v2/store.js','cat-mouse-server/v2/map-catalog.js','cat-mouse-server/v2/acceptance.cjs','cat-mouse-server/v2/venue-boundary.test.js','scripts/verify-venue-boundary.cjs'];
syntaxFiles.push('utils/track-export.js','utils/track-poster.js','cat-mouse-server/v2/visibility.js','cat-mouse-server/v2/tracks.js','cat-mouse-server/v2/tracks-vision.test.js','scripts/mcp-tracks-fixture.cjs','scripts/mcp-tracks-vision.cjs');
syntaxFiles.push('scripts/mcp-track-poster.cjs');
syntaxFiles.push('utils/track-highlights.js','cat-mouse-server/v2/track-highlights.js');
syntaxFiles.push('scripts/render-track-highlights.cjs');
syntaxFiles.push('utils/track-bubble-placement.js','utils/track-bubble-assets.js');
syntaxFiles.push('scripts/build-track-highlights-evidence.cjs');
syntaxFiles.push('scripts/verify-track-layering.cjs','scripts/build-track-layer-evidence.cjs');
const syntax=syntaxFiles.map(file=>{const r=cp.spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,file+' '+r.stderr);return {file,status:r.status};});
assert.equal(read('utils/venue-boundary.js'),read('cat-mouse-server/shared/venue-boundary.js'));
assert.equal(read('utils/qr-protocol.js'),read('cat-mouse-server/shared/qr-protocol.js'));
const font=JSON.parse(read('design/2026-10-13/global-font-v1/manifest.json'));assert.equal(sha(fs.readFileSync(path.join(root,'utils/fusion-font.wxss'))),font.wxssSha256);
const manifest=[],sizes={};function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else{const relative=path.relative(pack,f),bytes=fs.readFileSync(f);assert.equal(sha(bytes),sha(fs.readFileSync(path.join(root,relative))),relative);const group=app.subPackages.map(g=>g.root).find(n=>relative.startsWith(n+path.sep))||'main';sizes[group]=(sizes[group]||0)+bytes.length;manifest.push({file:relative,bytes:bytes.length,sha256:sha(bytes)});}}}walk(pack);assert.ok(Object.values(sizes).every(n=>n<2097152));assert.ok(sizes.main<1500000,'Main package must stay below 1,500,000 bytes');
const log=fs.readFileSync(path.join(out,'tests-final.log'),'utf8'),count=label=>Number(new RegExp('^# '+label+' (\\d+)\\r?$','m').exec(log)?.[1]);assert.equal(count('fail'),0);assert.equal(count('tests'),count('pass'));assert.ok(count('pass')>=168);
const diff=cp.spawnSync('git',['diff','--check'],{cwd:root,encoding:'utf8'});assert.equal(diff.status,0,diff.stdout);fs.writeFileSync(path.join(out,'diff-check.txt'),diff.stdout||'exit=0; no whitespace errors in tracked diff\n');
const result={date:/reports[\\/](\d{4}-\d{2}-\d{2})[\\/]/.exec(out)?.[1]||new Date().toISOString().slice(0,10),tests:{total:count('tests'),passed:count('pass'),failed:count('fail'),storage:'local PGlite; not a live PostgreSQL server'},compilation:Object.fromEntries(Object.entries(compilation).map(([k,v])=>[k,{files:v.files.length,status:v.status}])),syntax,sharedGeometryIdentical:true,font:{glyphs:font.glyphCount,bytes:font.bytes,sha256:font.wxssSha256},packageFiles:manifest.length,rawLocalBytes:sizes,uploadVerified:false,simulator:fs.existsSync(path.join(out,'mcp/result.json'))?JSON.parse(fs.readFileSync(path.join(out,'mcp/result.json'),'utf8')):{status:'not-recorded-in-this-artifact'},phone:'not-run',fieldGps:'not-run',productionDeployment:fs.existsSync(path.join(out,'deployment.json'))?'see deployment.json':'not-run',publicLoadTest:'not-run'};
result.sharedQrProtocolIdentical=true;
fs.writeFileSync(path.join(out,'package-manifest.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(out,'package-sizes.json'),JSON.stringify({rawLocalBytes:sizes,mainLimitBytes:1500000,subPackageLimitBytes:2097152,uploadVerified:false},null,2));fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({tests:result.tests,compilation:result.compilation,syntaxChecks:syntax.length,rawLocalBytes:sizes,packageFiles:manifest.length,simulator:result.simulator.status},null,2));
