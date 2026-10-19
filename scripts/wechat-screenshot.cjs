'use strict';
const path=require('node:path'),cp=require('node:child_process');
module.exports=async function screenshot(mp,file){
 if(process.env.CAT_MOUSE_USE_MCP!=='1')return mp.screenshot({path:file});
 const shell=process.env.CAT_MOUSE_POWERSHELL || 'C:/Users/Keke_/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe';
 let output;for(let attempt=0;attempt<2;attempt++){try{output=cp.execFileSync(shell,['-NoProfile','-File',path.join(__dirname,'wechat-mcp-screenshot.ps1'),'-Project',path.resolve(__dirname,'..'),'-Path',file],{encoding:'utf8',timeout:45000});break;}catch(e){if(attempt || !/ETIMEDOUT|ECONNRESET|secure TLS/i.test(String(e.message)+' '+String(e.stderr||'')))throw e;console.log('MCP_TRANSPORT_RETRY '+path.basename(file));await new Promise(resolve=>setTimeout(resolve,1500));}}
 if(!output.includes('MCP_SCREENSHOT_PASS'))throw Error(output);
 console.log(output.trim());
};
