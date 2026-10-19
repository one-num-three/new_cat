const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const osm=require('../../utils/osm-art-registration'),{wgs84togcj02}=require('../../utils/vendor/coordtransform');
const model=require('../../design/maps/seu-jiulonghu-registration-v3/jiulonghu-registration.json'),id='seu-jiulonghu-v1';

test('runtime maps entire saved campus boundary and 10m interior grid, including former hull holes',()=>{
 const result=require('../../scripts/verify-jiulonghu-coverage.cjs').verify();
 assert.equal(result.boundaryVertices,86);assert.ok(result.boundarySamples>1300);assert.ok(result.interiorSamples>24000);assert.equal(result.uncovered,0);assert.equal(result.oldAnchorsPreserved,23);
 assert.equal(result.version,'jiulonghu-reference-3');assert.equal(result.fieldVerified,false);assert.equal(result.extrapolation,false);
});

test('new road controls are exact while outside hull, foreign maps, CRS and unauthorized room models remain rejected',()=>{
 assert.equal(model.anchors.length,31);assert.equal(model.triangles.length,53);assert.deepEqual(model.quality.folds,[]);assert.equal(model.quality.campusCoverage.crossingImageEdges,0);
 for(const a of model.anchors.slice(23)){const [lng,lat]=wgs84togcj02(...a.wgs84),p={lng,lat},q=osm.project(p,'gcj02',id);assert.ok(Math.hypot(q.u*1254-a.pixel[0],q.v*1254-a.pixel[1])<.001);assert.equal(osm.project(p,'wgs84',id),null);assert.equal(osm.project(p,'gcj02','seu-sipailou-v1'),null);assert.equal(osm.overlay({points:[p]},{},600,600,id).points.length,0);}
 for(const ll of [[118.81,31.9],[118.8,31.89],[118.84,31.89],[118.82,31.87]]){const [lng,lat]=wgs84togcj02(...ll);assert.equal(osm.project({lng,lat},'gcj02',id),null);}
 const [lng,lat]=wgs84togcj02(...model.anchors[23].wgs84);assert.equal(osm.region({lng,lat,radiusM:500},600,600,id),null,'Large intelligence area cannot be truncated at a new boundary');
});

test('all new boundary simulations are explicit computer-only fixtures, never enabled on phone or release',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../utils/location-scenarios.js'),'utf8');
 function load(platform,env){const module={exports:{}};vm.runInNewContext(source,{module,wx:{getDeviceInfo:()=>({platform}),getAccountInfoSync:()=>({miniProgram:{envVersion:env}})}});return module.exports;}
 for(const suffix of ['northwest','northeast','southeast','southwest','west']){
  const scenario='jiulonghu-'+suffix,p=load('devtools','develop').get(scenario,id);assert.equal(p.simulated,true);assert.ok(osm.project(p,'gcj02',id));
  for(const [platform,env]of [['ios','develop'],['android','develop'],['devtools','trial'],['devtools','release']])assert.equal(load(platform,env).get(scenario,id),null);
 }
});
