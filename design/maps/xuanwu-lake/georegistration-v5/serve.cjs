'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
function server(){return http.createServer((req,res)=>{
 const name=decodeURIComponent(req.url.split('?')[0]).replace(/^\//,'')||'index.html';
 if(name.includes('/')||name.includes('\\')||name.includes('..')){res.writeHead(403);return res.end();}
 const p=path.join(__dirname,name);if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404);return res.end();}
 const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.md':'text/plain; charset=utf-8'};
 res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(p).pipe(res);
 });}
module.exports=server;
if(require.main===module){const port=Number(process.argv[2]||8775);server().listen(port,'127.0.0.1',()=>console.log(`Map registration preview: http://127.0.0.1:${port}/`));}
