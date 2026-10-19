'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function initial(width,height){return {x:0,z:0,yaw:0,pitch:.88,size:Math.max(1350,1650*height/width)*1.08};}
function constrain(c){return {...c,x:clamp(c.x,-1200,1200),z:clamp(c.z,-1050,1050),size:clamp(c.size,180,6500),pitch:clamp(c.pitch,.5,Math.PI/2-.001)};}
function multiply(a,b){const out=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)out[j*4+i]+=a[k*4+i]*b[j*4+k];return out;}
function matrix(c,width,height){
 const sy=Math.sin(c.yaw),cy=Math.cos(c.yaw),sp=Math.sin(c.pitch),cp=Math.cos(c.pitch),right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp],back=[sy*cp,sp,cy*cp],eye=[c.x+back[0]*3000,back[1]*3000,c.z+back[2]*3000];
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-dot(right,eye),-dot(up,eye),-dot(back,eye),1]);
 const h=c.size/2,w=h*width/height,n=1,f=6500;
 return multiply(new Float32Array([1/w,0,0,0,0,1/h,0,0,0,0,-2/(f-n),0,0,0,-(f+n)/(f-n),1]),view);
}
function project(p,m,width,height){const a=[p.x,p.y||0,p.z,1],v=[0,0,0,0];for(let i=0;i<4;i++)for(let k=0;k<4;k++)v[i]+=m[k*4+i]*a[k];if(v[3]<=0||v[2]/v[3]<-1||v[2]/v[3]>1)return null;return {x:(v[0]/v[3]+1)*width/2,y:(1-v[1]/v[3])*height/2};}
function move(c,dx,dy,width,height){const unit=c.size/height,cy=Math.cos(c.yaw),sy=Math.sin(c.yaw),sp=Math.sin(c.pitch);return constrain({...c,x:c.x-dx*unit*cy-dy*unit*sy/sp,z:c.z+dx*unit*sy-dy*unit*cy/sp});}
function gesture(touches){const t=touches||[];if(!t.length)return null;const x=p=>Number.isFinite(p.x)?p.x:p.clientX,y=p=>Number.isFinite(p.y)?p.y:p.clientY;if(t.length===1)return {x:x(t[0]),y:y(t[0]),count:1};const a=t[0],b=t[1],dx=x(b)-x(a),dy=y(b)-y(a);return {x:(x(a)+x(b))/2,y:(y(a)+y(b))/2,d:Math.hypot(dx,dy),angle:Math.atan2(dy,dx),count:2};}
function update(c,previous,next,width,height){if(!previous||!next||previous.count!==next.count)return c;let out=move(c,next.x-previous.x,next.y-previous.y,width,height);if(next.count===2&&previous.d>10&&next.d>10){const angle=Math.atan2(Math.sin(next.angle-previous.angle),Math.cos(next.angle-previous.angle));out=constrain({...out,size:out.size*previous.d/next.d,yaw:out.yaw+angle});}return out;}
module.exports={initial,constrain,matrix,project,move,gesture,update};
