import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveAssetUrl } from '../../src/utils/assetUrl.js';

describe('resolveAssetUrl utility', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns empty string for falsy input', () => {
    expect(resolveAssetUrl('')).toBe('');
    expect(resolveAssetUrl(null)).toBe('');
    expect(resolveAssetUrl(undefined)).toBe('');
  });

  it('returns absolute or special protocol URLs unchanged', () => {
    expect(resolveAssetUrl('http://localhost:5173/demo.mp4')).toBe('http://localhost:5173/demo.mp4');
    expect(resolveAssetUrl('https://example.com/video.mp4')).toBe('https://example.com/video.mp4');
    expect(resolveAssetUrl('app-asset://presets/slug/preview.mp4')).toBe('app-asset://presets/slug/preview.mp4');
    expect(resolveAssetUrl('blob:http://localhost:5173/uuid')).toBe('blob:http://localhost:5173/uuid');
    expect(resolveAssetUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
  });

  it('resolves to app-asset:// when running inside Electron', () => {
    window.electronAPI = {
      scanPresets: vi.fn()
    };

    expect(resolveAssetUrl('previews/dynamics/standard.mp4')).toBe('app-asset://previews/dynamics/standard.mp4');
    expect(resolveAssetUrl('./previews/dynamics/standard.mp4')).toBe('app-asset://previews/dynamics/standard.mp4');
    expect(resolveAssetUrl('/previews/dynamics/standard.mp4')).toBe('app-asset://previews/dynamics/standard.mp4');
  });

  it('resolves to relative ./ path when running in browser dev without electronAPI', () => {
    delete window.electronAPI;

    expect(resolveAssetUrl('previews/dynamics/standard.mp4')).toBe('./previews/dynamics/standard.mp4');
    expect(resolveAssetUrl('./previews/dynamics/standard.mp4')).toBe('./previews/dynamics/standard.mp4');
    expect(resolveAssetUrl('/previews/dynamics/standard.mp4')).toBe('./previews/dynamics/standard.mp4');
  });
});
