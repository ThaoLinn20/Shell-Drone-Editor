/**
 * Firework Lifespan & Timeline Phasing Utility
 *
 * Calculates the 3-phase physical lifecycle of firework timeline blocks:
 * 1. Phase 1: Ascent / Flight time (t_lift) from launch trigger to apex burst
 * 2. Phase 2: Burst Window (burstDuration = event.duration) representing active flower bloom in the sky
 * 3. Phase 3: Decay / Fadeout time (t_fadeout) representing lingering burning stars before extinction
 *
 * All parameters are analytical and derived at runtime without altering stored show schemas.
 */

import { LAUNCH_ZONE_CONFIG } from '@shell-drone/firework-engine';

/**
 * Calculates the 3-phase lifespan for any firework event.
 *
 * @param {Object} event - Timeline sequence or single firework event object
 * @returns {{
 *   liftTime: number,
 *   burstDuration: number,
 *   fadeoutDuration: number,
 *   totalVisualDuration: number,
 *   burstStartTime: number,
 *   burstEndTime: number,
 *   totalEndTime: number
 * }}
 */
export function getFireworkLifespan(event = {}) {
  const launchTime = Number(event.time) || 0;
  const rawDuration = (event.duration !== undefined && !isNaN(Number(event.duration)))
    ? Number(event.duration)
    : 2.0;
  let burstDuration = Math.max(0.1, rawDuration);

  // 1. Instant Burst (mines, ground shells, bouquets)
  const isInstant = Boolean(
    event.instantBurst ||
    (event.effectOverrides && event.effectOverrides.instantBurst) ||
    (Array.isArray(event.effects) && event.effects.includes('instantBurst')) ||
    (event.preset && typeof event.preset === 'object' && event.preset.instantBurst)
  );

  // 2. Comet / no-burst
  const isComet = Boolean(
    event.isComet ||
    event.type === 'comet' ||
    event.type === 'cometsequence' ||
    (typeof event.preset === 'string' && (event.preset === 'comet' || event.preset.startsWith('comet_'))) ||
    (event.preset && typeof event.preset === 'object' && (event.preset.isComet || event.preset.type === 'comet' || event.preset.noBurst)) ||
    event.noBurst ||
    (Array.isArray(event.effects) && event.effects.includes('no-burst')) ||
    (event.effectOverrides && event.effectOverrides.noBurst)
  );

  let liftTime = 0;

  // Check if event is a wave curve or has custom wavePoints
  const hasWavePoints = (
    event.pattern === 'sweep-custom-curve' ||
    event.pattern === 'sweep-wave' ||
    (Array.isArray(event.wavePoints) && event.wavePoints.length > 0)
  ) && Array.isArray(event.wavePoints) && event.wavePoints.length > 0;

  if (!isInstant && !isComet) {
    const gravity = 30; // abs(FIREWORK_CONFIG.GRAVITY) = 30 m/s^2
    const minBurstY = LAUNCH_ZONE_CONFIG.minBurstY ?? 0.5;
    const randomMinBurstY = LAUNCH_ZONE_CONFIG.randomMinBurstY ?? 75;
    const maxBurstY = LAUNCH_ZONE_CONFIG.maxBurstY ?? 300;
    const groundY = LAUNCH_ZONE_CONFIG.center?.y ?? 0.5;

    const calculateLiftTimeForHeight = (height) => {
      const h = Math.max(height - groundY, 0);
      return h > 0 ? 0.8190025 * Math.sqrt((2 * h) / gravity) : 0;
    };

    if (hasWavePoints) {
      const count = Math.max(1, Number(event.count) || event.wavePoints.length);
      const wavePoints = event.wavePoints;
      let minBurstTime = Infinity;
      let maxBurstTime = -Infinity;

      for (let i = 0; i < count; i++) {
        const progress = count > 1 ? i / (count - 1) : 0;
        let delay = progress * rawDuration;

        let ptY = 0.5;
        if (wavePoints.length === count && wavePoints[i]) {
          ptY = Number.isFinite(wavePoints[i].y) ? wavePoints[i].y : 0.5;
          if (Number.isFinite(wavePoints[i].delay)) {
            delay = wavePoints[i].delay;
          }
        } else {
          const evalPt = wavePoints[Math.min(i, wavePoints.length - 1)];
          ptY = Number.isFinite(evalPt?.y) ? evalPt.y : 0.5;
        }

        const burstHeight_i = Math.max(minBurstY, minBurstY + ptY * (maxBurstY - minBurstY));
        const liftTime_i = calculateLiftTimeForHeight(burstHeight_i);
        const burstMoment_i = delay + liftTime_i;

        if (burstMoment_i < minBurstTime) minBurstTime = burstMoment_i;
        if (burstMoment_i > maxBurstTime) maxBurstTime = burstMoment_i;
      }

      if (!Number.isFinite(minBurstTime)) minBurstTime = 2.75;
      if (!Number.isFinite(maxBurstTime)) maxBurstTime = minBurstTime + rawDuration;

      liftTime = Math.round(minBurstTime * 100) / 100;
      burstDuration = count > 1
        ? Math.round(Math.max(0.1, maxBurstTime - minBurstTime) * 100) / 100
        : Math.max(0.1, rawDuration);
    } else {
      let burstHeight;
      if (typeof event.burstHeight === 'number') {
        burstHeight = Math.max(minBurstY, event.burstHeight);
      } else if (typeof event.ratioY === 'number') {
        burstHeight = Math.max(minBurstY, minBurstY + event.ratioY * (maxBurstY - minBurstY));
      } else {
        const presetSize = Math.max(
          1,
          Math.min(
            6,
            event.shellSize || (event.preset && typeof event.preset === 'object' && event.preset.shellSize) || 1
          )
        );
        const sizeT = (presetSize - 1) / 5;
        burstHeight = randomMinBurstY + (0.42 + sizeT * 0.32) * (maxBurstY - randomMinBurstY);
      }

      liftTime = Math.round(calculateLiftTimeForHeight(burstHeight) * 100) / 100;
    }
  }

  // 3. Fadeout / Decay duration (star life)
  let fadeoutDuration = 0;
  if (isComet) {
    fadeoutDuration = 0.2;
  } else if (isInstant) {
    fadeoutDuration = 1.2;
  } else {
    const starLife = event.starLife ||
      (event.preset && typeof event.preset === 'object' && event.preset.starLife) ||
      2200;
    const starLifeMultiplier = event.starLifeMultiplier ||
      (event.preset && typeof event.preset === 'object' && event.preset.starLifeMultiplier) ||
      1.0;
    fadeoutDuration = Math.round(((starLife * starLifeMultiplier) / 1000) * 100) / 100;
  }

  const totalVisualDuration = Math.round((liftTime + burstDuration + fadeoutDuration) * 100) / 100;
  const burstStartTime = Math.round((launchTime + liftTime) * 100) / 100;
  const burstEndTime = Math.round((burstStartTime + burstDuration) * 100) / 100;
  const totalEndTime = Math.round((launchTime + totalVisualDuration) * 100) / 100;

  return {
    liftTime,
    burstDuration,
    fadeoutDuration,
    totalVisualDuration,
    burstStartTime,
    burstEndTime,
    totalEndTime
  };
}

/**
 * Checks if an event is a firework event that should be rendered with 3-phase lifecycle.
 *
 * @param {Object} event
 * @returns {boolean}
 */
export function isFireworkLifecycleEvent(event) {
  if (!event || event._deleted) {
    return false;
  }
  const type = event.type;
  return type === 'sequence' || type === 'single' || type === 'cometsequence' || type === 'finale';
}
