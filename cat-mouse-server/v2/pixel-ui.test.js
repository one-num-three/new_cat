const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const bytes=name=>fs.readFileSync(path.join(root,name));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const plain=value=>JSON.parse(JSON.stringify(value));
const manifest=()=>JSON.parse(read('design/2026-10-13/pixel-runtime-v1/manifest.json'));
const tags=(text,name)=>text.match(new RegExp('<'+name+'\\b(?:[^>"\']|"[^"]*"|\'[^\']*\')*>','g'))||[];
const attr=(tag,key)=>{const match=tag.match(new RegExp('(?:^|\\s)'+key+'="([^"]*)"'));return match?.[1];};
const expr=(value,data)=>value?.startsWith('{{')?vm.runInNewContext(value.slice(2,-2),data):value;
const control=(page,action)=>{
  const found=[...tags(read('pages/'+page+'/'+page+'.wxml'),'pixel-action'),...tags(read('pages/'+page+'/'+page+'.wxml'),'button')].find(tag=>attr(tag,'bindaction')===action || attr(tag,'bindtap')===action);
  assert.ok(found,page+' must use a real pixel-action for '+action);return found;
};

function actionFixture(patch={}){
  let definition;const events=[],writes=[];
  vm.runInNewContext(read('components/pixel-action/pixel-action.js'),{Component:value=>definition=value,require:name=>{assert.equal(name,'../../utils/pixel-button-dimensions');return require('../../utils/pixel-button-dimensions');}});
  const defaults=Object.fromEntries(Object.entries(definition.properties).map(([key,value])=>[key,value.value]));
  const instance={...definition.methods,data:{...defaults,...plain(definition.data),...patch},triggerEvent:(...args)=>events.push(args)};
  instance.setData=value=>{writes.push(plain(value));Object.assign(instance.data,value);};
  return {definition,instance,events,writes};
}

function pageFixture(name,options={}){
  let page;const effects=[];
  const reject=name=>()=>{effects.push(name);throw Error('unexpected '+name);};
  const guarded=(target,prefix)=>new Proxy(target,{get:(o,key)=>key in o?o[key]:reject(prefix+String(key))});
  const wx=guarded(options.wx||{},'wx.');
  const api=guarded(options.api||{config:{}},'api.');
  const loc=guarded(options.loc||{},'loc.');
  vm.runInNewContext(read('pages/'+name+'/'+name+'.js'),{
    Page:value=>page=value,wx,Date,Math,Number,Error,Promise,JSON,encodeURIComponent,
    require:name=>name.includes('venue-catalog')?require('../../utils/venue-catalog'):name.includes('venue-resources')?require('../../utils/venue-resources'):name.includes('map-markers')?require('../../utils/map-markers'):name.includes('capture-proof')?require('../../utils/capture-proof'):name.includes('team-config')?require('../../utils/team-config'):name.includes('presentation')?require('../../utils/presentation'):name.includes('snapshot-v2')?{shouldApply:()=>true}:name.includes('location-v2')?loc:name.includes('dev-preview')?(options.preview||{}):api,
    setTimeout:reject('setTimeout'),setInterval:reject('setInterval'),clearTimeout:reject('clearTimeout'),clearInterval:reject('clearInterval')
  });
  page.setData=patch=>Object.assign(page.data,patch);return {page,effects};
}

function pngInfo(buffer){
  assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  const result={};let offset=8;
  while(offset+12<=buffer.length){
    const length=buffer.readUInt32BE(offset),name=buffer.toString('ascii',offset+4,offset+8);
    assert.ok(offset+length+12<=buffer.length,'complete PNG '+name+' chunk');
    if(name==='IHDR'){result.width=buffer.readUInt32BE(offset+8);result.height=buffer.readUInt32BE(offset+12);result.colourType=buffer[offset+17];}
    if(name==='PLTE'){assert.equal(length%3,0);result.paletteEntries=length/3;}
    offset+=length+12;if(name==='IEND')break;
  }
  assert.equal(offset,buffer.length,'no omitted/trailing PNG chunk bytes');return result;
}

