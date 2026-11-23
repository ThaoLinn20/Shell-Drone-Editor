import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresetRegistry } from '../../src/core/PresetRegistry.js';

describe('PresetRegistry', () => {
  let registry;

  beforeEach(() => {
    registry = new PresetRegistry();
  });

  it('initializes and merges built-in presets with empty custom presets by default', () => {
    const list = registry.getAllPresets();
    expect(list.length).toBeGreaterThan(0);
    const first = list[0];
    expect(first.isBuiltin).toBe(true);
    expect(first.isCustom).toBe(false);
  });

  it('allows adding and saving custom presets in fallback mode', async () => {
    const payload = {
      name: 'Super Peony',
      category: 'shell',
      tags: ['bright', 'red'],
      summary: 'Custom bright red peony',
      composition: {
        shape: 'sphere',
        dynamics: 'standard',
        color: '#ff0000'
      }
    };

    const res = await registry.savePreset(payload);
    expect(res.success).toBe(true);
    expect(res.slug).toBe('super_peony');

    const found = registry.getPreset('super_peony');
    expect(found).toBeDefined();
    expect(found.name).toBe('Super Peony');
    expect(found.isCustom).toBe(true);
  });

  it('overrides built-in preset metadata when slug matches an existing preset', () => {
    registry.customPresets = [
      {
        slug: 'crysanthemum_uniform_sphere',
        id: 'crysanthemum_uniform_sphere',
        name: 'My Custom Chrysanthemum',
        summary: 'Overridden description',
        bannerUrl: 'app-asset://presets/crysanthemum_uniform_sphere/custom_banner.png',
        hasBanner: true,
        hasVideo: false
      }
    ];

    registry.rebuildMergedList();
    const preset = registry.getPreset('crysanthemum_uniform_sphere');
    expect(preset).toBeDefined();
    expect(preset.name).toBe('My Custom Chrysanthemum');
    expect(preset.summary).toBe('Overridden description');
    expect(preset.bannerUrl).toBe('app-asset://presets/crysanthemum_uniform_sphere/custom_banner.png');
    expect(preset.isOverridden).toBe(true);
  });

  it('deletes custom preset successfully', async () => {
    await registry.savePreset({
      name: 'To Delete',
      category: 'shell'
    });
    expect(registry.getPreset('to_delete')).toBeDefined();

    await registry.deletePreset('to_delete');
    expect(registry.getPreset('to_delete')).toBeNull();
  });

  it('notifies subscribers on registry change', async () => {
    const listener = vi.fn();
    const unsub = registry.subscribe(listener);

    await registry.savePreset({
      name: 'Notify Test'
    });
    expect(listener).toHaveBeenCalled();
    unsub();
  });
});
