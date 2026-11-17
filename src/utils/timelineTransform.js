/**
 * Timeline Multi-Selection Transformation Utilities
 * Provides mathematical algorithms for distributing spacing, distributing start times,
 * and proportionally time-stretching clusters of timeline event blocks.
 */

/**
 * Helper to get the effective visual duration of an event.
 * @param {Object} event
 * @returns {number}
 */
export function getEventDuration(event) {
  if (!event) return 0;
  if (typeof event.uiDuration === 'number') {
    return event.uiDuration;
  }
  if (typeof event.duration === 'number') {
    return event.duration;
  }
  return 0;
}

/**
 * Distribute the idle gap evenly between adjacent events, keeping the first and last event fixed.
 * If total idle time is negative, gracefully falls back to distributing start times.
 *
 * @param {Array<Object>} events - Array of event block objects with time and duration
 * @returns {{ events: Array<Object>, modified: boolean, gap: number, fallbackStarts?: boolean }}
 */
export function distributeSpacing(events) {
  if (!Array.isArray(events) || events.length < 3) {
    return {
      events: events || [],
      modified: false,
      gap: 0
    };
  }

  // Sort by time ascending
  const sorted = [...events].sort((a, b) => (a.time || 0) - (b.time || 0));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan = (last.time || 0) - (first.time || 0);

  // Sum durations of all events except the last one
  let sumDurations = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    sumDurations += getEventDuration(sorted[i]);
  }

  const idleTime = totalSpan - sumDurations;
  const count = sorted.length;

  if (idleTime >= 0) {
    const gap = idleTime / (count - 1);
    for (let i = 1; i < count - 1; i++) {
      const prev = sorted[i - 1];
      const prevDur = getEventDuration(prev);
      const newTime = (prev.time || 0) + prevDur + gap;
      sorted[i].time = Math.round(newTime * 100) / 100;
    }
    return {
      events: sorted,
      modified: true,
      gap: Math.round(gap * 100) / 100
    };
  }

  // Fallback: If idleTime < 0, distribute start times evenly to avoid overlaps
  const step = totalSpan / (count - 1);
  for (let i = 1; i < count - 1; i++) {
    const newTime = (first.time || 0) + i * step;
    sorted[i].time = Math.round(newTime * 100) / 100;
  }

  return {
    events: sorted,
    modified: true,
    gap: 0,
    fallbackStarts: true
  };
}

/**
 * Distribute the start times of events evenly between the first and last event.
 *
 * @param {Array<Object>} events - Array of event block objects
 * @returns {{ events: Array<Object>, modified: boolean, step: number }}
 */
export function distributeStarts(events) {
  if (!Array.isArray(events) || events.length < 3) {
    return {
      events: events || [],
      modified: false,
      step: 0
    };
  }

  const sorted = [...events].sort((a, b) => (a.time || 0) - (b.time || 0));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const totalSpan = (last.time || 0) - (first.time || 0);
  const count = sorted.length;
  const step = totalSpan / (count - 1);

  for (let i = 1; i < count - 1; i++) {
    const newTime = (first.time || 0) + i * step;
    sorted[i].time = Math.round(newTime * 100) / 100;
  }

  return {
    events: sorted,
    modified: true,
    step: Math.round(step * 100) / 100
  };
}

/**
 * Proportionally stretches or compresses the relative spacing between events
 * anchoring from the earliest event's start time.
 *
 * @param {Array<Object>} events - Array of event block objects
 * @param {number} deltaSpan - Change in total span (in seconds)
 * @param {number} [anchorTime] - Optional anchor point in time (defaults to min event time)
 * @returns {{ events: Array<Object>, modified: boolean, scale: number }}
 */
export function stretchEvents(events, deltaSpan, anchorTime = null) {
  if (!Array.isArray(events) || events.length < 2) {
    return {
      events: events || [],
      modified: false,
      scale: 1
    };
  }

  const sorted = [...events].sort((a, b) => (a.time || 0) - (b.time || 0));
  const minTime = anchorTime !== null ? anchorTime : (sorted[0].time || 0);
  const maxTime = sorted[sorted.length - 1].time || 0;
  const origSpan = maxTime - minTime;

  if (origSpan <= 0.001) {
    return {
      events: sorted,
      modified: false,
      scale: 1
    };
  }

  const newSpan = Math.max(0.1, origSpan + deltaSpan);
  const scale = newSpan / origSpan;

  for (let i = 1; i < sorted.length; i++) {
    const baseTime = typeof sorted[i]._stretchInitialTime === 'number'
      ? sorted[i]._stretchInitialTime
      : (sorted[i].time || 0);
    const offset = baseTime - minTime;
    const newTime = minTime + offset * scale;
    sorted[i].time = Math.max(0, Math.round(newTime * 100) / 100);
  }

  return {
    events: sorted,
    modified: true,
    scale: Math.round(scale * 1000) / 1000
  };
}
