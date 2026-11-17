import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRecentScripts,
  addRecentScript,
  removeRecentScript,
  clearRecentScripts,
  formatRelativeTime,
  MAX_RECENT_SCRIPTS,
  RECENT_SCRIPTS_STORAGE_KEY
} from '../../src/utils/recentScripts.js';

describe('recentScripts Utility', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.localStorage = {
      getItem: (k) => mockStorage[k] || null,
      setItem: (k, v) => { mockStorage[k] = String(v); },
      removeItem: (k) => { delete mockStorage[k]; },
      clear: () => { mockStorage = {}; }
    };
  });

  it('should return empty array if storage is empty or corrupted', () => {
    expect(getRecentScripts()).toEqual([]);
    mockStorage[RECENT_SCRIPTS_STORAGE_KEY] = 'not-a-json';
    expect(getRecentScripts()).toEqual([]);
    mockStorage[RECENT_SCRIPTS_STORAGE_KEY] = '{"not":"array"}';
    expect(getRecentScripts()).toEqual([]);
  });

  it('should add a new script entry to the top', () => {
    const list = addRecentScript({
      filePath: 'D:/shows/tet_2026.json',
      filename: 'tet_2026.json',
      duration: 180,
      eventCount: 45
    });

    expect(list.length).toBe(1);
    expect(list[0].filename).toBe('tet_2026.json');
    expect(list[0].filePath).toBe('D:/shows/tet_2026.json');
    expect(list[0].duration).toBe(180);
    expect(list[0].eventCount).toBe(45);
    expect(list[0].lastOpenedAt).toBeGreaterThan(0);
  });

  it('should deduplicate entries and bring existing script to index 0 on update', () => {
    addRecentScript({ filePath: 'D:/shows/show1.json', filename: 'show1.json', lastOpenedAt: 1000 });
    addRecentScript({ filePath: 'D:/shows/show2.json', filename: 'show2.json', lastOpenedAt: 2000 });

    const before = getRecentScripts();
    expect(before[0].filename).toBe('show2.json');
    expect(before[1].filename).toBe('show1.json');

    // Re-open show1
    addRecentScript({ filePath: 'D:/shows/show1.json', filename: 'show1.json', lastOpenedAt: 3000, eventCount: 99 });
    const after = getRecentScripts();
    expect(after.length).toBe(2);
    expect(after[0].filename).toBe('show1.json');
    expect(after[0].lastOpenedAt).toBe(3000);
    expect(after[0].eventCount).toBe(99);
    expect(after[1].filename).toBe('show2.json');
  });

  it('should enforce MAX_RECENT_SCRIPTS = 12 limit', () => {
    for (let i = 1; i <= 15; i++) {
      addRecentScript({
        filePath: `D:/shows/show_${i}.json`,
        filename: `show_${i}.json`,
        lastOpenedAt: i * 1000
      });
    }

    const list = getRecentScripts();
    expect(list.length).toBe(MAX_RECENT_SCRIPTS);
    expect(MAX_RECENT_SCRIPTS).toBe(12);
    // Newest show_15 is at index 0
    expect(list[0].filename).toBe('show_15.json');
    // Oldest preserved is show_4 (15 - 12 + 1)
    expect(list[list.length - 1].filename).toBe('show_4.json');
  });

  it('should remove a script by filePath', () => {
    addRecentScript({ filePath: 'D:/shows/show1.json', filename: 'show1.json' });
    addRecentScript({ filePath: 'D:/shows/show2.json', filename: 'show2.json' });

    expect(getRecentScripts().length).toBe(2);
    const updated = removeRecentScript('D:/shows/show1.json');
    expect(updated.length).toBe(1);
    expect(updated[0].filename).toBe('show2.json');
  });

  it('should clear all recent scripts', () => {
    addRecentScript({ filePath: 'D:/shows/show1.json', filename: 'show1.json' });
    clearRecentScripts();
    expect(getRecentScripts()).toEqual([]);
  });

  it('should format relative time correctly', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 10000)).toBe('Just now');
    expect(formatRelativeTime(now - 5 * 60 * 1000)).toBe('5m ago');
    expect(formatRelativeTime(now - 3 * 3600 * 1000)).toBe('3h ago');
    expect(formatRelativeTime(now - 25 * 3600 * 1000)).toBe('Yesterday');
  });
});
