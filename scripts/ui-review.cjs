// Real IDE layout probe. No desktop inputs, window resizing, screenshot popups or publishing.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const automator = require('../cat-mouse-server/node_modules/miniprogram-automator');
const root = path.resolve(__dirname, '..');
const modes = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8')).condition.miniprogram.list;
const wanted = process.argv[2] || 'gallery';
const modeFor = id => modes.find(m => (m.query.split('=')[1] || 'gallery') === id);
const ids = wanted === 'all' ? modes.map(m => m.query.split('=')[1] || 'gallery') : [wanted];
const output = process.argv[3] && path.resolve(process.argv[3]);
const records = [];
(async () => {
  for (const id of ids) {
    const mode = modeFor(id);
    assert.ok(mode, 'Unknown preview case: ' + id);
    // Fresh PageMap for each route: IDE recompiles may reuse native page IDs.
    const mp = await automator.connect({ wsEndpoint: 'ws://127.0.0.1:9420' });
    try {
      await new Promise(resolve=>setTimeout(resolve,1200));
      const account = await mp.callWxMethod('getAccountInfoSync');
      assert.equal(account.miniProgram.envVersion, 'develop', 'Developer build required');
      const route='/' + mode.pathName + (mode.query ? '?' + mode.query : '');
      let page = await mp.reLaunch(route);
      await page.waitFor(500);
      let data=await page.data();
      // A compile/user navigation may replace the webview while routing; one bounded retry.
      if(page.path!==mode.pathName || !(id==='gallery'?data.available:data.devPreview)){
        console.log('RETRY '+id+' observed='+page.path);
        page=await mp.reLaunch(route);await page.waitFor(500);data=await page.data();
      }
      assert.equal(page.path, mode.pathName, 'Unexpected route for ' + id);
      assert.equal(id === 'gallery' ? data.available : data.devPreview, true, 'Fixture not active: ' + id);
      const metrics = {};
      const selectors = mode.pathName.includes('/map/') ? ['.mapPage', '.topPanel', '.bottomPanel'] : mode.pathName.includes('/room/') ? ['.screen', '.code', '.copyButton', '.roomActions', '.primary'] : mode.pathName.includes('/qrcode/') ? ['.screen', '.qrCard', '.qrCorners', '.secondary'] : ['.screen'];
      for (const selector of selectors) {
        const element = await page.$(selector);
        if (element) metrics[selector] = { offset: await element.offset(), size: await element.size() };
      }
      const system = await mp.systemInfo();
      for (const [selector, box] of Object.entries(metrics)) {
        assert.ok(box.offset.left >= -1, id + selector + ' left overflow');
        assert.ok(box.offset.left + box.size.width <= system.windowWidth + 1, id + selector + ' right overflow');
      }
      if (id === 'ready') {
        const code=metrics['.code'], copy=metrics['.copyButton'];
        assert.ok(code.offset.left + code.size.width < copy.offset.left, 'Room code overlaps copy action');
        assert.ok(copy.size.width < system.windowWidth / 3, 'Copy action dominates invitation card');
      }
      if (mode.pathName.includes('/map/')) {
        const top = metrics['.topPanel'], bottom = metrics['.bottomPanel'];
        assert.ok(top.offset.top + top.size.height < bottom.offset.top, id + ' map panels overlap');
        assert.ok(bottom.offset.top + bottom.size.height <= system.windowHeight + 1, id + ' bottom panel cropped');
        if (id === 'paused') { assert.equal(data.clock, '04:45'); assert.equal(data.pauseReasonText, '组织者暂停'); }
        if (id === 'hiding') assert.equal(data.match.captured, 0);
        if (id === 'captured') assert.equal(data.phaseText, '本轮出局');
        if (id === 'offline') { assert.equal(data.clock, '--:--'); assert.equal(data.markers.length, 0); }
      }
      records.push({ id, path: page.path, fixture: true, window: { width: system.windowWidth, height: system.windowHeight }, metrics });
      if(output)fs.writeFileSync(output,JSON.stringify({result:'IN_PROGRESS',records},null,2));
      console.log('PASS ' + id);
    } finally { mp.disconnect(); }
  }
  if (output) fs.writeFileSync(output, JSON.stringify({ result: 'PASS', records }, null, 2));
  console.log('UI_PROBE_PASS=' + records.length);
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
