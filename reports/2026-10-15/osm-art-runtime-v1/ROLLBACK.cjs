'use strict';
// Disable only the OSM display fallback. Preserve room calibration, native map,
// concurrency fixes, user artwork and all other uncommitted work.
const fs=require('node:fs'),path=require('node:path');
const arg=process.argv.indexOf('--config'),target=arg>=0?path.resolve(process.argv[arg+1]):path.resolve(__dirname,'../../../utils/venue-art-config.js');
const current=fs.readFileSync(target,'utf8');
if(!/osmReferenceEnabled\s*:\s*(true|false)/.test(current))throw Error('Expected explicit OSM reference flag; no write');
const next=current.replace(/osmReferenceEnabled\s*:\s*true/,'osmReferenceEnabled:false');
fs.writeFileSync(target,next);console.log('PASS OSM reference disabled: '+target);
