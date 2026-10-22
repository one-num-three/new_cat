'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const MAIN_LIMIT=1500000,SUB_LIMIT=2097152;
function scan(root){
 const app=JSON.parse(fs.readFileSync(path.join(root,'app.json'),'utf8')),project=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'));
 const ignores=project.packOptions?.ignore||[],roots=(app.subPackages||app.subpackages||[]).map(s=>s.root.replace(/\\/g,'/').replace(/\/$/,'')),bytes={},files=[];
 for(const i of ignores)assert.ok(['file','folder'].includes(i.type),'Unsupported packaging ignore: '+i.type);
 const ignored=p=>ignores.some(i=>{const q=i.value.replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');return p===q||i.type==='folder'&&p.startsWith(q+'/');});
 function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const abs=path.join(dir,e.name),relative=path.relative(root,abs).split(path.sep).join('/');if(ignored(relative))continue;if(e.isSymbolicLink())throw Error('Unexpected package symlink: '+relative);if(e.isDirectory())walk(abs);else{const group=roots.find(r=>relative.startsWith(r+'/'))||'main',size=fs.statSync(abs).size;bytes[group]=(bytes[group]||0)+size;files.push({file:relative,bytes:size,package:group});}}}walk(root);
 return {rawLocalBytes:bytes,mainLimitBytes:MAIN_LIMIT,subPackageLimitBytes:SUB_LIMIT,mainHeadroomBytes:MAIN_LIMIT-(bytes.main||0),uploadVerified:false,measurement:'Uncompressed source files after project.config.json packOptions.ignore; not WeChat upload bytes',files};
}
function check(result){assert.ok(result.rawLocalBytes.main<MAIN_LIMIT,'Main package must be below 1,500,000 bytes');for(const [group,n]of Object.entries(result.rawLocalBytes))if(group!=='main')assert.ok(n<SUB_LIMIT,'Subpackage exceeds budget: '+group);return result;}
module.exports={scan,check,MAIN_LIMIT,SUB_LIMIT};
if(require.main===module){const result=scan(path.resolve(__dirname,'..'));if(process.argv.includes('--check'))check(result);const dest=process.argv.find(a=>a.startsWith('--output='));if(dest)fs.writeFileSync(dest.slice(9),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,files:result.files.length},null,2));}
