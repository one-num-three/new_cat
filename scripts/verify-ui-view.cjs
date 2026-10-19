// Focused before/after check; accepts an exact saved source tree, not Git HEAD.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(process.argv[2]||'.');
const moduleFixture={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'utils/dev-preview.js'),'utf8'),{
  module:moduleFixture,require:()=>({mode:'local'}),Date,
  wx:{getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}})}
});
const preview=moduleFixture.exports;
const paused=preview.mapSnapshot('paused','me'),hiding=preview.mapSnapshot('hiding','me');
const wxml=fs.readFileSync(path.join(root,'pages/map/map.wxml'),'utf8');
const observed={pausedMs:paused.match.remainingMs,hidingCaptured:hiding.match.captured,
  roster:paused.roster.length,cats:paused.roster.filter(p=>p.role==='cat').length,
  scrollDrawer:/<scroll-view scroll-y class="drawerBody">/.test(wxml),
  drawerMask:/class="drawerMask" bindtap="closeDrawer"/.test(wxml)};
console.log('UI_CHECK='+JSON.stringify(observed));
const ok=observed.pausedMs===285000 && observed.hidingCaptured===0 && observed.roster===8 &&
  observed.cats===2 && observed.scrollDrawer && observed.drawerMask;
console.log('UI_CHECK_RESULT='+(ok?'PASS':'FAIL'));
process.exitCode=ok?0:1;
