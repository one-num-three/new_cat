// Pixel coordinates refer to the visible foot/tip in the preserved 1254px source.
// Both rendering paths share this anchor, including the offset flag pole.
const sourceSize=1254;
const sprites={
 self:{iconPath:'/assets/map-markers-v2/self.png',width:48,height:48,anchor:{x:626.5/sourceSize,y:1127/sourceSize}},
 ally:{iconPath:'/assets/map-markers-v2/ally.png',width:48,height:48,anchor:{x:626.5/sourceSize,y:1153/sourceSize}},
 venue:{iconPath:'/assets/map-markers-v2/venue.png',width:48,height:48,anchor:{x:414.5/sourceSize,y:1052/sourceSize}}
};
function sprite(tone){const s=sprites[tone];return s?{...s,anchor:{...s.anchor}}:null;}
function overlay(point){const s=sprite(point.tone);if(!s)return null;return {...point,sprite:s.iconPath,width:s.width,height:s.height,left:-s.width*s.anchor.x,top:-s.height*s.anchor.y,anchorX:s.anchor.x,anchorY:s.anchor.y};}
module.exports={sprite,overlay};
