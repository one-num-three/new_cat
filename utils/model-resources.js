'use strict';
let loaded=false,pending=null;
function ensure(){if(loaded)return Promise.resolve();if(pending)return pending.promise;let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});const record={promise,resolve,reject};pending=record;
 const fail=()=>{if(pending===record)pending=null;reject(Error('3D资源加载失败，请重试'));};
 try{wx.navigateTo({url:'/campus3d/pages/open/open?resource=1',fail});}catch{fail();}return promise;
}
function markLoaded(){loaded=true;const job=pending;pending=null;if(job)job.resolve();}
module.exports={ensure,markLoaded,ready:()=>loaded};
