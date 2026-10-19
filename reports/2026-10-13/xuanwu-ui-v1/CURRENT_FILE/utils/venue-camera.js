// Display geometry only. The illustration has no geographic registration.
const SOURCE_WIDTH = 1154;
const SOURCE_HEIGHT = 1363;
const MIN_SCALE = 1;
const MAX_SCALE = 3;

function positiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clampScale(value) {
  return Number.isFinite(value) ? Math.max(MIN_SCALE, Math.min(MAX_SCALE, value)) : MIN_SCALE;
}

// One uniform fit factor preserves the entire source image, never a cover crop.
// x/y are the unscaled movable-view offsets within the measured viewport.
function fitContain(viewportWidth, viewportHeight, sourceWidth = SOURCE_WIDTH, sourceHeight = SOURCE_HEIGHT) {
  const empty = {valid:false, width:0, height:0, x:0, y:0, scale:MIN_SCALE};
  if (![viewportWidth, viewportHeight, sourceWidth, sourceHeight].every(positiveFinite)) return empty;
  const factor = Math.min(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
  const width = sourceWidth * factor;
  const height = sourceHeight * factor;
  if (![factor, width, height].every(positiveFinite)) return empty;
  return {valid:true, width, height, x:Math.max(0, (viewportWidth - width) / 2), y:Math.max(0, (viewportHeight - height) / 2), scale:MIN_SCALE};
}

module.exports = {SOURCE_WIDTH, SOURCE_HEIGHT, MIN_SCALE, MAX_SCALE, clampScale, fitContain};
