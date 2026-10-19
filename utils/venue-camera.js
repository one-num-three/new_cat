// Display geometry only. The illustration has no geographic registration.
const SOURCE_WIDTH = 1154;
const SOURCE_HEIGHT = 1363;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

function positiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clampScale(value,minScale=MIN_SCALE) {
  const min=positiveFinite(minScale)?Math.min(MIN_SCALE,minScale):MIN_SCALE;
  return Number.isFinite(value) ? Math.max(min, Math.min(MAX_SCALE, value)) : min;
}

// One uniform fit factor preserves the entire source image, never a cover crop.
// x/y are the unscaled movable-view offsets within the measured viewport.
function fitContain(viewportWidth, viewportHeight, sourceWidth = SOURCE_WIDTH, sourceHeight = SOURCE_HEIGHT) {
  const empty = {valid:false, width:0, height:0, x:0, y:0, scale:MIN_SCALE};
  if (![viewportWidth, viewportHeight, sourceWidth, sourceHeight].every(positiveFinite)) return empty;
  const factor = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  const width = sourceWidth * factor;
  const height = sourceHeight * factor;
  if (![factor, width, height].every(positiveFinite)) return empty;
  return {valid:true, width, height, x:Math.max(0, (viewportWidth - width) / 2), y:Math.max(0, (viewportHeight - height) / 2), scale:MIN_SCALE};
}

// Immersive cover: uniform scale, edge crop is intentional; never distort axes.
function fitCover(vw, vh, sw = SOURCE_WIDTH, sh = SOURCE_HEIGHT) {
  const empty={valid:false,width:0,height:0,x:0,y:0,scale:1};
  if(![vw,vh,sw,sh].every(positiveFinite))return empty;
  const f=Math.max(vw/sw,vh/sh),width=sw*f,height=sh*f;
  if(![f,width,height].every(positiveFinite))return empty;
  return {valid:true,width,height,x:(vw-width)/2,y:(vh-height)/2,scale:1};
}
function panPadding(vw,vh){return Math.min(120,Math.max(72,Math.min(vw,vh)*.25));}
function boundCamera(vw,vh,bw,bh,c={},minScale=MIN_SCALE,padding=0) {
  if(![vw,vh,bw,bh].every(positiveFinite))return {x:0,y:0,scale:1};
  const scale=clampScale(c.scale,minScale),w=bw*scale,h=bh*scale;
  if(![w,h].every(positiveFinite))return {x:0,y:0,scale:1};
  const pad=Number.isFinite(padding)?Math.max(0,Math.min(160,padding)):0;
  const axis=(view,size,offset)=>{const center=(view-size)/2,lo=size<=view?center-pad:view-size-pad,hi=size<=view?center+pad:pad;return Math.max(lo,Math.min(hi,Number.isFinite(offset)?offset:center));};
  return {x:axis(vw,w,c.x),y:axis(vh,h,c.y),scale};
}
function rubberCamera(vw,vh,bw,bh,c,minScale=MIN_SCALE,padding=0){
  const bounded=boundCamera(vw,vh,bw,bh,c,minScale,padding);
  const rubber=(raw,edge)=>{const d=Number.isFinite(raw)?raw-edge:0;return edge+80*d/(160+Math.abs(d));};
  return {x:rubber(c.x,bounded.x),y:rubber(c.y,bounded.y),scale:bounded.scale};
}
function unrubberCamera(vw,vh,bw,bh,c,minScale=MIN_SCALE,padding=0){
  const edge=boundCamera(vw,vh,bw,bh,c,minScale,padding),raw=(v,e)=>{const r=v-e;return e+160*r/Math.max(1e-6,80-Math.abs(r));};
  return {x:raw(c.x,edge.x),y:raw(c.y,edge.y),scale:edge.scale};
}
function zoomAt(c,nextScale,px,py,vw,vh,bw,bh,minScale=MIN_SCALE,padding=0) {
  const scale=clampScale(nextScale,minScale),old=clampScale(c.scale,minScale);
  return boundCamera(vw,vh,bw,bh,{x:px-(px-c.x)*scale/old,y:py-(py-c.y)*scale/old,scale},minScale,padding);
}
function perimeter(vw,vh,bw,bh,scale=1.28) {
  const c=boundCamera(vw,vh,bw,bh,{scale,x:0,y:0}),right=vw-bw*c.scale,bottom=vh-bh*c.scale;
  return [{x:0,y:0,scale:c.scale},{x:Math.min(0,right),y:0,scale:c.scale},{x:Math.min(0,right),y:Math.min(0,bottom),scale:c.scale},{x:0,y:Math.min(0,bottom),scale:c.scale}];
}
function interpolate(a,b,t) {
  const p=Number.isFinite(t)?Math.min(1,Math.max(0,t)):0;
  return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,scale:a.scale+(b.scale-a.scale)*p};
}
module.exports = {SOURCE_WIDTH, SOURCE_HEIGHT, MIN_SCALE, MAX_SCALE, clampScale, fitContain,fitCover,boundCamera,rubberCamera,unrubberCamera,panPadding,zoomAt,perimeter,interpolate};