test('pixel-action emits one real action event only when enabled and not loading',()=>{
  for(const disabled of [false,true])for(const loading of [false,true]){
    const f=actionFixture({disabled,loading});f.instance.activate();
    assert.deepEqual(f.events,disabled||loading?[]:[['action']]);assert.deepEqual(f.writes,[]);
  }
  const button=tags(read('components/pixel-action/pixel-action.wxml'),'button')[0];
  assert.equal(attr(button,'bindtap'),'activate');assert.equal(attr(button,'disabled'),'{{disabled || loading}}');assert.equal(attr(button,'aria-label'),'{{label}}');
});

test('pixel-action accepts only positive finite intrinsic dimensions and retries a changed skin',()=>{
  const f=actionFixture({skin:'/assets/pixel-v1/button-home-join.png'});
  f.instance.loaded({detail:{width:420,height:85}});assert.equal(f.instance.data.artWidth,420);assert.equal(f.instance.data.artHeight,85);
  for(const detail of [{},{width:NaN,height:85},{width:Infinity,height:85},{width:420,height:0},{width:-1,height:85},{width:'420',height:85}]){
    const before=plain(f.instance.data);f.instance.loaded({detail});assert.deepEqual(plain(f.instance.data),before);
  }
  f.instance.failed();assert.equal(f.instance.data.artFailed,true);
  f.definition.observers.skin.call(f.instance);assert.equal(f.instance.data.artFailed,false);
  f.instance.failed();f.instance.loaded({detail:{width:388,height:130}});assert.equal(f.instance.data.artFailed,false);assert.equal(f.instance.data.artWidth,388);assert.equal(f.instance.data.artHeight,130);
});

test('normal pixel action uses live selected-font text without rasterized labels',()=>{
 const w=read('components/pixel-action/pixel-action.wxml');assert.equal(tags(w,'image').length,0);assert.equal(tags(w,'text').length,1);assert.match(w,/class="actionLabel">{{label}}/);assert.match(w,/nativeAction/);assert.match(read('components/pixel-action/pixel-action.wxss'),/CatMouseFusionUI/);
  const m=manifest();for(const record of m.records.filter(item=>item.kind==='button')){
    const [x,y,width,height]=record.crop,[rx,ry,rw,rh]=record.rect;
    assert.ok(x<=rx&&y<=ry&&x+width>=rx+rw&&y+height>=ry+rh,record.id+' retains the complete button rectangle');
    assert.ok(Math.abs(record.height-record.width*height/width)<=1,record.id+' preserves aspect within one output pixel');
  }
});

test('large text and dynamic labels render native wrapping text with disabled gating',()=>{
 const w=read('components/pixel-action/pixel-action.wxml'),css=read('components/pixel-action/pixel-action.wxss');assert.match(w,/{{label}}/);assert.match(w,/disabled="{{disabled \|\| loading}}"/);
  assert.match(css,/\.actionLabel\{[^}]*white-space:normal/);
  assert.match(css,/\.nativeAction\{[^}]*padding:12px 14px/);
  assert.doesNotMatch(css.match(/\.nativeAction\{([^}]+)\}/)[1],/(?:^|;)height:|max-height:|white-space:nowrap|overflow:hidden/);
  assert.match(css,/min-height:44px/);assert.match(css,/font-size:calc\(20px \* var\(--action-scale,1\)\)/);
});

