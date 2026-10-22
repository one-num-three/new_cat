'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),design=path.resolve(__dirname,'..'),templateDir=path.join(design,'trajectory-share-irregular-v4'),bubbleDir=path.join(design,'track-bubbles-v1'),flagDir=path.join(design,'track-highlights-v1');
const layout=require(path.join(templateDir,'layout.json')),bubbles=require(path.join(bubbleDir,'manifest.json')),flags=require(path.join(flagDir,'manifest.json')),{place}=require(path.join(bubbleDir,'placement.cjs'));
const W=941,H=1672,rect=layout.mapRect;
const cases=[
 {key:'xuanwu',title:'玄武湖 · 环洲／樱洲',distance:'3.2',duration:'42',kcal:'160',fast:[291,693],closest:[951,925],route:[[550,278],[520,329],[490,382],[553,416],[611,455],[589,493],[568,533],[548,578],[523,626],[500,669],[483,703],[506,743],[552,775],[594,804],[636,833],[688,866],[741,891],[782,842],[834,765],[881,795],[919,824],[934,864],[953,898],[951,925],[942,938],[901,981],[851,1025],[803,1070],[761,1089],[718,1068],[652,1023],[590,985],[523,940],[454,892],[380,842],[308,795],[248,756],[291,693],[330,635],[362,585],[392,535],[429,480],[461,430]]},
 {key:'jiulonghu',title:'东南大学 · 九龙湖校区',distance:'4.8',duration:'60',kcal:'230',fast:[208,730],closest:[866,1067],route:[[559,1040],[554,980],[550,915],[548,842],[544,786],[600,787],[649,743],[676,697],[694,649],[684,593],[659,548],[616,514],[565,497],[513,498],[470,516],[429,538],[415,552],[402,574],[390,584],[386,607],[374,646],[364,663],[305,670],[226,681],[208,730],[206,792],[210,853],[214,913],[219,966],[225,1035],[245,1110],[350,1102],[451,1093],[554,1086],[663,1079],[771,1072],[866,1067],[886,979],[882,889],[884,791],[884,697],[886,613],[959,614],[1038,610],[1104,609]]},
 {key:'sipailou',title:'东南大学 · 四牌楼校区',distance:'2.4',duration:'32',kcal:'120',fast:[85,548],closest:[961,586],route:[[623,777],[626,746],[627,712],[628,670],[630,624],[635,581],[634,568],[611,552],[584,534],[572,507],[571,472],[571,443],[598,427],[637,427],[664,433],[691,440],[698,498],[700,548],[702,598],[700,650],[704,705],[725,743],[768,778],[817,793],[877,807],[913,818],[920,788],[929,739],[939,689],[950,640],[961,586],[972,533],[985,476],[981,442],[943,421],[916,395],[891,377],[846,365],[807,354],[780,349],[789,398],[792,442],[789,484],[788,537],[786,587],[783,636],[780,692],[774,743],[722,780],[663,773],[620,769],[563,763],[506,753],[452,739],[411,732],[355,719],[306,706],[253,695],[197,681],[133,669],[55,655],[68,615],[77,577],[85,548],[93,519],[103,477],[133,444],[177,444],[226,451],[264,461],[304,476],[319,425],[322,373],[324,320],[389,276],[450,278],[526,284],[598,286],[665,290]]}
];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const screen=p=>({x:rect.x+p[0]/1254*rect.width,y:rect.y+p[1]/1254*rect.height});
const svg=body=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${body}</svg>`);
const bubbleBox=p=>{const b=bubbles.sprites[p.key].visibleBounds;return {left:p.x+b.left*p.width,top:p.y+b.top*p.height,width:(b.right-b.left)*p.width,height:(b.bottom-b.top)*p.height};};
const overlap=(a,b)=>Math.max(0,Math.min(a.left+a.width,b.left+b.width)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.top+a.height,b.top+b.height)-Math.max(a.top,b.top));
function avoidFlags(p,q,flagPlacements){
 const score=c=>flagPlacements.reduce((s,f)=>s+overlap(bubbleBox(c),f),0);
 if(score(p)===0)return p;
 const edge=p.edge==='left'?'right':'left',key=p.key.replace(/(left|right)$/,edge),s=bubbles.sprites[key],f=s.files.find(f=>f.width===320),b=s.visibleBounds,width=p.width,height=width*f.height/f.width;
 let x=q.x-s.anchor.u*width,y=q.y-s.anchor.v*height;
 x=Math.max(18-b.left*width,Math.min(923-b.right*width,x));y=Math.max(478-b.top*height,Math.min(1192-b.bottom*height,y));
 const tip={x:x+s.anchor.u*width,y:y+s.anchor.v*height};
 const alternative={...p,key,edge,file:f.file,x,y,width,height,tip,leader:Math.hypot(tip.x-q.x,tip.y-q.y)>.5?{from:{...q},to:tip}:null,avoidance:'switched direction to avoid start/finish flags'};
 return score(alternative)<score(p)?alternative:p;
}
function dense(points){const result=[];let distance=0;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/7);for(let j=0;j<n;j++){const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n];if(result.length)distance+=Math.hypot(p[0]-result.at(-1).x,p[1]-result.at(-1).y);result.push({x:p[0],y:p[1],elapsedMs:result.length*5000});}}result.push({x:points.at(-1)[0],y:points.at(-1)[1],elapsedMs:result.length*5000});return result;}
(async()=>{
 const records=[];
 for(const scene of cases){
  const item=layout.items.find(x=>x.key===scene.key),sourcePath=path.join(root,item.source.slice(1)),source=fs.readFileSync(sourcePath);if(hash(source)!==item.sourceSha256)throw Error('Source image hash changed');
  const points=dense(scene.route),sp=scene.route.map(screen),d=sp.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
  points.forEach((p,i)=>p.elapsedMs=Math.round(i/(points.length-1)*Number(scene.duration)*60000));
  const line=svg(`<path d="${d}" fill="none" stroke="#fffbea" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#ff871c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`);
  const map=await sharp(source).resize(rect.width,rect.height,{kernel:'nearest'}).toBuffer();
  const base=await sharp({create:{width:W,height:H,channels:4,background:'#fcf6d2'}}).composite([{input:map,left:rect.x,top:rect.y},{input:line},{input:path.join(templateDir,item.overlay)}]).png().toBuffer();
  const overlays=[],flagOverlays=[],placements=[];
  for(const [name,p] of [['start',scene.route[0]],['finish',scene.route.at(-1)]]){
   const anchor=flags.sprites[name].anchor,q=screen(p),size=132,left=Math.round(q.x-anchor.u*size),top=Math.round(q.y-anchor.v*size);
   flagOverlays.push({input:await sharp(path.join(flagDir,name+'-flag-192.png')).resize(size,size,{kernel:'nearest'}).toBuffer(),left,top});placements.push({kind:name,point:q,left,top,width:size,height:size});
  }
  for(const [kind,point] of [['fastest',scene.fast],['closest',scene.closest]]){
   const q=screen(point),initial=place(kind,q,{x:10,y:470,width:921,height:730},bubbles,380,8);if(!initial)throw Error('Missing placement');
   const p=avoidFlags(initial,q,placements.filter(p=>p.kind==='start'||p.kind==='finish'));
   const color=kind==='fastest'?'#f6bd21':'#ed6279';
   overlays.push({input:svg(`<circle cx="${q.x}" cy="${q.y}" r="11" fill="${color}" stroke="#fffbea" stroke-width="4"/>`)});
   if(p.leader)overlays.push({input:svg(`<path d="M${p.leader.from.x},${p.leader.from.y} L${p.leader.to.x},${p.leader.to.y}" stroke="#fffbea" stroke-width="7"/><path d="M${p.leader.from.x},${p.leader.from.y} L${p.leader.to.x},${p.leader.to.y}" stroke="#174329" stroke-width="3"/>`)});
   const full=bubbles.sprites[p.key].files.find(f=>f.width===640);
   overlays.push({input:await sharp(path.join(bubbleDir,full.file)).resize(Math.round(p.width),Math.round(p.height),{kernel:'nearest'}).toBuffer(),left:Math.round(p.x),top:Math.round(p.y)});placements.push({kind,...p});
  }
  const text=svg(`<g font-family="Microsoft YaHei,sans-serif" text-anchor="middle"><text x="470" y="1263" font-size="23" font-weight="700" fill="#fffbea">模拟数据</text><g font-family="Courier New,Microsoft YaHei,sans-serif" font-size="64" font-weight="700" fill="#f47716"><text x="193" y="1395">${scene.distance}<tspan font-size="28" fill="#213c29"> km</tspan></text><text x="480" y="1395">${scene.duration}<tspan font-size="27" fill="#213c29"> 分钟</tspan></text><text x="766" y="1395"><tspan font-size="28">≈</tspan>${scene.kcal}<tspan font-size="24" fill="#213c29"> 千卡</tspan></text></g><text x="470" y="1485" font-size="17" fill="#658557">模拟轨迹与数据 · 非真实记录 · 热量按60kg示意</text></g>`);
  overlays.push(...flagOverlays,{input:text});
  const out=path.join(__dirname,scene.key+'-share.png');await sharp(base).composite(overlays).png({compressionLevel:9}).toFile(out);await sharp(out).jpeg({quality:88,chromaSubsampling:'4:4:4'}).toFile(path.join(__dirname,scene.key+'-share.jpg'));
  const fixture={schema:'image-space-mock-track-v1',synthetic:true,imageId:item.imageId,coordinateSystem:'original-image-pixels',imageWidth:1254,imageHeight:1254,controlPoints:scene.route,points,stats:{distanceKm:Number(scene.distance),durationMinutes:Number(scene.duration),caloriesKcal:Number(scene.kcal),note:'Illustrative values, not GPS measurements'},highlights:{fastest:scene.fast,closest:scene.closest},placements};
  fs.writeFileSync(path.join(__dirname,scene.key+'-mock.json'),JSON.stringify(fixture,null,2)+'\n');
  records.push({key:scene.key,title:scene.title,controlPoints:scene.route.length,samples:points.length,sourceSha256:item.sourceSha256,pngSha256:hash(fs.readFileSync(out)),placements});
 }
 const thumbs=[];for(let i=0;i<records.length;i++){const r=records[i];thumbs.push({input:await sharp(path.join(__dirname,r.key+'-share.png')).resize({width:376}).toBuffer(),left:16+i*392,top:46});}
 const titleSvg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1192" height="730"><g fill="#24452f" font-family="Microsoft YaHei,sans-serif" font-size="20" font-weight="700" text-anchor="middle">'+records.map((r,i)=>`<text x="${204+i*392}" y="30">${r.title}</text>`).join('')+'</g></svg>');
 await sharp({create:{width:1192,height:730,channels:4,background:'#efe9da'}}).composite([...thumbs,{input:titleSvg}]).png().toFile(path.join(__dirname,'all-three-preview.png'));
 fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify({version:'share-mock-v1-layer-fix',date:'2026-10-21',synthetic:true,width:W,height:H,layerOrder:['map','route','frame','highlightDots','highlightBubbles','startFinishFlags','stats'],records},null,2)+'\n');
 console.log(JSON.stringify({result:'MOCK_RENDER_PASS',maps:records.map(r=>({key:r.key,waypoints:r.controlPoints,samples:r.samples})),preservedOriginalMaps:true,flags:true,highlightBubbles:true,synthetic:true}));
})().catch(e=>{console.error(e);process.exit(1);});
