import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WelcomeGuideStateMachine,
  WELCOME_GUIDE_STEPS,
  WELCOME_GUIDE_STORAGE_KEY
} from '../../../src/ui/guides/WelcomeGuideStateMachine.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key)
  };
}

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

describe('WelcomeGuideStateMachine', () => {
  let eventBus;
  let storage;
  let machine;

  beforeEach(() => {
    eventBus = createEventBus();
    storage = createMemoryStorage();
    machine = new WelcomeGuideStateMachine(
      eventBus,
      storage
    );
  });

  it('should start on first visit, advance on guidehub open, revert if closed, and complete on guide pick', () => {
    const started = machine.startIfNeeded();
    expect(started).toBe(true);
    expect(machine.isActive).toBe(true);
    expect(machine.getTotalSteps()).toBe(2);
    expect(machine.currentStep).toBe(WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB);

    // Step 1 -> Step 2 when GuideHubModal opens
    eventBus.emit('guidehub:opened');
    expect(machine.currentStep).toBe(WELCOME_GUIDE_STEPS.PICK_GUIDE);

    // Closing modal without selecting a guide returns cleanly to Step 1
    eventBus.emit('guidehub:closed');
    expect(machine.currentStep).toBe(WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB);

    // Re-open modal and launch a target guide -> Completed
    eventBus.emit('guidehub:opened');
    expect(machine.currentStep).toBe(WELCOME_GUIDE_STEPS.PICK_GUIDE);

    // Executing welcome_guide itself does not prematurely complete
    eventBus.emit('guidehub:guide-executed', { guideId: 'welcome_guide' });
    expect(machine.currentStep).toBe(WELCOME_GUIDE_STEPS.PICK_GUIDE);

    // Selecting another guide completes and persists
    eventBus.emit('guidehub:guide-executed', { guideId: 'quick_start' });
    expect(machine.currentStep).toBe(WELCOME_GUIDE_STEPS.COMPLETED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('guidehub:opened')).toBe(0);
    expect(eventBus.listenerCount('guidehub:closed')).toBe(0);
    expect(eventBus.listenerCount('guidehub:guide-executed')).toBe(0);

    // Next app launch should not auto-start
    const nextMachine = new WelcomeGuideStateMachine(
      eventBus,
      storage
    );
    expect(nextMachine.startIfNeeded()).toBe(false);
  });

  it('should unbind listeners and persist dismissed status on skip', () => {
    machine.startIfNeeded();
    expect(eventBus.listenerCount('guidehub:opened')).toBe(1);

    machine.dismiss();
    expect(machine.currentStep).toBe(WELCOME_GUIDE_STEPS.DISMISSED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('guidehub:opened')).toBe(0);

    const saved = JSON.parse(storage.getItem(WELCOME_GUIDE_STORAGE_KEY));
    expect(saved.step).toBe(WELCOME_GUIDE_STEPS.DISMISSED);

    const nextMachine = new WelcomeGuideStateMachine(
      eventBus,
      storage
    );
    expect(nextMachine.startIfNeeded()).toBe(false);
  });
});

describe('WelcomeGuideFlow with TimelineEditor and GuideHubModal', () => {
  it('should auto-start welcomeGuide on first TimelineEditor launch and destroy spotlight before chosen guide runs', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', createMemoryStorage());

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
        addEventListener: vi.fn((type, handler) => {
          if (!el._listeners) el._listeners = {};
          if (!el._listeners[type]) el._listeners[type] = [];
          el._listeners[type].push(handler);
        }),
        removeEventListener: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
        trigger: (type, eventObj = {}) => {
          const list = (el._listeners && el._listeners[type]) || [];
          list.forEach((fn) => fn(eventObj));
        },
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 10,
          top: 20,
          width: 120,
          height: 36
        }),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        click: vi.fn(() => {
          el.trigger('click', { stopPropagation: vi.fn() });
        }),
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

    const { TimelineEditor } = await import('../../../src/ui/TimelineEditor.js');
    const { WELCOME_GUIDE_STEPS: STEPS } = await import('../../../src/ui/guides/WelcomeGuideStateMachine.js');

    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn()
    };

    const editor = new TimelineEditor(mockDirector, null);

    // First launch triggers welcomeGuide, not onboardingFlow
    expect(editor.welcomeGuide.stateMachine.isActive).toBe(true);
    expect(editor.welcomeGuide.stateMachine.currentStep).toBe(STEPS.OPEN_GUIDE_HUB);
    expect(editor.onboardingFlow.stateMachine.isActive).toBe(false);
    expect(editor.welcomeGuide.spotlight.isVisible).toBe(true);

    // Clicking helpBtn opens GuideHubModal -> advances to PICK_GUIDE targeting listContainer
    editor.openGuideHub();
    expect(editor.guideHubModal.isVisible).toBe(true);
    expect(editor.welcomeGuide.stateMachine.currentStep).toBe(STEPS.PICK_GUIDE);
    const step2Config = editor.welcomeGuide.getStepConfig(STEPS.PICK_GUIDE);
    expect(step2Config.getTarget()).toBe(editor.guideHubModal.listContainer);

    // Choosing create_and_export_script cleans up welcomeGuide spotlight BEFORE starting target guide
    const createScriptCard = editor.guideHubModal.listContainer.children.find(
      (c) => c.dataset.guideId === 'create_and_export_script'
    );
    expect(createScriptCard).toBeDefined();
    createScriptCard.children[1].trigger('click');

    expect(editor.welcomeGuide.stateMachine.currentStep).toBe(STEPS.COMPLETED);
    expect(editor.welcomeGuide.spotlight.isVisible).toBe(false);
    expect(editor.createScriptGuide.stateMachine.isActive).toBe(true);

    editor.createScriptGuide.destroy();
  });
});

