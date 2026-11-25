import { sanitizeWavePoints } from '../utils/SplineMath.js';
import { globalEventBus } from './EventBus.js';

const STORAGE_KEY = 'fdshow_pattern_library_v1';

/**
 * Generates a safe lowercase snake_case slug from a pattern name.
 * @param {string} raw
 * @returns {string}
 */
export function toPatternSlug(raw) {
  const normalized = String(raw || 'pattern')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `pattern_${Date.now()}`;
}

export class PatternRegistry {
  constructor() {
    this.patterns = [];
    this.listeners = new Set();
    this.isLoaded = false;
    this.memoryFallback = new Map();
  }

  subscribe(cb) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  notify() {
    const snapshot = this.getAllPatterns();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Error in PatternRegistry listener:', err);
      }
    }
    globalEventBus.emit(
      'patternLibrary:updated',
      { patterns: snapshot }
    );
  }

  _hasElectronAPI() {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.electronAPI) &&
      typeof window.electronAPI.scanPatterns === 'function'
    );
  }

  _readLocalStorageMap() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : {};
      }
    } catch {
      // Fallback to in-memory map
    }
    return Object.fromEntries(this.memoryFallback.entries());
  }

  _writeLocalStorageMap(mapObj) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapObj));
        return;
      }
    } catch {
      // Fallback to in-memory map
    }
    this.memoryFallback.clear();
    for (const [k, v] of Object.entries(mapObj)) {
      this.memoryFallback.set(k, v);
    }
  }

  _normalizePatternRecord(raw) {
    const slug = toPatternSlug(raw?.slug || raw?.name);
    const nowIso = new Date().toISOString();
    const cleanPoints = sanitizeWavePoints(raw?.points);
    const defaultShellCount = Number.isFinite(Number(raw?.defaultShellCount))
      ? Math.max(2, Math.round(Number(raw.defaultShellCount)))
      : Math.max(2, cleanPoints.length);

    return {
      version: 1,
      id: raw?.id || `pat_${slug}`,
      slug,
      name: String(raw?.name || slug).trim() || slug,
      description: typeof raw?.description === 'string' ? raw.description.trim() : '',
      points: cleanPoints.map((pt) => ({ ...pt })),
      defaultShellCount,
      mortarsLocked: Boolean(raw?.mortarsLocked),
      createdAt: raw?.createdAt || nowIso,
      updatedAt: raw?.updatedAt || nowIso
    };
  }

  _sortPatterns(list) {
    return list.sort((a, b) => {
      const timeA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
      const timeB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
      return timeB - timeA;
    });
  }

  async loadPatterns() {
    let loaded = [];
    if (this._hasElectronAPI()) {
      try {
        loaded = await window.electronAPI.scanPatterns();
      } catch (err) {
        console.warn('Failed to scan patterns from electronAPI, falling back to localStorage:', err);
        const mapObj = this._readLocalStorageMap();
        loaded = Object.values(mapObj);
      }
    } else {
      const mapObj = this._readLocalStorageMap();
      loaded = Object.values(mapObj);
    }

    const normalized = (Array.isArray(loaded) ? loaded : [])
      .filter((item) => item && Array.isArray(item.points) && item.points.length > 0)
      .map((item) => this._normalizePatternRecord(item));

    this.patterns = this._sortPatterns(normalized);
    this.isLoaded = true;
    this.notify();
    return this.getAllPatterns();
  }

  getAllPatterns() {
    return this.patterns.map((p) => ({
      ...p,
      points: p.points.map((pt) => ({ ...pt }))
    }));
  }

  getPattern(slug) {
    const safeSlug = toPatternSlug(slug);
    const found = this.patterns.find((p) => p.slug === safeSlug);
    if (!found) return null;
    return {
      ...found,
      points: found.points.map((pt) => ({ ...pt }))
    };
  }

  async savePattern(payload = {}) {
    const existing = payload?.slug ? this.getPattern(payload.slug) : null;
    const baseSlug = toPatternSlug(payload?.slug || payload?.name);

    // Avoid accidental silent collision when saving a brand new pattern with same name
    let finalSlug = baseSlug;
    if (!payload?.slug) {
      let suffix = 1;
      while (this.patterns.some((p) => p.slug === finalSlug)) {
        suffix += 1;
        finalSlug = `${baseSlug}_${suffix}`;
      }
    }

    const record = this._normalizePatternRecord({
      ...payload,
      slug: finalSlug,
      id: existing?.id || payload?.id || `pat_${finalSlug}`,
      createdAt: existing?.createdAt || payload?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    let saved = record;
    let savedViaElectron = false;
    if (this._hasElectronAPI() && typeof window.electronAPI.savePattern === 'function') {
      try {
        saved = await window.electronAPI.savePattern(record);
        saved = this._normalizePatternRecord(saved);
        savedViaElectron = true;
      } catch (err) {
        console.warn('Failed to save pattern via electronAPI, falling back to localStorage:', err);
      }
    }
    if (!savedViaElectron) {
      const mapObj = this._readLocalStorageMap();
      mapObj[saved.slug] = saved;
      this._writeLocalStorageMap(mapObj);
    }

    const idx = this.patterns.findIndex((p) => p.slug === saved.slug);
    if (idx >= 0) {
      this.patterns[idx] = saved;
    } else {
      this.patterns.unshift(saved);
    }
    this.patterns = this._sortPatterns(this.patterns);
    this.isLoaded = true;
    this.notify();
    return this.getPattern(saved.slug);
  }

  async renamePattern(slug, newName) {
    const existing = this.getPattern(slug);
    if (!existing) {
      return null;
    }
    const trimmed = String(newName || '').trim();
    if (!trimmed) {
      return existing;
    }
    return this.savePattern({
      ...existing,
      name: trimmed,
      updatedAt: new Date().toISOString()
    });
  }

  async deletePattern(slug) {
    const safeSlug = toPatternSlug(slug);
    let deletedViaElectron = false;
    if (this._hasElectronAPI() && typeof window.electronAPI.deletePattern === 'function') {
      try {
        await window.electronAPI.deletePattern(safeSlug);
        deletedViaElectron = true;
      } catch (err) {
        console.warn('Failed to delete pattern via electronAPI, falling back to localStorage:', err);
      }
    }
    if (!deletedViaElectron) {
      const mapObj = this._readLocalStorageMap();
      delete mapObj[safeSlug];
      this._writeLocalStorageMap(mapObj);
    }

    this.patterns = this.patterns.filter((p) => p.slug !== safeSlug);
    this.notify();
    return {
      deleted: true,
      slug: safeSlug
    };
  }
}

export const patternRegistry = new PatternRegistry();
