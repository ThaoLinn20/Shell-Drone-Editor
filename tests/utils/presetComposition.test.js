import { describe, it, expect } from 'vitest';
import {
  extractPresetComposition,
  applyPresetComposition
} from '../../src/utils/presetComposition.js';

describe('presetComposition round-trip and backward compatibility', () => {
  it('preserves all effects, terminalFlare, cascade/ring params, shellSize, and cometTrail in extract + apply', () => {
    const sourceEvent = {
      time: 53.9,
      type: 'sequence',
      pattern: 'sweep-custom-curve',
      count: 10,
      preset: 'crysanthemum',
      shapeType: 'sphere_rings',
      dynamicsType: 'crysanthemum-trail',
      instantBurst: false,
      effects: [
        { id: 'no-trail_ttaqk', type: 'no-trail', startRatio: 0, endRatio: 1, start: 0, end: 3.1 },
        { id: 'crossette_4yq8i', type: 'crossette', startRatio: 0.6, endRatio: 1, start: 1.86, end: 3.1 },
        'burst-smoke'
      ],
      cometTrail: 'none',
      color: 'red',
      terminalFlare: true,
      terminalFlareColor: '#ffd700',
      terminalFlareTriggerRatio: 0.79,
      terminalFlareSizeMultiplier: 1.55,
      starLifeMultiplier: 1.35,
      shellSize: 1.5,
      particleCountMultiplier: 1,
      pistil: false,
      burstSmoke: true,
      'burst-smoke': true,
      ringCount: 13,
      cascadeDuration: 1.3,
      cascadeRings: 12,
      cascadeMode: 'clockwise',
      _deleted: false,
      _waveformPeaks: [0.1, 0.2]
    };

    const composition = extractPresetComposition(sourceEvent);
    expect(composition.shellSize).toBe(1.5);
    expect(composition.terminalFlare).toBe(true);
    expect(composition.terminalFlareColor).toBe('#ffd700');
    expect(composition.terminalFlareTriggerRatio).toBe(0.79);
    expect(composition.terminalFlareSizeMultiplier).toBe(1.55);
    expect(composition.ringCount).toBe(13);
    expect(composition.cascadeRings).toBe(12);
    expect(composition.cascadeDuration).toBe(1.3);
    expect(composition.cascadeMode).toBe('clockwise');
    expect(composition.cometTrail).toBe('none');
    expect(composition.burstSmoke).toBe(true);
    expect(composition.effects).toHaveLength(3);
    expect(composition._deleted).toBeUndefined();
    expect(composition._waveformPeaks).toBeUndefined();

    const dirtyTarget = {
      time: 10,
      type: 'sequence',
      duration: 2.0,
      preset: 'old_preset',
      apexHang: true,
      slowBurst: true,
      secondBurst: { enabled: true, childShells: [{ preset: 'ring' }] },
      stages: [{ shape: 'heart' }]
    };

    applyPresetComposition(dirtyTarget, { id: 'custom_1', composition });
    expect(dirtyTarget.time).toBe(10);
    expect(dirtyTarget.duration).toBe(2.0);
    expect(dirtyTarget.shellSize).toBe(1.5);
    expect(dirtyTarget.terminalFlare).toBe(true);
    expect(dirtyTarget.cascadeMode).toBe('clockwise');
    expect(dirtyTarget.ringCount).toBe(13);
    expect(dirtyTarget.apexHang).toBeUndefined();
    expect(dirtyTarget.slowBurst).toBeUndefined();
    expect(dirtyTarget.secondBurst).toBeUndefined();

    // Mutating target effects must not mutate preset composition
    dirtyTarget.effects[0].startRatio = 0.5;
    expect(composition.effects[0].startRatio).toBe(0);
  });

  it('supports cometsequence and legacy scale fallback', () => {
    const legacyPreset = {
      id: 'legacy_comet',
      composition: {
        eventType: 'cometsequence',
        shapeType: 'sphere',
        dynamicsType: 'crysanthemum-trail',
        color: '#00ffff',
        scale: 2.25,
        cometTrail: 'ascent-bursts',
        ascentSubShellType: 'strobe',
        ascentBurstCount: 5
      }
    };

    const target = {
      time: 5,
      type: 'cometsequence',
      duration: 2
    };
    applyPresetComposition(target, legacyPreset);
    expect(target.shellSize).toBe(2.25);
    expect(target.cometTrail).toBe('ascent-bursts');
    expect(target.ascentSubShellType).toBe('strobe');
    expect(target.ascentBurstCount).toBe(5);
  });
});
