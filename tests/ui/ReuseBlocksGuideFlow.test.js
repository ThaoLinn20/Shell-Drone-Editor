import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ReuseBlocksStateMachine,
  REUSE_GUIDE_STEPS
} from '../../src/ui/ReuseBlocksStateMachine.js';

function createEventBus() {
  const listeners = new Map();
  return {
    on: vi.fn((event, handler) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
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
        for (const handler of listeners.get(event)) {
          handler(payload);
        }
      }
    }),
    listenerCount: (event) => (listeners.has(event) ? listeners.get(event).size : 0)
  };
}

describe('ReuseBlocksStateMachine', () => {
  let eventBus;
  let machine;

  beforeEach(() => {
    eventBus = createEventBus();
    machine = new ReuseBlocksStateMachine(eventBus);
  });

  it('should walk through all 3 interactive steps and complete on JSON import', () => {
    machine.start(0);
    expect(machine.isActive).toBe(true);
    expect(machine.currentStep).toBe(REUSE_GUIDE_STEPS.SELECT_MULTIPLE);
    expect(machine.selectedCount).toBe(0);

    // Selecting 1 block updates progress but stays on Step 1
    eventBus.emit('timeline:selection-changed', { selectedCount: 1 });
    expect(machine.selectedCount).toBe(1);
    expect(machine.currentStep).toBe(REUSE_GUIDE_STEPS.SELECT_MULTIPLE);

    // Selecting 2+ blocks advances to Step 2
    eventBus.emit('timeline:selection-changed', { selectedCount: 2 });
    expect(machine.selectedCount).toBe(2);
    expect(machine.currentStep).toBe(REUSE_GUIDE_STEPS.EXPORT_SELECTED);

    // Block context menu opens -> tracks menu state while staying in Step 2
    const mockMenu = { id: 'menu' };
    eventBus.emit('timeline:context-menu-shown', {
      targetType: 'block',
      menuElement: mockMenu
    });
    expect(machine.activeContextMenuType).toBe('block');
    expect(machine.activeContextMenuElement).toBe(mockMenu);

    // Export succeeds -> advances to Step 3
    eventBus.emit('timeline:blocks-exported', {
      exportedCount: 2,
      onlySelected: true,
      filename: 'export_selected_blocks.json'
    });
    expect(machine.currentStep).toBe(REUSE_GUIDE_STEPS.REIMPORT_EMPTY_SPACE);
    expect(machine.activeContextMenuType).toBeNull();

    // Empty space context menu opens -> tracks empty_space
    eventBus.emit('timeline:context-menu-shown', {
      targetType: 'empty_space',
      menuElement: mockMenu
    });
    expect(machine.activeContextMenuType).toBe('empty_space');

    // JSON imported -> completes and unsubscribes all listeners
    eventBus.emit('timeline:json-imported', {
      importedCount: 2,
      type: 'sequence'
    });
    expect(machine.currentStep).toBe(REUSE_GUIDE_STEPS.COMPLETED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('timeline:selection-changed')).toBe(0);
    expect(eventBus.listenerCount('timeline:blocks-exported')).toBe(0);
    expect(eventBus.listenerCount('timeline:json-imported')).toBe(0);
  });

  it('should fall back to select_multiple if all blocks are deselected during Step 2', () => {
    machine.start(0);
    eventBus.emit('timeline:selection-changed', { selectedCount: 2 });
    expect(machine.currentStep).toBe(REUSE_GUIDE_STEPS.EXPORT_SELECTED);

    eventBus.emit('timeline:selection-changed', { selectedCount: 0 });
    expect(machine.currentStep).toBe(REUSE_GUIDE_STEPS.SELECT_MULTIPLE);
  });

  it('should unbind all listeners when dismissed', () => {
    machine.start(0);
    expect(eventBus.listenerCount('timeline:selection-changed')).toBe(1);

    machine.dismiss();
    expect(machine.currentStep).toBe(REUSE_GUIDE_STEPS.DISMISSED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('timeline:selection-changed')).toBe(0);
  });
});

describe('ReuseBlocksGuideFlow', () => {
  let ReuseBlocksGuideFlow;
  let TimelineEditor;
  let globalEventBus;

  beforeEach(async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {}
    });

    const createMockElement = () => {
      const el = {
        style: {},
        dataset: {},
        className: '',
        children: [],
        appendChild: vi.fn((child) => {
          el.children.push(child);
          return child;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 0,
          top: 20,
          width: 400,
          height: 200
        }),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        click: vi.fn(),
        title: '',
        innerHTML: '',
        textContent: '',
        querySelector: vi.fn(() => null)
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

    const flowMod = await import('../../src/ui/ReuseBlocksGuideFlow.js');
    ReuseBlocksGuideFlow = flowMod.ReuseBlocksGuideFlow;
    const editorMod = await import('../../src/ui/TimelineEditor.js');
    TimelineEditor = editorMod.TimelineEditor;
    const busMod = await import('../../src/core/EventBus.js');
    globalEventBus = busMod.globalEventBus;
  });

  it('should seed 2 sample blocks when timeline has fewer than 2 blocks and clear selection', () => {
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
    editor.selectedEvents = [{ time: 1 }];

    const flow = new ReuseBlocksGuideFlow(editor, globalEventBus);
    flow.start();

    expect(editor.sequences.length).toBe(2);
    expect(editor.selectedEvents).toEqual([]);
    expect(flow.stateMachine.currentStep).toBe(REUSE_GUIDE_STEPS.SELECT_MULTIPLE);
    expect(flow.spotlight.isVisible).toBe(true);

    flow.destroy();
  });
});

