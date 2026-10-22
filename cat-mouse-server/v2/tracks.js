'use strict';
const {closestCat}=require('./track-highlights');
const SAMPLE_MS=2000,RETENTION_MS=7*86400000;
async function record(db,room,actor,point,now){
 const m=room.state.match,p=m?.participants.find(p=>p.id===actor);
 if(m?.trackVersion!=='tracks-v1'||!['HIDING','CHASING'].includes(m.phase)||p?.status!=='active')return;
 // 两秒最多留一点；唯一键使重试/重连不重复，不依赖易重置的客户端序号。
 await db.query('INSERT INTO match_track_points (match_id,player_id,bucket,sampled_at,recorded_at,lat,lng,accuracy,segment,phase) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING',
  [m.id,actor,Math.floor(now/SAMPLE_MS),point.sampledAt,now,point.lat,point.lng,point.accuracy,m.trackSegment||0,m.phase]);
}
async function read(store,matchId,actor,scope,now){
 if(!['self','all'].includes(scope))throw Error('INVALID_TRACK_SCOPE');
 const row=(await store.query('SELECT result FROM match_results WHERE match_id=$1',[matchId])).rows[0];
 if(!row)throw Error('MATCH_NOT_FINISHED');const result=row.result;
 if(!result.participants?.some(p=>p.id===actor))throw Error('FORBIDDEN');
 if(scope==='all'&&result.ownerId!==actor)throw Error('FORBIDDEN');
 if(result.trackVersion!=='tracks-v1')throw Error('TRACK_NOT_AVAILABLE');
 if(now-result.endedAt>RETENTION_MS)throw Error('TRACK_EXPIRED');
 const points=(await store.query('SELECT player_id,sampled_at,recorded_at,lat,lng,accuracy,segment,phase FROM match_track_points WHERE match_id=$1'+(scope==='self'?' AND player_id=$2':'')+' ORDER BY recorded_at,player_id',[matchId,...(scope==='self'?[actor]:[])])).rows;
 const normalize=q=>({lat:q.lat,lng:q.lng,accuracy:q.accuracy,sampledAt:Number(q.sampled_at),recordedAt:Number(q.recorded_at),segment:q.segment,phase:q.phase});
 const players=result.participants.filter(p=>scope==='all'||p.id===actor).map(p=>({id:p.id,nickname:p.nickname,role:p.role,status:p.status,points:points.filter(q=>q.player_id===p.id).map(normalize)}));
 const catIds=result.participants.filter(p=>p.role==='cat').map(p=>p.id);
 let cats=players.filter(p=>p.role==='cat').map(p=>p.points);
 if(scope==='self'&&players[0].role==='mouse'&&catIds.length){const catRows=(await store.query('SELECT player_id,sampled_at,recorded_at,lat,lng,accuracy,segment,phase FROM match_track_points WHERE match_id=$1 AND player_id IN ('+catIds.map((_,i)=>'$'+(i+2)).join(',')+') ORDER BY recorded_at',[matchId,...catIds])).rows;cats=catIds.map(id=>catRows.filter(p=>p.player_id===id).map(normalize));}
 for(const p of players)p.highlights={schema:'track-highlights-v1',closestCat:p.role==='mouse'?closestCat(p.points,cats):null};
 return {schema:'tracks-v1',matchId,scope,coordinateSystem:'gcj02',startedAt:result.startedAt,endedAt:result.endedAt,expiresAt:result.endedAt+RETENTION_MS,sampleIntervalMs:SAMPLE_MS,venue:result.venue,mapCalibration:result.mapCalibration||null,outcome:result.outcome,players};
}
const purge=(store,now)=>store.query("DELETE FROM match_track_points WHERE match_id IN (SELECT match_id FROM match_results WHERE (result->>'endedAt')::bigint<$1)",[now-RETENTION_MS]);
module.exports={record,read,purge,SAMPLE_MS,RETENTION_MS};
