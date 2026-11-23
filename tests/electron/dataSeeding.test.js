import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { seedDirectoryRecursively } from '../../src/electron/presetStorage.js';

describe('seedDirectoryRecursively', () => {
  let tempSrcDir;
  let tempDstDir;

  beforeEach(() => {
    tempSrcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-src-test-'));
    tempDstDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seed-dst-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempSrcDir)) {
      fs.rmSync(tempSrcDir, {
        recursive: true,
        force: true
      });
    }
    if (fs.existsSync(tempDstDir)) {
      fs.rmSync(tempDstDir, {
        recursive: true,
        force: true
      });
    }
  });

  it('copies missing files and nested directories from source to destination', () => {
    const subDir = path.join(tempSrcDir, 'previews', 'dynamics');
    fs.mkdirSync(subDir, {
      recursive: true
    });
    fs.writeFileSync(path.join(subDir, 'standard.mp4'), 'fake-video-bytes');

    seedDirectoryRecursively(tempSrcDir, tempDstDir);

    const copiedFile = path.join(tempDstDir, 'previews', 'dynamics', 'standard.mp4');
    expect(fs.existsSync(copiedFile)).toBe(true);
    expect(fs.readFileSync(copiedFile, 'utf8')).toBe('fake-video-bytes');
  });

  it('does not overwrite existing files in destination', () => {
    const srcFile = path.join(tempSrcDir, 'test.txt');
    const dstFile = path.join(tempDstDir, 'test.txt');

    fs.writeFileSync(srcFile, 'source-content');
    fs.writeFileSync(dstFile, 'user-custom-content');

    seedDirectoryRecursively(tempSrcDir, tempDstDir);

    expect(fs.readFileSync(dstFile, 'utf8')).toBe('user-custom-content');
  });

  it('gracefully handles non-existent source directory', () => {
    const nonExistent = path.join(os.tmpdir(), 'non-existent-dir-' + Date.now());
    expect(() => seedDirectoryRecursively(nonExistent, tempDstDir)).not.toThrow();
  });
});
