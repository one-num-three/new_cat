'use strict';
// Independent public-runtime check in lat/lng, rather than trusting builder metrics.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),osm=require('../utils/osm-art-registration');
const {wgs84togcj02}=require('../utils/vendor/coordtransform');
const mapping=require('../design/maps/seu-campuses-v1/mapping');
const model=require('../design/maps/seu-jiulonghu-registration-v3/jiulonghu-registration.json');
const previous=require('../design/maps/seu-jiulonghu-registration-v2/jiulonghu-registration.json');
const id='seu-jiulonghu-v1';
function verify(){
 const data=JSON.parse(fs.readFileSync(path.join(root,'design/maps/seu-campuses-v1/jiulonghu-reference.geojson'),'utf8'));
 const ring=data.features.find(f=>f.id==='way/171389014').geometry.coordinates[0];
 function inside(x,y){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
 let vertices=0,boundary=0,interior=0,previouslyUncovered=0;const mapped=[Infinity,Infinity,-Infinity,-Infinity];
 function sample(ll){
  const [lng,lat]=wgs84togcj02(...ll),p=osm.project({lng,lat},'gcj02',id);
  assert.ok(p,'Unmapped campus location '+JSON.stringify(ll));assert.equal(p.fieldVerified,false);
  assert.ok(p.u>=0&&p.u<=1&&p.v>=0&&p.v<=1,'Outside image '+JSON.stringify(ll));
  const x=p.u*1254,y=p.v*1254;mapped[0]=Math.min(mapped[0],x);mapped[1]=Math.min(mapped[1],y);mapped[2]=Math.max(mapped[2],x);mapped[3]=Math.max(mapped[3],y);
  if(!mapping.geoToPixel(ll,previous))previouslyUncovered++;
 }
 for(let i=0;i<ring.length-1;i++){
  const a=ring[i],b=ring[i+1];sample(a);vertices++;
  const metres=Math.hypot((a[0]-b[0])*111200*Math.cos(a[1]*Math.PI/180),(a[1]-b[1])*111200),n=Math.max(1,Math.ceil(metres/5));
  for(let j=0;j<n;j++){sample([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);boundary++;}
 }
 const xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]),dy=10/111200,dx=dy/Math.cos(31.89*Math.PI/180);
 for(let y=Math.min(...ys);y<=Math.max(...ys);y+=dy)for(let x=Math.min(...xs);x<=Math.max(...xs);x+=dx)if(inside(x,y)){sample([x,y]);interior++;}
 for(const a of previous.anchors){const [lng,lat]=wgs84togcj02(...a.wgs84),p=osm.project({lng,lat},'gcj02',id);assert.ok(Math.hypot(p.u*1254-a.pixel[0],p.v*1254-a.pixel[1])<.001,'Original anchor moved '+a.id);}
 const feedback=osm.project({lat:31.882368,lng:118.828049},'gcj02',id);assert.ok(feedback);
 const report={version:model.registrationVersion,controls:model.anchors.length,triangles:model.triangles.length,
  savedBoundaryId:'way/171389014',boundaryVertices:vertices,boundarySamples:boundary,interiorSamples:interior,
  previouslyUncoveredSamples:previouslyUncovered,uncovered:0,outsideImage:0,mappedBounds:mapped,
  feedbackPixel:[feedback.u*1254,feedback.v*1254],oldAnchorsPreserved:previous.anchors.length,
  fieldVerified:false,extrapolation:false,scope:'Geometric coverage of saved OSM polygon, not measured GPS accuracy, safety or current legal boundary.'};
 assert.ok(previouslyUncovered>0,'Regression must exercise former coverage holes');return report;
}
if(require.main===module){const result=verify();if(process.argv[2])fs.writeFileSync(path.resolve(process.argv[2]),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}
module.exports={verify};
