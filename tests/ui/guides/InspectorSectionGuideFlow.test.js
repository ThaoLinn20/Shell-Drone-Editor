import { describe, it, expect, beforeEach, vi } from 'vitest';
import { INSPECTOR_GUIDE_CONFIGS } from '../../../src/ui/guides/inspectorGuideConfigs.js';
import {
  InspectorSectionStateMachine,
  INSPECTOR_GUIDE_STATUS
} from '../../../src/ui/guides/InspectorSectionStateMachine.js';

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

describe('InspectorSectionStateMachine across all 5 custom_sequence guides', () => {
  let eventBus;

  beforeEach(() => {
    eventBus = createEventBus();
  });

  it.each(INSPECTOR_GUIDE_CONFIGS)(
    'should walk overview -> hands-on fields -> preview completion for $id',
    (config) => {
      const machine = new InspectorSectionStateMachine(
        eventBus,
        config
      );
      const history = [];
      machine.onChange = (step) => history.push(step);

      machine.start();
      expect(machine.isActive).toBe(true);
      expect(machine.getTotalSteps()).toBe(config.steps.length);
      expect(machine.currentStep).toBe('overview');

      // Field edits and preview triggers must NOT auto-advance in Property Inspector guides
      eventBus.emit('inspector:field-changed', { fieldName: 'pattern' });
      eventBus.emit('inspector:preview-triggered', { count: 1 });
      expect(machine.currentStep).toBe('overview');

      machine.advanceOverview();

      for (let i = 1; i < config.steps.length; i += 1) {
        const step = config.steps[i];
        expect(machine.currentStep).toBe(step.id);

        if (step.kind === 'field') {
          eventBus.emit('inspector:field-changed', {
            fieldName: step.fieldName,
            value: step.expectedValue
          });
          expect(machine.currentStep).toBe(step.id);
          machine.nextStep();
        } else if (step.kind === 'preview') {
          eventBus.emit('inspector:preview-triggered', { count: 1 });
          expect(machine.currentStep).toBe(step.id);
          expect(machine.hasTriggeredPreview).toBe(true);
          machine.nextStep();
        }
      }

      expect(machine.currentStep).toBe(INSPECTOR_GUIDE_STATUS.COMPLETED);
      expect(machine.isActive).toBe(false);
      expect(eventBus.listenerCount('inspector:field-changed')).toBe(0);
      expect(eventBus.listenerCount('inspector:preview-triggered')).toBe(0);
      expect(history[history.length - 1]).toBe(
        INSPECTOR_GUIDE_STATUS.COMPLETED
      );
    }
  );

  it('should unbind all listeners when dismissed mid-guide', () => {
    const machine = new InspectorSectionStateMachine(
      eventBus,
      INSPECTOR_GUIDE_CONFIGS[0]
    );
    machine.start();
    expect(eventBus.listenerCount('inspector:field-changed')).toBe(1);
    expect(eventBus.listenerCount('inspector:preview-triggered')).toBe(1);

    machine.dismiss();
    expect(machine.currentStep).toBe(INSPECTOR_GUIDE_STATUS.DISMISSED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('inspector:field-changed')).toBe(0);
    expect(eventBus.listenerCount('inspector:preview-triggered')).toBe(0);
  });
});

