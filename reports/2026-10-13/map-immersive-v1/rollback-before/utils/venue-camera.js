// Display geometry only. The illustration has no geographic registration.
const SOURCE_WIDTH = 1154;
const SOURCE_HEIGHT = 1363;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

function positiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clampScale(value) {
  return Number.isFinite(value) ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, value)) : MIN_SCALE;
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
function boundCamera(vw,vh,bw,bh,c={}) {
  if(![vw,vh,bw,bh].every(positiveFinite))return {x:0,y:0,scale:1};
  const scale=clampScale(c.scale),w=bw*scale,h=bh*scale;
  if(![w,h].every(positiveFinite))return {x:0,y:0,scale:1};
  return {x:Math.max(Math.min(0,vw-w),Math.min(0,Number.isFinite(c.x)?c.x:(vw-w)/2)),y:Math.max(Math.min(0,vh-h),Math.min(0,Number.isFinite(c.y)?c.y:(vh-h)/2)),scale};
}
function zoomAt(c,nextScale,px,py,vw,vh,bw,bh) {
  const scale=clampScale(nextScale),old=clampScale(c.scale);
  return boundCamera(vw,vh,bw,bh,{x:px-(px-c.x)*scale/old,y:py-(py-c.y)*scale/old,scale});
}
function perimeter(vw,vh,bw,bh,scale=1.28) {
  const c=boundCamera(vw,vh,bw,bh,{scale,x:0,y:0}),right=vw-bw*c.scale,bottom=vh-bh*c.scale;
  return [{x:0,y:0,scale:c.scale},{x:Math.min(0,right),y:0,scale:c.scale},{x:Math.min(0,right),y:Math.min(0,bottom),scale:c.scale},{x:0,y:Math.min(0,bottom),scale:c.scale}];
}
function interpolate(a,b,t) {
  const p=Number.isFinite(t)?Math.min(1,Math.max(0,t)):0;
  return {x:a.x+(b.x-a.x)*p,y:a.y+(b.y-a.y)*p,scale:a.scale+(b.scale-a.scale)*p};
}
module.exports = {SOURCE_WIDTH, SOURCE_HEIGHT, MIN_SCALE, MAX_SCALE, clampScale, fitContain,fitCover,boundCamera,zoomAt,perimeter,interpolate};
