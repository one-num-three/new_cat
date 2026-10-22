const images=require('../shared/venue-images');
function list(){return {schema:'venue-catalog-v1',coordinateSystem:'gcj02',limits:{minVertices:3,maxVertices:16,minAreaM2:400,maxAreaM2:4000000,maxDistanceM:3000,outsideToleranceM:50},maps:images.map(i=>({id:i.id,label:i.label,revision:i.sha256,bounds:i.gcjBounds||null,layers:i.id==='seu-jiulonghu-v1'?['native','art','model']:['native','art'],fieldVerified:false}))};}
module.exports={list};
