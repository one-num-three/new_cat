'use strict';
const {distance}=require('./rules');
const valid=p=>p&&[p.lat,p.lng,p.sampledAt,p.recordedAt,p.accuracy].every(Number.isFinite)&&Math.abs(p.lat)<85&&Math.abs(p.lng)<=180&&p.accuracy>=0&&p.accuracy<=15&&p.phase==='CHASING';
function samples(points){
 const good=points.filter(valid);
 return good.filter((p,i)=>![good[i-1],good[i+1]].some(q=>q&&q.segment===p.segment&&Math.abs(q.sampledAt-p.sampledAt)>0&&Math.abs(q.sampledAt-p.sampledAt)<=10000&&distance(p,q)/Math.abs(q.sampledAt-p.sampledAt)*1000>12));
}
// This summary is computed only AFTER export authorization. It identifies a
// recorded self sample; no cat identity, coordinate or route leaves the server.
function closestCat(self,cats){
 let best=null;
 const own=samples(self),groups=cats.map(points=>{const groups=new Map();for(const p of samples(points)){if(!groups.has(p.segment))groups.set(p.segment,[]);groups.get(p.segment).push(p);}for(const list of groups.values())list.sort((a,b)=>a.sampledAt-b.sampledAt);return groups;});
 for(const p of own)for(const group of groups){const list=group.get(p.segment)||[];let lo=0,hi=list.length;while(lo<hi){const mid=(lo+hi)>>1;if(list[mid].sampledAt<p.sampledAt)lo=mid+1;else hi=mid;}
  for(const q of [list[lo-1],list[lo]]){if(!q||Math.abs(q.sampledAt-p.sampledAt)>1500||Math.abs(q.recordedAt-p.recordedAt)>2000)continue;const d=distance(p,q);if(!best||d<best.distanceM)best={sampledAt:p.sampledAt,recordedAt:p.recordedAt,segment:p.segment,distanceM:d,alignmentMs:Math.abs(q.sampledAt-p.sampledAt),uncertaintyM:p.accuracy+q.accuracy};}
 }return best;
}
module.exports={closestCat};
