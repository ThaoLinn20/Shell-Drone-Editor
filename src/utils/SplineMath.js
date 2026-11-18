/**
 * SplineMath.js
 * Utility for smooth interpolation of custom wave curves, launch positions, and control points.
 */

export const DEFAULT_WAVE_POINTS = [
  { x: 0.0, y: 0.35, launchX: 0.12, angle: 0.28 },
  { x: 0.5, y: 0.88, launchX: 0.50, angle: 0.0 },
  { x: 1.0, y: 0.35, launchX: 0.88, angle: -0.28 }
];

/**
 * Calculates deflection angle (in radians) from launch base to burst apex.
 * @param {number} launchX Normalized mortar position (0..1)
 * @param {number} burstX Normalized apex burst position (0..1)
 * @param {number} burstY Normalized apex burst height (0..1)
 * @returns {number} Angle in radians (-80 deg to +80 deg)
 */
export function angleFromTrajectory(launchX, burstX, burstY) {
  const safeY = Math.max(0.05, burstY);
  const deltaX = (burstX - launchX) * 1.25;
  const rawAngle = Math.atan2(deltaX, safeY);
  const maxLimitRad = 80 * Math.PI / 180;
  return Math.max(-maxLimitRad, Math.min(maxLimitRad, rawAngle));
}

/**
 * Calculates launch base X position from burst apex and firing angle.
 * @param {number} burstX Normalized apex burst position (0..1)
 * @param {number} burstY Normalized apex burst height (0..1)
 * @param {number} angle Angle in radians
 * @returns {number} Normalized launch base X (0..1)
 */
export function launchXFromAngle(burstX, burstY, angle) {
  const safeY = Math.max(0.05, burstY);
  const safeAngle = Math.max(-80 * Math.PI / 180, Math.min(80 * Math.PI / 180, angle || 0));
  const deltaX = (safeY * Math.tan(safeAngle)) / 1.25;
  return Math.max(0.0, Math.min(1.0, burstX - deltaX));
}

/**
 * Normalizes, validates, and sorts wave control points along the X axis.
 * Supports dual-anchor points with launchX, burst apex (x, y), angle, and delay.
 * 
 * @param {Array<{x: number, y: number, launchX?: number, angle?: number, delay?: number}>} points 
 * @returns {Array<{x: number, y: number, launchX: number, angle: number, delay?: number}>}
 */
export function sanitizeWavePoints(points) {
  if (!Array.isArray(points) || points.length === 0) {
    return DEFAULT_WAVE_POINTS.map((p) => ({ ...p }));
  }

  const cleaned = points.map((p, idx) => {
    const x = Math.max(0.0, Math.min(1.0, Number.isFinite(p?.x) ? p.x : idx / Math.max(1, points.length - 1)));
    const y = Math.max(0.05, Math.min(1.0, Number.isFinite(p?.y) ? p.y : 0.5));

    let launchX;
    let angle;

    if (Number.isFinite(p?.launchX)) {
      launchX = Math.max(0.0, Math.min(1.0, p.launchX));
      angle = Number.isFinite(p?.angle) ? p.angle : angleFromTrajectory(launchX, x, y);
    } else if (Number.isFinite(p?.angle)) {
      angle = p.angle;
      launchX = launchXFromAngle(x, y, angle);
    } else {
      launchX = x;
      angle = 0.0;
    }

    const item = {
      x,
      y,
      launchX,
      angle: Number.isFinite(angle) ? angle : 0.0
    };

    if (Number.isFinite(p?.delay)) {
      item.delay = Math.max(0.0, p.delay);
    }

    return item;
  });

  // Ensure sorted by x
  cleaned.sort((a, b) => a.x - b.x);

  // Handle single-point edge case
  if (cleaned.length === 1) {
    cleaned = [
      { ...cleaned[0], x: 0.0 },
      { ...cleaned[0], x: 1.0 }
    ];
  }

  return cleaned;
}

/**
 * Smooth Hermite / Catmull-Rom cubic interpolation between two values.
 */
function cubicHermite(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 * (
      (2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    )
  );
}

/**
 * Evaluates the wave curve at normalized parameter t in [0, 1].
 * Returns { x, y, launchX, angle } at parameter t.
 * @param {Array<{x: number, y: number, launchX?: number, angle?: number}>} controlPoints 
 * @param {number} t Progress along the sequence (0.0 to 1.0)
 * @returns {{x: number, y: number, launchX: number, angle: number}}
 */
