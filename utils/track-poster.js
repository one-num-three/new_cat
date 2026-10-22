// Irregular v4 artwork is kept byte-for-byte; venue labels and real data are
// composed at export time so three identical 1.5MB frames need not be shipped.
const exporter=require('./track-export'),osm=require('./osm-art-registration'),geo=require('./geo-registration');
const highlights=require('./track-highlights');
const bubbleAssets=require('./track-bubble-assets');
const anchors=highlights.anchors;
const WIDTH=941,HEIGHT=1672,RECT={x:0,y:328,width:941,height:941};
const labels={'xuanwu-v4':'玄武湖·环洲樱洲','seu-jiulonghu-v1':'东大九龙湖校区','seu-sipailou-v1':'东大四牌楼校区'};
const distance=(a,b)=>{const r=Math.PI/180,x=(b.lng-a.lng)*r*Math.cos((a.lat+b.lat)*r/2),y=(b.lat-a.lat)*r;return Math.hypot(x,y)*6371000;};
function prepare(raw,image){
 if(raw?.schema!=='tracks-v1'||raw.scope!=='self'||raw.coordinateSystem!=='gcj02'||raw.players?.length!==1||!labels[image.id])throw Error('海报仅支持已授权的本人轨迹');
 const project=p=>raw.mapCalibration?geo.project(p,raw.mapCalibration,image.id):osm.project(p,'gcj02',image.id);
 const runs=[];let meters=0,chaseMs=0,movingMs=0,pairs=0,omitted=0;
 for(const part of exporter.segments(raw.players[0].points)){let run=[],last=null,anchor=null;
  const split=()=>{if(run.length)runs.push(run);run=[];};
  for(const p of part){const q=project(p);if(!q||![q.u,q.v].every(Number.isFinite)||q.u<0||q.u>1||q.v<0||q.v>1){split();last=null;anchor=null;omitted++;continue;}
   const current={x:RECT.x+q.u*RECT.width,y:RECT.y+q.v*RECT.height};
   if(last){const dt=p.sampledAt-last.sampledAt,d=distance(last,p);
    if(d/(dt/1000)>12||Math.max(last.accuracy||0,p.accuracy||0)>50){split();last=null;anchor=null;continue;}
    else{pairs++;if(p.phase==='CHASING')chaseMs+=dt;const noise=Math.max(3,Math.min(25,Math.max(anchor?.accuracy||0,p.accuracy||0))),net=distance(anchor||last,p);if(net>noise){meters+=net;movingMs+=Math.min(p.sampledAt-(anchor||last).sampledAt,net/.8*1000);anchor=p;}}
   }
   run.push({...p,...current});last=p;anchor=anchor||p;
  }split();
 }
 const all=runs.flat(),flags=all.length?[{kind:'start',point:all[0]},{kind:'finish',point:all[all.length-1]}]:[],fast=runs.map(run=>highlights.fastest(run)).filter(Boolean).sort((a,b)=>b.speedMps-a.speedMps)[0],bubbles=[];
 if(fast)bubbles.push({kind:'fastest',point:fast.point,lines:['你在这里','跑得最快'],detail:'约'+fast.speedMps.toFixed(1)+'米/秒 · '+Math.round(fast.windowMs/1000)+'秒窗口'});
 const near=raw.players[0].highlights?.schema==='track-highlights-v1'?raw.players[0].highlights.closestCat:null,nearPoint=near&&raw.players[0].role==='mouse'&&all.find(p=>p.sampledAt===near.sampledAt&&p.recordedAt===near.recordedAt&&p.segment===near.segment&&p.phase==='CHASING');
 if(nearPoint&&Number.isFinite(near.distanceM)&&near.distanceM>=0&&near.alignmentMs<=1500)bubbles.push({kind:'nearest',point:nearPoint,lines:['你在这里','离猫最近'],detail:'约'+Math.round(near.distanceM)+'米 · GPS估计'});
 const kcal=60*4*movingMs/3600000;
 const callouts=highlights.callouts(bubbles,flags),omittedHighlights=bubbles.length-callouts.length;
 return {runs,flags,callouts,omitted,omittedHighlights,metrics:{distance:pairs?(meters>=1000?(meters/1000).toFixed(2)+' km':Math.round(meters)+' 米'):'',duration:chaseMs?Math.floor(chaseMs/60000)+'分'+Math.floor(chaseMs%60000/1000)+'秒':'',calories:movingMs?(kcal<1?'<1':'约'+Math.round(kcal))+' 千卡':'',note:(raw.outcome==='cancelled'?'本局取消 · ':'')+'GPS有效片段 · 断点不补线'+(movingMs?' · 热量按60kg/4MET粗估':'')},notice:(omitted?'有'+omitted+'个点不在本局图面配准范围，已省略；原始坐标仍可导出':pairs?'已使用本局本人记录，断点与暂停处未连线':'缺少有效连续定位，轨迹与未知统计保持空白')+'。旗子为记录起终点；亮点按有效GPS估计，数据不足省略'+(omittedHighlights?'；空间不足，已省略'+omittedHighlights+'个亮点':'')};
}
function text(ctx,value,x,y,size,color,maxWidth){if(!value)return;ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold '+size+'px CatMouseFusionUI,sans-serif';const width=ctx.measureText(value).width;if(width>maxWidth)ctx.font='bold '+Math.max(12,Math.floor(size*maxWidth/width))+'px CatMouseFusionUI,sans-serif';ctx.fillText(value,x,y);}
function drawFlags(ctx,data,sprites){
 for(const f of highlights.flagPlacements(data.flags||[])){if(!sprites?.[f.kind])continue;const a=anchors[f.kind];ctx.save();ctx.translate(f.point.x,f.point.y);if(f.angle)ctx.rotate(f.angle);ctx.drawImage(sprites[f.kind],-a.u*f.size,-a.v*f.size,f.size,f.size);ctx.restore();}
}
function decorate(ctx,data,sprites){
 for(const h of data.callouts||[]){
  const p=h.point,q=h.placement;if(!sprites?.bubbles?.[q?.file])continue;
  if(q.leader){ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.tip.x,q.tip.y);ctx.strokeStyle='#fffbed';ctx.lineWidth=8;ctx.stroke();ctx.strokeStyle='#24482d';ctx.lineWidth=3;ctx.stroke();}
  ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fillStyle=h.kind==='fastest'?'#ad6c12':'#a84532';ctx.fill();ctx.strokeStyle='#fffbed';ctx.lineWidth=4;ctx.stroke();
 }
 for(const h of data.callouts||[]){
  const b=h.box,q=h.placement,img=sprites?.bubbles?.[q?.file],color=h.kind==='fastest'?'#ad6c12':'#a84532';if(!img)continue;
  // Already generated in both directions. Never mirror the text-bearing PNG.
  ctx.drawImage(img,q.x,q.y,q.width,q.height);
  ctx.fillStyle='#fff9df';ctx.fillRect(b.x,b.y,b.w,24);text(ctx,h.detail,b.x+b.w/2,b.y+12,17,color,b.w-12);
 }
 drawFlags(ctx,data,sprites);
}
function paint(ctx,map,frame,data,image,sprites){ctx.fillStyle='#fcf6d2';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.imageSmoothingEnabled=false;ctx.drawImage(map,RECT.x,RECT.y,RECT.width,RECT.height);ctx.save();ctx.beginPath();ctx.rect(RECT.x,RECT.y,RECT.width,RECT.height);ctx.clip();ctx.lineCap='round';ctx.lineJoin='round';
 for(const run of data.runs){if(run.length<2)continue;ctx.beginPath();run.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle='#fffbed';ctx.lineWidth=13;ctx.stroke();ctx.strokeStyle='#ff9419';ctx.lineWidth=7;ctx.stroke();}ctx.restore();ctx.drawImage(frame,0,0,WIDTH,HEIGHT);
 ctx.save();ctx.beginPath();ctx.rect(RECT.x,RECT.y,RECT.width,RECT.height);ctx.clip();ctx.lineCap='round';ctx.lineJoin='round';decorate(ctx,data,sprites);ctx.restore();
 text(ctx,labels[image.id],239,378,24,'#123b24',285);text(ctx,'记录起终点',470,1253,23,'#fffbed',155);for(const [key,x]of [['distance',193],['duration',480],['calories',766]])text(ctx,data.metrics[key],x,1373,52,'#f47716',240);
 text(ctx,data.metrics.note,470,1481,17,'#638052',800);text(ctx,'地图数据 © OpenStreetMap contributors',470,1504,13,'#638052',720);
}
const loadImage=(canvas,src)=>new Promise((resolve,reject)=>{const im=canvas.createImage();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('海报图片加载失败，请重试'));im.src=src;});
async function render(canvas,raw,image){const data=prepare(raw,image);canvas.width=WIDTH;canvas.height=HEIGHT;const [map,frame,start,finish,bubbleEntries]=await Promise.all([loadImage(canvas,image.src),loadImage(canvas,'/room-tools/assets/track-share-frame.png'),loadImage(canvas,'/room-tools/assets/start-flag.png'),loadImage(canvas,'/room-tools/assets/finish-flag.png'),Promise.all(data.callouts.map(async h=>{const q=h.placement,expected=bubbleAssets.sprites[q.key].files[0],img=await loadImage(canvas,'/room-tools/assets/'+q.file);if(img.width!==expected.width||img.height!==expected.height)throw Error('气泡素材尺寸不匹配');return [q.file,img];}))]);if(map.width!==image.width||map.height!==image.height||map.width!==map.height||frame.width!==WIDTH||frame.height!==HEIGHT||[start,finish].some(i=>i.width!==192||i.height!==192))throw Error('海报素材尺寸不匹配');paint(canvas.getContext('2d'),map,frame,data,image,{start,finish,bubbles:Object.fromEntries(bubbleEntries)});return data;}
module.exports={prepare,paint,render,decorate,drawFlags,anchors,WIDTH,HEIGHT,RECT};
