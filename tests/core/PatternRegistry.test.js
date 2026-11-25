import {
  describe,
  it,
  expect,
  beforeEach
} from 'vitest';
import { PatternRegistry } from '../../src/core/PatternRegistry.js';

describe('PatternRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new PatternRegistry();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('saves, renames, reloads, and deletes patterns using fallback storage', async () => {
    const saved = await registry.savePattern({
      name: 'Zigzag Sweep',
      points: [
        { x: 0.0, y: 0.2 },
        { x: 0.5, y: 0.8 },
        { x: 1.0, y: 0.2 }
      ],
      defaultShellCount: 14,
      mortarsLocked: false
    });

    expect(saved.slug).toBe('zigzag_sweep');
    expect(saved.points).toHaveLength(3);
    expect(saved.defaultShellCount).toBe(14);

    // Reload from fresh instance via storage fallback
    const freshRegistry = new PatternRegistry();
    freshRegistry.memoryFallback = registry.memoryFallback;
    const loaded = await freshRegistry.loadPatterns();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('Zigzag Sweep');

    // Rename
    const renamed = await registry.renamePattern('zigzag_sweep', 'Zigzag Pro');
    expect(renamed.name).toBe('Zigzag Pro');
    expect(registry.getPattern('zigzag_sweep').name).toBe('Zigzag Pro');

    // Delete
    await registry.deletePattern('zigzag_sweep');
    expect(registry.getAllPatterns()).toHaveLength(0);
  });

  it('auto-disambiguates duplicate names when saving new patterns without explicit slug', async () => {
    const first = await registry.savePattern({
      name: 'Fan Wave',
      points: [
        { x: 0, y: 0.3 },
        { x: 1, y: 0.7 }
      ]
    });
    const second = await registry.savePattern({
      name: 'Fan Wave',
      points: [
        { x: 0, y: 0.7 },
        { x: 1, y: 0.3 }
      ]
    });

    expect(first.slug).toBe('fan_wave');
    expect(second.slug).toBe('fan_wave_2');
    expect(registry.getAllPatterns()).toHaveLength(2);
  });
});
