import { describe, it, expect } from 'vitest';
import { computePresetCaptureWindow } from '../../src/utils/presetCaptureTiming.js';

describe('presetCaptureTiming', () => {
  it('starts recording 0.5s before burst and snaps peak photo at least 2.0s after burst for aerial shell', () => {
    const win = computePresetCaptureWindow({
      type: 'sequence',
      preset: 'crysanthemum',
      burstHeight: 150,
      duration: 2.0,
      lifeMultiplier: 1.0
    });

    expect(win.isContinuousEmitter).toBe(false);
    expect(win.recordStartTime).toBeGreaterThan(0);
    expect(win.snapshotTime - win.recordStartTime).toBeGreaterThanOrEqual(2.5);
    expect(win.recordEndTime).toBeGreaterThan(win.snapshotTime);
    expect(win.recordEndTime - win.recordStartTime).toBeGreaterThanOrEqual(2.8);
    expect(win.recordEndTime - win.recordStartTime).toBeLessThanOrEqual(6.5);
  });

  it('starts recording at t=0 for continuous comet or instant burst', () => {
    const win = computePresetCaptureWindow({
      type: 'comet',
      preset: 'comet_single_beam',
      duration: 2.5
    });

    expect(win.isContinuousEmitter).toBe(true);
    expect(win.recordStartTime).toBe(0);
    expect(win.snapshotTime).toBeGreaterThan(0);
    expect(win.recordEndTime).toBeGreaterThan(win.snapshotTime);
  });

  it('delays snapshot slightly for second_burst or crossette shells', () => {
    const base = computePresetCaptureWindow({
      type: 'sequence',
      preset: 'peony',
      burstHeight: 140,
      duration: 2.0,
      lifeMultiplier: 1.0
    });
    const crossette = computePresetCaptureWindow({
      type: 'sequence',
      preset: 'crossette_ring',
      burstHeight: 140,
      duration: 2.0,
      lifeMultiplier: 1.0,
      effects: ['crossette']
    });

    expect(crossette.snapshotTime).toBeGreaterThan(base.snapshotTime);
  });
});
