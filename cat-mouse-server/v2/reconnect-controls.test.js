const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
test('captured host can resume without uploading a forbidden location and stays captured',async()=>{
 let definition,locations=0,resumed=0,polled=0;
 const api={config:{},resume:async()=>{resumed++;}},loc={once:async()=>{locations++;const e=Error('captured');e.code='CAPTURED';throw e;}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../pages/map/map.js'),'utf8'),{Page:p=>definition=p,require:n=>n.includes('location-v2')?loc:n.endsWith('/v2')?api:require(path.resolve(__dirname,'../../pages/map',n)),wx:{},Date,Math,Number});
 const p={...definition,data:{roomId:'room',canResume:true,match:{myRole:'mouse',myStatus:'captured',phase:'PAUSED'}},setData(x){Object.assign(this.data,x);},poll:async()=>{polled++;}};
 await p.resume();assert.equal(locations,0);assert.equal(resumed,1);assert.equal(polled,1);assert.equal(p.data.match.myStatus,'captured');assert.equal(p.data.error,undefined);
});
test('live channel rejects a stale identity or conflicting own-role snapshot and never exposes session in its URL',()=>{
 let user='a',definition,received=0,dropped=0;const tasks=[],urls=[];
 const wx={getStorageSync:key=>key==='v2UserId'?user:'secret-token',connectSocket:o=>{urls.push(o.url);const h={};const t={onOpen:f=>h.open=f,onMessage:f=>h.message=f,onClose:f=>h.close=f,onError:f=>h.error=f,close(){},h};tasks.push(t);return t;}};
 const p={...require('../../utils/room-live').create({config:{mode:'local',baseUrl:'http://127.0.0.1:4000'}},wx),active:true,data:{roomId:'room'},setData(){},receiveSnapshot(){received++;},socketDropped(){dropped++;this.socket=null;}};
 p.startSocket();const payload={roster:[{id:'a',role:'mouse',status:'captured'},{id:'b',role:'cat',status:'active'}],match:{myRole:'cat',myStatus:'active'}};
 tasks[0].h.message({data:JSON.stringify({type:'SNAPSHOT',payload})});assert.equal(received,0);assert.equal(dropped,1);
 p.startSocket();user='b';tasks[1].h.message({data:JSON.stringify({type:'SNAPSHOT',payload})});assert.equal(received,0);assert.equal(dropped,2);
 p.startSocket();tasks[2].h.message({data:JSON.stringify({type:'SNAPSHOT',payload})});assert.equal(received,1);
 assert.equal(new Set(urls).size,3);assert.ok(urls.every(url=>!url.includes('secret-token')));
});
