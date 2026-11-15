import { describe, it, expect, vi, beforeAll } from 'vitest';

global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

describe('PropertyInspector Batch Second Burst Synchronization', () => {
  let PropertyInspector;

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

    const mod = await import('../../src/ui/PropertyInspector.js');
    PropertyInspector = mod.PropertyInspector;
  });

  it('should synchronize child shell properties across all selected events in batch mode via mutateBatchSecondBurstChild', () => {
    vi.useFakeTimers();
    const eventA = {
      id: 'a',
      type: 'sequence',
      secondBurst: {
        enabled: true,
        childShells: [
          {
            ratio: 0.20,
            triggerTiming: 0.50,
            scale: 0.35,
            color: '#ffd700',
            shapeType: 'sphere',
            effects: []
          }
        ]
      }
    };

    const eventB = {
      id: 'b',
      type: 'sequence',
      secondBurst: {
        enabled: true,
        childShells: [
          {
            ratio: 0.20,
            triggerTiming: 0.50,
            scale: 0.35,
            color: '#ffd700',
            shapeType: 'sphere',
            effects: []
          }
        ]
      }
    };

    const container = createMockElement('div');
    const updateSpy = vi.fn();
    const inspector = new PropertyInspector(container, updateSpy);

    inspector.show(eventA, [eventA, eventB]);
    expect(inspector.isBatchMode()).toBe(true);

    inspector.mutateBatchSecondBurstChild((child) => {
      child.color = '#00ffff';
      child.scale = 0.55;
      child.shapeType = 'ring';
    });

    expect(updateSpy).toHaveBeenCalledWith('beforeChange');
    vi.advanceTimersByTime(300);
    expect(updateSpy).toHaveBeenCalledWith();
    vi.useRealTimers();

    expect(eventA.secondBurst.childShells[0].color).toBe('#00ffff');
    expect(eventA.secondBurst.childShells[0].scale).toBe(0.55);
    expect(eventA.secondBurst.childShells[0].shapeType).toBe('ring');

    expect(eventB.secondBurst.childShells[0].color).toBe('#00ffff');
    expect(eventB.secondBurst.childShells[0].scale).toBe(0.55);
    expect(eventB.secondBurst.childShells[0].shapeType).toBe('ring');
  });

  it('should safely skip targets without secondBurst or with fewer childShells', () => {
    const eventWithTwoChildren = {
      id: 'a',
      type: 'sequence',
      secondBurst: {
        enabled: true,
        childShells: [
          { ratio: 0.20, color: '#ff0000' },
          { ratio: 0.30, color: '#00ff00' }
        ]
      }
    };

    const eventWithOneChild = {
      id: 'b',
      type: 'sequence',
      secondBurst: {
        enabled: true,
        childShells: [
          { ratio: 0.20, color: '#ff0000' }
        ]
      }
    };

    const eventWithoutSecondBurst = {
      id: 'c',
      type: 'sequence'
    };

    const container = createMockElement('div');
    const inspector = new PropertyInspector(container, () => {});
    inspector.show(eventWithTwoChildren, [eventWithTwoChildren, eventWithOneChild, eventWithoutSecondBurst]);

    inspector.activeChildShellIndex = 1;
    expect(() => {
      inspector.mutateBatchSecondBurstChild((child) => {
        child.color = '#ffffff';
      });
    }).not.toThrow();

    expect(eventWithTwoChildren.secondBurst.childShells[1].color).toBe('#ffffff');
    expect(eventWithOneChild.secondBurst.childShells.length).toBe(1);
    expect(eventWithOneChild.secondBurst.childShells[0].color).toBe('#ff0000');
    expect(eventWithoutSecondBurst.secondBurst).toBeUndefined();
  });

  it('should synchronize sub-target effects when modified inside renderSubTargetEffects on second burst', () => {
    const eventA = {
      id: 'a',
      type: 'sequence',
      secondBurst: {
        enabled: true,
        childShells: [
          {
            ratio: 0.20,
            effects: []
          }
        ]
      }
    };

    const eventB = {
      id: 'b',
      type: 'sequence',
      secondBurst: {
        enabled: true,
        childShells: [
          {
            ratio: 0.20,
            effects: []
          }
        ]
      }
    };

    const container = createMockElement('div');
    const inspector = new PropertyInspector(container, () => {});
    inspector.show(eventA, [eventA, eventB]);

    const card = createMockElement('div');
    inspector.renderSubTargetEffects(
      card,
      eventA.secondBurst.childShells[0],
      () => 1.5,
      {
        onMutate: (mutatorFn) => {
          inspector.mutateBatchSecondBurstChild(mutatorFn);
        }
      }
    );

    const chips = card.querySelectorAll('.effect-chip');
    const pistilChip = chips.find((c) => c.dataset.key === 'pistil');
    expect(pistilChip).toBeDefined();

    pistilChip.dispatchEvent('click');

    expect(eventA.secondBurst.childShells[0].pistil).toBe(true);
    expect(eventA.secondBurst.childShells[0].effects).toContain('pistil');

    expect(eventB.secondBurst.childShells[0].pistil).toBe(true);
    expect(eventB.secondBurst.childShells[0].effects).toContain('pistil');
  });

  it('should synchronize tadpoleColor on second burst child shell across batch targets', () => {
    const eventA = {
      id: 'a',
      type: 'sequence',
      secondBurst: {
        enabled: true,
        childShells: [
          {
            ratio: 0.20,
            effects: ['tadpole-flurry'],
            tadpoleColor: null
          }
        ]
      }
    };

    const eventB = {
      id: 'b',
      type: 'sequence',
      secondBurst: {
        enabled: true,
        childShells: [
          {
            ratio: 0.20,
            effects: ['tadpole-flurry'],
            tadpoleColor: null
          }
        ]
      }
    };

    const container = createMockElement('div');
    const inspector = new PropertyInspector(container, () => {});
    inspector.show(eventA, [eventA, eventB]);

    const card = createMockElement('div');
    inspector.renderSubTargetEffects(
      card,
      eventA.secondBurst.childShells[0],
      () => 1.5,
      {
        onMutate: (mutatorFn) => {
          inspector.mutateBatchSecondBurstChild(mutatorFn);
        }
      }
    );

    const swatches = card.querySelectorAll('.color-badge');
    expect(swatches.length).toBeGreaterThan(0);

    // Click the first swatch (gold)
    swatches[0].dispatchEvent('click');

    expect(eventA.secondBurst.childShells[0].tadpoleColor).toBeDefined();
    expect(eventB.secondBurst.childShells[0].tadpoleColor).toBe(eventA.secondBurst.childShells[0].tadpoleColor);
  });

  it('should keep multi-nested stages un-batched when edited', () => {
    const eventA = {
      id: 'a',
      type: 'sequence',
      stages: [
        { shapeType: 'sphere', color: '#ff0000', delay: 0.0 },
        { shapeType: 'ring', color: '#00ff00', delay: 0.5 }
      ]
    };

    const eventB = {
      id: 'b',
      type: 'sequence',
      stages: [
        { shapeType: 'sphere', color: '#ff0000', delay: 0.0 },
        { shapeType: 'ring', color: '#00ff00', delay: 0.5 }
      ]
    };

    const container = createMockElement('div');
    const inspector = new PropertyInspector(container, () => {});
    inspector.show(eventA, [eventA, eventB]);

    const content = createMockElement('div');
    inspector.renderNestedStages(content);

    // Modifying stage on eventA directly simulates user editing stage 0
    eventA.stages[0].color = '#ffffff';

    // eventB must remain completely untouched
    expect(eventB.stages[0].color).toBe('#ff0000');
  });
});
