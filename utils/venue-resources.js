const catalog=require('./venue-catalog');
const pending=new Map();
const loaded=new Set();
function ready(id){const image=catalog.get(id);return !!image&&(!image.subpackage||loaded.has(image.subpackage));}
function ensure(id){
 const image=catalog.get(id);if(!image)return Promise.reject(Error('未知场地地图'));
 if(ready(id))return Promise.resolve();
 if(pending.has(image.subpackage))return pending.get(image.subpackage).promise;
 let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}),record={promise,resolve,reject};pending.set(image.subpackage,record);
 const fail=()=>{if(pending.get(image.subpackage)===record)pending.delete(image.subpackage);reject(Error('校区地图加载失败，请重试或切换实时地图'));};
 // Mini-program packages load through navigation. The mini-game-only loading
 // API is absent in the actual mini-program runtime. A shared bootstrap page
 // confirms its package is available, then returns to the original page.
 try{wx.navigateTo({url:'/venue-maps/pages/open/open?resource=1',fail});}catch{fail();}
 return promise;
}
function markLoaded(name){if(!catalog.options.some(x=>catalog.get(x.id).subpackage===name))return;loaded.add(name);const record=pending.get(name);if(record){pending.delete(name);record.resolve();}}
module.exports={ensure,ready,markLoaded};
