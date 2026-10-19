// Read the authoritative model at startup, so rollback also disables the preview mapping.
const requested=new URLSearchParams(location.search).get('config')||'MODIFIED_FILE.json';
const config=['MODIFIED_FILE.json','baseline.json','rollback-test.json'].includes(requested)?requested:'MODIFIED_FILE.json';
Promise.all([fetch(config).then(r=>r.json()),fetch('reference.geojson').then(r=>r.json())]).then(([m,r])=>{
 window.REGISTRATION=m;window.REFERENCE=r;
 if(!m.enabled){const image=new Image();image.onload=()=>{document.getElementById('art').getContext('2d').drawImage(image,0,0);document.getElementById('info').textContent='UNREGISTERED / enabled=false / mapping=null / image=unchanged';document.getElementById('export').disabled=true;window.READY=true;};image.src=m.image.file;return;}
 const s=document.createElement('script');s.src='viewer.js';document.body.appendChild(s);
}).catch(e=>{document.getElementById('info').textContent='请用 node serve.cjs 启动本地预览服务。 '+e.message;});
