'use strict';
// WGS84 -> GCJ-02 subset adapted from wandergis/coordtransform (MIT).
// https://github.com/wandergis/coordtransform/blob/master/index.js
// See coordtransform.LICENSE. This is an approximate display transform, not a
// platform-certified survey conversion. Never use it for capture/rule decisions.
const PI=Math.PI,A=6378245,EE=0.00669342162296594323;
function wgs84togcj02(lng,lat){
 if(!(lng>73.66&&lng<135.05&&lat>3.86&&lat<53.55))return [lng,lat];
 const x=lng-105,y=lat-35;
 let dy=-100+2*x+3*y+.2*y*y+.1*x*y+.2*Math.sqrt(Math.abs(x));
 dy+=(20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3;
 dy+=(20*Math.sin(y*PI)+40*Math.sin(y/3*PI))*2/3;
 dy+=(160*Math.sin(y/12*PI)+320*Math.sin(y*PI/30))*2/3;
 let dx=300+x+2*y+.1*x*x+.1*x*y+.1*Math.sqrt(Math.abs(x));
 dx+=(20*Math.sin(6*x*PI)+20*Math.sin(2*x*PI))*2/3;
 dx+=(20*Math.sin(x*PI)+40*Math.sin(x/3*PI))*2/3;
 dx+=(150*Math.sin(x/12*PI)+300*Math.sin(x/30*PI))*2/3;
 const r=lat/180*PI,magic=1-EE*Math.sin(r)**2,s=Math.sqrt(magic);
 return [lng+dx*180/(A/s*Math.cos(r)*PI),lat+dy*180/(A*(1-EE)/(magic*s)*PI)];
}
module.exports={wgs84togcj02};