test('five registered business pages use pixel assets and preserve real native controls',()=>{
  const app=JSON.parse(read('app.json'));assert.equal(app.usingComponents['pixel-action'],'/components/pixel-action/pixel-action');
  for(const name of ['index','room','map','qrcode','dev']){
    const page='pages/'+name+'/'+name;assert.ok(app.pages.includes(page));
    const w=read(page+'.wxml');assert.match(w,/<nav-bar\b/);assert.ok(tags(w,'button').length+tags(w,'pixel-action').length>0);
    for(const suffix of ['.js','.wxml','.wxss'])assert.doesNotMatch(read(page+suffix),/\/assets\/faithful-v2\//,page+suffix);
    assert.doesNotMatch(w,/mode="(?:scaleToFill|aspectFill)"/);assert.doesNotMatch(read(page+'.wxss'),/scale[XY]\s*\(/);
    for(const [,expression]of w.matchAll(/{{([\s\S]*?)}}/g))assert.doesNotThrow(()=>new vm.Script('('+expression+')'),page+' expression');
  }
  assert.match(read('pages/index/index.wxml'),/<input\b[^>]*bindinput="nameInput"/);
  assert.match(read('pages/index/index.wxml'),/<input\b[^>]*bindinput="codeInput"/);
  for(const field of ['total','catsCount','miceCount'])assert.ok(read('pages/room/room.wxml').includes('data-field="'+field+'"'));
});

test('all pixel controls bind existing handlers with an accessible label and scalable text',()=>{
  for(const name of ['index','room','map','qrcode','dev']){
    const {page}=pageFixture(name);
    for(const tag of tags(read('pages/'+name+'/'+name+'.wxml'),'pixel-action')){
      assert.ok(Number.isFinite(page.data.fontScale)&&page.data.fontScale>=1,name+' initial render must supply a readable numeric font scale before onLoad');
      const handler=attr(tag,'bindaction');assert.equal(typeof page[handler],'function',name+' '+handler);
      assert.ok(attr(tag,'label')?.trim(),name+' '+handler+' accessible label');
      assert.equal(attr(tag,'font-scale'),'{{fontScale}}',name+' '+handler);
      assert.equal(attr(tag,'bindtap'),undefined,'events must use the component action event');
    }
  }
});

test('dynamic room and terminal action labels use native text when source-button copy would be wrong',()=>{
  const cases=[
    ['room','chooseVenue',{venue:null},'确认位置',true],
    ['room','chooseVenue',{venue:{confirmed:true}},'重选位置',false],
    ['room','start',{canStart:false},'等待所有人准备',true],
    ['room','start',{canStart:true},'开始30秒躲藏',false],
    ['room','toggleReady',{ready:false},'定位并准备',true],
    ['room','toggleReady',{ready:true},'取消准备',false],
    ['map','leave',{terminal:true},'返回首页',true],
    ['map','leave',{terminal:false},'退出本局',false]
  ];
  for(const [page,action,data,label,dynamic]of cases){
    const tag=control(page,action);assert.equal(expr(attr(tag,'label'),data),label);assert.equal(expr(attr(tag,'dynamic'),data),dynamic,page+' '+action);
  }
});

test('pixel map primary buttons retain the exact server-projected action gates',()=>{
  for(const [handler,gate] of [['scan','canScan'],['showCode','canShowCode'],['resume','canResume'],['replay','canReplay']])assert.equal(attr(control('map',handler),'wx:if'),'{{'+gate+'}}');
  const {project}=require('../../utils/presentation');
  for(const phase of ['HIDING','CHASING','PAUSED','FINISHED','CANCELLED'])for(const myRole of ['cat','mouse'])for(const myStatus of ['active','captured'])for(const owner of [false,true])for(const offline of [false,true]){
    const data=project({owner,match:{phase,myRole,myStatus},roster:[]},offline),live=!offline&&phase==='CHASING'&&myStatus==='active';
    assert.equal(data.canScan,live&&myRole==='cat');assert.equal(data.canShowCode,live&&myRole==='mouse');
    assert.equal(data.canResume,!offline&&phase==='PAUSED'&&owner);assert.equal(data.canReplay,!offline&&['FINISHED','CANCELLED'].includes(phase)&&owner);
  }
});

test('map action methods independently reject false permissions and preserve enabled routes',async()=>{
  const events=[];
  const f=pageFixture('map',{wx:{navigateTo:o=>events.push(['navigate',o.url]),redirectTo:o=>events.push(['redirect',o.url]),scanCode:()=>events.push(['scan'])},api:{resume:async id=>events.push(['resume',id])},loc:{once:async id=>events.push(['position',id])}});
  const p=f.page;p.data.roomId='real-room';p.devPreview=false;p.poll=async()=>events.push(['poll']);
  Object.assign(p.data,{canScan:false,canShowCode:false,canResume:false,canReplay:false,loading:false,offline:false});
  p.scan();p.showCode();await p.resume();p.replay();assert.deepEqual(events,[]);
  p.data.canScan=true;p.data.loading=true;p.scan();p.data.loading=false;p.data.offline=true;p.scan();assert.deepEqual(events,[]);
  p.data.offline=false;p.scan();assert.deepEqual(events.splice(0),[['scan']]);
  p.data.canShowCode=true;p.devPreview=true;p.showCode();assert.equal(p.data.codeOpen,true);assert.deepEqual(events.splice(0),[]);p.closeCode();p.devPreview=false;
  p.data.canResume=true;p.data.loading=true;await p.resume();assert.deepEqual(events,[]);p.data.loading=false;await p.resume();assert.deepEqual(events.splice(0),[['position','real-room'],['resume','real-room'],['poll']]);
  p.data.canReplay=true;p.replay();assert.deepEqual(events.splice(0),[['redirect','/pages/room/room?roomId=real-room']]);assert.deepEqual(f.effects,[]);
});

test('cancelled result counts and drawer names remain server data rather than painted sample values',()=>{
  const {project}=require('../../utils/presentation');
  const roster=[{id:'x-72',nickname:'动态昵称甲',role:'cat'},{id:'y-99',nickname:'动态昵称乙',role:'mouse',status:'captured'}];
  const state=project({owner:true,roster,rules:{mice:9},match:{id:'cancel-server',phase:'CANCELLED',myRole:'mouse',myStatus:'active',captured:2,target:7,outcome:null}});
  assert.equal(state.uiState,'cancelled');assert.deepEqual(state.cats,[roster[0]]);assert.deepEqual(state.mice,[roster[1]]);assert.equal(state.initialMice,9);
  const w=read('pages/map/map.wxml');assert.match(w,/{{match\.captured}}/);assert.match(w,/{{match\.target}}/);
  for(const collection of ['cats','mice'])assert.match(w,new RegExp('wx:for="{{'+collection+'}}"'));
  assert.match(w,/{{item\.nickname}}/);assert.match(w,/{{item\.status==='captured'/);
  const room=read('pages/room/room.wxml');assert.match(room,/wx:for="{{roster}}"/);assert.match(room,/{{item\.nickname}}/);assert.match(room,/{{roster\.length}}\/{{rules\?rules\.total:total}}/);
  assert.doesNotMatch(read('utils/presentation.js'),/dev-preview|猫猫队长|小鼠同学/);
});

test('native page application retains non-sample server targets and variable roster sizes',()=>{
  const roster=Array.from({length:11},(_,i)=>({id:'server-'+i,nickname:'服务器成员-'+i,role:i<3?'cat':'mouse',status:i===4?'captured':'active',ready:i<10}));
  const map=pageFixture('map',{wx:{getStorageSync:()=>roster[0].id},loc:{stop:()=>{}}});map.page.active=true;
  const snapshot={version:4,serverTime:1000,owner:false,roster,rules:{total:11,cats:3,mice:8},match:{id:'server-cancel',phase:'CANCELLED',myRole:'cat',myStatus:'active',captured:2,target:7,remainingMs:0},venue:{lat:32.07,lng:118.79,radiusM:200},visiblePositions:[],intel:[],events:[]};
  map.page.apply(snapshot);
  assert.equal(map.page.data.match,snapshot.match);assert.equal(map.page.data.match.target,7);assert.equal(map.page.data.match.captured,2);
  assert.equal(map.page.data.roster,roster);assert.equal(map.page.data.cats.length,3);assert.equal(map.page.data.mice.length,8);assert.equal(map.page.data.mice[1].nickname,'服务器成员-4');assert.deepEqual(map.effects,[]);
  const room=pageFixture('room',{wx:{setNavigationBarTitle:()=>{}}});room.page.applyRoom({roster,rules:snapshot.rules,owner:false});
  assert.equal(room.page.data.roster,roster);assert.equal(room.page.data.roster.length,11);assert.equal(room.page.data.readyCount,10);assert.equal(room.page.data.canStart,false);assert.equal(room.page.data.catsCount,3);assert.deepEqual(room.effects,[]);
});

test('QR view still binds a generated token image and never substitutes a decorative QR slice',async()=>{
  const w=read('pages/qrcode/qrcode.wxml');
  assert.match(w,/<image\b[^>]*wx:elif="{{image}}"[^>]*src="{{image}}"[^>]*mode="aspectFit"/);
  assert.match(w,/wx:if="{{devPreview}}" class="qrDemo"/);assert.match(w,/不可扫描/);
  const writes=[],expiresAt=Date.now()+15000;
  const f=pageFixture('qrcode',{api:{token:async id=>{assert.equal(id,'server-room');return {qrPngBase64:'server-provided-png',expiresAt};}},wx:{env:{USER_DATA_PATH:'/local-generated'},getFileSystemManager:()=>({writeFileSync:(...args)=>writes.push(args),unlinkSync:()=>{}})}});
  f.page.active=true;f.page.lifecycle=1;f.page.data.roomId='server-room';await f.page.refresh();
  assert.equal(writes.length,1);assert.equal(writes[0][1],'server-provided-png');assert.equal(writes[0][2],'base64');
  assert.equal(f.page.data.image,writes[0][0]);assert.match(f.page.data.image,/^\/local-generated\/capture-\d+-1\.png$/);assert.deepEqual(f.effects,[]);
});

test('15 approved pixel reference PNGs and original HTML/CSS/JS remain SHA-locked',()=>{
  const m=manifest();assert.equal(m.sources.filter(s=>s.path.endsWith('.png')).length,15);
  assert.equal(m.rules.originalsUnchanged,true);assert.equal(m.rules.htmlUnchanged,true);
  const expected={
    'replica.js':'cd3cd6fdf62d34017d8eb85cc01454fc8a8dcc59c9cb0c0ddcd1ada01f9fcc33',
    'replica.css':'25fb69f0ba4dec1edcc28cd6db50ef53555947ac23b7e9714233409285fecc4f',
    'index.html':'cf77bcd05f8800d3b70adc6cca9d6ea7fdb30242f3ade07d595fe84b2ff82a50'
  };
  for(const source of m.sources){const buffer=bytes(source.path);assert.equal(sha(buffer),source.sha256,source.path);assert.equal(buffer.length,source.bytes,source.path);if(source.original)assert.equal(sha(bytes(source.original)),source.sha256,source.original);}
  for(const [file,hash]of Object.entries(expected))assert.equal(sha(bytes(m.sourceDir+'/'+file)),hash,file);
});

test('all 65 runtime PNGs match locked bytes, dimensions and actual PLTE palettes of at most 64',()=>{
  const m=manifest();assert.equal(m.records.length,65);assert.equal(new Set(m.records.map(r=>r.path)).size,65);
  let total=0;
  for(const record of m.records){
    const buffer=bytes(record.path),png=pngInfo(buffer);
    assert.equal(sha(buffer),record.sha256,record.id);assert.equal(buffer.length,record.bytes,record.id);total+=buffer.length;
    assert.equal(png.width,record.width,record.id);assert.equal(png.height,record.height,record.id);assert.equal(png.colourType,3,record.id+' uses indexed PNG');
    assert.ok(png.paletteEntries>0&&png.paletteEntries<=64,record.id+' actual PLTE count '+png.paletteEntries);assert.equal(png.paletteEntries,record.actualColours,record.id);
    assert.equal(sha(bytes(record.source)),record.sourceSha256,record.id+' source');
    assert.ok(Math.abs(record.height-record.width*record.crop[3]/record.crop[2])<=1,record.id+' aspect ratio');
  }
  assert.equal(total,m.budget.pngBytes);assert.ok(total<=m.budget.pngLimitBytes);assert.equal(m.budget.pngWithinBudget,true);
});

test('pixel asset extraction excludes map slices and retains historical v3 lock and uses the separate uncalibrated v4 art',()=>{
  const m=manifest();assert.equal(m.rules.mapsExtracted,false);
  for(const item of m.records)assert.doesNotMatch(item.id,/map|stage|geo/i,item.id);
  const venue=JSON.parse(read('design/maps/xuanwu-lake/runtime-v1/manifest.json'));
  assert.equal(venue.width,1154);assert.equal(venue.height,1363);assert.equal(venue.georeferenced,false);assert.equal(venue.geographicOverlay,false);
  assert.equal(sha(bytes(venue.source)),'c3abcab8c59bdd55d3529d8457fb03c53a8f852f2529f1dd6515f5447f34b4a6');assert.equal(sha(bytes(venue.path)),venue.sha256);
  assert.equal(require('../../utils/presentation').project({}).parkArt,'/assets/maps/xuanwu-lake-v4.jpg');
  assert.match(read('pages/room/room.wxml'),/src="{{venueSource}}" mode="aspectFit"/);assert.equal(require('../../utils/venue-catalog').get().src,'/assets/maps/xuanwu-lake-v4.jpg');
  assert.match(read('components/venue-art/venue-art.wxml'),/mode="aspectFit"/);
});

test('pixel font embeds exactly the retained 107816-byte variable WOFF with its OFL license',()=>{
  const m=manifest(),font=m.files.find(f=>f.path.endsWith('.woff')),license=m.files.find(f=>f.path.endsWith('FONT-LICENSE.txt'));
  assert.ok(font&&license);const buffer=bytes(font.path);assert.equal(buffer.length,107816);assert.equal(m.budget.fontBytes,107816);
  assert.equal(sha(buffer),font.sha256);assert.deepEqual(buffer,bytes(font.source));
  const css=read('utils/pixel-font.wxss'),encoded=css.match(/base64,([A-Za-z0-9+/=]+)/);assert.ok(encoded);assert.deepEqual(Buffer.from(encoded[1],'base64'),buffer);
  assert.match(css,/font-family\s*:\s*['"]?ParkReplicaUI/);assert.match(css,/font-weight\s*:\s*100\s+900/);
  assert.equal(sha(bytes(license.path)),license.sha256);assert.deepEqual(bytes(license.path),bytes(license.source));assert.match(read(license.path),/SIL OPEN FONT LICENSE Version 1\.1/);
  assert.match(read('utils/pixel-theme.wxss'),/@import "\.\/pixel-font\.wxss"/);assert.match(read('utils/pixel-theme.wxss'),/ParkReplicaUI,"PingFang SC"/);
});


test('offline and paused headers cannot imply active pursuit, and large-code action stays blue',()=>{
 const w=read('pages/map/map.wxml'),label=w.match(/<text class="phaseName">({{[\s\S]*?}})<\/text>/)[1];
 for(const [data,expected] of [[{offline:true,uiState:'offline',phaseText:'追逐中'},'重连中'],[{offline:false,uiState:'paused',phaseText:'追逐中'},'本局暂停'],[{offline:false,uiState:'captured',phaseText:'本轮出局'},'已出局'],[{offline:false,uiState:'hiding',phaseText:'躲藏阶段'},'躲藏阶段']])assert.equal(expr(label,data),expected);
 assert.equal(attr(control('qrcode','back'),'tone'),'blue');
 assert.match(read('pages/qrcode/qrcode.wxml'),/class="demoArt"[^>]*src="\/assets\/pixel-v1\/code-demo-art.png"[^>]*mode="widthFix"/);
 for(const asset of ['drawer-cat-avatar','drawer-mouse-avatar','drawer-title-icon','drawer-event-icon','drawer-rules-icon'])assert.ok(w.includes('/assets/pixel-v1/'+asset+'.png'));
 assert.doesNotMatch(w,/ready-avatar-/);
});


test('native component hosts expose class selectors so visual checks never silently inspect zero controls',()=>{
 for(const name of ['index','room','map','qrcode','dev','venue']){const w=read('pages/'+name+'/'+name+'.wxml');for(const tag of tags(w,'pixel-action'))assert.equal(attr(tag,'class'),'pixelControl');for(const tag of tags(w,'venue-art'))assert.equal(attr(tag,'class'),'venueArt');}
 const script=read('scripts/pixel-ui-review.cjs');assert.match(script,/selectAllComponents\('\.pixelControl'\)/);assert.match(script,/selectComponent\('\.venueArt'\)/);
});


test('approved button dimensions are available before image load and layout changes notify parent',()=>{
 const dims=require('../../utils/pixel-button-dimensions');assert.equal(Object.keys(dims).length,32);for(const record of manifest().records.filter(r=>r.kind==='button' && dims['/'+r.path])){assert.deepEqual(dims['/'+record.path],[record.width,record.height]);const f=actionFixture({skin:'/'+record.path});f.definition.observers.skin.call(f.instance);assert.equal(f.instance.data.artWidth,record.width);assert.equal(f.instance.data.artHeight,record.height);assert.equal(f.events[0][0],'layout');assert.deepEqual(plain(f.events[0][2]),{bubbles:true,composed:true});}
 const m=pageFixture('map');let calls=0;m.page.selectComponent=selector=>{assert.equal(selector,'.venueArt');return {remeasure:()=>calls++};};m.page.active=true;m.page.remeasureVenue();assert.equal(calls,1);m.page.active=false;m.page.remeasureVenue();assert.equal(calls,1);assert.match(read('pages/map/map.wxml'),/bindlayout="remeasureVenue"/);
});