export function evaluateWaveCurve(controlPoints, t) {
  const points = sanitizeWavePoints(controlPoints);
  const clampedT = Math.max(0.0, Math.min(1.0, t));

  const startX = points[0].x;
  const endX = points[points.length - 1].x;
  const targetX = startX + clampedT * (endX - startX);

  // Find the segment [i, i+1] where points[i].x <= targetX <= points[i+1].x
  let segIdx = 0;
  for (let i = 0; i < points.length - 1; i++) {
    if (targetX >= points[i].x && targetX <= points[i + 1].x) {
      segIdx = i;
      break;
    }
  }

  const p1 = points[segIdx];
  const p2 = points[segIdx + 1];
  const p0 = segIdx > 0 ? points[segIdx - 1] : {
    x: p1.x - (p2.x - p1.x),
    y: p1.y - (p2.y - p1.y),
    launchX: p1.launchX - (p2.launchX - p1.launchX),
    angle: p1.angle
  };
  const p3 = segIdx + 2 < points.length ? points[segIdx + 2] : {
    x: p2.x + (p2.x - p1.x),
    y: p2.y + (p2.y - p1.y),
    launchX: p2.launchX + (p2.launchX - p1.launchX),
    angle: p2.angle
  };

  const segRange = p2.x - p1.x;
  const localT = segRange > 1e-6 ? (targetX - p1.x) / segRange : 0.0;
  const smoothT = Math.max(0.0, Math.min(1.0, localT));

  const yRaw = cubicHermite(p0.y, p1.y, p2.y, p3.y, smoothT);
  const launchXRaw = cubicHermite(p0.launchX, p1.launchX, p2.launchX, p3.launchX, smoothT);
  const angleRaw = cubicHermite(p0.angle, p1.angle, p2.angle, p3.angle, smoothT);

  return {
    x: targetX,
    y: Math.max(0.05, Math.min(1.0, yRaw)),
    launchX: Math.max(0.0, Math.min(1.0, launchXRaw)),
    angle: angleRaw
  };
}

/**
 * Resamples a wave curve so that the number of control points matches shellCount.
 * Guarantees a direct 1-to-1 correspondence between vertices and individual shells.
 * @param {Array} controlPoints
 * @param {number} targetCount
 * @returns {Array<{x: number, y: number, launchX: number, angle: number}>}
 */
export function resampleWavePoints(controlPoints, targetCount) {
  const count = Math.max(2, targetCount || 2);
  const sanitized = sanitizeWavePoints(controlPoints);

  if (sanitized.length === count) {
    return sanitized.map((p) => ({
      x: Number(p.x.toFixed(3)),
      y: Number(p.y.toFixed(3)),
      launchX: Number((p.launchX ?? p.x).toFixed(3)),
      angle: Number(p.angle.toFixed(3))
    }));
  }

  const resampled = [];
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const evalPt = evaluateWaveCurve(sanitized, t);
    resampled.push({
      x: Number(evalPt.x.toFixed(3)),
      y: Number(evalPt.y.toFixed(3)),
      launchX: Number((evalPt.launchX ?? evalPt.x).toFixed(3)),
      angle: Number(evalPt.angle.toFixed(3))
    });
  }
  return resampled;
}

/**
 * Generates an array of points for a preset pattern matching the exact shell count.
 * @param {'arch' | 'double_peak' | 'wave' | 'slope' | 'v_shape' | 'criss_cross'} presetType 
 * @param {number} count 
 * @returns {Array<{x: number, y: number, launchX: number, angle: number}>}
 */
export function generateWavePreset(presetType, count) {
  const n = Math.max(2, count || 12);
  const points = [];

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = t;
    let y = 0.5;
    let launchX = t;

    switch (presetType) {
      case 'arch': {
        y = 0.35 + 0.53 * Math.sin(t * Math.PI);
        launchX = 0.15 + t * 0.70;
        break;
      }
      case 'double_peak': {
        y = 0.35 + 0.50 * Math.pow(Math.sin(t * Math.PI * 2), 2);
        launchX = 0.10 + t * 0.80;
        break;
      }
      case 'wave': {
        y = 0.50 + 0.35 * Math.sin(t * Math.PI * 2.5);
        launchX = 0.10 + t * 0.80;
        break;
      }
      case 'slope': {
        y = 0.25 + 0.65 * t;
        launchX = 0.10 + t * 0.80;
        break;
      }
      case 'v_shape': {
        const distFromCenter = Math.abs(t - 0.5) * 2;
        y = 0.25 + 0.60 * distFromCenter;
        launchX = 0.45 + (t - 0.5) * 0.20;
        break;
      }
      case 'criss_cross': {
        y = 0.75 + 0.05 * Math.sin(t * Math.PI);
        launchX = 1.0 - t;
        break;
      }
      default: {
        y = 0.35 + 0.53 * Math.sin(t * Math.PI);
        launchX = t;
      }
    }

    y = Math.max(0.05, Math.min(1.0, y));
    launchX = Math.max(0.0, Math.min(1.0, launchX));
    const angle = angleFromTrajectory(launchX, x, y);

    points.push({
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      launchX: Number(launchX.toFixed(3)),
      angle: Number(angle.toFixed(3))
    });
  }

  return points;
}
