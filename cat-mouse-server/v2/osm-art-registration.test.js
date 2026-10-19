'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),osm=require('../../utils/osm-art-registration');
const model=require('../../utils/osm-art-model'),source=require('../../design/maps/xuanwu-lake/georegistration-v5/MODIFIED_FILE.json');
const original=require('../../design/maps/xuanwu-lake/georegistration-v5/mapping'),forward=require('../../utils/vendor/coordtransform').wgs84togcj02;
const gcj=([lng,lat])=>{const p=forward(lng,lat);return {lng:p[0],lat:p[1]};};
test('OSM client release is reproducible and uses exact source artwork with no field claim',()=>{
 assert.equal(cp.spawnSync(process.execPath,['scripts/sync-osm-art.cjs','--verify'],{cwd:root}).status,0);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,model.image.runtimePath))).digest('hex'),model.image.sha256);
 assert.equal(model.fieldVerified,false);assert.equal(model.source.crs,'EPSG:4326');assert.equal(model.extrapolation,false);
});
test('explicit GCJ input guard and approximate inverse pass known reference and 41 anchor pairs',()=>{
 const beijing=forward(116.404,39.915);assert.ok(Math.abs(beijing[0]-116.41024449916938)<1e-12);assert.ok(Math.abs(beijing[1]-39.91640428150164)<1e-12);
 for(const a of source.anchors){const p=gcj(a.wgs84),back=osm.gcjToWgs(p,'gcj02'),q=osm.project(p,'gcj02');assert.ok(Math.hypot(back.lng-a.wgs84[0],back.lat-a.wgs84[1])<1e-8);assert.ok(q);assert.ok(Math.hypot(q.u*1254-a.pixel[0],q.v*1254-a.pixel[1])<1e-4);assert.equal(q.fieldVerified,false);}
 for(const p of [null,{}, {lat:NaN,lng:118},{lat:90,lng:118},{lat:'32',lng:118}])assert.equal(osm.project(p,'gcj02'),null);
 assert.equal(osm.project(gcj(source.anchors[0].wgs84),'WGS84'),null);assert.equal(osm.project(gcj(source.anchors[0].wgs84)),null);assert.equal(osm.project({lat:0,lng:0},'gcj02'),null);
});
test('all 72 triangle interiors preserve handed-off geometry after the CRS bridge',()=>{
 for(const t of source.triangles){const px=[0,1].map(k=>t.reduce((s,i)=>s+source.pixels[i][k]/3,0)),wgs=original.pixelToGeo(px,source),p=osm.project(gcj([wgs.lng,wgs.lat]),'gcj02');assert.ok(p);assert.ok(Math.hypot(p.u*1254-px[0],p.v*1254-px[1])<1e-4);}
});
test('coarse region stays a region and conservatively contains mapped circle across triangle edges',()=>{
 const ll=[118.787,32.074],wgs=original.pixelToGeo([627,627],source),center=gcj([wgs.lng,wgs.lat]),r=50,e=osm.region({...center,radiusM:r},600,600);assert.ok(e&&e.rx>0&&e.ry>0);
 for(let i=0;i<180;i++){const a=i*Math.PI/90,p={lng:wgs.lng+Math.cos(a)*r/(6378137*Math.cos(wgs.lat*Math.PI/180))*180/Math.PI,lat:wgs.lat+Math.sin(a)*r/6378137*180/Math.PI},q=osm.project(gcj([p.lng,p.lat]),'gcj02');assert.ok(q);assert.ok(((q.u*600-e.x)/e.rx)**2+((q.v*600-e.y)/e.ry)**2<=1+1e-7);}
 const frame=osm.frame({regions:[{...center,radiusM:r}],points:[]},600,600);assert.equal(frame.points.length,0);assert.equal(frame.regions.length,1);
 assert.equal(osm.region({...center,radiusM:500},600,600),null);assert.equal(osm.frame({regions:[{...center,radiusM:500}]},600,600).omittedRegions,1);
});
test('room affine model overrides OSM; invalid supplied model fails closed',()=>{
 const g=require('../../utils/geo-registration'),m=g.compile(require('./geo-fixture.cjs').fixture()),p=g.pixelToGeo({u:.5,v:.5},m),data={points:[{...p,tone:'self'}]};
 assert.equal(osm.frame(data,600,600).points.length,0);assert.ok(Math.abs(osm.overlay(data,m,600,600).points[0].x-300)<1e-7);
 const osmPoint=gcj(source.anchors[0].wgs84);assert.equal(osm.overlay({points:[osmPoint]}, {},600,600).points.length,0);
});
test('reference frame ignores roster coordinates and clears authorized overlays on empty snapshot',()=>{
 const p=gcj(source.anchors[0].wgs84),data={points:[{...p,label:'本人',tone:'self'}],roster:[{...p,label:'hidden enemy',role:'cat'}],regions:[]};
 const a=osm.frame(data,400,400),b=osm.frame({...data,roster:[]},400,400);assert.deepEqual(a,b);assert.equal(a.points.length,1);assert.equal(osm.frame({},400,400).points.length,0);
});
