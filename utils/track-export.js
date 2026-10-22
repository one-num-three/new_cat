const {gcjToWgs}=require('./osm-art-registration');
function segments(points){const result=[];let last=null,part;
 for(const p of points||[]){if(!p||![p.lat,p.lng,p.sampledAt,p.recordedAt].every(Number.isFinite)||Math.abs(p.lat)>=85||Math.abs(p.lng)>180){last=null;continue;}
  if(!last||p.segment!==last.segment||p.phase!==last.phase||p.recordedAt-last.recordedAt>10000||p.recordedAt<=last.recordedAt||p.sampledAt-last.sampledAt>10000||p.sampledAt<=last.sampledAt){part=[];result.push(part);}part.push(p);last=p;
 }return result;
}
const csvCell=v=>{let s=String(v??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
function file(data,format){
 if(data?.schema!=='tracks-v1'||data.coordinateSystem!=='gcj02'||!Array.isArray(data.players))throw Error('轨迹格式无效');
 let content;if(format==='csv'){
  const rows=[['match_id','player_id','nickname','role','phase','segment','sampled_at_utc','recorded_at_utc','latitude_gcj02','longitude_gcj02','accuracy_m']];
  for(const p of data.players)for(const q of p.points)rows.push([data.matchId,p.id,p.nickname,p.role,q.phase,q.segment,new Date(q.sampledAt).toISOString(),new Date(q.recordedAt).toISOString(),q.lat,q.lng,q.accuracy]);
  content='\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
 }else if(format==='geojson'){
  const features=[];for(const p of data.players)for(const part of segments(p.points)){const coords=part.map(q=>gcjToWgs(q,'gcj02')).filter(Boolean).map(q=>[q.lng,q.lat]);if(!coords.length)continue;features.push({type:'Feature',properties:{playerId:p.id,nickname:p.nickname,role:p.role,phase:part[0].phase,segment:part[0].segment,startedAt:part[0].sampledAt,endedAt:part[part.length-1].sampledAt},geometry:{type:coords.length===1?'Point':'LineString',coordinates:coords.length===1?coords[0]:coords}});}
  content=JSON.stringify({type:'FeatureCollection',properties:{matchId:data.matchId,coordinateConversion:'GCJ-02 to approximate WGS84; not surveyed',gapPolicy:'pause, phase change or >10s missing samples split the line'},features},null,2);
 }else throw Error('导出格式无效');
 return {name:'catmouse-'+data.matchId+'-'+data.scope+'.'+format,content};
}
module.exports={file,segments};
