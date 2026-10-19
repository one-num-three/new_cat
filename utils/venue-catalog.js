const images=require('./venue-images.js');
const DEFAULT_ID='xuanwu-v4';
function get(id=DEFAULT_ID){return images.find(x=>x.id===id)||null;}
function contains(id,p){const image=get(id);if(!image||!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng))return false;const b=image.gcjBounds;return !b||p.lng>=b[0]&&p.lat>=b[1]&&p.lng<=b[2]&&p.lat<=b[3];}
const options=images.map(x=>({id:x.id,label:x.label}));
module.exports={DEFAULT_ID,get,contains,options};
