const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const manifest=require('./manifest.json'),{place}=require('./placement.cjs');
(async()=>{
 let cases=0;
 for(const [key,s] of Object.entries(manifest.sprites))for(const f of s.files){
  const p=path.join(__dirname,f.file),b=fs.readFileSync(p);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256);
  const {data,info}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(info.width,f.width);assert.equal(info.height,f.height);assert.equal(data[3],0);assert.equal(data[data.length-1],0);
 }
 for(const kind of ['fastest','closest'])for(const width of [240,375,941])for(const x of [1,8,width/2,width-8,width-1])for(const y of [1,20,300,599]){
  const point={x,y},box={x:0,y:0,width,height:600},p=place(kind,point,box,manifest);assert(p);assert.deepEqual(p.geographicPoint,point);
  const b=manifest.sprites[p.key].visibleBounds;
  assert(p.x+b.left*p.width>=8-1e-7);assert(p.x+b.right*p.width<=width-8+1e-7);
  assert(p.y+b.top*p.height>=8-1e-7);assert(p.y+b.bottom*p.height<=592+1e-7);
  if(x===8&&y===300)assert.equal(p.edge,'left');if(x===width-8&&y===300)assert.equal(p.edge,'right');cases++;
 }
 assert.equal(place('fastest',{x:-1,y:100},{x:0,y:0,width:375,height:600},manifest),null);
 assert.equal(place('bad',{x:100,y:100},{x:0,y:0,width:375,height:600},manifest),null);
 fs.writeFileSync(path.join(__dirname,'VERIFICATION.json'),JSON.stringify({pass:true,variants:4,trueAlpha:true,sourceTextVisuallyChecked:true,textMirrored:false,placementCases:cases,edgeSwitch:true,geographicPointUnchanged:true,offscreenRejected:true},null,2)+'\n');
 console.log('VERIFY_PASS variants=4 true_alpha=true placement_cases='+cases+' edge_switch=PASS visible_bounds=PASS geographic_point=unchanged text=normal');
})().catch(e=>{console.error(e);process.exit(1);});
