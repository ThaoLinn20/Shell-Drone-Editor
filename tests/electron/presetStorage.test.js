import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  findBundleFiles,
  scanPresetBundles,
  savePresetBundle,
  deletePresetBundle
} from '../../src/electron/presetStorage.js';

describe('presetStorage module', () => {
  let tempPresetsDir;

  beforeEach(() => {
    tempPresetsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preset-storage-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempPresetsDir)) {
      fs.rmSync(tempPresetsDir, { recursive: true, force: true });
    }
  });

  it('finds bundle files matching the slug exactly', () => {
    const slug = 'chrysanthemum_test';
    const bundleDir = path.join(tempPresetsDir, slug);
    fs.mkdirSync(bundleDir, { recursive: true });

    fs.writeFileSync(path.join(bundleDir, `${slug}.json`), '{"name":"Chrysanthemum Test"}');
    fs.writeFileSync(path.join(bundleDir, `${slug}.png`), 'fake-image');
    fs.writeFileSync(path.join(bundleDir, `${slug}.mp4`), 'fake-video');

    const result = findBundleFiles(bundleDir, slug);
    expect(result.jsonFile).toBe(`${slug}.json`);
    expect(result.bannerFile).toBe(`${slug}.png`);
    expect(result.videoFile).toBe(`${slug}.mp4`);
  });

  it('falls back to standard file names if slug name differs', () => {
    const slug = 'willow_waterfall';
    const bundleDir = path.join(tempPresetsDir, slug);
    fs.mkdirSync(bundleDir, { recursive: true });

    fs.writeFileSync(path.join(bundleDir, 'preset.json'), '{"name":"Waterfall"}');
    fs.writeFileSync(path.join(bundleDir, 'banner.webp'), 'fake-banner');
    fs.writeFileSync(path.join(bundleDir, 'preview.webm'), 'fake-preview');

    const result = findBundleFiles(bundleDir, slug);
    expect(result.jsonFile).toBe('preset.json');
    expect(result.bannerFile).toBe('banner.webp');
    expect(result.videoFile).toBe('preview.webm');
  });

  it('scans all preset bundles and returns sorted array with app-asset URLs', () => {
    // Preset 1
    const bundleDir1 = path.join(tempPresetsDir, 'preset_b');
    fs.mkdirSync(bundleDir1);
    fs.writeFileSync(
      path.join(bundleDir1, 'preset_b.json'),
      JSON.stringify({
        name: 'Preset Beta',
        category: 'comet',
        tags: ['trail', 'bright']
      })
    );
    fs.writeFileSync(path.join(bundleDir1, 'preset_b.png'), 'png');

    // Preset 2
    const bundleDir2 = path.join(tempPresetsDir, 'preset_a');
    fs.mkdirSync(bundleDir2);
    fs.writeFileSync(
      path.join(bundleDir2, 'preset_a.json'),
      JSON.stringify({
        name: 'Preset Alpha',
        category: 'shell'
      })
    );
    fs.writeFileSync(path.join(bundleDir2, 'preset_a.mp4'), 'mp4');

    const list = scanPresetBundles(tempPresetsDir);
    expect(list.length).toBe(2);
    expect(list[0].name).toBe('Preset Alpha');
    expect(list[0].hasVideo).toBe(true);
    expect(list[0].hasBanner).toBe(false);
    expect(list[0].videoUrl).toBe('app-asset://presets/preset_a/preset_a.mp4');

    expect(list[1].name).toBe('Preset Beta');
    expect(list[1].hasBanner).toBe(true);
    expect(list[1].bannerUrl).toBe('app-asset://presets/preset_b/preset_b.png');
    expect(list[1].tags).toEqual(['trail', 'bright']);
  });

  it('saves a preset bundle with base64 image and creates proper files', () => {
    const payload = {
      name: 'Custom Sparkle Shell',
      category: 'strobe',
      tags: ['sparkle'],
      composition: {
        shape: 'sphere',
        dynamics: 'standard'
      },
      bannerBase64: 'data:image/png;base64,aGVsbG8gd29ybGQ='
    };

    const res = savePresetBundle(tempPresetsDir, payload);
    expect(res.success).toBe(true);
    expect(res.slug).toBe('custom_sparkle_shell');

    const bundleDir = path.join(tempPresetsDir, 'custom_sparkle_shell');
    expect(fs.existsSync(bundleDir)).toBe(true);
    expect(fs.existsSync(path.join(bundleDir, 'custom_sparkle_shell.json'))).toBe(true);
    expect(fs.existsSync(path.join(bundleDir, 'custom_sparkle_shell.png'))).toBe(true);

    const savedJson = JSON.parse(
      fs.readFileSync(path.join(bundleDir, 'custom_sparkle_shell.json'), 'utf8')
    );
    expect(savedJson.name).toBe('Custom Sparkle Shell');
    expect(savedJson.category).toBe('strobe');
    expect(savedJson.composition.shape).toBe('sphere');
  });

  it('deletes a preset bundle directory completely', () => {
    const slug = 'to_be_deleted';
    const bundleDir = path.join(tempPresetsDir, slug);
    fs.mkdirSync(bundleDir);
    fs.writeFileSync(path.join(bundleDir, `${slug}.json`), '{}');

    expect(fs.existsSync(bundleDir)).toBe(true);
    const delRes = deletePresetBundle(tempPresetsDir, slug);
    expect(delRes.success).toBe(true);
    expect(fs.existsSync(bundleDir)).toBe(false);
  });

  it('strips codec parameters in data URLs when saving webm video and jpeg banner', () => {
    const rawVideoBytes = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02]);
    const rawImageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    const res = savePresetBundle(
      tempPresetsDir,
      {
        slug: 'test_codec_strip',
        name: 'Test Codec Strip',
        bannerBase64: `data:image/jpeg;base64,${rawImageBytes.toString('base64')}`,
        videoBase64: `data:video/webm;codecs=vp9;base64,${rawVideoBytes.toString('base64')}`
      }
    );

    expect(res.success).toBe(true);

    const savedVideo = fs.readFileSync(
      path.join(tempPresetsDir, 'test_codec_strip', 'test_codec_strip.webm')
    );
    const savedBanner = fs.readFileSync(
      path.join(tempPresetsDir, 'test_codec_strip', 'test_codec_strip.jpg')
    );

    expect(savedVideo.equals(rawVideoBytes)).toBe(true);
    expect(savedBanner.equals(rawImageBytes)).toBe(true);
  });
});
