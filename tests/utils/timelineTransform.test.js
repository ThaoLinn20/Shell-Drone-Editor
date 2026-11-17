import { describe, it, expect } from 'vitest';
import {
  getEventDuration,
  distributeSpacing,
  distributeStarts,
  stretchEvents
} from '../../src/utils/timelineTransform.js';

describe('timelineTransform utilities', () => {
  describe('getEventDuration', () => {
    it('returns uiDuration when available', () => {
      expect(getEventDuration({ uiDuration: 2.5, duration: 1.0 })).toBe(2.5);
    });

    it('returns duration when uiDuration is undefined', () => {
      expect(getEventDuration({ duration: 1.2 })).toBe(1.2);
    });

    it('returns 0 for empty or invalid event', () => {
      expect(getEventDuration(null)).toBe(0);
      expect(getEventDuration({})).toBe(0);
    });
  });

  describe('distributeSpacing', () => {
    it('returns unmodified if events array has fewer than 3 items', () => {
      const single = [{ time: 1.0, duration: 0.5 }];
      const res = distributeSpacing(single);
      expect(res.modified).toBe(false);
      expect(res.events).toEqual(single);
    });

    it('evenly distributes idle spacing between 3 events with equal durations', () => {
      // Event 0 at 0.0s, dur 1.0s (ends at 1.0s)
      // Event 1 at 1.2s, dur 1.0s
      // Event 2 at 5.0s, dur 1.0s
      // Total span: 5.0 - 0.0 = 5.0s
      // Sum durations (first 2): 1.0 + 1.0 = 2.0s
      // Idle time: 5.0 - 2.0 = 3.0s
      // Gaps: 3.0 / 2 = 1.5s
      // Expected:
      // Event 0: time 0.0s
      // Event 1: 0.0 + 1.0 + 1.5 = 2.5s
      // Event 2: time 5.0s
      const events = [
        { id: 1, time: 0.0, duration: 1.0 },
        { id: 2, time: 1.2, duration: 1.0 },
        { id: 3, time: 5.0, duration: 1.0 }
      ];

      const res = distributeSpacing(events);
      expect(res.modified).toBe(true);
      expect(res.gap).toBe(1.5);
      expect(res.events[0].time).toBe(0.0);
      expect(res.events[1].time).toBe(2.5);
      expect(res.events[2].time).toBe(5.0);
    });

    it('evenly distributes idle spacing between 4 events with varying durations', () => {
      // E0: time 0.0, dur 0.5
      // E1: time 1.0, dur 1.0
      // E2: time 2.0, dur 1.5
      // E3: time 6.0, dur 0.5
      // Span: 6.0 - 0.0 = 6.0
      // Durations (E0, E1, E2): 0.5 + 1.0 + 1.5 = 3.0
      // Idle: 6.0 - 3.0 = 3.0
      // Gap: 3.0 / 3 = 1.0
      // E0: 0.0
      // E1: 0.0 + 0.5 + 1.0 = 1.5
      // E2: 1.5 + 1.0 + 1.0 = 3.5
      // E3: 6.0
      const events = [
        { id: 'a', time: 0.0, duration: 0.5 },
        { id: 'b', time: 1.0, duration: 1.0 },
        { id: 'c', time: 2.0, duration: 1.5 },
        { id: 'd', time: 6.0, duration: 0.5 }
      ];

      const res = distributeSpacing(events);
      expect(res.modified).toBe(true);
      expect(res.gap).toBe(1.0);
      expect(res.events[0].time).toBe(0.0);
      expect(res.events[1].time).toBe(1.5);
      expect(res.events[2].time).toBe(3.5);
      expect(res.events[3].time).toBe(6.0);
    });

    it('gracefully falls back to distribute start times if idle time is negative', () => {
      // Total span 2.0s, but sum durations is 3.0s (overlap)
      const events = [
        { id: 1, time: 0.0, duration: 2.0 },
        { id: 2, time: 0.5, duration: 2.0 },
        { id: 3, time: 2.0, duration: 2.0 }
      ];

      const res = distributeSpacing(events);
      expect(res.modified).toBe(true);
      expect(res.fallbackStarts).toBe(true);
      // Evenly distributed starts: 0.0, 1.0, 2.0
      expect(res.events[0].time).toBe(0.0);
      expect(res.events[1].time).toBe(1.0);
      expect(res.events[2].time).toBe(2.0);
    });
  });

  describe('distributeStarts', () => {
    it('returns unmodified if events array has fewer than 3 items', () => {
      const pair = [{ time: 1.0 }, { time: 2.0 }];
      const res = distributeStarts(pair);
      expect(res.modified).toBe(false);
    });

    it('evenly distributes start times between first and last', () => {
      const events = [
        { id: 1, time: 1.0 },
        { id: 2, time: 1.2 },
        { id: 3, time: 3.5 },
        { id: 4, time: 4.0 }
      ];

      // Span: 4.0 - 1.0 = 3.0
      // Step: 3.0 / 3 = 1.0
      // 1.0, 2.0, 3.0, 4.0
      const res = distributeStarts(events);
      expect(res.modified).toBe(true);
      expect(res.step).toBe(1.0);
      expect(res.events[0].time).toBe(1.0);
      expect(res.events[1].time).toBe(2.0);
      expect(res.events[2].time).toBe(3.0);
      expect(res.events[3].time).toBe(4.0);
    });
  });

  describe('stretchEvents', () => {
    it('returns unmodified if fewer than 2 items', () => {
      const single = [{ time: 1.0 }];
      const res = stretchEvents(single, 1.0);
      expect(res.modified).toBe(false);
    });

    it('proportionally expands events when deltaSpan is positive', () => {
      // E0: 2.0
      // E1: 3.0 (offset +1.0)
      // E2: 4.0 (offset +2.0, original span 2.0)
      // Delta: +2.0 => newSpan = 4.0 => scale = 2.0
      // E0: 2.0
      // E1: 2.0 + 1.0 * 2.0 = 4.0
      // E2: 2.0 + 2.0 * 2.0 = 6.0
      const events = [
        { id: 1, time: 2.0 },
        { id: 2, time: 3.0 },
        { id: 3, time: 4.0 }
      ];

      const res = stretchEvents(events, 2.0);
      expect(res.modified).toBe(true);
      expect(res.scale).toBe(2.0);
      expect(res.events[0].time).toBe(2.0);
      expect(res.events[1].time).toBe(4.0);
      expect(res.events[2].time).toBe(6.0);
    });

    it('proportionally compresses events when deltaSpan is negative', () => {
      // Original span: 4.0 - 0.0 = 4.0
      // Delta: -2.0 => newSpan = 2.0 => scale = 0.5
      const events = [
        { id: 1, time: 0.0 },
        { id: 2, time: 2.0 },
        { id: 3, time: 4.0 }
      ];

      const res = stretchEvents(events, -2.0);
      expect(res.modified).toBe(true);
      expect(res.scale).toBe(0.5);
      expect(res.events[0].time).toBe(0.0);
      expect(res.events[1].time).toBe(1.0);
      expect(res.events[2].time).toBe(2.0);
    });
  });
});
