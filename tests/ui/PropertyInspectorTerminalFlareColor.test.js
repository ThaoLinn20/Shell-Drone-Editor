import { describe, it, expect, vi, beforeAll } from 'vitest';

global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

describe('PropertyInspector Terminal Flare Color Controls', () => {
  let PropertyInspector;

  const createMockElement = (tag = 'div') => {
    const listeners = {};
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
      getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 100, height: 30 }),
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
          listeners[event] = listeners[event].filter((l) => l !== cb);
        }
      },
      click: () => {
        if (listeners.click) {
          listeners.click.forEach((cb) => cb({ target: el, preventDefault: () => {} }));
        }
      },
      dispatchInput: (val) => {
        el.value = val;
        if (listeners.input) {
          listeners.input.forEach((cb) => cb({ target: el }));
        }
      }
    };
    return el;
  };

  beforeAll(async () => {
    global.document = {
      createElement: (tag) => createMockElement(tag),
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    if (!global.window) global.window = {};
    if (!global.window.addEventListener) {
      global.window.addEventListener = vi.fn();
      global.window.removeEventListener = vi.fn();
    }

    const inspectorMod = await import('../../src/ui/PropertyInspector.js');
    PropertyInspector = inspectorMod.PropertyInspector;
  });

  it('renders Terminal Flare color controls when terminalFlare is enabled', () => {
    const mockContainer = createMockElement('div');
    const inspector = new PropertyInspector(mockContainer, vi.fn());

    const container = createMockElement('div');
    const target = {
      terminalFlare: true,
      terminalFlareTriggerRatio: 0.85,
      terminalFlareIntensity: 2.5,
      terminalFlareSizeMultiplier: 1.35
    };

    inspector.renderTerminalFlareControls(container, target);

    expect(container.children.length).toBe(1);
    const flareBox = container.children[0];
    expect(flareBox.className).toBe('inspector-terminal-flare-controls');

    // There should be 4 rows: trigger, intensity, size, and color
    expect(flareBox.children.length).toBe(4);
    const colorRow = flareBox.children[3];
    expect(colorRow).toBeDefined();

    const controlsContainer = colorRow.children[1];
    expect(controlsContainer).toBeDefined();

    // First child is Random button
    const randomBtn = controlsContainer.children[0];
    expect(randomBtn.textContent).toBe('Random');

    // Default state when terminalFlareColor is undefined: random button is active
    expect(randomBtn.style.fontWeight).toBe('600');
  });

  it('updates terminalFlareColor to random when Random button is clicked', () => {
    const mockContainer = createMockElement('div');
    const inspector = new PropertyInspector(mockContainer, vi.fn());
    vi.spyOn(inspector, 'triggerUpdate').mockImplementation(() => {});
    vi.spyOn(inspector, 'render').mockImplementation(() => {});

    const container = createMockElement('div');
    const target = {
      terminalFlare: true,
      terminalFlareColor: '#ffd700'
    };

    inspector.renderTerminalFlareControls(container, target);

    const colorRow = container.children[0].children[3];
    const controlsContainer = colorRow.children[1];
    const randomBtn = controlsContainer.children[0];

    randomBtn.click();
    expect(target.terminalFlareColor).toBe('random');
    expect(inspector.triggerUpdate).toHaveBeenCalled();
  });

  it('updates terminalFlareColor to hex when a preset swatch is clicked', () => {
    const mockContainer = createMockElement('div');
    const inspector = new PropertyInspector(mockContainer, vi.fn());
    vi.spyOn(inspector, 'triggerUpdate').mockImplementation(() => {});
    vi.spyOn(inspector, 'render').mockImplementation(() => {});

    const container = createMockElement('div');
    const target = {
      terminalFlare: true,
      terminalFlareColor: 'random'
    };

    inspector.renderTerminalFlareControls(container, target);

    const colorRow = container.children[0].children[3];
    const controlsContainer = colorRow.children[1];

    // Swatches start at index 1 (0 is Random button)
    const cyanSwatch = controlsContainer.children.find((c) => c.style && c.style.backgroundColor === '#00f5ff');
    expect(cyanSwatch).toBeDefined();

    cyanSwatch.click();
    expect(target.terminalFlareColor).toBe('#00f5ff');
    expect(inspector.triggerUpdate).toHaveBeenCalled();
  });

  it('updates terminalFlareColor to custom hex when custom color input is changed', () => {
    const mockContainer = createMockElement('div');
    const inspector = new PropertyInspector(mockContainer, vi.fn());
    vi.spyOn(inspector, 'triggerUpdate').mockImplementation(() => {});

    const container = createMockElement('div');
    const target = {
      terminalFlare: true,
      terminalFlareColor: 'random'
    };

    inspector.renderTerminalFlareControls(container, target);

    const colorRow = container.children[0].children[3];
    const controlsContainer = colorRow.children[1];
    const customInput = controlsContainer.children[controlsContainer.children.length - 1];
    expect(customInput.type).toBe('color');

    customInput.dispatchInput('#e11d48');
    expect(target.terminalFlareColor).toBe('#e11d48');
    expect(inspector.triggerUpdate).toHaveBeenCalled();
  });

  it('invokes onBatchUpdate callback for batch selections', () => {
    const mockContainer = createMockElement('div');
    const inspector = new PropertyInspector(mockContainer, vi.fn());
    vi.spyOn(inspector, 'triggerUpdate').mockImplementation(() => {});
    vi.spyOn(inspector, 'render').mockImplementation(() => {});

    const onBatchUpdate = vi.fn();
    const container = createMockElement('div');
    const target = {
      terminalFlare: true,
      terminalFlareColor: 'random'
    };

    inspector.renderTerminalFlareControls(container, target, onBatchUpdate);

    const colorRow = container.children[0].children[3];
    const controlsContainer = colorRow.children[1];
    const goldSwatch = controlsContainer.children.find((c) => c.style && c.style.backgroundColor === '#ffd700');
    expect(goldSwatch).toBeDefined();

    goldSwatch.click();
    expect(onBatchUpdate).toHaveBeenCalledWith('terminalFlareColor', '#ffd700');
  });
});
