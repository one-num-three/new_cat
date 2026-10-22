const {segments}=require('./track-export');
const {place}=require('./track-bubble-placement'),bubbleAssets=require('./track-bubble-assets');
const distance=(a,b)=>{const r=Math.PI/180;return Math.hypot((b.lng-a.lng)*r*Math.cos((a.lat+b.lat)*r/2),(b.lat-a.lat)*r)*6371000;};
const anchors={start:{u:.2926634768740032,v:.8843700159489634},finish:{u:.2926634768740032,v:.8859649122807017}};
function flagPlacements(flags=[]){
 const together=flags.length===2&&Math.hypot(flags[0].point.x-flags[1].point.x,flags[0].point.y-flags[1].point.y)<30;
 return flags.filter(f=>anchors[f.kind]&&Number.isFinite(f.point?.x)&&Number.isFinite(f.point?.y)).map(f=>{const a=anchors[f.kind],size=140,angle=together?(f.kind==='start'?-.36:.36):0,c=Math.cos(angle),s=Math.sin(angle),corners=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>{const x=(u-a.u)*size,y=(v-a.v)*size;return {x:f.point.x+x*c-y*s,y:f.point.y+x*s+y*c};}),xs=corners.map(p=>p.x),ys=corners.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return {...f,size,angle,box:{x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y}};});
}
// Stable net displacement over an 8–12s window, not a single GPS speed spike.
function fastest(points){let best=null;
 for(const part of segments(points)){let run=[];for(const p of part){if(!Number.isFinite(p.accuracy)||p.accuracy<0||p.accuracy>15){run=[];continue;}const last=run[run.length-1];if(last&&(p.sampledAt-last.sampledAt>4000||distance(last,p)/(p.sampledAt-last.sampledAt)*1000>12))run=[];run.push(p);while(run.length&&p.sampledAt-run[0].sampledAt>12000)run.shift();
  for(let i=0;i<run.length-3;i++){const first=run[i],duration=p.sampledAt-first.sampledAt;if(duration<8000)continue;const meters=distance(first,p),noise=2*Math.max(...run.slice(i).map(q=>q.accuracy))+3,speed=meters/duration*1000;if(meters<=noise||speed>12)continue;if(!best||speed>best.speedMps)best={point:p,speedMps:speed,windowMs:duration};}
 }}return best;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const intersects=(a,b)=>a.x<b.x+b.w+12&&a.x+a.w+12>b.x&&a.y<b.y+b.h+12&&a.y+a.h+12>b.y;
function callouts(highlights,flags=[]){
 const placed=[],obstacles=flagPlacements(flags.map((f,i)=>f.point?f:{kind:i?'finish':'start',point:f})).map(f=>f.box);
 for(const h of highlights){
  if(!['fastest','nearest'].includes(h.kind))continue;
  const p=h.point,layout=place(h.kind==='nearest'?'closest':'fastest',p,{x:0,y:328,width:941,height:941},bubbleAssets,420,8);if(!layout)continue;
  const oppositeKey=layout.key.replace(/(left|right)$/,layout.edge==='left'?'right':'left'),oppositeAsset=bubbleAssets.sprites[oppositeKey],oppositeFile=oppositeAsset.files[0],width=layout.width,height=width*oppositeFile.height/oppositeFile.width;
  const opposite={...layout,key:oppositeKey,edge:layout.edge==='left'?'right':'left',preferred:false,file:oppositeFile.file,x:p.x-oppositeAsset.anchor.u*width,y:p.y-oppositeAsset.anchor.v*height,width,height};
  const variants=[layout,opposite].map(v=>{const b=bubbleAssets.sprites[v.key].visibleBounds,w=(b.right-b.left)*v.width,h=(b.bottom-b.top)*v.height+26;return {layout:v,b,w,h};});
  const candidate=(v,x,y)=>({variant:v,box:{x:clamp(x,20,941-v.w-20),y:clamp(y,530,1230-v.h),w:v.w,h:v.h}});
  const blocked=c=>obstacles.some(o=>intersects(c.box,o))||placed.some(o=>intersects(c.box,o.box));
  // Try the other tail direction at the same geographic point BEFORE moving
  // the bubble. This is the Jiulonghu start-flag overlap regression.
  const initial=variants.map(v=>candidate(v,v.layout.x+v.b.left*v.layout.width,v.layout.y+v.b.top*v.layout.height-26));
  let chosen=!blocked(initial[0])?initial[0]:!blocked(initial[1])?initial[1]:null;
  if(!chosen){const candidates=[];for(const v of variants){
    const positions=[[v.layout.x+v.b.left*v.layout.width,v.layout.y+v.b.top*v.layout.height-26],...[[-v.w-30,-v.h-24],[30,-v.h-24],[-v.w-30,24],[30,24],[-v.w/2,-v.h-150],[-v.w/2,120]].map(([dx,dy])=>[p.x+dx,p.y+dy]),[20,530],[941-v.w-20,530],[20,1230-v.h],[941-v.w-20,1230-v.h]];
    for(const o of [...obstacles,...placed.map(o=>o.box)])positions.push([o.x+o.w+13,p.y-v.h],[o.x-v.w-13,p.y-v.h],[p.x-v.w/2,o.y-v.h-13],[p.x-v.w/2,o.y+o.h+13]);
    candidates.push(...positions.map(([x,y])=>candidate(v,x,y)).filter(c=>!blocked(c)));
   }
   const score=c=>(c.box.y+c.box.h>p.y+1?1000:0)+Math.hypot(c.box.x+c.box.w/2-p.x,c.box.y+c.box.h/2-p.y)+(c.variant.layout.edge===layout.edge?0:1);
   candidates.sort((a,b)=>score(a)-score(b));chosen=candidates[0];
  }
  // No collision-free space: omit the highlight, never obscure a flag/text.
  if(!chosen)continue;
  const {box,variant:v}=chosen,x=box.x-v.b.left*v.layout.width,y=box.y+26-v.b.top*v.layout.height,asset=bubbleAssets.sprites[v.layout.key],tip={x:x+asset.anchor.u*v.layout.width,y:y+asset.anchor.v*v.layout.height};
  placed.push({...h,box,placement:{...v.layout,x,y,tip,avoidance:v.layout.edge!==layout.edge?'switched direction to avoid flags/bubbles':null,leader:Math.hypot(tip.x-p.x,tip.y-p.y)>.5?{from:{...p},to:tip}:null}});
 }return placed;
}
module.exports={fastest,callouts,distance,flagPlacements,anchors};
