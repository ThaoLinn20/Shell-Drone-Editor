/**
 * Recent Scripts Manager
 * Tracks recently opened and saved show script files in localStorage with a strict LRU limit (max 12).
 */

export const RECENT_SCRIPTS_STORAGE_KEY = 'fd_recent_scripts';
export const MAX_RECENT_SCRIPTS = 12;

/**
 * @typedef {Object} RecentScriptItem
 * @property {string} filePath - Absolute path or unique identifier on disk
 * @property {string} filename - Display filename (e.g. "show_tet_2026.json")
 * @property {number} lastOpenedAt - Epoch timestamp in milliseconds
 * @property {string} [lastAction] - 'open' | 'save' | 'import'
 * @property {number} [duration] - Total script duration in seconds
 * @property {number} [eventCount] - Total event count (fireworks + drones)
 */

/**
 * Retrieve recent scripts sorted from newest to oldest.
 * @returns {RecentScriptItem[]}
 */
export function getRecentScripts() {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(RECENT_SCRIPTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => (b.lastOpenedAt || 0) - (a.lastOpenedAt || 0));
  } catch {
    return [];
  }
}

/**
 * Record a script into recent list. Automatically deduplicates and places at index 0.
 * @param {Object} meta
 * @param {string} meta.filePath
 * @param {string} [meta.filename]
 * @param {string} [meta.lastAction]
 * @param {number} [meta.duration]
 * @param {number} [meta.eventCount]
 * @param {number} [meta.lastOpenedAt]
 * @returns {RecentScriptItem[]}
 */
export function addRecentScript(meta) {
  if (!meta || !meta.filePath || typeof meta.filePath !== 'string') {
    return getRecentScripts();
  }

  const cleanPath = meta.filePath.trim();
  if (!cleanPath) return getRecentScripts();

  const filename = meta.filename && typeof meta.filename === 'string' && meta.filename.trim()
    ? meta.filename.trim()
    : cleanPath.replace(/^.*[\\/]/, '');

  const existing = getRecentScripts();
  // Filter out existing entry with the same filePath (deduplication)
  const filtered = existing.filter((item) => item.filePath !== cleanPath);

  const newEntry = {
    filePath: cleanPath,
    filename: filename,
    lastOpenedAt: typeof meta.lastOpenedAt === 'number' ? meta.lastOpenedAt : Date.now(),
    lastAction: meta.lastAction || 'open',
    duration: typeof meta.duration === 'number' ? meta.duration : 0,
    eventCount: typeof meta.eventCount === 'number' ? meta.eventCount : 0
  };

  const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_SCRIPTS);

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(RECENT_SCRIPTS_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Graceful fallback if localStorage is unavailable or full
    }
  }

  return updated;
}

/**
 * Remove a specific script by its filePath.
 * @param {string} filePath
 * @returns {RecentScriptItem[]}
 */
export function removeRecentScript(filePath) {
  if (!filePath || typeof localStorage === 'undefined') {
    return getRecentScripts();
  }
  const existing = getRecentScripts();
  const updated = existing.filter((item) => item.filePath !== filePath);
  try {
    localStorage.setItem(RECENT_SCRIPTS_STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
  return updated;
}

/**
 * Clear all recent scripts history.
 */
export function clearRecentScripts() {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(RECENT_SCRIPTS_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Human-readable relative time string.
 * @param {number} timestamp
 * @param {Function} [t] - Optional translation function
 * @returns {string}
 */
export function formatRelativeTime(timestamp, t = null) {
  if (!timestamp || isNaN(timestamp)) return '';
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) {
    return (t && t('editor.showLibrary.justNow')) || 'Just now';
  }
  if (diffHours < 1) {
    return (t && t('editor.showLibrary.minutesAgo', { count: diffMin })) || `${diffMin}m ago`;
  }
  if (diffDays < 1) {
    return (t && t('editor.showLibrary.hoursAgo', { count: diffHours })) || `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return (t && t('editor.showLibrary.yesterday')) || 'Yesterday';
  }

  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
