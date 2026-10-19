const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const folder='design/2026-10-13/global-font-v1/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('Fusion UI is shared on all six registered pages and native button labels',()=>{
 const theme=read('utils/pixel-theme.wxss');assert.match(theme,/@import "\.\/fusion-font\.wxss"/);assert.match(theme,/font-family:CatMouseFusionUI,ParkReplicaUI/);
 for(const p of JSON.parse(read('app.json')).pages)assert.match(read(p+'.wxss'),/pixel-theme/);
 for(const p of ['pages/index/index.wxss','pages/room/room.wxss','components/nav-bar/nav-bar.wxss','components/pixel-action/pixel-action.wxss'])assert.match(read(p),/CatMouseFusionUI/);
 assert.doesNotMatch(read('components/pixel-action/pixel-action.wxml'),/<image/);assert.match(read('components/pixel-action/pixel-action.wxml'),/{{label}}/);
});

test('font source and embedded subset are locked and OFL preserved',()=>{
 const m=JSON.parse(read(folder+'manifest.json'));
 assert.equal(m.globalRollout,true);assert.equal(m.scope,'registered-pages-and-components');assert.equal(m.version,'2026.09.25');
 for(const [name,hash] of [['../fusion-font-v1/upstream-zh-hans.woff',m.sourceSha256],['ui-subset.woff',m.subsetSha256]])assert.equal(sha(fs.readFileSync(path.join(root,folder,name))),hash);
 const css=read('utils/fusion-font.wxss');assert.equal(sha(Buffer.from(css)),m.wxssSha256);
 const embedded=Buffer.from(css.match(/base64,([^\"]+)/)[1],'base64');
 assert.equal(sha(embedded),m.subsetSha256);assert.equal(embedded.toString('ascii',0,4),'wOFF');
 assert.ok(embedded.length<40000,'page static subset stays small');
 assert.match(read('design/2026-10-13/fusion-font-v1/OFL.txt'),/SIL OPEN FONT LICENSE Version 1.1/);
});

test('all static Chinese labels in the trial are covered; arrow explicitly falls back',()=>{
 const m=JSON.parse(read(folder+'manifest.json'));
 const {groups}=require('../../utils/dev-preview');
 const labels=read('pages/dev/dev.wxml')+JSON.stringify(groups);
 for(const char of labels.match(/[\u3400-\u9fff]/g))assert.ok(m.coverage.includes(char),char);
 assert.deepEqual(m.fallbackCharacters,['›']);

});
