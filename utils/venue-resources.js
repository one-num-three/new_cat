const catalog=require('./venue-catalog');
const pending=new Map();
const loaded=new Set();
const queue=[];
let active=null;
function next(){
 if(active)return;
 const record=queue.shift();if(!record)return;
 if(loaded.has(record.name)||pending.get(record.name)!==record){next();return;}
 active=record;
 const fail=()=>{if(pending.get(record.name)!==record)return;pending.delete(record.name);if(active===record)active=null;record.reject(Error('场地地图加载失败，请重试或切换实时地图'));next();};
 try{wx.navigateTo({url:'/'+record.name+'/pages/open/open?resource=1&mapId='+encodeURIComponent(record.id),fail});}catch{fail();}
}
function ready(id){const image=catalog.get(id);return !!image&&(!image.subpackage||loaded.has(image.subpackage));}
function ensure(id){
 const image=catalog.get(id);if(!image)return Promise.reject(Error('未知场地地图'));
 if(ready(id))return Promise.resolve();
 if(pending.has(image.subpackage))return pending.get(image.subpackage).promise;
 let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;}),record={promise,resolve,reject,name:image.subpackage,id};pending.set(image.subpackage,record);
 // Mini-program packages load through navigation. The mini-game-only loading
 // API is absent in the actual mini-program runtime. A shared bootstrap page
 // confirms its package is available, then returns to the original page.
 queue.push(record);next();
 return promise;
}
function markLoaded(name){if(!catalog.options.some(x=>catalog.get(x.id).subpackage===name))return;loaded.add(name);const record=pending.get(name);if(record){pending.delete(name);record.resolve();}if(active?.name===name)active=null;next();}
module.exports={ensure,ready,markLoaded};
