'use strict';
// Bounds are in the same coordinate system as the projected geographic point.
function place(kind,point,box,manifest,requestedWidth=320,margin=8){
 if(!['fastest','closest'].includes(kind)||!point||!box||![point.x,point.y,box.x,box.y,box.width,box.height,requestedWidth,margin].every(Number.isFinite)||box.width<=2*margin||box.height<=2*margin||requestedWidth<=0||margin<0)return null;
 if(point.x<box.x||point.y<box.y||point.x>box.x+box.width||point.y>box.y+box.height)return null;
 const preferred=point.x<box.x+box.width/2?'left':'right';
 const candidates=['left','right'].map(edge=>{
  const key=kind+'-edge-'+edge,s=manifest.sprites[key],f=s.files.find(f=>f.width===320),b=s.visibleBounds;
  const ratio=f.height/f.width,width=Math.min(requestedWidth,(box.width-2*margin)/(b.right-b.left),(box.height-2*margin)/ratio/(b.bottom-b.top)),height=width*ratio;
  let x=point.x-s.anchor.u*width,y=point.y-s.anchor.v*height;
  const l=x+b.left*width,r=x+b.right*width,t=y+b.top*height,bt=y+b.bottom*height;
  const overflow=Math.max(0,box.x+margin-l)+Math.max(0,r-box.x-box.width+margin)+Math.max(0,box.y+margin-t)+Math.max(0,bt-box.y-box.height+margin);
  const loX=box.x+margin-b.left*width,hiX=box.x+box.width-margin-b.right*width,loY=box.y+margin-b.top*height,hiY=box.y+box.height-margin-b.bottom*height;
  x=Math.max(loX,Math.min(hiX,x));y=Math.max(loY,Math.min(hiY,y));
  const tip={x:x+s.anchor.u*width,y:y+s.anchor.v*height};
  return {key,edge,file:f.file,x,y,width,height,tip,geographicPoint:{...point},leader:Math.hypot(tip.x-point.x,tip.y-point.y)>.5?{from:{...point},to:tip}:null,overflow,preferred:edge===preferred};
 });
 candidates.sort((a,b)=>a.overflow-b.overflow||Number(b.preferred)-Number(a.preferred));return candidates[0];
}
module.exports={place};
