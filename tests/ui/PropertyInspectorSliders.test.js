import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';

global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

describe('PropertyInspector Sliders and Star Lifetime Multiplier', () => {
  let PropertyInspector;
  let ACTIVE_EFFECT_TAGS;
  let TIMED_EFFECT_TAGS;
  let TOGGLE_MODIFIER_TAGS;
  let FireworkSystem;

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
    ACTIVE_EFFECT_TAGS = inspectorMod.ACTIVE_EFFECT_TAGS;
    TIMED_EFFECT_TAGS = inspectorMod.TIMED_EFFECT_TAGS;
    TOGGLE_MODIFIER_TAGS = inspectorMod.TOGGLE_MODIFIER_TAGS;

    const fireworkMod = await import('../../src/systems/FireworkSystem.js');
    FireworkSystem = fireworkMod.FireworkSystem;
  });

  it('should remove long-burn from ACTIVE_EFFECT_TAGS', () => {
    const keys = ACTIVE_EFFECT_TAGS.map((tag) => tag.key);
    expect(keys).not.toContain('long-burn');
  });

  it('should include flow and no-trail in TIMED_EFFECT_TAGS, and not burst-smoke', () => {
    const keys = TIMED_EFFECT_TAGS.map((tag) => tag.key);
    expect(keys).toContain('flow');
    expect(keys).toContain('no-trail');
    expect(keys).toContain('strobe');
    expect(keys).not.toContain('burst-smoke');
    expect(keys).not.toContain('no-burst');
    expect(keys).not.toContain('pistil');
    expect(keys).not.toContain('apex-hang');
  });

  it('should include burst-smoke, pistil, apex-hang and slow-burst in TOGGLE_MODIFIER_TAGS', () => {
    const keys = TOGGLE_MODIFIER_TAGS.map((tag) => tag.key);
    expect(keys).toContain('burst-smoke');
    expect(keys).toContain('pistil');
    expect(keys).toContain('apex-hang');
    expect(keys).toContain('slow-burst');
    expect(keys).not.toContain('no-burst');
    expect(keys).not.toContain('flow');
    expect(keys).not.toContain('no-trail');
  });

  it('should render toggle modifier chips and toggle event properties on click', () => {
    const mockContainer = createMockElement('div');
    const onUpdate = vi.fn();
    const inspector = new PropertyInspector(mockContainer, onUpdate);
    const targetEvent = {
      preset: 'crysanthemum',
      effects: []
    };
    inspector.selectedEvent = targetEvent;

    const parentDiv = createMockElement('div');
    inspector.renderToggleModifiers(parentDiv, targetEvent);

    const wrapper = parentDiv.children[0];
    const chips = wrapper.children[1].children;
    const burstSmokeChip = chips.find((c) => c.dataset.key === 'burst-smoke');
    const pistilChip = chips.find((c) => c.dataset.key === 'pistil');
    expect(burstSmokeChip).toBeDefined();
    expect(pistilChip).toBeDefined();

    // Click burst-smoke chip
    burstSmokeChip.dispatchEvent({ type: 'click' });
    expect(targetEvent.burstSmoke).toBe(true);
    expect(targetEvent['burst-smoke']).toBe(true);

    // Click again to turn off burst-smoke
    burstSmokeChip.dispatchEvent({ type: 'click' });
    expect(targetEvent.burstSmoke).toBeUndefined();
    expect(targetEvent['burst-smoke']).toBeUndefined();

    // Click pistil chip
    pistilChip.dispatchEvent({ type: 'click' });
    expect(targetEvent.pistil).toBe(true);

    // Click again to turn off
    pistilChip.dispatchEvent({ type: 'click' });
    expect(targetEvent.pistil).toBe(false);
  });

  it('should not contain instantBurst or pistil as standalone fields in compositionSettings', () => {
    const mockContainer = createMockElement('div');
    const inspector = new PropertyInspector(mockContainer, vi.fn());
    const eventGroups = inspector.getSchema().event;
    const compGroup = eventGroups.find((g) => g.groupKey === 'compositionSettings');
    expect(compGroup).toBeDefined();
    const fieldNames = compGroup.fields.map((f) => f.name);
    expect(fieldNames).not.toContain('instantBurst');
    expect(fieldNames).not.toContain('pistil');
    expect(fieldNames).toContain('shapeType');
    expect(fieldNames).toContain('dynamicsType');
    expect(fieldNames).toContain('effects');
  });

  it('should configure shellSize and starLifeMultiplier as sliders in visualEffects group', () => {
    const mockContainer = createMockElement('div');
    const inspector = new PropertyInspector(mockContainer, vi.fn());
    const eventGroups = inspector.getSchema().event;
    const visualGroup = eventGroups.find((g) => g.groupKey === 'visualEffects');

    expect(visualGroup).toBeDefined();

    const colorField = visualGroup.fields.find((f) => f.name === 'color');
    expect(colorField).toBeDefined();
    expect(colorField.span).toBe(2);

    const shellSizeField = visualGroup.fields.find((f) => f.name === 'shellSize');
    expect(shellSizeField).toBeDefined();
    expect(shellSizeField.type).toBe('slider');
    expect(shellSizeField.min).toBe('0.2');
    expect(shellSizeField.max).toBe('5.0');
    expect(shellSizeField.span).toBe(2);

    const starLifeField = visualGroup.fields.find((f) => f.name === 'starLifeMultiplier');
    expect(starLifeField).toBeDefined();
    expect(starLifeField.type).toBe('slider');
    expect(starLifeField.min).toBe('0.4');
    expect(starLifeField.max).toBe('5.0');
    expect(starLifeField.span).toBe(2);

    const cometTrailField = visualGroup.fields.find((f) => f.name === 'cometTrail');
    expect(cometTrailField).toBeDefined();
    expect(cometTrailField.span).toBe(2);
  });

  it('should render slider element with correct values and update event on input', () => {
    vi.useFakeTimers();
    const mockContainer = createMockElement('div');
    const onUpdate = vi.fn();
    const inspector = new PropertyInspector(mockContainer, onUpdate);

    const event = {
      shellSize: 1.5,
      starLifeMultiplier: 1.8
    };
    inspector.selectedEvent = event;

    const parentDiv = createMockElement('div');
    inspector.renderSlider(parentDiv, {
      name: 'starLifeMultiplier',
      labelKey: 'starLifeMultiplier',
      type: 'slider',
      min: '0.4',
      max: '2.5',
      step: '0.05',
      defaultValue: 1.0,
      formatValue: (v) => `${Number(v).toFixed(2)}x`
    });

    const label = parentDiv.querySelector('.inspector-label');
    const badge = parentDiv.querySelector('.inspector-slider-value');
    const slider = parentDiv.querySelector('.inspector-slider');

    expect(label).toBeDefined();
    expect(badge.textContent).toBe('1.80x');
    expect(slider.value).toBe('1.8');

    // Simulate pointerdown (undo recording)
    slider.dispatchEvent({ type: 'pointerdown' });
    expect(onUpdate).toHaveBeenCalledWith('beforeChange');

    // Simulate dragging slider to 2.2
    slider.value = '2.2';
    slider.dispatchEvent({ type: 'input', target: { value: '2.2' } });

    expect(badge.textContent).toBe('2.20x');
    expect(event.starLifeMultiplier).toBe(2.2);

    // Fast-forward debounce timer
    vi.advanceTimersByTime(300);
    expect(onUpdate).toHaveBeenCalledWith();
    vi.useRealTimers();
  });

  it('should scale particle lifetime according to starLifeMultiplier in FireworkSystem', () => {
    const scene = new THREE.Scene();
    const fireworkSystem = new FireworkSystem(scene);

    // Standard burst without multiplier
    fireworkSystem.createBurst(
      new THREE.Vector3(0, 100, 0),
      new THREE.Color(0xffaa00),
      'sphere',
      { starLifeMultiplier: 1.0 },
      'test-standard'
    );
    const standardParticle = fireworkSystem.burstParticles.find(p => !p.isDyingEmber) || fireworkSystem.burstParticles[0];
    const standardMaxLife = standardParticle.maxLife;
    fireworkSystem.clear();

    // Burst with 0.5x starLifeMultiplier
    fireworkSystem.createBurst(
      new THREE.Vector3(0, 100, 0),
      new THREE.Color(0xffaa00),
      'sphere',
      { starLifeMultiplier: 0.5 },
      'test-short'
    );
    const shortParticle = fireworkSystem.burstParticles.find(p => !p.isDyingEmber) || fireworkSystem.burstParticles[0];
    const shortMaxLife = shortParticle.maxLife;
    fireworkSystem.clear();

    // Burst with 2.0x starLifeMultiplier
    fireworkSystem.createBurst(
      new THREE.Vector3(0, 100, 0),
      new THREE.Color(0xffaa00),
      'sphere',
      { starLifeMultiplier: 2.0 },
      'test-long'
    );
    const longParticle = fireworkSystem.burstParticles.find(p => !p.isDyingEmber) || fireworkSystem.burstParticles[0];
    const longMaxLife = longParticle.maxLife;
    fireworkSystem.clear();

    // Burst with 5.0x starLifeMultiplier
    fireworkSystem.createBurst(
      new THREE.Vector3(0, 100, 0),
      new THREE.Color(0xffaa00),
      'sphere',
      { starLifeMultiplier: 5.0 },
      'test-5x'
    );
    const ultraLongParticle = fireworkSystem.burstParticles.find(p => !p.isDyingEmber) || fireworkSystem.burstParticles[0];
    const ultraLongMaxLife = ultraLongParticle.maxLife;
    fireworkSystem.clear();

    expect(shortMaxLife).toBeLessThan(standardMaxLife * 0.75);
    expect(longMaxLife).toBeGreaterThan(standardMaxLife * 1.35);
    expect(ultraLongMaxLife).toBeGreaterThan(standardMaxLife * 3.2);
    expect(longParticle.isLongBurn).toBe(true);
    expect(ultraLongParticle.isLongBurn).toBe(true);
  });

  it('should gracefully fallback to longBurnMultiplier for legacy events with long-burn', () => {
    const scene = new THREE.Scene();
    const fireworkSystem = new FireworkSystem(scene);

    fireworkSystem.createBurst(
      new THREE.Vector3(0, 100, 0),
      new THREE.Color(0xff4400),
      'sphere',
      {
        effects: ['long-burn']
      },
      'test-legacy'
    );

    const legacyParticle = fireworkSystem.burstParticles[0];
    expect(legacyParticle.isLongBurn).toBe(true);
    expect(legacyParticle.maxLife).toBeGreaterThan(3.0);

    fireworkSystem.clear();
  });

  it('should scale burst particle count proportionally down to 0.01x without clamping to 0.25x floor in FireworkSystem', () => {
    const scene = new THREE.Scene();
    const fireworkSystem = new FireworkSystem(scene);

    // Burst with standard 1.0x particleCountMultiplier
    fireworkSystem.createBurst(
      new THREE.Vector3(0, 100, 0),
      new THREE.Color(0xffaa00),
      'sphere',
      { particleCountMultiplier: 1.0 },
      'test-std-count'
    );
    const standardCount = fireworkSystem.burstParticles.length;
    fireworkSystem.clear();

    // Burst with 0.25x particleCountMultiplier
    fireworkSystem.createBurst(
      new THREE.Vector3(0, 100, 0),
      new THREE.Color(0xffaa00),
      'sphere',
      { particleCountMultiplier: 0.25 },
      'test-025-count'
    );
    const count025 = fireworkSystem.burstParticles.length;
    fireworkSystem.clear();

    // Burst with 0.01x particleCountMultiplier (user soft limits)
    fireworkSystem.createBurst(
      new THREE.Vector3(0, 100, 0),
      new THREE.Color(0xffaa00),
      'sphere',
      { particleCountMultiplier: 0.01 },
      'test-001-count'
    );
    const count001 = fireworkSystem.burstParticles.length;
    fireworkSystem.clear();

    expect(count025).toBeLessThan(standardCount);
    expect(count001).toBeLessThan(count025);
    expect(count001).toBe(1);
  });

  it('should configure soundVolume as slider before launchSound in soundSettings group', () => {
    const mockContainer = createMockElement('div');
    const inspector = new PropertyInspector(mockContainer, vi.fn());
    const eventGroups = inspector.getSchema().event;
    const soundGroup = eventGroups.find((g) => g.groupKey === 'soundSettings');

    expect(soundGroup).toBeDefined();
    expect(soundGroup.fields.length).toBeGreaterThan(0);

    const firstField = soundGroup.fields[0];
    expect(firstField.name).toBe('soundVolume');
    expect(firstField.type).toBe('slider');
    expect(firstField.min).toBe('0.0');
    expect(firstField.max).toBe('2.0');
    expect(firstField.step).toBe('0.05');
    expect(firstField.span).toBe(2);

    const secondField = soundGroup.fields[1];
    expect(secondField.name).toBe('launchSound');
  });

  it('should update both soundVolume and sound.volumeMultiplier when moving soundVolume slider', () => {
    vi.useFakeTimers();
    const mockContainer = createMockElement('div');
    const onUpdate = vi.fn();
    const inspector = new PropertyInspector(mockContainer, onUpdate);

    const event = {
      sound: {
        volumeMultiplier: 0.8
      }
    };
    inspector.selectedEvent = event;

    const parentDiv = createMockElement('div');
    inspector.renderSlider(parentDiv, {
      name: 'soundVolume',
      labelKey: 'soundVolume',
      type: 'slider',
      min: '0.0',
      max: '2.0',
      step: '0.05',
      defaultValue: 1.0,
      formatValue: (v) => `${Number(v).toFixed(2)}x`
    });

    const badge = parentDiv.querySelector('.inspector-slider-value');
    const slider = parentDiv.querySelector('.inspector-slider');

    expect(badge.textContent).toBe('0.80x');
    expect(slider.value).toBe('0.8');

    // Drag slider to 1.5
    slider.value = '1.5';
    slider.dispatchEvent({ type: 'input', target: { value: '1.5' } });

    expect(badge.textContent).toBe('1.50x');
    expect(event.soundVolume).toBe(1.5);
    expect(event.sound.volumeMultiplier).toBe(1.5);

    vi.advanceTimersByTime(300);
    expect(onUpdate).toHaveBeenCalledWith();
    vi.useRealTimers();
  });

  it('should allow typing custom value directly into valueBadge and commit on Enter or blur', () => {
    vi.useFakeTimers();
    const mockContainer = createMockElement('div');
    const onUpdate = vi.fn();
    const inspector = new PropertyInspector(mockContainer, onUpdate);

    const event = { shellSize: 1.5 };
    inspector.selectedEvent = event;

    const parentDiv = createMockElement('div');
    inspector.renderSlider(parentDiv, {
      name: 'shellSize',
      labelKey: 'shellSize',
      type: 'slider',
      min: '0.5',
      max: '3.0',
      step: '0.1',
      defaultValue: 1.0,
      formatValue: (v) => `${Number(v).toFixed(1)}x`
    });

    const badge = parentDiv.querySelector('.inspector-slider-value');
    const slider = parentDiv.querySelector('.inspector-slider');

    expect(badge.value).toBe('1.5x');
    expect(slider.value).toBe('1.5');

    // Simulate focus: should strip 'x'
    badge.dispatchEvent({ type: 'focus' });
    expect(badge.value).toBe('1.5');

    // Type 2.2 and press Enter
    badge.value = '2.2';
    badge.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault: vi.fn() });

    expect(badge.value).toBe('2.2x');
    expect(slider.value).toBe('2.2');
    expect(event.shellSize).toBe(2.2);

    // Type with comma and suffix "2,8x" and blur
    badge.value = '2,8x';
    badge.dispatchEvent({ type: 'blur' });

    expect(badge.value).toBe('2.8x');
    expect(slider.value).toBe('2.8');
    expect(event.shellSize).toBe(2.8);

    vi.useRealTimers();
  });

  it('should allow typing values exceeding slider max (soft bounds) and revert on Escape or invalid input', () => {
    const mockContainer = createMockElement('div');
    const onUpdate = vi.fn();
    const inspector = new PropertyInspector(mockContainer, onUpdate);

    const event = { starLifeMultiplier: 1.0 };
    inspector.selectedEvent = event;

    const parentDiv = createMockElement('div');
    inspector.renderSlider(parentDiv, {
      name: 'starLifeMultiplier',
      labelKey: 'starLifeMultiplier',
      type: 'slider',
      min: '0.2',
      max: '2.5',
      step: '0.05',
      defaultValue: 1.0,
      formatValue: (v) => `${Number(v).toFixed(2)}x`
    });

    const badge = parentDiv.querySelector('.inspector-slider-value');
    const slider = parentDiv.querySelector('.inspector-slider');

    // Focus then type value exceeding max (5.0) -> soft bounds: badge and event get 5.0, slider thumb rests at max (2.5)
    badge.dispatchEvent({ type: 'focus' });
    badge.value = '5.0';
    badge.dispatchEvent({ type: 'blur' });

    expect(badge.value).toBe('5.00x');
    expect(slider.value).toBe('2.5');
    expect(event.starLifeMultiplier).toBe(5.0);

    // Focus then type invalid characters -> revert to previous valid (5.0)
    badge.dispatchEvent({ type: 'focus' });
    badge.value = 'invalid';
    badge.dispatchEvent({ type: 'blur' });

    expect(badge.value).toBe('5.00x');
    expect(slider.value).toBe('2.5');

    // Focus then type 1.2 and press Escape -> cancel and revert
    badge.dispatchEvent({ type: 'focus' });
    badge.value = '1.2';
    badge.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault: vi.fn() });

    expect(badge.value).toBe('5.00x');
    expect(slider.value).toBe('2.5');
  });

  describe('Active Effects and Structural Modifiers Unification on Nested Stages and Second Burst', () => {
    it('should render structural modifier chips and timeline container in renderSubTargetEffects', () => {
      const mockContainer = createMockElement('div');
      const onUpdate = vi.fn();
      const inspector = new PropertyInspector(mockContainer, onUpdate);

      const stage = {
        shapeType: 'sphere',
        dynamicsType: 'standard',
        effects: ['pistil']
      };

      const card = createMockElement('div');
      inspector.renderSubTargetEffects(card, stage, () => 2.3);

      const modRow = card.querySelector('.inspector-subtarget-modifiers-row');
      expect(modRow).toBeDefined();

      const chips = modRow.querySelectorAll('.effect-chip');
      const chipKeys = chips.map((c) => c.dataset?.key);
      expect(chipKeys).toContain('burst-smoke');
      expect(chipKeys).toContain('pistil');
      expect(chipKeys).toContain('apex-hang');
      expect(chipKeys).toContain('slow-burst');

      const timelineContainer = card.querySelector('.inspector-active-effects-container');
      expect(timelineContainer).toBeDefined();
    });

    it('should toggle structural modifiers on subTarget when chips are clicked', () => {
      const mockContainer = createMockElement('div');
      const onUpdate = vi.fn();
      const inspector = new PropertyInspector(mockContainer, onUpdate);

      const stage = {
        shapeType: 'sphere',
        dynamicsType: 'standard',
        effects: []
      };

      const card = createMockElement('div');
      inspector.renderSubTargetEffects(card, stage, () => 2.3);

      const modRow = card.querySelector('.inspector-subtarget-modifiers-row');
      const chips = modRow.querySelectorAll('.effect-chip');
      const pistilChip = chips.find((c) => c.dataset?.key === 'pistil');
      const smokeChip = chips.find((c) => c.dataset?.key === 'burst-smoke');

      expect(pistilChip).toBeDefined();
      expect(smokeChip).toBeDefined();

      // Click pistil chip -> toggles stage.pistil = true and adds to stage.effects
      pistilChip.dispatchEvent({ type: 'click' });
      expect(stage.pistil).toBe(true);
      expect(stage.effects).toContain('pistil');

      // Click burst-smoke chip -> toggles stage.burstSmoke = true and adds to stage.effects
      smokeChip.dispatchEvent({ type: 'click' });
      expect(stage.burstSmoke).toBe(true);
      expect(stage['burst-smoke']).toBe(true);
      expect(stage.effects).toContain('burst-smoke');

      // Click pistil chip again -> turns off pistil
      pistilChip.dispatchEvent({ type: 'click' });
      expect(stage.pistil).toBe(false);
      expect(stage.effects).not.toContain('pistil');
      // Smoke remains
      expect(stage.effects).toContain('burst-smoke');
    });

    it('should preserve structural modifiers when active effects timeline emits onChange', () => {
      const mockContainer = createMockElement('div');
      const onUpdate = vi.fn();
      const inspector = new PropertyInspector(mockContainer, onUpdate);

      const stage = {
        shapeType: 'ring',
        dynamicsType: 'flow',
        burstSmoke: true,
        effects: ['burst-smoke']
      };

      let capturedOptions = null;
      const card = createMockElement('div');
      inspector.renderSubTargetEffects(card, stage, () => 2.0);

      // Locate the timeline container and its instance or simulate onChange
      const timelineContainer = card.querySelector('.inspector-active-effects-container');
      expect(timelineContainer).toBeDefined();

      // Simulate timeline onChange with a timed effect
      const updatedTimedEffects = [
        {
          id: 'strobe_1',
          type: 'strobe',
          startRatio: 0.1,
          endRatio: 0.6,
          start: 0.2,
          end: 1.2
        }
      ];

      // Simulate how renderSubTargetEffects handles timeline onChange
      const existingModifiers = stage.effects.filter((e) => {
        const key = typeof e === 'object' && e !== null ? (e.type || e.key) : e;
        return TOGGLE_MODIFIER_TAGS.some((mod) => mod.key === key);
      });
      stage.effects = [...updatedTimedEffects, ...existingModifiers];

      expect(stage.effects).toHaveLength(2);
      expect(stage.effects.some((e) => e.type === 'strobe')).toBe(true);
      expect(stage.effects.includes('burst-smoke')).toBe(true);
    });

    it('should mount renderSubTargetEffects for each stage in renderNestedStages', () => {
      const mockContainer = createMockElement('div');
      const onUpdate = vi.fn();
      const inspector = new PropertyInspector(mockContainer, onUpdate);

      const event = {
        id: 'event-multi-1',
        type: 'sequence',
        preset: 'multi_nested',
        multiNested: true,
        stages: [
          {
            shapeType: 'sphere',
            dynamicsType: 'standard',
            delay: 0.0,
            scale: 1.0,
            effects: ['strobe']
          },
          {
            shapeType: 'ring',
            dynamicsType: 'flow',
            delay: 0.5,
            scale: 0.8,
            effects: ['crackle', 'pistil']
          }
        ]
      };
      inspector.selectedEvent = event;

      const parentDiv = createMockElement('div');
      inspector.activeStageIndex = 0;
      inspector.renderNestedStages(parentDiv);

      const cardStage1 = parentDiv.querySelector('.inspector-subcard');
      expect(cardStage1).toBeDefined();

      const modRowStage1 = cardStage1.querySelector('.inspector-subtarget-modifiers-row');
      expect(modRowStage1).toBeDefined();
      const timelineStage1 = cardStage1.querySelector('.inspector-active-effects-container');
      expect(timelineStage1).toBeDefined();

      // Switch to Stage 2
      const parentDiv2 = createMockElement('div');
      inspector.activeStageIndex = 1;
      inspector.renderNestedStages(parentDiv2);

      const cardStage2 = parentDiv2.querySelector('.inspector-subcard');
      expect(cardStage2).toBeDefined();
      const modRowStage2 = cardStage2.querySelector('.inspector-subtarget-modifiers-row');
      expect(modRowStage2).toBeDefined();
      const timelineStage2 = cardStage2.querySelector('.inspector-active-effects-container');
      expect(timelineStage2).toBeDefined();
    });

    it('should mount renderSubTargetEffects for active child in renderSecondBurst', () => {
      const mockContainer = createMockElement('div');
      const onUpdate = vi.fn();
      const inspector = new PropertyInspector(mockContainer, onUpdate);

      const event = {
        id: 'event-sb-1',
        type: 'sequence',
        secondBurst: {
          enabled: true,
          activeChildIndex: 0,
          childShells: [
            {
              shapeType: 'sphere',
              dynamicsType: 'standard',
              scale: 0.35,
              color: '#ffd700',
              effects: ['ghost']
            }
          ]
        }
      };
      inspector.selectedEvent = event;

      const parentDiv = createMockElement('div');
      inspector.renderSecondBurst(parentDiv);

      const card = parentDiv.querySelector('.inspector-subcard');
      expect(card).toBeDefined();

      const modRow = card.querySelector('.inspector-subtarget-modifiers-row');
      expect(modRow).toBeDefined();

      const timeline = card.querySelector('.inspector-active-effects-container');
      expect(timeline).toBeDefined();
    });
  });
});
