'use strict';
// Pure export-layer helper: no network, GPS reads or authority decisions.
// project(point) must be the product's validated projection for the selected image.
function layers(points,project,rect){
 const runs=[];let run=[],last=null;
 const split=()=>{if(run.length>1)runs.push(run);run=[];};
 for(const p of points||[]){
  if(!p||![p.lat,p.lng,p.sampledAt,p.recordedAt].every(Number.isFinite)){split();last=null;continue;}
  if(last&&(p.segment!==last.segment||p.phase!==last.phase||p.recordedAt-last.recordedAt>10000||p.recordedAt<last.recordedAt||p.sampledAt<=last.sampledAt))split();
  const q=project(p);
  if(!q||![q.u,q.v].every(Number.isFinite)||q.u<0||q.u>1||q.v<0||q.v>1){split();last=p;continue;}
  run.push({x:rect.x+q.u*rect.width,y:rect.y+q.v*rect.height});last=p;
 }
 split();return runs;
}
function drawRoutes(ctx,runs){
 ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
 for(const run of runs){ctx.beginPath();run.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#fffbed';ctx.lineWidth=13;ctx.stroke();ctx.strokeStyle='#ff9419';ctx.lineWidth=7;ctx.stroke();}
 ctx.restore();
}
function drawMetrics(ctx,slots,values){
 ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=slots.color;ctx.font='bold '+slots.fontSize+'px sans-serif';
 for(const key of ['distance','duration','calories']){const value=values&&values[key];if(value!==null&&value!==undefined&&String(value).length)ctx.fillText(String(value).slice(0,16),slots[key].x,slots[key].y);}
 if(values&&values.note){ctx.font=slots.note.fontSize+'px sans-serif';ctx.fillStyle='#638052';ctx.fillText(String(values.note).slice(0,60),slots.note.x,slots.note.y);}
 ctx.restore();
}
module.exports={layers,drawRoutes,drawMetrics};
