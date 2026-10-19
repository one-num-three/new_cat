'use strict';
// Official WeChat local automation only; never manipulates desktop windows or submits game locations.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});let seq=0;
const shell='C:/Users/Keke_/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
function call(tool,args){const file=path.join(out,'command-'+(++seq)+'.json');fs.writeFileSync(file,JSON.stringify({tool,project:root,args}));const result=cp.spawnSync(shell,['-NoProfile','-File',path.join(root,'scripts/wechat-mcp-command.ps1'),'-InputFile',file],{encoding:'utf8',timeout:45000});fs.writeFileSync(path.join(out,'call-'+seq+'.log'),result.stdout+result.stderr);assert.equal(result.status,0,result.stderr);const data=JSON.parse(result.stdout.slice(result.stdout.indexOf('{')));assert.ok(data.ok&&data.result.success,JSON.stringify(data));return data.result;}
function inspect(){const fn=function(){return new Promise(resolve=>{let n=0;function check(){const p=getCurrentPages().slice(-1)[0],c=p&&p.selectComponent('.venueArt');if(!p||p.route!=='pages/venue/venue'||!p.data.simulated||!c||c.data.imageState!=='ready'||c.data.overlayPoints.length!==1){if(++n>50){resolve({ready:false,route:p&&p.route});return;}setTimeout(check,100);return;}const q=c.createSelectorQuery();q.select('.venueImage').boundingClientRect();q.select('.geoMarker').boundingClientRect();q.select('.venueViewport').boundingClientRect();q.exec(r=>resolve({ready:true,route:p.route,mapId:p.data.mapId,label:p.position.label,coordinate:p.data.coordinateText,message:p.data.locationError,simulated:p.data.simulated,imageState:c.data.imageState,image:r[0],marker:r[1],viewport:r[2],points:c.data.overlayPoints,fit:[c.data.fitWidth,c.data.fitHeight],window:wx.getWindowInfo()}));}check();});};const data=call('automation_evaluate',{'fn-source':fn.toString()});return data.result.result;}
const rows=[];
for(const suffix of ['northwest','northeast','southeast','southwest','west','meiyuan7b']){
 const scenario='jiulonghu-'+suffix;
 call('automation_navigate',{action:'reLaunch',url:'"/pages/venue/venue?mapId=seu-jiulonghu-v1&simPosition='+scenario+'"'});
 const s=inspect();assert.equal(s.ready,true);assert.equal(s.mapId,'seu-jiulonghu-v1');assert.equal(s.simulated,true);assert.match(s.coordinate,/模拟 GCJ-02/);assert.doesNotMatch(s.message,/超出|未完成/);
 const expected={northwest:'西北',northeast:'东北',southeast:'东南',southwest:'西南',west:'西侧',meiyuan7b:'梅园7B'}[suffix];assert.ok(s.label.includes(expected));
 assert.ok(Math.abs(s.image.width/s.image.height-1)<.001);assert.ok(Math.abs(s.marker.width-48)<1);assert.ok(Math.abs(s.marker.height-48)<1);
 const p=s.points[0],target=[s.image.left+p.x/s.fit[0]*s.image.width,s.image.top+p.y/s.fit[1]*s.image.height],tip=[s.marker.left+s.marker.width*p.anchorX,s.marker.top+s.marker.height*p.anchorY];
 s.tipErrorPx=Math.hypot(target[0]-tip[0],target[1]-tip[1]);assert.ok(s.tipErrorPx<2);assert.ok(s.marker.left>=s.viewport.left-1&&s.marker.right<=s.viewport.right+1&&s.marker.top>=s.viewport.top-1&&s.marker.bottom<=s.viewport.bottom+1,'Marker must be visible inside map viewport');
 const capture=call('simulator_screenshot',{path:path.join(out,suffix+'.png'),optimize:'false'});assert.ok(Math.abs(capture.imageWidth/capture.imageHeight-s.window.windowWidth/s.window.windowHeight)<.01);
 rows.push({scenario,...s,screenshot:suffix+'.png',manuallyInspected:false,phoneVerified:false});fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(rows,null,2));console.log('CAPTURED '+scenario+'; manual image review required');
}
