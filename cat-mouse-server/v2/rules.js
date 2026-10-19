const RULES = Object.freeze({ version: 'pilot-0.2', hidingMs: 30000, chasingMs: 360000, intelMs: 30000, tokenMs: 15000, pauseBudgetMs: 60000 });
const catsFor = n => n <= 8 ? 2 : 3;
const targetFor = mice => Math.ceil(mice * .6);
function preset(n, localTest = false, teams) {
  if (teams !== undefined) {
    if (!Number.isInteger(n) || n < 2 || n > 60) throw new Error('INVALID_PRESET');
    const { cats, mice } = teams;
    if (!Number.isInteger(cats) || !Number.isInteger(mice) || cats < 1 || mice < 1 || cats + mice !== n) throw new Error('INVALID_TEAMS');
    return { ...RULES, version:'pilot-0.3', total:n, cats, mice };
  }
  if (!Number.isInteger(n) || !(n >= 6 && n <= 12 || localTest && n === 2)) throw new Error('INVALID_PRESET');
  return { total: n, cats: n === 2 ? 1 : catsFor(n), mice: n - (n === 2 ? 1 : catsFor(n)), ...RULES };
}
function distance(a, b) {
  const rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
module.exports = { RULES, preset, targetFor, distance };
