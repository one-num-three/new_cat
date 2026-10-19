// Local guide only: no session, upload, persistence or background collection.
function create(onPosition,onError){
 let run=0,active=false,handler=null,timer=null,lastAt=0,startedAt=0,stale=false;
 const current=id=>active&&id===run;
 function stop(){const owned=active||handler||timer;run++;active=false;if(handler)wx.offLocationChange(handler);handler=null;clearInterval(timer);timer=null;if(owned)wx.stopLocationUpdate({fail:()=>{}});}
 function start(){
  if(active)return;active=true;const id=++run;startedAt=Date.now();lastAt=0;stale=false;
  const receive=p=>{
   if(!current(id))return;
   if(!p||!Number.isFinite(p.latitude)||!Number.isFinite(p.longitude)||Math.abs(p.latitude)>85||Math.abs(p.longitude)>180||!Number.isFinite(p.accuracy)||p.accuracy<0){onError(Error('定位数据无效，请重试'));return;}
   lastAt=Date.now();stale=false;onPosition({lat:p.latitude,lng:p.longitude,accuracy:p.accuracy,receivedAt:lastAt,coordinateSystem:'gcj02'});
  };
  const fail=e=>{if(!current(id))return;stop();onError(e);};
  try{
   handler=receive;wx.onLocationChange(handler);wx.startLocationUpdate({type:'gcj02',fail});
   if(!current(id))return;
   timer=setInterval(()=>{if(!current(id)||stale||Date.now()-(lastAt||startedAt)<10000)return;stale=true;onError(Error('定位已超过10秒未更新，请检查GPS或重新开启定位'));},1000);
   wx.getLocation({type:'gcj02',isHighAccuracy:true,success:p=>{if(!lastAt)receive(p);},fail:e=>{if(current(id)&&!lastAt)onError(e);}});
  }catch(e){fail(e);}
 }
 return {start,stop,isActive:()=>active};
}
module.exports={create};
