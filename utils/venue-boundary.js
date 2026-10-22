// GCJ-02 venue geometry, shared verbatim with the server. Distances in metres.
const R=111320,RAD=Math.PI/180;
const error=code=>{const e=new Error(code);e.code=code;throw e;};
const point=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&Math.abs(p.lat)<85&&Math.abs(p.lng)<=180;
const xy=(p,o)=>[(p.lng-o.lng)*R*Math.cos(o.lat*RAD),(p.lat-o.lat)*R];
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
function edgeDistance(p,a,b){const x=b[0]-a[0],y=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*x+(p[1]-a[1])*y)/(x*x+y*y)||0));return Math.hypot(p[0]-a[0]-t*x,p[1]-a[1]-t*y);}
function intersects(a,b,c,d){const ab=cross(a,b,c),ad=cross(a,b,d),ca=cross(c,d,a),cb=cross(c,d,b);return ab*ad<0&&ca*cb<0||[ [a,c,d],[b,c,d],[c,a,b],[d,a,b] ].some(([p,x,y])=>edgeDistance(p,x,y)<.001);}
function ringDistance(p,ring){const a=ring.map(q=>xy(q,p));let inside=false,min=Infinity;for(let i=0,j=a.length-1;i<a.length;j=i++){const u=a[j],v=a[i];min=Math.min(min,edgeDistance([0,0],u,v));if((u[1]>0)!==(v[1]>0)&&0<(v[0]-u[0])*(-u[1])/(v[1]-u[1])+u[0])inside=!inside;}return inside||min<.001?0:min;}
function area(ring){if(!ring?.length)return 0;const a=ring.map(p=>xy(p,ring[0]));return Math.abs(a.reduce((n,p,i)=>{const q=a[(i+1)%a.length];return n+p[0]*q[1]-q[0]*p[1];},0)/2);}
function normalize(v,image){
 if(!v||v.confirmed!==true||!point(v))error('INVALID_VENUE');
 const within=p=>!image.gcjBounds||(p.lng>=image.gcjBounds[0]&&p.lat>=image.gcjBounds[1]&&p.lng<=image.gcjBounds[2]&&p.lat<=image.gcjBounds[3]);
 if(!within(v))error('VENUE_MAP_MISMATCH');
 const base={lat:v.lat,lng:v.lng,confirmed:true,mapId:image.id};
 if(!Object.prototype.hasOwnProperty.call(v,'boundary')){if(!Number.isInteger(v.radiusM)||v.radiusM<100||v.radiusM>500)error('INVALID_VENUE');return {...base,radiusM:v.radiusM};}
 const ring=v.boundary;if(!Array.isArray(ring)||ring.length<3||ring.length>16||ring.some(p=>!point(p)))error('INVALID_BOUNDARY');
 if(ring.some(p=>!within(p)))error('VENUE_MAP_MISMATCH');
 const a=ring.map(p=>xy(p,v)),n=a.length;
 if(a.some(p=>Math.hypot(...p)>3000))error('BOUNDARY_TOO_LARGE');
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.hypot(a[i][0]-a[j][0],a[i][1]-a[j][1])<5)error('BOUNDARY_POINTS_CLOSE');
 for(let i=0;i<n;i++){const b=a[(i+1)%n],c=a[(i+2)%n];if(Math.abs(cross(a[i],b,c))<.001&&(edgeDistance(a[i],b,c)<.001||edgeDistance(c,a[i],b)<.001))error('BOUNDARY_INTERSECTS');for(let j=i+1;j<n;j++){if(j===i+1||i===0&&j===n-1)continue;if(intersects(a[i],b,a[j],a[(j+1)%n]))error('BOUNDARY_INTERSECTS');}}
 const size=area(ring);if(size<400)error('BOUNDARY_TOO_SMALL');if(size>4000000)error('BOUNDARY_TOO_LARGE');
 if(ringDistance(v,ring)>.001)error('MEETING_OUTSIDE');
 return {...base,boundary:ring.map(p=>({lat:p.lat,lng:p.lng}))};
}
function outsideDistance(v,p){if(!point(p)||!v)return Infinity;if(Object.prototype.hasOwnProperty.call(v,'boundary'))return Array.isArray(v.boundary)&&v.boundary.length>=3&&v.boundary.every(point)?ringDistance(p,v.boundary):Infinity;return point(v)&&Number.isFinite(v.radiusM)?Math.max(0,Math.hypot(...xy(p,v))-v.radiusM):Infinity;}
function outline(v){if(!v)return [];if(Array.isArray(v.boundary))return v.boundary;return point(v)&&Number.isFinite(v.radiusM)?Array.from({length:48},(_,i)=>({lat:v.lat+Math.sin(i*Math.PI/24)*v.radiusM/R,lng:v.lng+Math.cos(i*Math.PI/24)*v.radiusM/(R*Math.cos(v.lat*RAD))})):[];}
function sample(ring){if(!Array.isArray(ring)||ring.length<3||ring.length>48||!ring.every(point))return [];const out=[];for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],count=Math.min(16,Math.max(1,Math.ceil(Math.hypot(...xy(q,p))/40)));for(let j=0;j<count;j++)out.push({lat:p.lat+(q.lat-p.lat)*j/count,lng:p.lng+(q.lng-p.lng)*j/count});}return [...out,out[0]];}
module.exports={normalize,area,outsideDistance,outline,sample};
