const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {project}=require('../../utils/presentation'),root=path.resolve(__dirname,'../..');
const snapshot=(phase='CHASING',role='cat',status='active',owner=false)=>({owner,rules:{mice:6},roster:[{id:'me',role,status},{id:'other',role:'mouse',status:'captured'}],match:{id:'m1',phase,myRole:role,myStatus:status,captured:4,target:4,outcome:phase==='FINISHED'?'cat_win':null}});
test('native template expressions parse including conditional accessibility classes',()=>{
 const app=JSON.parse(fs.readFileSync(path.join(root,'app.json')));
 for(const page of [...app.pages,'components/nav-bar/nav-bar']){
  const w=fs.readFileSync(path.join(root,page+'.wxml'),'utf8');
  for(const [,expression]of w.matchAll(/{{([\s\S]*?)}}/g))assert.doesNotThrow(()=>new vm.Script('('+expression+')'),page+' '+expression);
 }
});
test('presentation only exposes role and stage appropriate primary actions',()=>{
 for(const phase of ['HIDING','CHASING','PAUSED','FINISHED','CANCELLED'])for(const role of ['cat','mouse'])for(const status of ['active','captured'])for(const owner of [false,true]){
  const s=snapshot(phase,role,status,owner),p=project(s);
  assert.equal(p.canScan,phase==='CHASING'&&role==='cat'&&status==='active');
  assert.equal(p.canShowCode,phase==='CHASING'&&role==='mouse'&&status==='active');
  assert.equal(p.canResume,phase==='PAUSED'&&owner);
  assert.equal(p.canReplay,['FINISHED','CANCELLED'].includes(phase)&&owner);
  for(const key of ['canScan','canShowCode','canResume','canReplay'])assert.equal(project(s,true)[key],false,phase+' offline '+key);
 }
});
test('result denominator stays at opening rules despite roster departures',()=>{
 const s=snapshot('FINISHED');const p=project(s);
 assert.equal(p.initialMice,6);assert.match(p.resultSummary,/4 \/ 6/);
 assert.equal(s.match.outcome,'cat_win');assert.equal(s.match.captured,4);assert.equal(p.uiState,'catWin');
 s.match.phase='CANCELLED';s.match.outcome=null;assert.equal(project(s).uiState,'cancelled');assert.equal(project(s).resultSummary,'这局记录保留，下一轮使用新的对局');
});
test('window metrics use real capsule, safe area and bounded text preference',()=>{
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'utils/presentation.js'),'utf8'),{module,require:p=>require('../../utils/venue-catalog'),wx:{getWindowInfo:()=>({statusBarHeight:47,screenHeight:844,safeArea:{bottom:810}}),getMenuButtonBoundingClientRect:()=>({top:51,bottom:83}),getAppBaseInfo:()=>({fontSizeSetting:32})}});
 const m=module.exports.metrics();assert.equal(m.navHeight,87);assert.equal(m.safeBottom,34);assert.equal(m.fontScale,1.3);
});
test('native pages keep actionable controls and real map isolated from preview illustration',()=>{
 const read=f=>fs.readFileSync(path.join(root,f),'utf8'),app=JSON.parse(read('app.json'));
 assert.equal(app.window.navigationStyle,'custom');assert.equal(app.usingComponents['nav-bar'],'/components/nav-bar/nav-bar');
 for(const page of app.pages){const w=read(page+'.wxml');assert.match(w,/<nav-bar /);assert.match(w,/<(?:button|pixel-action) /);assert.doesNotMatch(w,/page-concepts-v1/);}
 const map=read('pages/map/map.wxml');assert.match(map,/<venue-art[^>]*wx:elif="{{artMode}}"/);assert.match(map,/<map wx:else id="gameMap" class="gameMap"/);assert.match(map,/wx:if="{{canScan}}"/);assert.match(map,/wx:if="{{canReplay}}"/);assert.match(map,/仅查看公开位置/);
 assert.match(read('pages/qrcode/qrcode.wxml'),/src="{{image}}"/);assert.match(read('pages/index/index.wxml'),/bindinput="nameInput"/);
});
test('mobile art derivatives match fixed lock and state scenes have transparency',()=>{
 const lock=JSON.parse(fs.readFileSync(path.join(root,'design/2026-10-12/runtime-art/runtime-lock.json')));
 assert.equal(lock.records.length,9);
 for(const r of lock.records){const b=fs.readFileSync(path.join(root,r.path));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),r.sha256);assert.ok(r.bytes<300000);if(!['home-landscape-v2','compact-landscape','preview-park'].includes(r.id))assert.equal(r.hasAlpha,true);}
 assert.ok(lock.records.reduce((n,r)=>n+r.bytes,0)<1000000);
});
test('faithful art retains approved source bytes, intrinsic aspect and separate page/state compositions',()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,'design/2026-10-12/faithful-art/manifest.json')));
 assert.equal(m.sources.length,16);assert.equal(m.assets.length,48);
 const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');
 for(const s of m.sources)assert.equal(hash(s.path),s.sha256);
 for(const a of m.assets){assert.equal(hash(a.path),a.sha256);assert.equal(a.transform.resizeWidth,a.width);assert.ok(Math.abs((a.width/a.height)/(a.crop.width/a.crop.height)-1)<.012,a.id+' distorted');assert.equal(a.previewOnly,a.kind==='park-stage');}
 for(const id of ['home','create','ready','code','gallery'])assert.ok(m.assets.some(a=>a.id==='hero-'+id));
 for(const id of ['mouse','hiding','captured','paused','offline','catWin','mouseWin','cancelled']){const a=m.assets.find(a=>a.id==='state-'+id);assert.ok(a.alpha.transparent>0&&a.alpha.opaque>0);}
 assert.ok(m.runtimeBytes<1850000);
});
test('map art and event timestamps are display only while authenticated actions remain gated',()=>{
 const mouse=project(snapshot('CHASING','mouse'));
 assert.equal(mouse.stateArt,'');assert.match(mouse.roleArt,/pixel-v1\/role-mouse.png$/);
 const offline=project(snapshot('CHASING','mouse'),true);assert.equal(offline.parkArt,'/assets/maps/xuanwu-lake-v4.jpg');assert.equal(offline.canShowCode,false);
 const {eventTime}=require('../../utils/presentation');assert.equal(eventTime(undefined),'—');assert.match(eventTime(1791766800000),/^\d{2}:\d{2}$/);
 const map=fs.readFileSync(path.join(root,'pages/map/map.wxml'),'utf8');assert.match(map,/event.timeText/);assert.match(map,/取消不计胜负/);
 assert.match(map,/<venue-art[^>]*wx:elif="{{artMode}}"/);assert.doesNotMatch(map,/<venue-art[^>]*(?:markers=|circles=|latitude=|longitude=)/);assert.match(map,/class="mapStatus/);assert.match(map,/class="resultHero"[^>]*mode="widthFix"/);
 assert.match(map,/<map wx:else id="gameMap" class="gameMap"[^>]*markers="{{markers}}"[^>]*circles="{{circles}}"/);
});
test('current variable font is licensed and native controls use pixel baseline',()=>{
 const bytes=fs.readFileSync(path.join(root,'assets/pixel-v1/ui-variable.woff'));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'11e128112254d25a1439408158c8a8aac7cda64ca07772705b2d1aa769463819');
 const css=fs.readFileSync(path.join(root,'utils/pixel-font.wxss'),'utf8');assert.ok(css.includes(bytes.toString('base64')));assert.match(css,/font-weight:100 900/);
 assert.match(fs.readFileSync(path.join(root,'assets/pixel-v1/FONT-LICENSE.txt'),'utf8'),/SIL OPEN FONT LICENSE Version 1.1/);
 assert.match(fs.readFileSync(path.join(root,'utils/pixel-theme.wxss'),'utf8'),/ParkReplicaUI/);
});
test('every native page responds to viewport resize without changing match/action state',()=>{
 const helper={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'utils/presentation.js'),'utf8'),{module:helper,require:p=>require('../../utils/venue-catalog'),Date,wx:{getWindowInfo:()=>({windowWidth:390,windowHeight:844,statusBarHeight:47}),getAppBaseInfo:()=>({fontSizeSetting:16})}});
 for(const name of ['index','room','map','qrcode','dev','venue']){
  let page;vm.runInNewContext(fs.readFileSync(path.join(root,'pages/'+name+'/'+name+'.js'),'utf8'),{Page:p=>page=p,require:p=>p.includes('venue-catalog')?require('../../utils/venue-catalog'):p.includes('venue-resources')?require('../../utils/venue-resources'):p.includes('capture-proof')?require('../../utils/capture-proof'):p.includes('presentation')?helper.exports:{},wx:{},Date,Math});
  const original={match:{id:'m-existing',myRole:'mouse'},canShowCode:true,clock:'04:45'};
  page.data=original;page.setData=updates=>Object.assign(page.data,updates);
  page.onResize({size:{windowWidth:320,windowHeight:693}});
  assert.equal(page.data.viewportWidth,320,name);assert.equal(page.data.viewportHeight,693,name);
  assert.equal(page.data.match.id,'m-existing');assert.equal(page.data.canShowCode,true);assert.equal(page.data.clock,'04:45');
  page.onResize({size:{windowWidth:-1,windowHeight:NaN}});assert.equal(page.data.viewportWidth,390);assert.equal(page.data.viewportHeight,844);
 }
});
test('responsive UI never uses nonuniform image scaling and narrow canvas keeps native controls',()=>{
 for(const name of ['index','room','map','qrcode','dev','venue']){
  const w=fs.readFileSync(path.join(root,'pages/'+name+'/'+name+'.wxml'),'utf8');
  const c=fs.readFileSync(path.join(root,'pages/'+name+'/'+name+'.wxss'),'utf8');
  assert.doesNotMatch(w,/mode="scaleToFill"/);assert.doesNotMatch(c,/scale[XY]\s*\(/);
 }
 for(const name of ['index','room','dev'])assert.match(fs.readFileSync(path.join(root,'pages/'+name+'/'+name+'.wxml'),'utf8'),/viewportWidth<350\?'narrowCanvas'/);
 const styles=fs.readFileSync(path.join(root,'utils/pixel-art-ratios.wxss'),'utf8'),assets=JSON.parse(fs.readFileSync(path.join(root,'design/2026-10-13/pixel-runtime-v1/manifest.json'))).records;
 for(const a of assets.filter(a=>a.kind==='illustration'))assert.ok(styles.includes('aspect-ratio:'+a.width+' / '+a.height+';height:auto!important'),a.id+' missing intrinsic responsive ratio');
 assert.match(fs.readFileSync(path.join(root,'utils/pixel-theme.wxss'),'utf8'),/@import "\.\/pixel-art-ratios.wxss"/);
});
