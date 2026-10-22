const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const geo=require('../../utils/geo-registration'),{fixture}=require('./geo-fixture.cjs');
function page(owner=true){let p;const memory=new Map(),effects=[];const room={owner,version:7,venue:{lat:32.073,lng:118.789},mapCalibration:null};
 const wx={getStorageSync:k=>memory.get(k),setStorageSync:(k,v)=>memory.set(k,v),removeStorageSync:k=>memory.delete(k),nextTick:fn=>fn()};
 const api={session:async()=>{},room:async()=>room,calibration:async()=>{effects.push('save');return {version:8,mapCalibration:{id:'confirmed-profile'}};}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../../pages/calibrate/calibrate.js'),'utf8'),{Page:x=>p=x,Math,Number,JSON,Error,wx,require:name=>name.includes('room-live')?require('../../utils/room-live'):name.includes('snapshot-v2')?require('../../utils/snapshot-v2'):name.includes('venue-boundary')?require('../../utils/venue-boundary'):name.includes('venue-catalog')?require('../../utils/venue-catalog'):name.includes('venue-resources')?require('../../utils/venue-resources'):name.includes('presentation')?{metrics:()=>({})}:name.includes('geo-registration')?geo:name.includes('dev-preview')?{enabled:()=>true}:api});
 p.setData=value=>Object.assign(p.data,value);return {p,memory,effects};
}
test('host calibration draft survives page recreation, confirmed save clears draft',async()=>{
 const a=page();await a.p.onLoad({roomId:'room'});a.p.setData({points:fixture().points});a.p.assess();assert.equal(a.p.data.canSave,true);assert.equal(a.memory.size,1);
 const b=page();for(const [k,v]of a.memory)b.memory.set(k,v);await b.p.onLoad({roomId:'room'});assert.equal(b.p.data.points.length,6);assert.equal(b.p.data.canSave,true);await b.p.save();assert.equal(b.effects.length,1);assert.equal(b.memory.size,0);assert.equal(b.p.data.canSave,false);
});
test('nonowner never saves and developer preview does not touch GPS, server or storage',async()=>{
 const a=page(false);await a.p.onLoad({roomId:'room'});a.p.setData({points:fixture().points});a.p.assess();assert.equal(a.p.data.canSave,false);await a.p.save();assert.equal(a.effects.length,0);assert.equal(a.memory.size,0);
 const b=page();await b.p.onLoad({devPreview:'calibrate'});b.p.setData({points:fixture().points});b.p.assess();await b.p.addGps();await b.p.addMap();await b.p.save();assert.equal(b.effects.length,0);assert.equal(b.memory.size,0);
});
