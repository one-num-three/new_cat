// Explicit developer-tool fixtures only. Never feed these into game APIs.
function enabled(){try{const info=wx.getDeviceInfo?wx.getDeviceInfo():wx.getSystemInfoSync();return wx.getAccountInfoSync().miniProgram.envVersion==='develop'&&info.platform==='devtools';}catch{return false;}}
function get(id,mapId){if(!enabled()||mapId!=='seu-jiulonghu-v1')return null;const points={
 'jiulonghu-meiyuan7b':{lat:31.882368,lng:118.828049,label:'梅园7B附近 · 反馈坐标'},
 'jiulonghu-library':{lat:31.88777433108612,lng:118.81920737398848,label:'李文正图书馆'},
 // Saved OSM campus-boundary vertices converted to GCJ02; developer fixtures, not GPS samples.
 'jiulonghu-northwest':{lat:31.892569519589912,lng:118.81101082774053,label:'西北校界 · 参考点'},
 'jiulonghu-northeast':{lat:31.894127849461455,lng:118.82999843499006,label:'东北校界 · 参考点'},
 'jiulonghu-southeast':{lat:31.88143701609742,lng:118.83023008418435,label:'东南校界 · 参考点'},
 'jiulonghu-southwest':{lat:31.88003022694977,lng:118.81354645328248,label:'西南校界 · 参考点'},
 'jiulonghu-west':{lat:31.885355259089867,lng:118.81171560943383,label:'西侧校界 · 参考点'}
};const p=points[id];return p?{...p,accuracy:6,coordinateSystem:'gcj02',simulated:true}:null;}
module.exports={enabled,get};
