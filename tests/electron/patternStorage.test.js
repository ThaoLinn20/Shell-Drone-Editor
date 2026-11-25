import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach
} from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  sanitizePatternSlug,
  scanPatterns,
  savePattern,
  deletePattern
} from '../../src/electron/patternStorage.js';

describe('patternStorage', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fdshow-patterns-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('sanitizes slugs to lowercase snake_case and prevents path traversal', () => {
    expect(sanitizePatternSlug('../etc/passwd')).toBe('passwd');
    expect(sanitizePatternSlug('My Double Wave!')).toBe('my_double_wave');
  });

  it('saves, scans, and deletes pattern JSON files cleanly', () => {
    const saved = savePattern(tempDir, {
      name: 'Crescendo Arch',
      points: [
        { x: 0, y: 0.2, launchX: 0.1, angle: 0.2 },
        { x: 1, y: 0.9, launchX: 0.9, angle: -0.2 }
      ],
      defaultShellCount: 10,
      mortarsLocked: true
    });

    expect(saved.slug).toBe('crescendo_arch');
    expect(saved.defaultShellCount).toBe(10);
    expect(saved.mortarsLocked).toBe(true);

    const scanned = scanPatterns(tempDir);
    expect(scanned).toHaveLength(1);
    expect(scanned[0].name).toBe('Crescendo Arch');
    expect(scanned[0].points).toHaveLength(2);

    const delResult = deletePattern(tempDir, 'crescendo_arch');
    expect(delResult.deleted).toBe(true);
    expect(scanPatterns(tempDir)).toHaveLength(0);
  });
});
