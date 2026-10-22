'use strict';
const {distance}=require('./rules');
const RANGE_M=120;
// 只从当前有效、存活且未退出的鼠推导共享视野，绝不先广播全员坐标。
function mouseSight(service,room,viewer,participants){
 const revision=room.state.venueRevision||0,mine=service.fresh(viewer.id,room.id,revision);
 const observers=room.state.match.settings?.mouseTeamVision
  ?participants.filter(p=>p.role==='mouse'&&p.status==='active').map(p=>service.fresh(p.id,room.id,revision)).filter(Boolean)
  :mine?[mine]:[];
 const cats=[];let nearby=false;
 for(const cat of participants.filter(p=>p.role==='cat'&&p.status==='active')){
  const position=service.fresh(cat.id,room.id,revision);if(!position)continue;
  if(mine&&distance(mine,position)<=RANGE_M)nearby=true;
  if(room.state.match.settings?.mouseTeamVision&&observers.some(p=>distance(p,position)<=RANGE_M))cats.push({id:cat.id,relation:'enemy',role:'cat',visibility:'team',lat:position.lat,lng:position.lng,accuracy:position.accuracy,receivedAt:position.receivedAt});
 }
 return {cats,nearby};
}
module.exports={mouseSight,RANGE_M};
