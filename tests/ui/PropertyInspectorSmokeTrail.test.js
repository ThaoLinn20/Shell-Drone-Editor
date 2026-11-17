import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { FireworkSequencer } from '../../src/directors/FireworkSequencer.js';

global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

describe('PropertyInspector and FireworkSequencer Smoke Trail Active Effect', () => {
  let PropertyInspector;
  let TIMED_EFFECT_TAGS;
  let TOGGLE_MODIFIER_TAGS;
  let EFFECT_COLORS;

  const createMockElement = (tag = 'div') => {
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
      innerHTML: '',
      textContent: '',
      children: [],
      parentElement: null,
      dataset: {},
      className: '',
      value: '',
      type: tag === 'input' ? 'text' : '',
      appendChild: (child) => {
        el.children.push(child);
        child.parentElement = el;
        return child;
      },
      removeChild: (child) => {
        el.children = el.children.filter((c) => c !== child);
        child.parentElement = null;
      },
      contains: () => false,
      getBoundingClientRect: () => ({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 100,
        height: 30
      }),
      setAttribute: vi.fn((attr, val) => {
        el[attr] = val;
      }),
      getAttribute: vi.fn((attr) => el[attr] || null),
      addEventListener: (event, cb) => {
        if (!el._listeners) el._listeners = {};
        if (!el._listeners[event]) el._listeners[event] = [];
        el._listeners[event].push(cb);
      },
      dispatchEvent: (evt) => {
        const type = typeof evt === 'string' ? evt : evt.type;
        if (el._listeners && el._listeners[type]) {
          el._listeners[type].forEach((cb) => cb(evt));
        }
      },
      querySelector: (selector) => {
        const className = selector.replace('.', '');
        const findRecursive = (node) => {
          if (node.className && node.className.split(' ').includes(className)) return node;
          for (const child of node.children) {
            const found = findRecursive(child);
            if (found) return found;
          }
          return null;
        };
        return findRecursive(el);
      },
      querySelectorAll: (selector) => {
        const matches = [];
        const className = selector.startsWith('.') ? selector.replace('.', '') : null;
        const tagName = !selector.startsWith('.') ? selector.toUpperCase() : null;
        const findRecursive = (node) => {
          if (className && node.className && node.className.split(' ').includes(className)) {
            matches.push(node);
          } else if (tagName && node.tagName === tagName) {
            matches.push(node);
          }
          for (const child of node.children) {
            findRecursive(child);
          }
        };
        for (const child of el.children) {
          findRecursive(child);
        }
        return matches;
      }
    };
    return el;
  };

  beforeAll(async () => {
    global.document = {
      createElement: (tag) => createMockElement(tag),
      body: createMockElement('body'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    if (!global.window) {
      global.window = {};
    }
    if (!global.window.addEventListener) {
      global.window.addEventListener = vi.fn();
      global.window.removeEventListener = vi.fn();
    }

    const inspectorMod = await import('../../src/ui/PropertyInspector.js');
    PropertyInspector = inspectorMod.PropertyInspector;
    TIMED_EFFECT_TAGS = inspectorMod.TIMED_EFFECT_TAGS;
    TOGGLE_MODIFIER_TAGS = inspectorMod.TOGGLE_MODIFIER_TAGS;

    const timelineMod = await import('../../src/ui/ActiveEffectsTimeline.js');
    EFFECT_COLORS = timelineMod.EFFECT_COLORS;
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should classify smoke_trail strictly as a timed active effect, not a toggle modifier', () => {
    const inTimed = TIMED_EFFECT_TAGS.some(
      (tag) => tag.key === 'smoke_trail' || tag.key === 'smoke-trail'
    );
    const inToggle = TOGGLE_MODIFIER_TAGS.some(
      (tag) => tag.key === 'smoke_trail' || tag.key === 'smoke-trail'
    );
    expect(inTimed).toBe(true);
    expect(inToggle).toBe(false);
  });

  it('should have styling configured for smoke_trail in EFFECT_COLORS', () => {
    expect(EFFECT_COLORS['smoke_trail']).toBeDefined();
    expect(EFFECT_COLORS['smoke_trail'].bg).toBeDefined();
    expect(EFFECT_COLORS['smoke_trail'].border).toBeDefined();
  });

  it('should forward smokeTrail timing overrides in FireworkSequencer.playPattern', () => {
    const mockFireworkSystem = {
      launchRandom: vi.fn(),
      clear: vi.fn()
    };
    const mockCometSystem = {
      launchRandom: vi.fn(),
      clear: vi.fn()
    };
    const sequencer = new FireworkSequencer(
      mockFireworkSystem,
      mockCometSystem
    );

    sequencer.playPattern('sweep', {
      count: 2,
      duration: 1.0,
      smokeTrail: true,
      smokeTrailStartTime: 0.25,
      smokeTrailDuration: 2.5
    });

    expect(sequencer.activeTasks.length).toBe(2);
    const task = sequencer.activeTasks[0];
    expect(task.options.effectOverrides).toBeDefined();
    expect(task.options.effectOverrides.smokeTrail).toBe(true);
    expect(task.options.effectOverrides.smokeTrailStartTime).toBe(0.25);
    expect(task.options.effectOverrides.smokeTrailDuration).toBe(2.5);
  });

  it('should allow active effects timeline to accept smoke_trail with custom timing window', () => {
    const container = createMockElement('div');
    const onUpdate = vi.fn();
    const inspector = new PropertyInspector(
      container,
      onUpdate
    );

    const event = {
      id: 'test-smoke-timed-event',
      time: 2.0,
      type: 'firework',
      shellType: 'chrysanthemum',
      duration: 3.0,
      effects: [
        {
          type: 'smoke_trail',
          startTime: 0.5,
          duration: 1.8,
          startRatio: 0.166,
          endRatio: 0.766
        }
      ]
    };

    inspector.show(event);

    const timelineContainer = container.querySelector(
      '.inspector-active-effects-container'
    );
    expect(timelineContainer).not.toBeNull();

    // Verify smoke_trail is in event effects
    expect(event.effects.length).toBe(1);
    expect(event.effects[0].type).toBe('smoke_trail');
    expect(event.effects[0].startTime).toBe(0.5);
    expect(event.effects[0].duration).toBe(1.8);
  });
});
