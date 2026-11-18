import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveCurveEditor } from '../../src/ui/WaveCurveEditor.js';
import { WaveCurveModal } from '../../src/ui/WaveCurveModal.js';
import { angleFromTrajectory, launchXFromAngle } from '../../src/utils/SplineMath.js';

describe('WaveCurveEditor Component', () => {
  let listeners = {};

  beforeEach(() => {
    listeners = {};

    const createMockElement = (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        innerHTML: '',
        textContent: '',
        children: [],
        parentElement: null,
        dataset: {},
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
          contains: vi.fn(() => false)
        },
        appendChild: (child) => {
          el.children.push(child);
          child.parentElement = el;
          return child;
        },
        removeChild: (child) => {
          el.children = el.children.filter((c) => c !== child);
          child.parentElement = null;
          return child;
        },
        remove: () => {
          if (el.parentElement) {
            el.parentElement.removeChild(el);
          }
        },
        setAttribute: vi.fn((attr, val) => {
          el[attr] = val;
        }),
        getAttribute: vi.fn((attr) => el[attr] || null),
        addEventListener: (event, cb) => {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeEventListener: (event, cb) => {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter((fn) => fn !== cb);
          }
        },
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 280,
          height: 160,
          right: 280,
          bottom: 160
        }),
        getContext: () => ({
          save: vi.fn(),
          restore: vi.fn(),
          scale: vi.fn(),
          fillRect: vi.fn(),
          strokeRect: vi.fn(),
          fillText: vi.fn(),
          beginPath: vi.fn(),
          moveTo: vi.fn(),
          lineTo: vi.fn(),
          stroke: vi.fn(),
          fill: vi.fn(),
          arc: vi.fn(),
          quadraticCurveTo: vi.fn(),
          setLineDash: vi.fn(),
          createLinearGradient: () => ({
            addColorStop: vi.fn()
          })
        })
      };
      return el;
    };

    global.document = {
      createElement: createMockElement,
      body: {
        children: [],
        appendChild: function (child) {
          this.children.push(child);
          child.parentElement = this;
          return child;
        },
        removeChild: function (child) {
          const idx = this.children.indexOf(child);
          if (idx !== -1) {
            this.children.splice(idx, 1);
          }
          child.parentElement = null;
          return child;
        }
      }
    };

    global.window = {
      devicePixelRatio: 1,
      addEventListener: (event, cb) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(cb);
      },
      removeEventListener: (event, cb) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((fn) => fn !== cb);
        }
      }
    };
  });

  afterEach(() => {
    delete global.document;
    delete global.window;
  });

  it('initializes with 1-to-1 correspondence between peaks and shellCount', () => {
    const rawPoints = [
      { x: 0.0, y: 0.35, angle: 0.2 },
      { x: 0.5, y: 0.88, angle: 0.0 },
      { x: 1.0, y: 0.35, angle: -0.2 }
    ];

    const editor = new WaveCurveEditor({
      points: rawPoints,
      shellCount: 8
    });

    const clean = editor.getCleanPoints();
    // 1-to-1 mapping: exactly 8 shells -> exactly 8 peaks
    expect(clean.length).toBe(8);
    clean.forEach((p) => {
      expect(p.launchX).toBeDefined();
      expect(typeof p.launchX).toBe('number');
      expect(p.launchX).toBeGreaterThanOrEqual(0.0);
      expect(p.launchX).toBeLessThanOrEqual(1.0);
    });
    expect(editor.getElement()).toBeDefined();
  });

  it('guarantees 1-to-1 shell mapping and updates shellCount dynamically', () => {
    let changedPoints = null;
    let changedCount = null;
    const editor = new WaveCurveEditor({
      shellCount: 6,
      onChange: (pts, count) => {
        changedPoints = pts;
        changedCount = count;
      }
    });

    expect(editor.points.length).toBe(6);
    editor.setShellCount(10);
    expect(editor.points.length).toBe(10);
    expect(changedCount).toBe(10);
    expect(changedPoints.length).toBe(10);

    // Each shell should be positioned across [0, 1]
    expect(editor.points[0].x).toBe(0.0);
    expect(editor.points[9].x).toBe(1.0);
  });

  it('adds and removes individual shells with count updates', () => {
    const editor = new WaveCurveEditor({ shellCount: 5 });
    expect(editor.points.length).toBe(5);

    editor.addPoint();
    expect(editor.points.length).toBe(6);
    expect(editor.shellCount).toBe(6);

    editor.selectedIndex = 2;
    editor.removePoint();
    expect(editor.points.length).toBe(5);
    expect(editor.shellCount).toBe(5);
  });

  it('updates angle correctly using angleFromTrajectory when dragging base or apex', () => {
    const editor = new WaveCurveEditor({ shellCount: 6 });
    const pt = editor.points[1];
    pt.launchX = 0.2;
    pt.x = 0.5;
    pt.y = 0.8;

    const angle = angleFromTrajectory(pt.launchX, pt.x, pt.y);
    expect(angle).toBeGreaterThan(0.0);

    const reconstructedLaunchX = launchXFromAngle(pt.x, pt.y, angle);
    expect(reconstructedLaunchX).toBeCloseTo(0.2, 2);
  });

  it('resets mortars evenly across shell positions', () => {
    const editor = new WaveCurveEditor({ shellCount: 5 });
    // Mess up the launchX values
    editor.points[0].launchX = 0.8;
    editor.points[1].launchX = 0.8;
    editor.points[2].launchX = 0.8;
    editor.points[3].launchX = 0.8;
    editor.points[4].launchX = 0.8;

    editor.resetMortars();

    expect(editor.points[0].launchX).toBe(0.0);
    expect(editor.points[1].launchX).toBe(0.25);
    expect(editor.points[2].launchX).toBe(0.5);
    expect(editor.points[3].launchX).toBe(0.75);
    expect(editor.points[4].launchX).toBe(1.0);
  });

  it('preserves launchX when mortars are locked and dragging apex', () => {
    const editor = new WaveCurveEditor({ shellCount: 5 });
    editor.mortarsLocked = true;
    editor.points[1].launchX = 0.25;

    // Simulate dragTarget on apex
    editor.dragTarget = { type: 'apex', index: 1 };
    const moveListeners = listeners['mousemove'] || [];
    for (const listener of moveListeners) {
      listener({ clientX: 180, clientY: 40 });
    }

    expect(editor.points[1].launchX).toBe(0.25);
    expect(editor.points[1].angle).not.toBe(0.0);
  });

  it('opens WaveCurveModal on expand and applies edits with shellCount', () => {
    let appliedPoints = null;
    const editor = new WaveCurveEditor({
      shellCount: 6,
      onChange: (pts) => {
        appliedPoints = pts;
      }
    });

    const modal = editor.openModal();
    expect(modal).toBeInstanceOf(WaveCurveModal);
    expect(global.document.body.children.length).toBe(1);

    // Simulate applying from modal
    modal.applySlopePreset();
    modal.onApply(modal.getCleanPoints(), modal.shellCount);
    modal.close();

    expect(appliedPoints).toBeDefined();
    expect(appliedPoints.length).toBe(6);
    expect(global.document.body.children.length).toBe(0);
  });

  it('supports Shift-click multi-selection of apexes and mortar bases', () => {
    const editor = new WaveCurveEditor({ shellCount: 5 });
    expect(editor.selectedApexIndices.has(0)).toBe(true);

    // Simulate Shift-click on apex 2
    const pt2 = editor.points[2];
    const { px: px2, py: py2 } = editor.toPixel(pt2.x, pt2.y);
    const downListeners = listeners['mousedown'] || [];
    for (const listener of downListeners) {
      listener({
        button: 0,
        shiftKey: true,
        clientX: px2,
        clientY: py2
      });
    }

    expect(editor.selectedApexIndices.has(0)).toBe(true);
    expect(editor.selectedApexIndices.has(2)).toBe(true);
    expect(editor.selectedApexIndices.size).toBe(2);

    // Shift-click again to toggle apex 0 off
    const pt0 = editor.points[0];
    const { px: px0, py: py0 } = editor.toPixel(pt0.x, pt0.y);
    for (const listener of downListeners) {
      listener({
        button: 0,
        shiftKey: true,
        clientX: px0,
        clientY: py0
      });
    }
    expect(editor.selectedApexIndices.has(0)).toBe(false);
    expect(editor.selectedApexIndices.has(2)).toBe(true);
  });

  it('supports marquee box drag selection across canvas', () => {
    const editor = new WaveCurveEditor({ shellCount: 5 });
    const downListeners = listeners['mousedown'] || [];
    const moveListeners = listeners['mousemove'] || [];
    const upListeners = listeners['mouseup'] || [];

    // Mouse down on empty background at (40, 20)
    for (const listener of downListeners) {
      listener({
        button: 0,
        shiftKey: false,
        clientX: 40,
        clientY: 20
      });
    }
    expect(editor.marqueeBox).toBeDefined();

    // Drag to (160, 120) to enclose middle points
    for (const listener of moveListeners) {
      listener({
        clientX: 160,
        clientY: 120
      });
    }
    expect(editor.selectedApexIndices.size).toBeGreaterThan(0);

    // Release mouse
    for (const listener of upListeners) {
      listener({});
    }
    expect(editor.marqueeBox).toBeNull();
  });

  it('batch drags multiple selected apexes simultaneously', () => {
    const editor = new WaveCurveEditor({ shellCount: 5 });
    // Select apex 1 and 2
    editor.selectedApexIndices = new Set([1, 2]);
    const initY1 = editor.points[1].y;
    const initY2 = editor.points[2].y;

    const pt1 = editor.points[1];
    const { px, py } = editor.toPixel(pt1.x, pt1.y);

    editor.dragTarget = {
      type: 'apex',
      index: 1,
      startPos: { x: px, y: py },
      initialPoints: editor.points.map((p) => ({ ...p }))
    };

    const moveListeners = listeners['mousemove'] || [];
    // Drag downwards by 15 pixels (avoiding 1.0 altitude clamp ceiling)
    for (const listener of moveListeners) {
      listener({ clientX: px, clientY: py + 15 });
    }

    expect(editor.points[1].y).toBeLessThan(initY1);
    expect(editor.points[2].y).toBeLessThan(initY2);
    // Relative altitude difference between 1 and 2 is preserved
    const diffBefore = initY2 - initY1;
    const diffAfter = editor.points[2].y - editor.points[1].y;
    expect(Math.abs(diffAfter - diffBefore)).toBeLessThan(0.01);
  });

  it('batch drags multiple selected mortar bases simultaneously', () => {
    const editor = new WaveCurveEditor({ shellCount: 5 });
    editor.selectedBaseIndices = new Set([1, 2]);
    const initL1 = editor.points[1].launchX;
    const initL2 = editor.points[2].launchX;

    const basePx = editor.padding + initL1 * (editor.canvas.width - editor.padding * 2);
    const groundY = editor.canvas.height - editor.padding;

    editor.dragTarget = {
      type: 'base',
      index: 1,
      startPos: { x: basePx, y: groundY },
      initialPoints: editor.points.map((p) => ({ ...p }))
    };

    const moveListeners = listeners['mousemove'] || [];
    // Drag base rightwards by 25 pixels
    for (const listener of moveListeners) {
      listener({ clientX: basePx + 25, clientY: groundY });
    }

    expect(editor.points[1].launchX).toBeGreaterThan(initL1);
    expect(editor.points[2].launchX).toBeGreaterThan(initL2);
  });

  it('renders preset dropdown and changes curve preset', () => {
    let capturedPreset = null;
    const editor = new WaveCurveEditor({
      shellCount: 6,
      wavePreset: 'custom',
      onChange: (pts, count, preset) => {
        capturedPreset = preset;
      }
    });

    expect(editor.presetSelect).toBeDefined();
    expect(editor.presetSelect.value).toBe('custom');

    editor.applyPreset('arch');
    expect(editor.wavePreset).toBe('arch');
    expect(editor.presetSelect.value).toBe('arch');
    expect(capturedPreset).toBe('arch');
  });

  it('switches preset dropdown to custom when dragging an apex', () => {
    const editor = new WaveCurveEditor({ shellCount: 5, wavePreset: 'arch' });
    expect(editor.wavePreset).toBe('arch');

    const pt = editor.points[1];
    const { px, py } = editor.toPixel(pt.x, pt.y);
    editor.dragTarget = {
      type: 'apex',
      index: 1,
      startPos: { x: px, y: py },
      initialPoints: editor.points.map((p) => ({ ...p }))
    };

    const moveListeners = listeners['mousemove'] || [];
    for (const listener of moveListeners) {
      listener({ clientX: px, clientY: py + 10 });
    }

    expect(editor.wavePreset).toBe('custom');
    expect(editor.presetSelect.value).toBe('custom');
  });

  it('supports dragging apex of first and last shell', () => {
    const editor = new WaveCurveEditor({ shellCount: 5 });
    // Drag first apex (#0)
    const pt0 = editor.points[0];
    const { px, py } = editor.toPixel(pt0.x, pt0.y);
    editor.dragTarget = {
      type: 'apex',
      index: 0,
      startPos: { x: px, y: py },
      initialPoints: editor.points.map((p) => ({ ...p }))
    };

    const moveListeners = listeners['mousemove'] || [];
    // Drag rightwards by 20 pixels and upwards by 10 pixels
    for (const listener of moveListeners) {
      listener({ clientX: px + 20, clientY: py - 10 });
    }

    expect(editor.points[0].x).toBeGreaterThan(0.0);
    expect(editor.points[0].x).toBeLessThan(editor.points[1].x);
  });
});
