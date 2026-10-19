const {test}=require('node:test'),assert=require('node:assert/strict');
const {preset,targetFor}=require('./rules');
const {validate}=require('../../utils/team-config');
test('custom pilot-0.3 accepts arbitrary positive team split, keeps legacy defaults',()=>{
 for(let total=2;total<=60;total++)for(let cats=1;cats<total;cats++){
  const mice=total-cats,r=preset(total,false,{cats,mice});assert.equal(r.version,'pilot-0.3');
  assert.equal(r.cats+r.mice,r.total);assert.equal(r.cats,cats);assert.equal(targetFor(mice),Math.ceil(mice*.6));assert.equal(validate(total,cats,mice),'');
 }
 assert.equal(preset(8).version,'pilot-0.2');assert.equal(preset(8).cats,2);
});
test('client and authority reject invalid, missing and noninteger team configurations',()=>{
 for(const [total,cats,mice] of [[8,3,6],[8,0,8],[8,8,0],[1,1,0],[61,1,60],[8,1.5,6.5],[8,'2',6],[8,2,undefined],[NaN,2,6],[8,Infinity,6],[8,-1,9]]){
  assert.throws(()=>preset(total,false,{cats,mice}));assert.ok(validate(total,cats,mice));
 }
});
test('room UI blocks invalid sums and submits all three chosen counts unchanged',async()=>{
 const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');let page;const calls=[];
 const api={config:{},create:async p=>{calls.push(p);return {roomId:'new-room',code:'ABCDEF1234'};}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../pages/room/room.js'),'utf8'),{Page:p=>page=p,Number,Math,Error,wx:{getStorageSync:()=> '房主',setStorageSync(){},pageScrollTo(){},setNavigationBarTitle(){}},require:p=>p.includes('venue-catalog')?require('../../utils/venue-catalog'):p.includes('venue-resources')?require('../../utils/venue-resources'):p.includes('team-config')?{validate}:p.includes('presentation')?{}:p.includes('dev-preview')?{}:api});
 page.setData=p=>Object.assign(page.data,p);page.begin=()=>{};page.data.venue={lat:32,lng:118,radiusM:200,confirmed:true};
 const input=(field,value)=>page.teamInput({currentTarget:{dataset:{field}},detail:{value}});
 input('total','10');await page.create();assert.equal(calls.length,0);assert.ok(page.data.teamError);
 input('catsCount','3');input('miceCount','7');assert.equal(page.data.teamError,'');assert.equal(page.data.targetCount,5);
 await page.create();assert.equal(calls.length,1);assert.equal(calls[0].total,10);assert.equal(calls[0].cats,3);assert.equal(calls[0].mice,7);
 input('catsCount','');assert.ok(page.data.teamError);await page.create();assert.equal(calls.length,1);
});
test('HTTP custom teams persist, assign exact roles and quota; unknown authority fields rejected',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {createServer}=require('./server');
 const env={NODE_ENV:'test',ENABLE_LOCAL_TEST_IDENTITIES:'true',DATA_DIR:fs.mkdtempSync(path.join(os.tmpdir(),'catmouse-custom-'))};
 let ctx,now=Date.now();
 const boot=async()=>{ctx=await createServer({env,now:()=>now});ctx.server.listen(0,'127.0.0.1');await new Promise(r=>ctx.server.once('listening',r));};
 const req=async(method,url,body,token)=>{const res=await fetch('http://127.0.0.1:'+ctx.server.address().port+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,data:await res.json()};};
 const close=async()=>ctx.close();
 try{
  await boot();const players=[];for(let i=0;i<3;i++)players.push((await req('POST','/api/v2/session/test',{})).data);
  const venue={lat:32,lng:118,radiusM:200,confirmed:true};
  assert.equal((await req('POST','/api/v2/rooms',{total:3,cats:1,mice:1,venue},players[0].token)).data.error,'INVALID_TEAMS');
  assert.equal((await req('POST','/api/v2/rooms',{total:3,cats:1,mice:2,winner:'cat_win',venue},players[0].token)).data.error,'INVALID_CONFIG');
  const room=(await req('POST','/api/v2/rooms',{total:3,cats:1,mice:2,venue,nickname:'房主'},players[0].token)).data,id=room.roomId;
  for(const p of players.slice(1))assert.equal((await req('POST',`/api/v2/rooms/${id}/join`,{nickname:'伙伴'},p.token)).status,200);
  for(const p of players){await req('POST',`/api/v2/rooms/${id}/location`,{lat:32,lng:118,accuracy:5,sampledAt:now,sampleSeq:1,coordinateSystem:'gcj02'},p.token);await req('POST',`/api/v2/rooms/${id}/ready`,{ready:true},p.token);}
  assert.equal((await req('POST',`/api/v2/rooms/${id}/start`,{},players[1].token)).status,403);
  const start=(await req('POST',`/api/v2/rooms/${id}/start`,{},players[0].token)).data;
  assert.equal(start.rules.version,'pilot-0.3');assert.equal(start.match.target,2);assert.equal(start.roster.filter(p=>p.role==='cat').length,1);assert.equal(start.roster.filter(p=>p.role==='mouse').length,2);
  await req('POST',`/api/v2/rooms/${id}/cancel`,{},players[0].token);await close();ctx=null;await boot();
  const restored=(await req('GET',`/api/v2/rooms/${id}`,undefined,players[0].token)).data;
  assert.equal(restored.rules.cats,1);assert.equal(restored.rules.mice,2);assert.equal(restored.match.phase,'CANCELLED');assert.equal(restored.match.id,start.match.id);
 }finally{if(ctx)await close();fs.rmSync(env.DATA_DIR,{recursive:true,force:true});}
});
