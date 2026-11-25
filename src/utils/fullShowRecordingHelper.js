import { getFireworkLifespan } from './fireworkLifespan.js';

export const FULL_SHOW_QUALITY_PRESETS = {
  '1080p': {
    key: '1080p',
    label: '1080p 60fps',
    width: 1920,
    height: 1080,
    fps: 60,
    bitrate: 18000000
  },
  '2k': {
    key: '2k',
    label: '2K 60fps',
    width: 2560,
    height: 1440,
    fps: 60,
    bitrate: 28000000
  },
  '4k': {
    key: '4k',
    label: '4K 60fps',
    width: 3840,
    height: 2160,
    fps: 60,
    bitrate: 45000000
  }
};

/**
 * Resolve quality preset configuration by key, defaulting to 1080p 60fps.
 * @param {string} key
 */
export function getFullShowQualityPreset(key = '1080p') {
  return FULL_SHOW_QUALITY_PRESETS[key] || FULL_SHOW_QUALITY_PRESETS['1080p'];
}

/**
 * Calculate total playback duration in seconds for a timeline scriptConfig
 * so full-show recording knows when to stop automatically.
 *
 * @param {Array<Object>} scriptConfig
 * @param {number} tailMarginSec
 * @returns {number}
 */
export function computeShowEndTime(scriptConfig = [], tailMarginSec = 1.5) {
  if (!Array.isArray(scriptConfig) || scriptConfig.length === 0) {
    return 5.0;
  }

  let maxEnd = 0;

  const visit = (item, parentTime = 0) => {
    if (!item || item._deleted) return;

    const absTime = item.time !== undefined
      ? (Number(item.time) || 0)
      : parentTime + (Number(item.timeOffset) || 0);

    if (item.type === 'group' && Array.isArray(item.children)) {
      item.children.forEach((child) => visit(child, absTime));
      return;
    }

    if (item.type === 'audio' || item.type === 'droneshow') {
      const dur = Math.max(0, Number(item.duration) || 0);
      maxEnd = Math.max(maxEnd, absTime + dur);
      return;
    }

    const lifespan = getFireworkLifespan({
      ...item,
      time: absTime
    });
    maxEnd = Math.max(maxEnd, lifespan.totalEndTime);
  };

  scriptConfig.forEach((evt) => visit(evt, 0));

  return Number(Math.max(2.0, maxEnd + tailMarginSec).toFixed(2));
}
