// Invitation and capture codes have separate purposes. Never navigate to scanned URLs.
const INVITE='catmouse.room.v1',CAPTURE='catmouse.capture.v1';
const code=x=>typeof x==='string'&&/^[0-9A-F]{10}$/.test(x);
const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
function invite(roomCode){if(!code(roomCode))throw Error('INVALID_INVITE');return {kind:INVITE,code:roomCode};}
function launch(options){const c=options?.roomCode;return code(c)?c:'';}
function readInvite(result){let p;try{const raw=result?.result;if(typeof raw!=='string'||raw.length>1024)throw Error();p=JSON.parse(raw);}catch{throw Error('请扫描房间邀请二维码');}if(!p||p.kind!==INVITE||!code(p.code))throw Error('这不是房间邀请二维码');return p.code;}
function capture(proof){return {kind:CAPTURE,roomId:proof.roomId,matchId:proof.matchId,token:proof.token,expiresAt:proof.expiresAt};}
function readCapture(result,roomId,matchId){let p;try{const raw=result?.result;if(typeof raw!=='string'||raw.length>2048)throw Error();p=JSON.parse(raw);}catch{throw Error('请扫描鼠队动态抓捕码');}if(!p||p.kind!==undefined&&p.kind!==CAPTURE)throw Error('这不是动态抓捕码');if(!uuid(p.matchId)||typeof p.token!=='string'||!/^[A-Za-z0-9_-]{32}$/.test(p.token))throw Error('抓捕码无效');if(p.matchId!==matchId||p.roomId!==undefined&&p.roomId!==roomId)throw Error('抓捕码不属于当前对局');return {matchId:p.matchId,token:p.token};}
module.exports={INVITE,CAPTURE,invite,launch,readInvite,capture,readCapture,uuid};
