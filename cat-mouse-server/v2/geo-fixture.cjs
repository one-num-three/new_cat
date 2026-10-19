// SYNTHETIC, test-only geometry. Never load this as a real park calibration.
const geo=require('../../utils/geo-registration');
function fixture(){const origin={lat:32.073,lng:118.789},latM=6371000*Math.PI/180,lngM=latM*Math.cos(origin.lat*Math.PI/180);
 const point=(u,v,kind)=>({u,v,kind,lat:origin.lat+(180-400*v+30*u)/latM,lng:origin.lng+(-180+400*u+20*v)/lngM});
 return {imageId:geo.IMAGE.id,imageSha256:geo.IMAGE.sha256,crs:'gcj02',points:[point(.1,.1,'control'),point(.9,.1,'control'),point(.9,.9,'control'),point(.1,.9,'control'),point(.3,.35,'check'),point(.7,.65,'check')]};}
module.exports={fixture};
