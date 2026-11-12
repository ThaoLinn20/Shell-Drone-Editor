import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TimelineControlsStateMachine,
  TIMELINE_CONTROLS_STEPS
} from '../../../src/ui/guides/TimelineControlsStateMachine.js';

function createEventBus() {
  const listeners = new Map();
  return {
    on: vi.fn((event, handler) => {
      if (!listeners.has(event)) {
        listeners.set(
          event,
          new Set()
        );
      }
      listeners.get(event).add(handler);
    }),
    off: vi.fn((event, handler) => {
      if (listeners.has(event)) {
        listeners.get(event).delete(handler);
      }
    }),
    emit: vi.fn((event, payload) => {
      if (listeners.has(event)) {
        [...listeners.get(event)].forEach((fn) => fn(payload));
      }
    }),
    listenerCount: (event) => {
      return listeners.has(event) ? listeners.get(event).size : 0;
    }
  };
}

describe('TimelineControlsStateMachine', () => {
  let eventBus;
  let machine;
  let stepHistory;

  beforeEach(() => {
    eventBus = createEventBus();
    machine = new TimelineControlsStateMachine(eventBus);
    stepHistory = [];
    machine.onChange = (step) => {
      stepHistory.push(step);
    };
  });

  it('should progress through all 7 timeline control steps and clean up on complete', () => {
    const sampleBlock = { time: 1, type: 'sequence' };
    machine.start({
      selectedCount: 1,
      targetEvent: sampleBlock
    });

    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.MOVE_BLOCK);
    expect(machine.getTotalSteps()).toBe(7);

    // Step 1: Move block
    eventBus.emit(
      'timeline:block-moved',
      { event: sampleBlock, time: 2 }
    );
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.RESIZE_BLOCK);

    // Step 2: Resize block
    eventBus.emit(
      'timeline:block-resized',
      { event: sampleBlock, duration: 2.5 }
    );
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR);

    // Step 3: Pick Anchor Head via Ruler
    eventBus.emit(
      'timeline:anchor-changed',
      { time: 5.0, source: 'ruler' }
    );
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.COPY_BLOCK);

    // Step 4: Copy block
    eventBus.emit(
      'timeline:copied',
      { count: 1 }
    );
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.PASTE_BLOCK);

    // Step 5: Paste block at Anchor Head
    const pastedBlock = { time: 5.0, type: 'sequence' };
    eventBus.emit(
      'timeline:pasted',
      { count: 1, anchorTime: 5.0, events: [pastedBlock] }
    );
    expect(machine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK
    );
    expect(machine.targetEvent).toBe(pastedBlock);

    // Step 6: Right-click selected block
    eventBus.emit(
      'timeline:context-menu-shown',
      { targetType: 'block' }
    );
    expect(machine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY
    );

    // Step 7: Right-click empty space
    eventBus.emit(
      'timeline:context-menu-shown',
      { targetType: 'empty_space' }
    );
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.COMPLETED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('timeline:block-moved')).toBe(0);
    expect(eventBus.listenerCount('timeline:context-menu-shown')).toBe(0);
    expect(stepHistory).toEqual([
      TIMELINE_CONTROLS_STEPS.MOVE_BLOCK,
      TIMELINE_CONTROLS_STEPS.RESIZE_BLOCK,
      TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR,
      TIMELINE_CONTROLS_STEPS.COPY_BLOCK,
      TIMELINE_CONTROLS_STEPS.PASTE_BLOCK,
      TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK,
      TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY,
      TIMELINE_CONTROLS_STEPS.COMPLETED
    ]);
  });

  it('should enforce guards on anchor source, empty copy/paste, and context menu targetType', () => {
    machine.start({ selectedCount: 1 });

    eventBus.emit('timeline:block-moved', { event: { time: 2 } });
    eventBus.emit('timeline:block-resized', { event: { time: 2 } });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR);

    // Programmatic and beat-dot anchor changes must not skip the ruler instruction
    eventBus.emit('timeline:anchor-changed', { time: 3, source: 'programmatic' });
    eventBus.emit('timeline:anchor-changed', { time: 3, source: 'beat_dot' });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR);

    eventBus.emit('timeline:anchor-changed', { time: 4, source: 'ruler' });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.COPY_BLOCK);

    // Zero count copy does not advance
    eventBus.emit('timeline:copied', { count: 0 });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.COPY_BLOCK);

    eventBus.emit('timeline:copied', { count: 1 });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.PASTE_BLOCK);

    // Zero count paste does not advance
    eventBus.emit('timeline:pasted', { count: 0 });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.PASTE_BLOCK);

    eventBus.emit('timeline:pasted', { count: 1, events: [{ time: 4 }] });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK);

    // Empty-space menu during block right-click step must not advance
    eventBus.emit('timeline:context-menu-shown', { targetType: 'empty_space' });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK);

    eventBus.emit('timeline:context-menu-shown', { targetType: 'block' });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY);

    // Block menu during empty-space right-click step must not complete
    eventBus.emit('timeline:context-menu-shown', { targetType: 'block' });
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY);
  });

  it('should clean up all listeners when dismissed mid-guide', () => {
    machine.start({ selectedCount: 1 });
    expect(eventBus.listenerCount('timeline:block-moved')).toBe(1);
    expect(eventBus.listenerCount('timeline:copied')).toBe(1);

    machine.dismiss();
    expect(machine.currentStep).toBe(TIMELINE_CONTROLS_STEPS.DISMISSED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('timeline:block-moved')).toBe(0);
    expect(eventBus.listenerCount('timeline:copied')).toBe(0);
    expect(eventBus.listenerCount('timeline:anchor-changed')).toBe(0);
  });
});

