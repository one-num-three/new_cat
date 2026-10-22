'use strict';
// Assemble public MCP artifacts only; never copy command arguments or session storage.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const source=path.resolve(process.argv[2]),out=path.resolve(process.argv[3]);
const read=name=>JSON.parse(fs.readFileSync(path.join(source,name+'.json'),'utf8'));
const records=read('captures'),final=read('final-state'),joined=read('after-join');
// The first navigation produced a loading frame despite the logic-layer snapshot being ready.
// Keep it as raw evidence, but never present it as a successful rendered roster screenshot.
const accepted=records.filter(r=>r.name!=='00-original-eight');
const original=read('00-original-eight'),offline=read('11-network-lost'),recovered=read('12-same-page-recovered');
const resumed=read('13-host-resumed'),returned=read('14-returned-player-active');
const target=final.match.joinPolicy==='reinforce-v2'?5:4;
assert.equal(final.roster.length,10);assert.equal(final.allOnlinePeersAligned,true);
assert.equal(final.match.id,final.originalMatchId);assert.equal(final.match.target,target);assert.equal(final.match.captured,1);
assert.equal(joined.rules.cats,3);assert.equal(joined.rules.mice,7);
assert.equal(joined.roster.find(p=>p.index===8).role,'mouse');assert.equal(joined.roster.find(p=>p.index===9).role,'cat');
for(const [id,role]of Object.entries(final.originalRoles))assert.equal(final.roster.find(p=>p.id===id).role,role);
const players=final.roster.map(p=>{
 const peer=final.peerViews.find(v=>v.index===p.index),name='player-'+String(p.index+1).padStart(2,'0'),ui=read(name).view;
 assert.equal(peer.connected,true);assert.equal(peer.version,final.version);assert.equal(peer.phase,final.match.phase);
 assert.equal(peer.role,p.role);assert.equal(peer.status,p.status);
 for(const id of peer.visibleIds){const visible=final.roster.find(v=>v.id===id);assert.ok(visible&&visible.role===p.role);}
 if(p.status==='captured')assert.equal(peer.visibleIds.length,0);
 assert.equal(ui.userId,p.id);assert.equal(ui.role,p.role);assert.equal(ui.status,p.status);
 assert.equal(ui.matchId,final.match.id);assert.equal(ui.roster.length,10);assert.equal(ui.target,target);assert.equal(ui.captured,1);
 return {player:p.nickname,id:p.id,role:p.role,status:p.status,livePhase:peer.phase,liveVersion:peer.version,visiblePlayers:peer.visibleIds.length,uiPhase:ui.phase,screenshot:name+'.png',consistent:true};
});
for(const s of [offline,recovered,returned])assert.equal(s.view.userId,players[8].id);
assert.equal(offline.view.offline,true);assert.equal(offline.view.markers,0);assert.equal(offline.view.canScan,false);assert.equal(offline.view.canShowCode,false);
assert.equal(recovered.view.offline,false);assert.equal(recovered.view.phase,'PAUSED');assert.equal(returned.view.phase,'CHASING');
assert.equal(resumed.view.status,'captured');assert.equal(resumed.view.phase,'CHASING');
for(const s of [original,offline,recovered,resumed,returned])assert.equal(s.view.matchId,final.match.id);
assert.deepEqual(read('restore'),{restored:true,backupRemoved:true});
const summary={date:'2026-10-19',status:'passed',method:'official WeChat DevTools MCP; real HTTP and native WebSocket rules service',simulators:1,concurrentAuthorizedWebSockets:10,storage:'isolated local PGlite',realWallClock:true,hidingSeconds:30,chasingSeconds:360,simulatedGps:true,phoneTest:false,publicNetworkTest:false,productionDataWritten:false,originalSessionRestored:true,devPreview:false,screenshots:records.length,acceptedScreenshots:accepted.length,excludedVisualEvidence:[{name:'00-original-eight',reason:'Loading frame; logic-layer baseline only, not a rendered UI pass'}],individualUiScreenshots:players.length,allUiDuringChase:players.every(p=>p.uiPhase==='CHASING'),matchId:final.match.id,lateJoin:{from:8,to:10,cats:3,mice:7,oldRolesUnchanged:true,target,captured:1},offline:{player:'P09',locationsHidden:true,captureDisabled:true,automaticGlobalPause:true,samePageAutomaticReconnect:true,identityUnchanged:true,capturedHostResumedWithoutRevival:true},players};
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});fs.mkdirSync(path.join(out,'mcp'),{recursive:true});
for(const r of records){assert.ok(!/[\\/]/.test(r.name));for(const ext of ['png','json'])fs.copyFileSync(path.join(source,r.name+'.'+ext),path.join(out,'screenshots',r.name+'.'+ext));}
for(const name of ['after-join','final-state','others-during-disconnect','restore'])fs.copyFileSync(path.join(source,name+'.json'),path.join(out,name+'.json'));
fs.copyFileSync(path.join(source,'fixture-events.jsonl'),path.join(out,'fixture-events.jsonl'));
fs.writeFileSync(path.join(out,'mcp/result.json'),JSON.stringify(summary,null,2));
fs.writeFileSync(path.join(out,'captures.json'),JSON.stringify(records,null,2));
const labels={'00-original-eight':'原 8 人 · 2 猫 6 鼠','11-network-lost':'P09 断线 · 隐藏位置','12-same-page-recovered':'P09 自动重连 · 等待房主','13-host-resumed':'被捕房主恢复 · 不复活','14-returned-player-active':'P09 恢复追逐 · 原身份'};
const role=r=>r==='cat'?'猫':'鼠',status=s=>s==='captured'?'已被捕获':'活跃';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const card=r=>`<article><a href="screenshots/${r.screenshot}" target="_blank"><img loading="lazy" src="screenshots/${r.screenshot}" alt="${escape(labels[r.name]||r.label)}"></a><h3>${escape(labels[r.name]||r.label)}</h3><p>${role(r.role)}队 · ${status(r.status)} · ${r.phase}<br>${r.captured}/${r.target} · ${r.offline?'断线':'已连接'}</p><a href="screenshots/${r.name}.json">查看对应状态</a></article>`;
const network=accepted.filter(r=>!r.name.startsWith('player-'));
fs.writeFileSync(path.join(out,'index.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>中途加入与断线重连 · MCP实测</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f4eb;color:#213638;font:16px/1.6 system-ui,'Microsoft YaHei',sans-serif}main{max-width:1380px;margin:auto;padding:28px}h1{font-size:30px;margin:0}h2{margin-top:34px}p{margin:8px 0 14px}.note{padding:16px;background:#e4efdf;border-left:5px solid #477f60}table{width:100%;border-collapse:collapse;background:#fffdf5}th,td{text-align:left;padding:10px;border-bottom:1px solid #d7decf}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:18px}article{background:#fffdf5;border:1px solid #ccd5c1;padding:10px;border-radius:8px}article img{width:100%;height:auto;display:block}article h3{font-size:17px;margin:10px 0 0}article p,article a{font-size:14px}a{color:#235f51}summary{cursor:pointer}.muted{color:#596760}</style><main><h1>中途加入与断线重连 · MCP 实测</h1><p>2026-10-19 · 8 人开局 → 10 人 · 同一对局 · 服务端裁决</p><div class="note">已核对 10 人实时身份/状态，取得 10 个身份的独立小程序截图。<br>使用 <b>1 个微信模拟器轮换身份 + 10 个同时在线的授权 WebSocket</b>；连接真实本机规则服务和隔离 PGlite。GPS 为模拟坐标，未做 10 台真机或公网断网测试。</div><h2>全员核对</h2><p>旧 8 人不重抽；P09 补鼠、P10 补猫，合计 3 猫 7 鼠。捕获目标为 ${target}。所有实时快照版本为 ${final.version}，P01 被捕后不恢复活跃。</p><table><thead><tr><th>身份</th><th>阵营</th><th>状态</th><th>实时 / UI</th><th>核对</th></tr></thead><tbody>${players.map(p=>`<tr><td>${escape(p.player)}</td><td>${role(p.role)}</td><td>${status(p.status)}</td><td>${p.livePhase} / ${p.uiPhase}</td><td>一致</td></tr>`).join('')}</tbody></table><h2>加入与重连过程</h2><p>P09 请求和连接被定向阻断 → 本机界面隐藏位置/禁用抓捕 → 服务端定位失联暂停 → 恢复网络后原页自动同步 → 被捕房主按实际恢复按钮继续本局。</p><section class="grid">${network.map(card).join('')}</section><h2>10 个身份各自的页面</h2><p class="muted">逐个切换测试会话，从服务端重新接收授权状态；没有向页面注入阵营、名单或胜负。点图查看原尺寸。</p><section class="grid">${players.map(p=>card(records.find(r=>r.screenshot===p.screenshot))).join('')}</section><h2>验证范围与修复</h2><ul><li>修复被捕房主恢复时错误上报定位、被 CAPTURED 拒绝的问题。</li><li>实时连接绑定当前会话，拒绝本人阵营/状态矛盾的旧快照；每次连接使用独立标识。</li><li>自动回归 177/177 通过；官方 WXML/WXSS 编译通过。<a href="verification.json">验证汇总</a> · <a href="mcp/result.json">逐人证据</a> · <a href="README.md">复现说明与限制</a></li><li>已恢复原真实会话、HTTPS/WSS 配置和定位 API。前端未上传或发布；本次没有修改生产对局。</li></ul></main></html>`);
console.log(JSON.stringify({status:summary.status,screenshots:summary.screenshots,players:players.length,allUiDuringChase:summary.allUiDuringChase,output:out},null,2));
