import { describe, it, expect } from 'vitest';
import {
  computeShowEndTime,
  getFullShowQualityPreset
} from '../../src/utils/fullShowRecordingHelper.js';

describe('fullShowRecordingHelper', () => {
  it('returns 1080p 60fps as default quality preset and supports 2k and 4k', () => {
    const p1080 = getFullShowQualityPreset('1080p');
    const p2k = getFullShowQualityPreset('2k');
    const p4k = getFullShowQualityPreset('4k');

    expect(p1080.width).toBe(1920);
    expect(p1080.height).toBe(1080);
    expect(p1080.fps).toBe(60);
    expect(p2k.width).toBe(2560);
    expect(p4k.width).toBe(3840);
    expect(getFullShowQualityPreset('unknown')).toEqual(p1080);
  });

  it('computes total show end time across audio, group, and firework events', () => {
    const end = computeShowEndTime([
      {
        type: 'audio',
        time: 0,
        duration: 12
      },
      {
        type: 'group',
        time: 10,
        children: [
          {
            type: 'sequence',
            timeOffset: 5,
            duration: 2,
            burstHeight: 150
          }
        ]
      }
    ]);

    expect(end).toBeGreaterThan(17);
  });
});