describe('TimelineControlsGuideFlow integration with TimelineEditor', () => {
  let TimelineControlsGuideFlow;
  let TimelineEditor;
  let globalEventBus;

  beforeEach(async () => {
    vi.resetModules();

    const createMockStorage = () => {
      const store = new Map();
      return {
        getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
        setItem: vi.fn((k, v) => store.set(k, String(v))),
        removeItem: vi.fn((k) => store.delete(k)),
        clear: vi.fn(() => store.clear())
      };
    };

    vi.stubGlobal('localStorage', createMockStorage());
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn()
    );

    const createMockElement = () => {
      const el = {
        style: {},
        dataset: {},
        children: [],
        listeners: {},
        className: '',
        offsetHeight: 160,
        clientWidth: 1000,
        scrollLeft: 0,
        appendChild: vi.fn((child) => {
          el.children.push(child);
          return child;
        }),
        addEventListener: vi.fn((evt, cb) => {
          if (!el.listeners[evt]) {
            el.listeners[evt] = [];
          }
          el.listeners[evt].push(cb);
        }),
        removeEventListener: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
        getBoundingClientRect: vi.fn(() => ({
          left: 20,
          top: 400,
          width: 120,
          height: 36,
          bottom: 436
        })),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        click: vi.fn(),
        title: '',
        innerHTML: '',
        textContent: '',
        querySelector: vi.fn((selector) => {
          if (selector === '[data-role="resize-handle"]') {
            return el.children.find(
              (c) => c.dataset && c.dataset.role === 'resize-handle'
            ) || null;
          }
          return null;
        })
      };
      return el;
    };

    vi.stubGlobal('document', {
      createElement: vi.fn(() => createMockElement()),
      getElementById: vi.fn(() => null),
      body: {
        appendChild: vi.fn(),
        style: {}
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    vi.stubGlobal('window', {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      open: vi.fn()
    });

    const flowMod = await import(
      '../../../src/ui/guides/TimelineControlsGuideFlow.js'
    );
    TimelineControlsGuideFlow = flowMod.TimelineControlsGuideFlow;
    const editorMod = await import('../../../src/ui/TimelineEditor.js');
    TimelineEditor = editorMod.TimelineEditor;
    const busMod = await import('../../../src/core/EventBus.js');
    globalEventBus = busMod.globalEventBus;
  });

  it('should seed starter block if empty and ignore zero-delta drag/resize before advancing on real mutations', () => {
    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn()
    };
    const editor = new TimelineEditor(mockDirector, null);
    editor.sequences = [];
    editor.selectedEvents = [];

    const flow = new TimelineControlsGuideFlow(editor, globalEventBus);
    flow.start();

    expect(editor.sequences.length).toBe(1);
    expect(editor.selectedEvents.length).toBe(1);
    const starterBlock = editor.sequences[0];
    const blockEl = editor.blockDomMap.get(starterBlock);
    expect(blockEl).toBeDefined();
    expect(blockEl.dataset.selected).toBe('true');

    const resizeHandle = blockEl.querySelector('[data-role="resize-handle"]');
    expect(resizeHandle).toBeDefined();
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.MOVE_BLOCK
    );

    // Click without dragging (zero delta) should NOT emit timeline:block-moved
    editor.isDragging = true;
    editor.draggedEvent = starterBlock;
    starterBlock.initialTime = starterBlock.time;
    editor.onDragEnd({});
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.MOVE_BLOCK
    );

    // Real block move advances to resize step targeting resizeHandle
    editor.isDragging = true;
    editor.draggedEvent = starterBlock;
    starterBlock.initialTime = starterBlock.time;
    starterBlock.time = starterBlock.time + 1.5;
    editor.onDragEnd({});
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.RESIZE_BLOCK
    );
    expect(flow.getTargetResizeHandleElement()).toBe(resizeHandle);

    // Zero-delta resize click should NOT advance
    editor.isResizing = true;
    editor.resizedEvent = starterBlock;
    editor.initialDuration = starterBlock.uiDuration;
    editor.onDragEnd({});
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.RESIZE_BLOCK
    );

    // Real resize advances to select_anchor
    editor.isResizing = true;
    editor.resizedEvent = starterBlock;
    editor.initialDuration = starterBlock.uiDuration;
    starterBlock.uiDuration = 3.0;
    editor.onDragEnd({});
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR
    );

    // Programmatic anchor update does not advance; ruler click advances
    editor.setAnchorTime(2.0, false, 'programmatic');
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR
    );
    editor.setAnchorTime(6.0, true, 'ruler');
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.COPY_BLOCK
    );

    // Copy & Paste via TimelineEditor methods
    editor.clipboardEvents = [];
    editor.pasteSelected();
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.COPY_BLOCK
    );

    editor.selectedEvents = [starterBlock];
    editor.copySelected();
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.PASTE_BLOCK
    );

    editor.pasteSelected();
    expect(editor.sequences.length).toBe(2);
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK
    );

    // Context menu events complete guide cleanly
    globalEventBus.emit('timeline:context-menu-shown', {
      targetType: 'block'
    });
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY
    );

    globalEventBus.emit('timeline:context-menu-shown', {
      targetType: 'empty_space'
    });
    expect(flow.stateMachine.currentStep).toBe(
      TIMELINE_CONTROLS_STEPS.COMPLETED
    );

    flow.destroy();
  });
});

