function shouldApply(current, next) {
  if (!next || !next.match) return false;
  if (!current) return true;
  if (next.version < current.version) return false;
  if (next.version === current.version && next.serverTime <= current.serverTime) return false;
  return true;
}
module.exports = { shouldApply };
