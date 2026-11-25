import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFireworkLifespan,
  isFireworkLifecycleEvent
} from '../../src/utils/fireworkLifespan.js';
import { TimelineEditor } from '../../src/ui/TimelineEditor.js';

// Stub localStorage globally before tests
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

describe('Firework Lifespan & 3-Phase Lifecycle Model', () => {
  describe('isFireworkLifecycleEvent', () => {
    it('identifies firework events correctly', () => {
      expect(isFireworkLifecycleEvent({ type: 'sequence' })).toBe(true);
      expect(isFireworkLifecycleEvent({ type: 'single' })).toBe(true);
      expect(isFireworkLifecycleEvent({ type: 'cometsequence' })).toBe(true);
      expect(isFireworkLifecycleEvent({ type: 'finale' })).toBe(true);
    });

    it('rejects non-firework and deleted events', () => {
      expect(isFireworkLifecycleEvent({ type: 'audio' })).toBe(false);
      expect(isFireworkLifecycleEvent({ type: 'droneshow' })).toBe(false);
      expect(isFireworkLifecycleEvent({ type: 'group' })).toBe(false);
      expect(isFireworkLifecycleEvent({ type: 'sequence', _deleted: true })).toBe(false);
      expect(isFireworkLifecycleEvent(null)).toBe(false);
      expect(isFireworkLifecycleEvent({})).toBe(false);
    });
  });

  describe('getFireworkLifespan calculations', () => {
    it('calculates analytical lift time for explicit burstHeight values', () => {
      // At burstHeight = 75m: h = 74.5, t_lift = 0.8190025 * sqrt(2 * 74.5 / 30) = 1.83s
      const lowShell = getFireworkLifespan({
        time: 2.0,
        burstHeight: 75,
        duration: 2.0,
        starLife: 2000,
        starLifeMultiplier: 1.0
      });
      expect(lowShell.liftTime).toBe(1.83);
      expect(lowShell.burstDuration).toBe(2.0);
      expect(lowShell.fadeoutDuration).toBe(2.0);
      expect(lowShell.burstStartTime).toBe(3.83);
      expect(lowShell.burstEndTime).toBe(5.83);
      expect(lowShell.totalVisualDuration).toBe(5.83);
      expect(lowShell.totalEndTime).toBe(7.83);

      // At burstHeight = 300m: h = 299.5, t_lift = 0.8190025 * sqrt(2 * 299.5 / 30) = 3.66s
      const highShell = getFireworkLifespan({
        time: 0.0,
        burstHeight: 300,
        duration: 1.5,
        starLife: 2200,
        starLifeMultiplier: 1.0
      });
      expect(highShell.liftTime).toBe(3.66);
      expect(highShell.burstDuration).toBe(1.5);
      expect(highShell.fadeoutDuration).toBe(2.2);
      expect(highShell.totalVisualDuration).toBe(7.36);
      expect(highShell.totalEndTime).toBe(7.36);
    });

    it('calculates lift time based on ratioY interpolation', () => {
      // ratioY = 0.5 => burstHeight = 0.5 + 0.5 * 299.5 = 150.25m
      const midShell = getFireworkLifespan({
        time: 1.0,
        ratioY: 0.5,
        duration: 2.0
      });
      expect(midShell.liftTime).toBe(2.59);
      expect(midShell.burstStartTime).toBe(3.59);

      // ratioY = 0 => burstHeight = 0.5m (water level => 0s lift time)
      const waterShell = getFireworkLifespan({
        time: 1.0,
        ratioY: 0,
        duration: 2.0
      });
      expect(waterShell.liftTime).toBe(0);
    });

    it('calculates zero lift time for instantBurst events (mines and ground bouquets)', () => {
      const mine = getFireworkLifespan({
        time: 5.0,
        instantBurst: true,
        duration: 1.0
      });
      expect(mine.liftTime).toBe(0);
      expect(mine.burstDuration).toBe(1.0);
      expect(mine.fadeoutDuration).toBe(1.2);
      expect(mine.burstStartTime).toBe(5.0);
      expect(mine.totalVisualDuration).toBe(2.2);
      expect(mine.totalEndTime).toBe(7.2);
    });

    it('calculates zero lift time and fast fadeout for comet events', () => {
      const comet = getFireworkLifespan({
        time: 10.0,
        type: 'cometsequence',
        duration: 3.0
      });
      expect(comet.liftTime).toBe(0);
      expect(comet.burstDuration).toBe(3.0);
      expect(comet.fadeoutDuration).toBe(0.2);
      expect(comet.totalVisualDuration).toBe(3.2);
      expect(comet.totalEndTime).toBe(13.2);
    });

    it('scales fadeout duration with starLife and starLifeMultiplier', () => {
      const longBurn = getFireworkLifespan({
        time: 0.0,
        burstHeight: 75,
        duration: 1.0,
        starLife: 2000,
        starLifeMultiplier: 2.5
      });
      // 2000 * 2.5 / 1000 = 5.0s
      expect(longBurn.fadeoutDuration).toBe(5.0);
      expect(longBurn.totalVisualDuration).toBe(1.83 + 1.0 + 5.0);
    });

    it('calculates dynamic flight time and burst window for wave curve events based on wavePoints', () => {
      // 1. Low wave points (all at y = 0.05 => 15.475m, liftTime ~ 0.82s)
      const lowWaveEvent = {
        time: 2.0,
        pattern: 'sweep-custom-curve',
        count: 5,
        duration: 2.0,
        wavePoints: [
          { x: 0.0, y: 0.05 },
          { x: 0.25, y: 0.05 },
          { x: 0.5, y: 0.05 },
          { x: 0.75, y: 0.05 },
          { x: 1.0, y: 0.05 }
        ],
        starLife: 2000,
        starLifeMultiplier: 1.0
      };
      const lowLifespan = getFireworkLifespan(lowWaveEvent);
      expect(lowLifespan.liftTime).toBe(0.82);
      expect(lowLifespan.burstDuration).toBe(2.0);
      expect(lowLifespan.fadeoutDuration).toBe(2.0);
      expect(lowLifespan.burstStartTime).toBe(2.82);
      expect(lowLifespan.burstEndTime).toBe(4.82);

      // 2. High wave points (all at y = 1.0 => 300m, liftTime ~ 3.66s)
      const highWaveEvent = {
        time: 0.0,
        pattern: 'sweep-custom-curve',
        count: 5,
        duration: 2.0,
        wavePoints: [
          { x: 0.0, y: 1.0 },
          { x: 0.25, y: 1.0 },
          { x: 0.5, y: 1.0 },
          { x: 0.75, y: 1.0 },
          { x: 1.0, y: 1.0 }
        ]
      };
      const highLifespan = getFireworkLifespan(highWaveEvent);
      expect(highLifespan.liftTime).toBe(3.66);
      expect(highLifespan.burstDuration).toBe(2.0);
      expect(highLifespan.burstStartTime).toBe(3.66);
      expect(highLifespan.burstEndTime).toBe(5.66);

      // 3. Arch curve with varied heights: shell 0 at y=0.05 (lift=1.96s), shell 2 at y=1.0 (lift=3.66s, delay=1.0s)
      const archEvent = {
        time: 1.0,
        pattern: 'sweep-custom-curve',
        count: 5,
        duration: 2.0,
        wavePoints: [
          { x: 0.0, y: 0.05 },
          { x: 0.25, y: 0.5 },
          { x: 0.5, y: 1.0 },
          { x: 0.75, y: 0.5 },
          { x: 1.0, y: 0.05 }
        ]
      };
      const archLifespan = getFireworkLifespan(archEvent);
      // First burst: Shell 0 bursts at delay 0.0 + lift 0.82s = 0.82s
      expect(archLifespan.liftTime).toBe(0.82);
      // Last burst: Shell 2 bursts at delay 1.0 + lift 3.66s = 4.66s
      // Burst window: 4.66s - 0.82s = 3.84s
      expect(archLifespan.burstDuration).toBe(3.84);
      expect(archLifespan.burstStartTime).toBe(1.82);
      expect(archLifespan.burstEndTime).toBe(5.66);
    });
  });

  describe('TimelineEditor 3-Phase DOM Rendering & Snapping', () => {
    let mockShowDirector;
    let mockHotkeyManager;
    let createdElements;

    beforeEach(() => {
      vi.stubGlobal('requestAnimationFrame', vi.fn());
      createdElements = [];

      const createMockElement = (tag) => {
        const el = {
          tagName: tag.toUpperCase(),
          style: {},
          dataset: {},
          childNodes: [],
          appendChild: vi.fn((child) => {
            el.childNodes.push(child);
            return child;
          }),
          addEventListener: vi.fn(),
          getBoundingClientRect: vi.fn().mockReturnValue({
            left: 0,
            top: 0,
            width: 800,
            height: 600
          }),
          classList: {
            add: vi.fn(),
            remove: vi.fn()
          },
          title: '',
          textContent: '',
          innerHTML: ''
        };
        createdElements.push(el);
        return el;
      };

      vi.stubGlobal('document', {
        createElement: vi.fn().mockImplementation((tag) => createMockElement(tag)),
        getElementById: vi.fn().mockReturnValue(null),
        body: {
          appendChild: vi.fn(),
          style: {}
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      });

      vi.stubGlobal('window', {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      });

      mockShowDirector = {
        elapsedTime: 0,
        isPlaying: false,
        loadScript: vi.fn(),
        seek: vi.fn()
      };

      mockHotkeyManager = {
        register: vi.fn(),
        setActiveContext: vi.fn()
      };
    });

    it('renders 3-phase DOM blocks for firework sequences with distinct phases', () => {
      const editor = new TimelineEditor(mockShowDirector, mockHotkeyManager);
      const seq = {
        time: 2.0,
        type: 'sequence',
        preset: 'crysanthemum',
        count: 5,
        burstHeight: 75,
        duration: 2.0,
        starLife: 2000,
        starLifeMultiplier: 1.0
      };
      editor.sequences = [seq];
      editor.renderTracks();

      const block = editor.blockDomMap.get(seq);
      expect(block).toBeDefined();
      expect(block.dataset.hasLifespanPhases).toBe('true');

      // Lifespan for 75m: liftTime = 1.83s, burst = 2.0s, fade = 2.0s => total = 5.83s
      // Total width: 5.83s * 50px = 291.5px
      expect(parseFloat(block.style.width)).toBeCloseTo(291.5, 0);

      // Verify sub-phases exist as children
      const phases = block.childNodes.filter(
        (node) => node.className && node.className.includes('timeline-block-phase')
      );
      expect(phases.length).toBe(3);

      const [liftPhase, burstPhase, fadePhase] = phases;
      expect(liftPhase.className).toContain('timeline-phase-lift');
      expect(burstPhase.className).toContain('timeline-phase-burst');
      expect(fadePhase.className).toContain('timeline-phase-fadeout');

      // Verify burstPhase contains preset label
      expect(burstPhase.childNodes.length).toBeGreaterThan(0);

      // Verify resize handle exists and is positioned on Phase 2 right border
      const resizeHandle = block.childNodes.find(
        (node) => node.className && node.className.includes('timeline-block-resize-handle')
      );
      expect(resizeHandle).toBeDefined();
      // handleLeft = (liftTime * pixelsPerSecond) + burstWidth - 4
      // 1.83 * 50 + 100 - 4 = 91.5 + 100 - 4 = 187.5px
      expect(parseFloat(resizeHandle.style.left)).toBeCloseTo(187.5, 0);
    });

    it('supports dual-snap to beat: snaps launch and burst start to audio beats', () => {
      const editor = new TimelineEditor(mockShowDirector, mockHotkeyManager);
      const audioSeq = {
        time: 0.0,
        type: 'audio',
        beats: [10.0] // Beat at 10.0s
      };
      const fireworkSeq = {
        time: 5.0,
        type: 'sequence',
        burstHeight: 75, // liftTime = 1.83s
        duration: 2.0
      };
      editor.sequences = [audioSeq, fireworkSeq];

      // Simulate dragging fireworkSeq near beat for burst alignment
      // Target burst at 10.0s => launch should be 10.0 - 1.83 = 8.17s
      editor.isDragging = true;
      editor.draggedEvent = fireworkSeq;
      editor.selectedEvents = [fireworkSeq];
      editor.dragOffsetX = 0;

      // Mouse moved to position representing 8.15s (close to 8.17s burst target)
      const fakeEventBurst = {
        clientX: 8.15 * editor.pixelsPerSecond
      };
      editor.onDrag(fakeEventBurst);

      // Should snap to 8.17s so burst occurs exactly at 10.0s!
      expect(fireworkSeq.time).toBeCloseTo(8.17, 1);

      // Mouse moved to position representing 10.05s (close to 10.0s launch target)
      const fakeEventLaunch = {
        clientX: 10.05 * editor.pixelsPerSecond
      };
      editor.onDrag(fakeEventLaunch);

      // Should snap to 10.0s so launch occurs on beat!
      expect(fireworkSeq.time).toBe(10.0);
    });

    it('strips uiDuration in cleanSequence to avoid schema pollution', () => {
      const editor = new TimelineEditor(mockShowDirector, mockHotkeyManager);
      const dirtySeq = {
        time: 1.0,
        duration: 2.0,
        uiDuration: 5.8,
        _trackRow: 2,
        _deleted: false,
        preset: 'crysanthemum'
      };

      const cleaned = editor.cleanSequence(dirtySeq);
      expect(cleaned.uiDuration).toBeUndefined();
      expect(cleaned._trackRow).toBeUndefined();
      expect(cleaned._deleted).toBeUndefined();
      expect(cleaned.time).toBe(1.0);
      expect(cleaned.duration).toBe(2.0);
      expect(cleaned.preset).toBe('crysanthemum');
    });
  });
});
