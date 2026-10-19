const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname, types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.png':'image/png','.woff':'font/woff'};
http.createServer((req,res)=>{const name=new URL(req.url,'http://127.0.0.1').pathname;
 const rel=name==='/'?'index.html':name.slice(1);
 if(!(['index.html','replica.css','replica.js'].includes(rel)||/^assets\/(?:\d\d-[a-z-]+\.png|display-black\.woff)$/.test(rel))){res.writeHead(404);return res.end('Not found');}
 const p=path.join(root,rel);if(!fs.existsSync(p)){res.writeHead(404);return res.end('Not found');}
 res.writeHead(200,{'Content-Type':types[path.extname(p)],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});fs.createReadStream(p).pipe(res);
}).listen(8767,'127.0.0.1',()=>console.log('PIXEL_PREVIEW http://127.0.0.1:8767 (allowlisted preview files only)'));
