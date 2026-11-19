import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WaveCurveModal } from '../../src/ui/WaveCurveModal.js';

describe('WaveCurveModal Component', () => {
  let listeners = {};

  beforeEach(() => {
    listeners = {};

    const createMockElement = (tag) => {
      let _innerHTML = '';
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        get innerHTML() { return _innerHTML; },
        set innerHTML(val) {
          _innerHTML = val;
          if (val === '') {
            el.children = [];
          }
        },
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
          width: 720,
          height: 440,
          right: 720,
          bottom: 440
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

  it('renders modal dialog with 1-to-1 shells and presets', () => {
    const modal = new WaveCurveModal({
      points: [
        { x: 0.0, y: 0.3, launchX: 0.1, angle: 0.2 },
        { x: 0.5, y: 0.8, launchX: 0.5, angle: 0.0 },
        { x: 1.0, y: 0.3, launchX: 0.9, angle: -0.2 }
      ],
      shellCount: 8
    });

    expect(modal.overlay).toBeDefined();
    // 1-to-1 mapping: 8 shells = 8 peaks
    expect(modal.points.length).toBe(8);

    // Apply V-Shape preset: generates exactly 8 shells
    modal.applyVShapePreset();
    expect(modal.points.length).toBe(8);

    // Apply Criss-Cross preset: generates exactly 8 shells
    modal.applyCrissCrossPreset();
    expect(modal.points.length).toBe(8);

    const clean = modal.getCleanPoints();
    expect(clean.length).toBe(8);
    expect(clean[0].x).toBe(0.0);
    expect(clean[7].x).toBe(1.0);
  });

  it('handles addPoint and removePoint with shell count update', () => {
    const modal = new WaveCurveModal({ shellCount: 6 });
    expect(modal.points.length).toBe(6);

    modal.addPoint();
    expect(modal.points.length).toBe(7);
    expect(modal.shellCount).toBe(7);

    modal.removePoint();
    expect(modal.points.length).toBe(6);
    expect(modal.shellCount).toBe(6);
  });

  it('resets mortars evenly across shell positions', () => {
    const modal = new WaveCurveModal({ shellCount: 5 });
    modal.points[0].launchX = 0.9;
    modal.points[1].launchX = 0.9;
    modal.points[2].launchX = 0.9;
    modal.points[3].launchX = 0.9;
    modal.points[4].launchX = 0.9;

    modal.resetMortars();

    expect(modal.points[0].launchX).toBe(0.0);
    expect(modal.points[1].launchX).toBe(0.25);
    expect(modal.points[2].launchX).toBe(0.5);
    expect(modal.points[3].launchX).toBe(0.75);
    expect(modal.points[4].launchX).toBe(1.0);
  });

  it('triggers onApply callback and closes modal', () => {
    let applied = null;
    let appliedCount = null;
    const modal = new WaveCurveModal({
      shellCount: 6,
      onApply: (pts, count) => {
        applied = pts;
        appliedCount = count;
      }
    });

    expect(global.document.body.children.length).toBe(1);

    modal.onApply(modal.getCleanPoints(), modal.shellCount);
    expect(applied).toBeDefined();
    expect(applied.length).toBe(6);
    expect(appliedCount).toBe(6);

    modal.close();
    expect(global.document.body.children.length).toBe(0);
  });

  it('does not create an extra shell when adjusting first or last point and applying', () => {
    let appliedPoints = null;
    let appliedCount = null;
    const modal = new WaveCurveModal({
      shellCount: 7,
      onApply: (pts, count) => {
        appliedPoints = pts;
        appliedCount = count;
      }
    });

    // Simulate adjusting first point height and angle
    modal.points[0].y = 0.85;
    modal.points[0].launchX = 0.20;

    // Simulate adjusting last point height
    modal.points[6].y = 0.45;

    const clean = modal.getCleanPoints();
    expect(clean.length).toBe(7);

    modal.onApply(clean, modal.shellCount);
    expect(appliedPoints.length).toBe(7);
    expect(appliedCount).toBe(7);
    modal.close();
  });

  it('renders batch sidebar card when multiple apexes are selected', () => {
    const modal = new WaveCurveModal({ shellCount: 8 });
    expect(modal.selectedApexIndices.size).toBe(1);

    // Multi-select 3 apexes
    modal.selectedApexIndices = new Set([1, 2, 3]);
    modal.updateSidebar();

    expect(modal.sidebarContent.children.length).toBe(1);
    const card = modal.sidebarContent.children[0];
    const headerTitle = card.children[0].children[0];
    expect(headerTitle.textContent).toContain('Batch');
    expect(headerTitle.textContent).toContain('3');
    modal.close();
  });

  it('removes all selected apexes when batch delete is executed', () => {
    const modal = new WaveCurveModal({ shellCount: 8 });
    modal.selectedApexIndices = new Set([1, 2]);

    modal.removePoint();
    // 8 - 2 = 6 shells
    expect(modal.points.length).toBe(6);
    expect(modal.shellCount).toBe(6);
    modal.close();
  });

  it('renders preset select dropdown and applies preset', () => {
    let appliedPreset = null;
    const modal = new WaveCurveModal({
      shellCount: 6,
      wavePreset: 'custom',
      onApply: (pts, count, preset) => {
        appliedPreset = preset;
      }
    });

    expect(modal.presetSelect).toBeDefined();
    expect(modal.presetSelect.value).toBe('custom');

    modal.applyPreset('wave');
    expect(modal.wavePreset).toBe('wave');
    expect(modal.presetSelect.value).toBe('wave');

    modal.onApply(modal.getCleanPoints(), modal.shellCount, modal.wavePreset);
    expect(appliedPreset).toBe('wave');
    modal.close();
  });

  it('supports adjusting burst apex X and Y of first and last shells', () => {
    const modal = new WaveCurveModal({ shellCount: 5 });
    // First shell
    modal.selectedIndex = 0;
    modal.updateSidebar();

    // Adjust first shell X to 0.12
    modal.points[0].x = 0.12;
    modal.points[0].y = 0.80;

    // Last shell
    modal.selectedIndex = 4;
    modal.points[4].x = 0.88;
    modal.points[4].y = 0.65;

    const clean = modal.getCleanPoints();
    expect(clean.length).toBe(5);
    expect(clean[0].x).toBe(0.12);
    expect(clean[0].y).toBe(0.80);
    expect(clean[4].x).toBe(0.88);
    expect(clean[4].y).toBe(0.65);
    modal.close();
  });

  it('mirrors full curve horizontally in modal', () => {
    const modal = new WaveCurveModal({ shellCount: 5 });
    modal.applySlopePreset();
    const y0 = modal.points[0].y;
    const y4 = modal.points[4].y;
    expect(y0).not.toBe(y4);

    modal.mirrorCurve();

    expect(modal.wavePreset).toBe('custom');
    expect(modal.points[0].y).toBeCloseTo(y4, 2);
    expect(modal.points[4].y).toBeCloseTo(y0, 2);
    modal.close();
  });

  it('mirrors selected subset of shells in modal', () => {
    const modal = new WaveCurveModal({ shellCount: 5 });
    modal.points[1].y = 0.25;
    modal.points[2].y = 0.50;
    modal.points[3].y = 0.75;
    modal.selectedApexIndices = new Set([1, 2, 3]);

    modal.mirrorCurve();

    expect(modal.points[1].y).toBeCloseTo(0.75, 2);
    expect(modal.points[2].y).toBeCloseTo(0.50, 2);
    expect(modal.points[3].y).toBeCloseTo(0.25, 2);
    modal.close();
  });
});
