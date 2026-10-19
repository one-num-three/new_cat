const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const file=process.argv[2]||'maps-config.json', mode=process.argv[3]||'pixel';
const c=JSON.parse(fs.readFileSync(path.resolve(__dirname,file),'utf8'));
assert.equal(c.art_mode,mode);assert.equal(c.coordinate_system,'WGS84');assert.equal(c.scenes.length,2);
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'baseline-config.json'),'utf8'));
assert.deepStrictEqual(c.scenes,baseline.scenes);
const reg=JSON.parse(fs.readFileSync(path.join(__dirname,'registration.json'),'utf8'));
assert(reg.small_control_rmse_source_px<1);assert(reg.large_water_mask_iou>.99);
const h=crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../source-v1/osm-source.osm'))).digest('hex');
assert.equal(h,'2ba67de27a5880686c6e6d52a7e61808f7c9ce3ff7f7335916ec67ee47ce524a');
const R=6378137, proj=([x,y])=>[R*x*Math.PI/180,R*Math.log(Math.tan(Math.PI/4+y*Math.PI/360))];
const inv=([x,y])=>[x/R*180/Math.PI,(2*Math.atan(Math.exp(y/R))-Math.PI/2)*180/Math.PI];
let max=0;
for(const s of c.scenes)for(const zoom of [0.5,1,3,8])for(const angle of [0,.37,Math.PI/2]){
 const [x0,y0,x1,y1]=s.world_bounds,center=[(x0+x1)/2,(y0+y1)/2],scale=zoom*s.output_size[0]/(x1-x0),cs=Math.cos(angle),sn=Math.sin(angle);
 for(const p of [[s.bounds_wgs84[0],s.bounds_wgs84[1]],[s.bounds_wgs84[2],s.bounds_wgs84[3]]]){
  const w=proj(p),x=(w[0]-center[0])*scale,y=-(w[1]-center[1])*scale;
  const sx=cs*x-sn*y+37,sy=sn*x+cs*y-19,rx=sx-37,ry=sy+19;
  const q=inv([center[0]+(cs*rx+sn*ry)/scale,center[1]-(-sn*rx+cs*ry)/scale]);
  max=Math.max(max,Math.abs(q[0]-p[0]),Math.abs(q[1]-p[1]));
 }
}
assert(max<1e-9);
console.log('PASS mode='+mode+' maps=2 geometry=unchanged registration=PASS transform_roundtrip=PASS source_hash=unchanged');
