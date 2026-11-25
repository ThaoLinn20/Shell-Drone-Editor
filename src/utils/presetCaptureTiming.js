import { getFireworkLifespan } from './fireworkLifespan.js';

/**
 * Compute automated 480p video recording and peak-burst snapshot timestamps
 * for a single isolated firework event played from t = 0.
 *
 * @param {Object} event - Firework or comet timeline event
 * @returns {{
 *   warmUpStartTime: number,
 *   recordStartTime: number,
 *   snapshotTime: number,
 *   recordEndTime: number,
 *   burstAltitude: number,
 *   isContinuousEmitter: boolean
 * }}
 */
export function computePresetCaptureWindow(event = {}) {
  const isolatedEvent = {
    ...event,
    time: 0
  };

  const lifespan = getFireworkLifespan(isolatedEvent);
  const lifeMult = Math.max(
    0.2,
    Number(event.lifeMultiplier ?? event.effectOverrides?.lifeMultiplier ?? 1.0) || 1.0
  );

  const isContinuousEmitter = lifespan.liftTime <= 0.1;
  const preBurstLead = 0.5;

  const recordStartTime = isContinuousEmitter
    ? 0
    : Math.max(0, lifespan.burstStartTime - preBurstLead);

  const hasSecondBurst = Boolean(
    event.secondBurst ||
    event.effectOverrides?.secondBurst ||
    (Array.isArray(event.effects) && event.effects.includes('second_burst')) ||
    (Array.isArray(event.effects) && event.effects.includes('crossette')) ||
    event.dynamicsType === 'crossette'
  );

  const isWillow = Boolean(
    event.dynamicsType === 'willow' ||
    (typeof event.preset === 'string' && event.preset.includes('willow'))
  );

  let peakOffset;
  if (isContinuousEmitter) {
    peakOffset = Math.min(2.2, Math.max(1.5, lifespan.burstDuration * 0.7));
  } else if (hasSecondBurst) {
    peakOffset = Math.min(2.6, Math.max(2.15, 2.25 * lifeMult));
  } else if (isWillow) {
    peakOffset = Math.min(2.5, Math.max(2.05, 2.15 * lifeMult));
  } else {
    peakOffset = Math.min(2.4, Math.max(2.0, 2.0 * lifeMult));
  }

  const snapshotTime = isContinuousEmitter
    ? peakOffset
    : lifespan.burstStartTime + peakOffset;

  const rawFadeoutTail = Math.min(lifespan.fadeoutDuration, 2.2);
  const rawEndTime = Math.max(
    snapshotTime + 0.3,
    Math.min(
      lifespan.totalEndTime,
      lifespan.burstEndTime + rawFadeoutTail
    )
  );

  const minClipDuration = 2.8;
  const maxClipDuration = 6.5;
  const clampedDuration = Math.min(
    maxClipDuration,
    Math.max(minClipDuration, rawEndTime - recordStartTime)
  );
  const recordEndTime = recordStartTime + clampedDuration;

  let burstAltitude = 120;
  if (typeof event.burstHeight === 'number') {
    burstAltitude = Math.max(20, event.burstHeight);
  } else if (typeof event.ratioY === 'number') {
    burstAltitude = Math.max(20, 0.5 + event.ratioY * 299.5);
  } else if (isContinuousEmitter) {
    burstAltitude = 45;
  }

  return {
    warmUpStartTime: 0,
    recordStartTime: Number(recordStartTime.toFixed(3)),
    snapshotTime: Number(Math.min(recordEndTime - 0.1, snapshotTime).toFixed(3)),
    recordEndTime: Number(recordEndTime.toFixed(3)),
    burstAltitude: Number(burstAltitude.toFixed(1)),
    isContinuousEmitter
  };
}
