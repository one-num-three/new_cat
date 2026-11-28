'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function initial(width,height){const w=Number.isFinite(width)&&width>0?width:375,h=Number.isFinite(height)&&height>0?height:375;return {x:0,z:0,yaw:0,pitch:.88,size:Math.max(1350,1650*h/w)*1.08};}
function constrain(c){const s=c||{};return {...s,x:clamp(Number.isFinite(s.x)?s.x:0,-1200,1200),z:clamp(Number.isFinite(s.z)?s.z:0,-1050,1050),yaw:Number.isFinite(s.yaw)?s.yaw:0,size:clamp(Number.isFinite(s.size)?s.size:2000,180,6500),pitch:clamp(Number.isFinite(s.pitch)?s.pitch:.88,.5,Math.PI/2-.001)};}
function multiply(a,b){const out=new Float32Array(16);for(let j=0;j<4;j++)for(let i=0;i<4;i++)for(let k=0;k<4;k++)out[j*4+i]+=a[k*4+i]*b[j*4+k];return out;}
function matrix(c,width,height){
 const w0=Number.isFinite(width)&&width>0?width:375,h0=Number.isFinite(height)&&height>0?height:375,cam=constrain(c);
 const sy=Math.sin(cam.yaw),cy=Math.cos(cam.yaw),sp=Math.sin(cam.pitch),cp=Math.cos(cam.pitch),right=[cy,0,-sy],up=[-sy*sp,cp,-cy*sp],back=[sy*cp,sp,cy*cp],eye=[cam.x+back[0]*3000,back[1]*3000,cam.z+back[2]*3000];
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 const view=new Float32Array([right[0],up[0],back[0],0,right[1],up[1],back[1],0,right[2],up[2],back[2],0,-dot(right,eye),-dot(up,eye),-dot(back,eye),1]);
 const h=cam.size/2,w=h*w0/h0,n=1,f=6500;
 return multiply(new Float32Array([1/w,0,0,0,0,1/h,0,0,0,0,-2/(f-n),0,0,0,-(f+n)/(f-n),1]),view);
}
function project(p,m,width,height){const a=[p.x,p.y||0,p.z,1],v=[0,0,0,0];for(let i=0;i<4;i++)for(let k=0;k<4;k++)v[i]+=m[k*4+i]*a[k];if(v[3]<=0||v[2]/v[3]<-1||v[2]/v[3]>1)return null;return {x:(v[0]/v[3]+1)*width/2,y:(1-v[1]/v[3])*height/2};}
function move(c,dx,dy,width,height){const h0=Number.isFinite(height)&&height>0?height:375,cam=constrain(c),unit=cam.size/h0,cy=Math.cos(cam.yaw),sy=Math.sin(cam.yaw),sp=Math.sin(cam.pitch);return constrain({...cam,x:cam.x-dx*unit*cy-dy*unit*sy/sp,z:cam.z+dx*unit*sy-dy*unit*cy/sp});}
function gesture(touches){const t=touches||[];if(!t.length)return null;const pick=(p,ks)=>{for(const k of ks)if(Number.isFinite(p?.[k]))return p[k];return NaN;};const coords=t.slice(0,2).map(p=>({x:pick(p,['x','clientX','pageX']),y:pick(p,['y','clientY','pageY'])})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(!coords.length)return null;if(coords.length===1)return {x:coords[0].x,y:coords[0].y,count:1};const [a,b]=coords,dx=b.x-a.x,dy=b.y-a.y;return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(dx,dy),angle:Math.atan2(dy,dx),count:2};}
function update(c,previous,next,width,height){if(!previous||!next||previous.count!==next.count)return c;let out=move(c,next.x-previous.x,next.y-previous.y,width,height);if(next.count===2&&previous.d>10&&next.d>10){const angle=Math.atan2(Math.sin(next.angle-previous.angle),Math.cos(next.angle-previous.angle));out=constrain({...out,size:out.size*previous.d/next.d,yaw:out.yaw+angle});}return out;}
module.exports={initial,constrain,matrix,project,move,gesture,update};
