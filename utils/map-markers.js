// Pixel coordinates refer to the exact bottom/pole tip in assets/map-markers-v3.
// Both native <map> markers and 2D/3D overlays share these sprites and anchors.
const sprites={
 self:{iconPath:'/assets/map-markers-v3/self.png',width:48,height:48,anchor:{x:96/192,y:173/192}},
 ally:{iconPath:'/assets/map-markers-v3/ally.png',width:48,height:48,anchor:{x:96/192,y:177/192}},
 enemy:{iconPath:'/assets/map-markers-v3/role-cat-marker.png',width:40,height:40,anchor:{x:96/192,y:177/192}},
 venue:{iconPath:'/assets/map-markers-v3/venue.png',width:48,height:48,anchor:{x:63/192,y:161/192}},
 vertex:{iconPath:'/assets/map-markers-v3/vertex.png',width:34,height:34,anchor:{x:64/128,y:114/128}},
 vertexSelected:{iconPath:'/assets/map-markers-v3/vertex-selected.png',width:38,height:38,anchor:{x:64/128,y:114/128}},
 trackCat:{iconPath:'/assets/map-markers-v3/track-cat.png',width:38,height:38,anchor:{x:64/128,y:116/128}},
 trackMouse:{iconPath:'/assets/map-markers-v3/track-mouse.png',width:38,height:38,anchor:{x:64/128,y:116/128}},
 trackEnd:{iconPath:'/assets/map-markers-v3/track-end.png',width:34,height:34,anchor:{x:34/128,y:114/128}}
};
const calloutThemes={
 self:{bgColor:'#1e64a8',borderColor:'#0e355e',color:'#fffdf6'},
 ally:{bgColor:'#2c6122',borderColor:'#163811',color:'#fffdf6'},
 enemy:{bgColor:'#c73322',borderColor:'#5c140c',color:'#fffdf6'},
 venue:{bgColor:'#fcf5e3',borderColor:'#7b3c14',color:'#4f2710'},
 vertex:{bgColor:'#fff7e0',borderColor:'#6b3e17',color:'#3b1d0b'},
 vertexSelected:{bgColor:'#e87f24',borderColor:'#7a3303',color:'#fffdf6'}
};
function sprite(tone){const s=sprites[tone];return s?{...s,anchor:{...s.anchor}}:null;}
function callout(tone,content,opts={}){const t=calloutThemes[tone]||calloutThemes.venue;return {content:String(content||''),display:opts.display||'ALWAYS',padding:opts.padding??4,borderRadius:opts.borderRadius??3,borderWidth:opts.borderWidth??2,borderColor:t.borderColor,bgColor:t.bgColor,color:t.color,fontSize:opts.fontSize??12,textAlign:'center'};}
function overlay(point){const s=sprite(point.tone);if(!s)return null;return {...point,sprite:s.iconPath,width:s.width,height:s.height,left:-s.width*s.anchor.x,top:-s.height*s.anchor.y,anchorX:s.anchor.x,anchorY:s.anchor.y};}
module.exports={sprite,callout,overlay};