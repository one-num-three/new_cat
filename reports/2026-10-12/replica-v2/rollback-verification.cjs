'use strict';
// This report utility writes only the marked isolated fixture and report evidence.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const report = __dirname;
const repo = path.resolve(report, '../../..');
const fixture = path.join(report, 'rollback-fixture');
const baseline = path.join(report, 'baseline');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = p => fs.readFileSync(p);
const norm = p => path.resolve(p).replaceAll('\\', '/').toLowerCase();
const fail = message => { throw new Error('ROLLBACK_VERIFICATION ' + message); };
function checkedFile(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..' || p === '.git' || p === 'node_modules')) fail('invalid relative file');
  let p = root;
  for (const part of relative.split('/')) {
    p = path.join(p, part);
    if (!fs.existsSync(p) || fs.lstatSync(p).isSymbolicLink()) fail('missing or linked file ' + p);
  }
  if (!fs.lstatSync(p).isFile()) fail('not an ordinary file ' + p);
  return p;
}
const manifestBytes = read(path.join(report, 'baseline-hashes.json'));
if (hash(manifestBytes) !== 'c0a88cd082bb72ce6648c038b136183269c51f9475690b2110aae05a73c159df') fail('baseline manifest changed');
const items = JSON.parse(manifestBytes.toString('utf8'));
if (items.length !== 42 || new Set(items.map(i => i.path)).size !== 42) fail('expected 42 baseline paths');
if (!fs.lstatSync(fixture).isDirectory() || fs.lstatSync(fixture).isSymbolicLink() || norm(fs.realpathSync(fixture)) !== norm(path.join(report, 'rollback-fixture'))) fail('fixture directory changed');
const marker = JSON.parse(read(checkedFile(fixture, '.rollback-fixture-marker.json')).toString('utf8'));
if (marker.kind !== 'cat-mouse-replica-v2-rollback-fixture' || marker.fixtureOnly !== true || norm(marker.root) !== norm(fixture)) fail('fixture marker mismatch');
for (const item of items) {
  if (!/^[a-f0-9]{64}$/.test(item.sha256) || hash(read(checkedFile(baseline, item.path))) !== item.sha256) fail('baseline bytes changed ' + item.path);
}
const mode = process.argv[2];
if (process.argv.length !== 3) fail('expected one mode');
if (mode === '--refresh-current') {
  const snapshot = items.map(item => {
    const source = checkedFile(repo, item.path);
    const target = checkedFile(fixture, item.path);
    const bytes = read(source);
    return { ...item, source, target, bytes, currentSha256: hash(bytes) };
  });
  // All sources and destinations are validated above, before any fixture write.
  for (const item of snapshot) fs.writeFileSync(item.target, item.bytes);
  for (const item of snapshot) {
    if (hash(read(item.source)) !== item.currentSha256 || hash(read(item.target)) !== item.currentSha256) fail('live/snapshot changed ' + item.path);
  }
  const records = snapshot.map(item => ({ path: item.path, sha256: item.currentSha256, bytes: item.bytes.length, baselineSha256: item.sha256 }));
  fs.writeFileSync(path.join(report, 'rollback-current-hashes.json'), JSON.stringify(records, null, 2) + '\n');
  const reopened = JSON.parse(read(path.join(report, 'rollback-current-hashes.json')).toString('utf8'));
  if (JSON.stringify(reopened) !== JSON.stringify(records)) fail('current hash record reopen mismatch');
  console.log('ROLLBACK_FINAL_CURRENT_REFRESH managed=42 baselineValid=42 liveSame=42 fixtureSame=42 differentFromBaseline=' + records.filter(i => i.sha256 !== i.baselineSha256).length);
} else if (mode === '--verify-restored') {
  const current = JSON.parse(read(path.join(report, 'rollback-current-hashes.json')).toString('utf8'));
  const restored = JSON.parse(read(path.join(report, 'rollback-restored-hashes.json')).toString('utf8'));
  if (current.length !== 42 || restored.length !== 42 || new Set(current.map(i => i.path)).size !== 42 || new Set(restored.map(i => i.path)).size !== 42) fail('current/restored count mismatch');
  const records = items.map(item => {
    const before = current.find(i => i.path === item.path);
    const rollback = restored.find(i => i.path === item.path);
    if (!before || !rollback) fail('missing managed record ' + item.path);
    const liveSha256 = hash(read(checkedFile(repo, item.path)));
    const currentBackupSha256 = hash(read(checkedFile(path.join(fixture, 'current-before-rollback'), item.path)));
    const fixtureSha256 = hash(read(checkedFile(fixture, item.path)));
    const record = {
      path: item.path, currentSha256: before.sha256, liveSha256, currentBackupSha256,
      fixtureSha256, baselineSha256: item.sha256,
      livePreserved: liveSha256 === before.sha256,
      currentBackupMatches: currentBackupSha256 === before.sha256,
      fixtureRestored: fixtureSha256 === item.sha256,
      rollbackRecordMatches: rollback.currentSha256 === before.sha256 && rollback.restoredSha256 === fixtureSha256 && rollback.baselineSha256 === item.sha256
    };
    if (!record.livePreserved || !record.currentBackupMatches || !record.fixtureRestored || !record.rollbackRecordMatches) fail('byte proof mismatch ' + item.path);
    return record;
  });
  const home = read(checkedFile(fixture, 'pages/index/index.wxml')).toString('utf8');
  const map = read(checkedFile(fixture, 'pages/map/map.wxml')).toString('utf8');
  if (!home.includes('/assets/replica-v1/home-landscape.png') || home.includes('/assets/faithful-v2/')) fail('restored home reference mismatch');
  if (!/<image class="parkArt" src="\/assets\/replica-v1\/preview-park\.png" mode="scaleToFill"/.test(map)) fail('restored map mode mismatch');
  const tests = read(path.join(report, 'rollback-tests.txt')).toString('utf8');
  if (!/^# tests 26\r?$/m.test(tests) || !/^# pass 26\r?$/m.test(tests) || !/^# fail 0\r?$/m.test(tests) || !/^# EXIT_STATUS=0\r?$/m.test(tests)) fail('rollback tests did not pass 26/26');
  const scriptBytes = read(path.join(report, 'ROLLBACK.sh'));
  if (!scriptBytes.toString('utf8').startsWith('#!/usr/bin/env bash\n') || !scriptBytes.toString('utf8').includes(hash(manifestBytes))) fail('rollback script structure mismatch');
  const resultBytes = read(path.join(report, 'rollback-result.txt'));
  const result = resultBytes.toString('utf8');
  if (!result.includes('BASELINE_SHA_VALIDATED=42/42') || !result.includes('CURRENT_BYTES_PRESERVED=42/42') || !result.includes('ROLLBACK_RESTORED=42/42') || !result.includes('EXIT_STATUS=0') || result.split('\n').filter(line => line.startsWith('HASH ')).length !== 42) fail('result record mismatch');
  const proof = {
    status: 'VERIFIED', managedFiles: 42, baselineManifestSha256: hash(manifestBytes),
    baselineValid: 42, liveCurrentUnchanged: 42, currentBackupMatches: 42,
    fixtureRestored: 42, rollbackTests: { tests: 26, pass: 26, fail: 0, exitStatus: 0 },
    restoredHome: '/assets/replica-v1/home-landscape.png', restoredMapMode: 'scaleToFill',
    liveFilesWrittenByRollback: 0, deletedFiles: 0, rollbackScriptSha256: hash(scriptBytes),
    rollbackResultSha256: hash(resultBytes), rollbackTestsSha256: hash(Buffer.from(tests)), records
  };
  const output = path.join(report, 'rollback-live-backup-verification.json');
  fs.writeFileSync(output, JSON.stringify(proof, null, 2) + '\n');
  const reopened = JSON.parse(read(output).toString('utf8'));
  if (JSON.stringify(reopened) !== JSON.stringify(proof)) fail('verification artifact reopen mismatch');
  console.log('ROLLBACK_FINAL_PROOF baseline=42/42 liveCurrent=42/42 currentBackup=42/42 restored=42/42 tests=26/26 exit=0 home=replica-v1 map=scaleToFill');
} else fail('unknown mode ' + mode);
