const {test}=require('node:test'),assert=require('node:assert/strict');
const {preset,targetFor,distance}=require('./rules');
test('pilot presets and quota stay fixed',()=>{
  assert.equal(preset(8).cats,2);assert.equal(preset(8).mice,6);assert.equal(targetFor(6),4);
  assert.equal(preset(9).cats,3);assert.equal(preset(12).cats,3);assert.equal(targetFor(9),6);
  assert.throws(()=>preset(2),/INVALID_PRESET/);assert.equal(preset(2,true).cats,1);
  assert.throws(()=>preset(8.5),/INVALID_PRESET/);
});
test('distance handles zero and same coordinate',()=>{
  assert.equal(distance({lat:0,lng:0},{lat:0,lng:0}),0);
  assert.ok(distance({lat:0,lng:0},{lat:0,lng:.001})>100);
});
