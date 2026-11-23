import {
  EFFECT_PREVIEW_METADATA,
  PREVIEW_CATEGORIES
} from '../config/effectPreviews.js';

export class PresetRegistry {
  constructor() {
    this.customPresets = [];
    this.mergedPresets = [];
    this.listeners = new Set();
    this.isLoaded = false;
  }

  /**
   * Subscribe to registry updates.
   * @param {Function} cb
   * @returns {Function} unsubscribe function
   */
  subscribe(cb) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getAllPresets());
      } catch (err) {
        console.error('Error in PresetRegistry listener:', err);
      }
    }
  }

  /**
   * Load presets from built-in metadata and Electron storage.
   */
  async loadPresets() {
    let scanned = [];
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.scanPresets === 'function') {
      try {
        scanned = await window.electronAPI.scanPresets();
      } catch (err) {
        console.warn('Failed to scan presets from electronAPI:', err);
      }
    }

    this.customPresets = Array.isArray(scanned) ? scanned : [];
    this.rebuildMergedList();
    this.isLoaded = true;
    this.notify();
    return this.getAllPresets();
  }

  /**
   * Rebuild the merged list of built-in presets and custom presets.
   */
  rebuildMergedList() {
    const list = [];
    const customMap = new Map();

    for (const cp of this.customPresets) {
      customMap.set(cp.slug || cp.id, cp);
    }

    // 1. Ingest built-in presets from EFFECT_PREVIEW_METADATA (presets category)
    if (EFFECT_PREVIEW_METADATA) {
      for (const [key, meta] of Object.entries(EFFECT_PREVIEW_METADATA)) {
        if (meta.category === PREVIEW_CATEGORIES.PRESET) {
          // Skip legacy hyphenated alias if canonical snake_case preset exists
          if (key.includes('-') && EFFECT_PREVIEW_METADATA[key.replace(/-/g, '_')]) {
            continue;
          }
          const override = customMap.get(key);
          const bannerUrl = override?.bannerUrl ||
            meta.bannerUrl ||
            (meta.videoUrl ? meta.videoUrl.replace(/\.mp4$/i, '.jpg') : null);
          const videoUrl = override?.videoUrl || meta.videoUrl || null;
          list.push({
            id: key,
            slug: key,
            name: override?.name || meta.name || key,
            category: override?.category || 'preset',
            tags: override?.tags || meta.tags || [],
            summary: override?.summary || meta.summary || '',
            bannerUrl,
            videoUrl,
            hasBanner: Boolean(override?.hasBanner || bannerUrl),
            hasVideo: Boolean(override?.hasVideo || videoUrl),
            isBuiltin: true,
            isCustom: false,
            isOverridden: Boolean(override),
            updatedAt: override?.updatedAt || null
          });
          // Remove from map so we know which ones are purely custom
          customMap.delete(key);
        }
      }
    }

    // 2. Remaining items in customMap are user-created custom presets
    for (const cp of customMap.values()) {
      list.push({
        id: cp.slug || cp.id,
        slug: cp.slug || cp.id,
        name: cp.name || cp.slug,
        category: cp.category || 'custom',
        tags: cp.tags || [],
        summary: cp.summary || '',
        composition: cp.composition || null,
        bannerUrl: cp.bannerUrl || null,
        videoUrl: cp.videoUrl || null,
        hasBanner: Boolean(cp.hasBanner),
        hasVideo: Boolean(cp.hasVideo),
        isBuiltin: false,
        isCustom: true,
        isOverridden: false,
        updatedAt: cp.updatedAt || null
      });
    }

    list.sort((a, b) => a.name.localeCompare(b.name));
    this.mergedPresets = list;
  }

  /**
   * Get all active presets (merged).
   */
  getAllPresets() {
    if (!this.isLoaded) {
      this.rebuildMergedList();
    }
    return this.mergedPresets;
  }

  /**
   * Find a preset by ID or slug.
   */
  getPreset(id) {
    return this.getAllPresets().find((p) => p.id === id || p.slug === id) || null;
  }

  /**
   * Save or update a preset.
   */
  async savePreset(payload) {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.savePreset === 'function') {
      const res = await window.electronAPI.savePreset(payload);
      await this.loadPresets();
      return res;
    }
    // Fallback for tests/browser
    const slug = payload.slug || payload.name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const existingIdx = this.customPresets.findIndex((p) => p.slug === slug);
    const updated = {
      ...payload,
      slug,
      id: slug,
      updatedAt: new Date().toISOString()
    };
    if (existingIdx >= 0) {
      this.customPresets[existingIdx] = updated;
    } else {
      this.customPresets.push(updated);
    }
    this.rebuildMergedList();
    this.notify();
    return {
      success: true,
      slug
    };
  }

  /**
   * Delete a custom preset.
   */
  async deletePreset(slug) {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.deletePreset === 'function') {
      const res = await window.electronAPI.deletePreset(slug);
      await this.loadPresets();
      return res;
    }
    this.customPresets = this.customPresets.filter((p) => p.slug !== slug);
    this.rebuildMergedList();
    this.notify();
    return {
      success: true
    };
  }

  /**
   * Open the presets folder in explorer.
   */
  async openFolder(slug = null) {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.openPresetsFolder === 'function') {
      return window.electronAPI.openPresetsFolder(slug);
    }
    return false;
  }

  /**
   * Import media file (banner or video) for a preset.
   */
  async importMedia(slug, mediaType) {
    if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.importPresetMedia === 'function') {
      const res = await window.electronAPI.importPresetMedia(slug, mediaType);
      await this.loadPresets();
      return res;
    }
    return {
      canceled: true
    };
  }
}

export const presetRegistry = new PresetRegistry();
