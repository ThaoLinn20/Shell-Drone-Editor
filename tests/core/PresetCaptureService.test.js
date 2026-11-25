import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PresetCaptureService } from '../../src/core/PresetCaptureService.js';

describe('PresetCaptureService manual capture modes', () => {
  let keyListeners;
  let mockShowDirector;
  let mockCameraManager;
  let mockCaptureCtx;
  let mockCaptureCanvas;
  let service;

  beforeEach(() => {
    keyListeners = [];
    vi.stubGlobal('window', {
      addEventListener: vi.fn((type, fn) => {
        if (type === 'keydown') keyListeners.push(fn);
      }),
      removeEventListener: vi.fn((type, fn) => {
        keyListeners = keyListeners.filter((h) => h !== fn);
      })
    });

    mockCaptureCtx = {
      drawImage: vi.fn()
    };
    mockCaptureCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCaptureCtx),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,MOCK_JPEG')
    };

    const createEl = (tag) => {
      if (tag === 'canvas') return mockCaptureCanvas;
      return {
        tagName: tag.toUpperCase(),
        style: {},
        textContent: '',
        className: '',
        type: '',
        children: [],
        appendChild: vi.fn(function (c) {
          this.children.push(c);
          return c;
        }),
        addEventListener: vi.fn(),
        remove: vi.fn()
      };
    };

    const exitPointerLock = vi.fn();
    vi.stubGlobal('document', {
      createElement: vi.fn(createEl),
      body: createEl('body'),
      pointerLockElement: {},
      exitPointerLock
    });

    mockShowDirector = {
      scriptConfig: [{ type: 'sequence', time: 5 }],
      elapsedTime: 1.5,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn((t) => {
        mockShowDirector.elapsedTime = t;
      }),
      play: vi.fn(() => {
        mockShowDirector.isPlaying = true;
      }),
      pause: vi.fn(() => {
        mockShowDirector.isPlaying = false;
      })
    };

    const makeVec = (x = 0, y = 0, z = 0) => ({
      x,
      y,
      z,
      set: vi.fn(),
      copy: vi.fn(),
      clone: vi.fn(() => makeVec(x, y, z))
    });

    mockCameraManager = {
      enabled: true,
      instance: {
        position: makeVec(0, 6, 420),
        quaternion: makeVec(0, 0, 0),
        lookAt: vi.fn()
      }
    };

    service = new PresetCaptureService({
      renderer: {
        instance: {
          domElement: {
            width: 1920,
            height: 1080
          }
        }
      },
      showDirector: mockShowDirector,
      cameraManager: mockCameraManager
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('captures manual photo when user presses C and restores editor state', async () => {
    const promise = service.captureManualPhoto({
      type: 'sequence',
      preset: 'crysanthemum',
      burstHeight: 140
    });

    expect(service.isCapturing).toBe(true);
    expect(mockCameraManager.enabled).toBe(true);
    expect(keyListeners.length).toBe(1);

    // Simulate pressing C
    keyListeners[0]({
      key: 'c',
      code: 'KeyC',
      repeat: false,
      target: { tagName: 'BODY' },
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn()
    });

    // Next render tick captures synchronously
    service.onAfterRender();

    const result = await promise;
    expect(result).toEqual({
      bannerBase64: 'data:image/jpeg;base64,MOCK_JPEG',
      width: 854,
      height: 480
    });
    expect(service.isCapturing).toBe(false);
    expect(keyListeners.length).toBe(0);
    expect(document.exitPointerLock).toHaveBeenCalled();
    expect(mockShowDirector.loadScript).toHaveBeenLastCalledWith([
      { type: 'sequence', time: 5 }
    ]);
  });

  it('cancels manual photo cleanly when user presses Escape', async () => {
    const promise = service.captureManualPhoto({
      type: 'sequence',
      preset: 'peony',
      burstHeight: 120
    });

    keyListeners[0]({
      key: 'Escape',
      code: 'Escape',
      repeat: false,
      target: { tagName: 'BODY' },
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn()
    });

    const result = await promise;
    expect(result).toBeNull();
    expect(service.isCapturing).toBe(false);
    expect(keyListeners.length).toBe(0);
  });
});