describe('InspectorSectionGuideFlow integration with TimelineEditor & PropertyInspector', () => {
  let TimelineEditor;
  let globalEventBus;

  beforeEach(async () => {
    vi.resetModules();

    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
      setItem: vi.fn((k, v) => store.set(k, String(v))),
      removeItem: vi.fn((k) => store.delete(k)),
      clear: vi.fn(() => store.clear())
    });
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const matchSelector = (node, selector) => {
      const parts = selector.trim().split(/\s+/);
      const last = parts[parts.length - 1];
      if (last.startsWith('.')) {
        const cls = last.slice(1);
        return Boolean(
          node.className && node.className.split(' ').includes(cls)
        );
      }
      const attrMatches = [...last.matchAll(/\[([^=\]]+)="([^"]+)"\]/g)];
      if (attrMatches.length > 0) {
        return attrMatches.every(([, attr, val]) => {
          const camel = attr
            .replace(/^data-/, '')
            .replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          return node.dataset && node.dataset[camel] === val;
        });
      }
      return node.tagName && node.tagName.toLowerCase() === last.toLowerCase();
    };

    const createMockElement = (tag = 'div') => {
      let _innerHTML = '';
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        dataset: {},
        children: [],
        parentElement: null,
        listeners: {},
        className: '',
        value: '',
        disabled: false,
        title: '',
        offsetHeight: 160,
        clientWidth: 1000,
        scrollLeft: 0,
        scrollIntoView: vi.fn(),
        appendChild: (child) => {
          el.children.push(child);
          child.parentElement = el;
          return child;
        },
        addEventListener: (evt, cb) => {
          if (!el.listeners[evt]) el.listeners[evt] = [];
          el.listeners[evt].push(cb);
        },
        removeEventListener: vi.fn(),
        remove: vi.fn(),
        contains: () => false,
        getBoundingClientRect: () => ({
          left: 1500,
          top: 120,
          width: 300,
          height: 44,
          bottom: 164
        }),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        setAttribute: vi.fn((attr, val) => {
          el[attr] = val;
        }),
        getAttribute: vi.fn((attr) => el[attr] || null),
        click: vi.fn(),
        trigger: (evt, payload = {}) => {
          if (el.listeners[evt]) {
            el.listeners[evt].forEach((cb) => cb(payload));
          }
        },
        get innerHTML() {
          return _innerHTML;
        },
        set innerHTML(val) {
          _innerHTML = val;
          if (val === '') {
            el.children = [];
          }
        },
        textContent: '',
        querySelector: (selector) => {
          const findRecursive = (node) => {
            if (matchSelector(node, selector)) {
              return node;
            }
            for (const child of node.children) {
              const found = findRecursive(child);
              if (found) return found;
            }
            return null;
          };
          return findRecursive(el);
        },
        querySelectorAll: () => []
      };
      return el;
    };

    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => createMockElement(tag)),
      getElementById: vi.fn(() => null),
      activeElement: null,
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

    const editorMod = await import('../../../src/ui/TimelineEditor.js');
    TimelineEditor = editorMod.TimelineEditor;
    const busMod = await import('../../../src/core/EventBus.js');
    globalEventBus = busMod.globalEventBus;
  });

  it('should seed sequence, auto-expand collapsed group, emit field-changed, and complete on preview click', () => {
    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
      previewEvents: vi.fn(() => true)
    };

    const editor = new TimelineEditor(mockDirector, null);
    editor.sequences = [];
    editor.selectedEvents = [];
    editor.inspector.collapsedGroups.visualEffects = true;

    editor.startInspectorGuide('inspector_visual_effects');
    const flow = editor.inspectorGuides.inspector_visual_effects;

    expect(editor.sequences.length).toBe(1);
    expect(editor.inspector.collapsedGroups.visualEffects).toBe(false);
    expect(flow.stateMachine.currentStep).toBe('overview');

    const groupEl = flow.resolveStepTarget(
      flow.stateMachine.getActiveStepConfig()
    );
    expect(groupEl.dataset.groupKey).toBe('visualEffects');
    expect(groupEl.scrollIntoView).toHaveBeenCalled();
    expect(
      parseFloat(flow.spotlight.tooltipCard.style.left)
    ).toBeLessThan(1500);

    // Advance overview -> color -> shellSize -> starLifeMultiplier -> preview
    flow.stateMachine.advanceOverview();
    expect(flow.stateMachine.currentStep).toBe('color');
    const colorFieldEl = flow.resolveStepTarget(
      flow.stateMachine.getActiveStepConfig()
    );
    expect(colorFieldEl.dataset.fieldName).toBe('color');

    // Field changes do not auto-jump step; user navigates manually with Back / Next
    editor.inspector.emitFieldChanged('color');
    expect(flow.stateMachine.currentStep).toBe('color');

    flow.stateMachine.nextStep();
    expect(flow.stateMachine.currentStep).toBe('shellSize');

    flow.stateMachine.previousStep();
    expect(flow.stateMachine.currentStep).toBe('color');
    flow.stateMachine.nextStep();
    expect(flow.stateMachine.currentStep).toBe('shellSize');

    editor.inspector.emitFieldChanged('shellSize');
    expect(flow.stateMachine.currentStep).toBe('shellSize');
    flow.stateMachine.nextStep();
    expect(flow.stateMachine.currentStep).toBe('starLifeMultiplier');

    editor.inspector.emitFieldChanged('starLifeMultiplier');
    expect(flow.stateMachine.currentStep).toBe('starLifeMultiplier');
    flow.stateMachine.nextStep();
    expect(flow.stateMachine.currentStep).toBe('preview');

    const previewBtn = editor.inspector.container.querySelector(
      '.inspector-preview-btn'
    );
    expect(previewBtn).not.toBeNull();
    expect(flow.spotlight.highlightBox.style.boxShadow).not.toContain('0.55');

    previewBtn.trigger('click', { stopPropagation: vi.fn() });

    // Preview removes dark backdrop so user watches 3D sky and advances manually with Next/Finish
    expect(mockDirector.previewEvents).toHaveBeenCalledTimes(1);
    expect(flow.stateMachine.currentStep).toBe('preview');
    expect(flow.spotlight.highlightBox.style.boxShadow).toContain('rgba(0, 0, 0, 0)');
    expect(flow.spotlight.highlightBox.style.boxShadow).not.toContain('0.55');

    flow.stateMachine.nextStep();
    expect(flow.stateMachine.currentStep).toBe(
      INSPECTOR_GUIDE_STATUS.COMPLETED
    );

    flow.destroy();
  });

  it('should not emit inspector:field-changed on keystroke input before change commit', () => {
    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
      previewEvents: vi.fn(() => true)
    };

    const editor = new TimelineEditor(mockDirector, null);
    editor.sequences = [];
    editor.selectedEvents = [];
    editor.startInspectorGuide('inspector_core_settings');
    const flow = editor.inspectorGuides.inspector_core_settings;

    // Jump to count step
    while (flow.stateMachine.currentStep !== 'count') {
      flow.stateMachine.nextStep();
    }

    const countWrapper = editor.inspector.container.querySelector(
      '[data-field-name="count"]'
    );
    const countInput = countWrapper && countWrapper.querySelector('input');
    expect(countInput).not.toBeNull();

    // Typing '1' via input event should update data without jumping step prematurely
    countInput.trigger('input', { target: { value: '1' } });
    expect(flow.stateMachine.currentStep).toBe('count');

    // Committing '15' via change event updates data while staying on count until user clicks Next
    countInput.trigger('change', { target: { value: '15' } });
    expect(flow.stateMachine.currentStep).toBe('count');
    flow.stateMachine.nextStep();
    expect(flow.stateMachine.currentStep).toBe('duration');

    flow.destroy();
  });

  it('should show Next Guide button on final step of non-final Property Inspector guides and launch the next one', () => {
    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn(),
      previewEvents: vi.fn(() => true)
    };

    const editor = new TimelineEditor(mockDirector, null);
    editor.sequences = [];
    editor.selectedEvents = [];

    editor.startInspectorGuide('inspector_core_settings');
    const coreFlow = editor.inspectorGuides.inspector_core_settings;

    // Non-final step has no Next Guide action
    expect(coreFlow.getStepActions().length).toBe(1);

    // Move to final step of core settings
    while (coreFlow.stateMachine.currentStep !== 'preview') {
      coreFlow.stateMachine.nextStep();
    }

    const finalActions = coreFlow.getStepActions();
    // Expect Next Guide + Previous + Finish
    expect(finalActions.length).toBe(3);
    expect(finalActions[0].label).toBe('Next Guide');

    finalActions[0].onClick();
    expect(coreFlow.stateMachine.currentStep).toBe(
      INSPECTOR_GUIDE_STATUS.COMPLETED
    );
    const compFlow = editor.inspectorGuides.inspector_composition;
    expect(compFlow.stateMachine.isActive).toBe(true);
    expect(compFlow.stateMachine.currentStep).toBe('overview');

    // Last guide (geometryOffsets) has no Next Guide button on its final step
    compFlow.destroy();
    editor.startInspectorGuide('inspector_geometry_offsets');
    const geoFlow = editor.inspectorGuides.inspector_geometry_offsets;
    while (geoFlow.stateMachine.currentStep !== 'preview') {
      geoFlow.stateMachine.nextStep();
    }
    const geoFinalActions = geoFlow.getStepActions();
    expect(geoFinalActions.length).toBe(2);

    geoFlow.destroy();
  });
});

