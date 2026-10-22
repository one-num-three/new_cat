function shouldApply(current, next) {
  if (!next || !next.match) return false;
  return shouldApplyRoom(current,next);
}
function shouldApplyRoom(current,next) {
  if(!next||!Number.isFinite(next.version))return false;
  if (!current) return true;
  if(current.roomId&&next.roomId&&current.roomId!==next.roomId)return false;
  if (next.version < current.version) return false;
  if (next.version === current.version && (next.serverTime||0) <= (current.serverTime||0)) return false;
  return true;
}
module.exports = { shouldApply,shouldApplyRoom };
