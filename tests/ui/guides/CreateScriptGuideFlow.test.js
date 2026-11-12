import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CreateScriptStateMachine,
  CREATE_SCRIPT_STEPS
} from '../../../src/ui/guides/CreateScriptStateMachine.js';

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

describe('CreateScriptStateMachine', () => {
  let eventBus;
  let machine;

  beforeEach(() => {
    eventBus = createEventBus();
    machine = new CreateScriptStateMachine(eventBus);
  });

  it('should walk through all 7 interactive steps including confirm dialog and complete on full export', () => {
    machine.start();
    expect(machine.isActive).toBe(true);
    expect(machine.getTotalSteps()).toBe(7);
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.NEW_SCRIPT);

    // Step 1: Opening confirmation modal -> Step 2 (confirm OK)
    eventBus.emit('timeline:new-script-confirm-opened');
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.CONFIRM_NEW_SCRIPT);

    // Cancelling confirmation returns cleanly to Step 1
    eventBus.emit('timeline:new-script-confirm-cancelled');
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.NEW_SCRIPT);

    // Re-open confirmation and confirm OK -> Step 3
    eventBus.emit('timeline:new-script-confirm-opened');
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.CONFIRM_NEW_SCRIPT);
    eventBus.emit('timeline:new-script-created');
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.ADD_SEQUENCE_BTN);

    // Step 2: Add Sequence from toolbar -> Step 3
    eventBus.emit('timeline:sequence-added', { source: 'toolbar', time: 0 });
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.ADD_SEQUENCE_MENU);

    // Step 3: Toolbar add-sequence does NOT satisfy Step 3; only context_menu does
    eventBus.emit('timeline:sequence-added', { source: 'toolbar', time: 1 });
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.ADD_SEQUENCE_MENU);

    const mockMenu = { id: 'ctx-menu' };
    eventBus.emit('timeline:context-menu-shown', {
      targetType: 'empty_space',
      menuElement: mockMenu
    });
    expect(machine.activeContextMenuType).toBe('empty_space');
    expect(machine.activeContextMenuElement).toBe(mockMenu);

    eventBus.emit('timeline:sequence-added', { source: 'context_menu', time: 4 });
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.PLAY_PREVIEW);
    expect(machine.activeContextMenuType).toBeNull();

    // Step 4: Playback started (Space or Play) -> Step 5
    eventBus.emit('timeline:playback-started');
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.SAVE_SCRIPT);

    // Step 5: Ctrl+S saved -> Step 6
    eventBus.emit('timeline:script-saved', { filename: 'untitled.json' });
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.EXPORT_ALL);

    // Step 6: Selected-only export should NOT complete; full export (onlySelected: false) completes
    eventBus.emit('timeline:blocks-exported', { onlySelected: true });
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.EXPORT_ALL);

    eventBus.emit('timeline:blocks-exported', { onlySelected: false });
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.COMPLETED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('timeline:new-script-created')).toBe(0);
    expect(eventBus.listenerCount('timeline:sequence-added')).toBe(0);
    expect(eventBus.listenerCount('timeline:playback-started')).toBe(0);
    expect(eventBus.listenerCount('timeline:script-saved')).toBe(0);
    expect(eventBus.listenerCount('timeline:blocks-exported')).toBe(0);
  });

  it('should unbind all listeners when dismissed', () => {
    machine.start();
    expect(eventBus.listenerCount('timeline:new-script-created')).toBe(1);

    machine.dismiss();
    expect(machine.currentStep).toBe(CREATE_SCRIPT_STEPS.DISMISSED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('timeline:new-script-created')).toBe(0);
  });
});

describe('CreateScriptGuideFlow', () => {
  it('should start at new_script step and highlight newBtn', async () => {
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
          left: 10,
          top: 20,
          width: 80,
          height: 30
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

    const { CreateScriptGuideFlow } = await import('../../../src/ui/guides/CreateScriptGuideFlow.js');
    const { TimelineEditor } = await import('../../../src/ui/TimelineEditor.js');
    const { globalEventBus } = await import('../../../src/core/EventBus.js');

    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn()
    };
    const editor = new TimelineEditor(mockDirector, null);
    const flow = new CreateScriptGuideFlow(editor, globalEventBus);

    flow.start();

    expect(flow.stateMachine.currentStep).toBe(CREATE_SCRIPT_STEPS.NEW_SCRIPT);
    expect(flow.spotlight.isVisible).toBe(true);
    expect(editor.newBtn).toBeDefined();
    expect(editor.addBtn).toBeDefined();
    expect(editor.exportBtn).toBeDefined();

    // Confirm modal step resolves confirm OK button target when mounted
    const mockConfirmOkBtn = {
      dataset: { confirmAction: 'ok' },
      getBoundingClientRect: vi.fn().mockReturnValue({
        left: 100,
        top: 100,
        width: 60,
        height: 28
      })
    };
    document.querySelectorAll = vi.fn(() => [mockConfirmOkBtn]);
    const confirmConfig = flow.getStepConfig(CREATE_SCRIPT_STEPS.CONFIRM_NEW_SCRIPT);
    expect(confirmConfig.getTarget()).toBe(mockConfirmOkBtn);

    flow.destroy();
  });

  it('should skip confirm step directly when timeline is already empty on new-script-created', () => {
    const emptyEventBus = createEventBus();
    const emptyMachine = new CreateScriptStateMachine(emptyEventBus);
    emptyMachine.start();
    emptyEventBus.emit('timeline:new-script-created');
    expect(emptyMachine.currentStep).toBe(CREATE_SCRIPT_STEPS.ADD_SEQUENCE_BTN);
  });
});

