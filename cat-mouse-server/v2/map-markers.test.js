const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const markers=require('../../utils/map-markers');
const root=path.resolve(__dirname,'../..');
// Decode the alpha of shipped RGBA PNGs without an image-library test dependency.
function rgba(bytes){
 assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),chunks=[];
 assert.equal(bytes[24],8);assert.equal(bytes[25],6);assert.equal(bytes[28],0);
 for(let pos=8;pos<bytes.length;){const size=bytes.readUInt32BE(pos);if(bytes.toString('ascii',pos+4,pos+8)==='IDAT')chunks.push(bytes.subarray(pos+8,pos+8+size));pos+=size+12;}
 const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=width*4,out=Buffer.alloc(stride*height);assert.equal(raw.length,(stride+1)*height);
 const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 for(let y=0;y<height;y++){const filter=raw[y*(stride+1)];assert.ok(filter<=4);for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=4?out[i-4]:0,b=y?out[i-stride]:0,c=y&&x>=4?out[i-stride-4]:0;out[i]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}}
 return {width,height,data:out};
}
test('generated runtime sprites retain true alpha, visible tips and locked source hashes',()=>{
 const manifest=require('../../design/2026-10-16/map-markers-v2/manifest.json');let total=0;
 for(const entry of manifest.entries){
  const bytes=fs.readFileSync(path.join(root,entry.runtime)),im=rgba(bytes),s=markers.sprite(entry.role);total+=bytes.length;
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),entry.runtimeSha256);
  const original=fs.readFileSync(path.join(root,'design/2026-10-16/map-markers-v2',entry.role+'-original.png'));
  assert.equal(crypto.createHash('sha256').update(original).digest('hex'),entry.originalSha256);
  assert.equal(im.width,192);assert.equal(im.height,192);let empty=0,solid=0;
  for(let i=3;i<im.data.length;i+=4){if(im.data[i]===0)empty++;if(im.data[i]>=200)solid++;}
  assert.ok(empty>im.width*im.height*.5);assert.ok(solid>2000);
  for(const [x,y] of [[0,0],[191,0],[0,191],[191,191]])assert.equal(im.data[(y*192+x)*4+3],0);
  // Declared geographic contact is within two source-resampled pixels of visible ink.
  const x=Math.round(s.anchor.x*192),y=Math.round(s.anchor.y*192);let contact=false;
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)if(im.data[((y+dy)*192+x+dx)*4+3]>=200)contact=true;
  assert.ok(contact,entry.role+' foot must meet coordinate');
 }
 assert.ok(total<75*1024,'small shared local assets, no image downloads');
});
test('shared sprite geometry keeps the visible tip on its map coordinate at every uniform zoom',()=>{
 for(const role of ['self','ally','venue','enemy']){const p=markers.overlay({tone:role,x:210,y:320,label:'测试'}),s=markers.sprite(role);
  assert.equal(s.width,s.height);assert.equal(p.sprite,s.iconPath);
  for(const scale of [.52,1,1.25,4]){const screen={x:-35+p.x*scale,y:20+p.y*scale},inv=1/scale;
   assert.ok(Math.abs(screen.x+(p.left+s.width*s.anchor.x)*inv*scale-screen.x)<1e-9);
   assert.ok(Math.abs(screen.y+(p.top+s.height*s.anchor.y)*inv*scale-screen.y)<1e-9);
   assert.equal(s.width*scale*inv,role==='enemy'?40:48);
  }
 }
 assert.match(markers.overlay({tone:'enemy',x:1,y:1}).sprite,/role-cat/);assert.equal(markers.sprite('unknown'),null);
 const a=markers.sprite('self');a.anchor.x=0;assert.notEqual(markers.sprite('self').anchor.x,0);
 assert.ok(markers.sprite('venue').anchor.x<.4,'flag pole, not flag canvas centre');
});
