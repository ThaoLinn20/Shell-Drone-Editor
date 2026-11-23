import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('PropertyInspector Preset Groups (Shell vs Comet)', () => {
  let PropertyInspector;
  let container;
  let inspector;
  let onChange;
  let mockBody;

  const createMockElement = (tag = 'div') => {
    let _innerHTML = '';
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
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
      contains: (target) => {
        if (el === target) return true;
        const check = (node) => {
          for (const c of node.children) {
            if (c === target || check(c)) return true;
          }
          return false;
        };
        return check(el);
      },
      getBoundingClientRect: () => ({
        top: 100,
        bottom: 130,
        left: 50,
        right: 250,
        width: 200,
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
      click: () => {
        if (el._listeners && el._listeners['click']) {
          el._listeners['click'].forEach((cb) => cb({ stopPropagation: () => {} }));
        }
      },
      querySelector: (selector) => {
        const className = selector.startsWith('.') ? selector.replace('.', '') : null;
        const findRecursive = (node) => {
          if (className && node.className && node.className.split(' ').includes(className)) return node;
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
        findRecursive(el);
        return matches;
      },
      focus: vi.fn()
    };
    return el;
  };

  beforeEach(async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {}
    });

    mockBody = createMockElement('body');

    vi.stubGlobal('document', {
      createElement: (tag) => createMockElement(tag),
      body: mockBody,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      querySelectorAll: (selector) => mockBody.querySelectorAll(selector),
      querySelector: (selector) => mockBody.querySelector(selector)
    });

    vi.stubGlobal('window', {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const mod = await import('../../src/ui/PropertyInspector.js');
    PropertyInspector = mod.PropertyInspector;

    container = createMockElement('div');
    mockBody.appendChild(container);
    onChange = vi.fn();

    const presetOptions = [
      'random',
      'crysanthemum',
      'peony',
      'multi_nested',
      'strobe',
      'comet_cluster',
      'comet_single',
      'sparkling_comet'
    ];

    inspector = new PropertyInspector(
      container,
      onChange,
      presetOptions
    );
  });

  afterEach(() => {
    if (container) {
      container.innerHTML = '';
    }
    vi.restoreAllMocks();
  });

  it('should categorize preset options into shell and comet with filter tabs and group headers', () => {
    const event = {
      type: 'sequence',
      time: 1.0,
      duration: 2.0,
      count: 10,
      preset: 'crysanthemum',
      pattern: 'random'
    };

    inspector.show(event);

    const presetSelectContainer = container.querySelector('.custom-select-container');
    expect(presetSelectContainer).toBeDefined();

    const menus = mockBody.querySelectorAll('.custom-select-menu');
    const selectMenu = menus.find((m) => m.dataset.fieldName === 'preset');
    expect(selectMenu).toBeDefined();

    // Check group tabs
    const tabsContainer = selectMenu.querySelector('.custom-select-tabs');
    expect(tabsContainer).not.toBeNull();
    const tabBtns = tabsContainer.querySelectorAll('.custom-select-tab-btn');
    expect(tabBtns.length).toBe(3);
    expect(tabBtns[0].dataset.groupId).toBe('all');
    expect(tabBtns[1].dataset.groupId).toBe('shell');
    expect(tabBtns[2].dataset.groupId).toBe('comet');

    // Check group headers in options list
    const groupHeaders = selectMenu.querySelectorAll('.custom-select-group-header');
    expect(groupHeaders.length).toBe(2);
    expect(groupHeaders[0].dataset.group).toBe('shell');
    expect(groupHeaders[1].dataset.group).toBe('comet');

    // Check items have group dataset
    const items = selectMenu.querySelectorAll('.custom-select-item');
    const shellItem = items.find((i) => i.dataset.value === 'crysanthemum');
    const cometItem = items.find((i) => i.dataset.value === 'comet_cluster');
    const randomItem = items.find((i) => i.dataset.value === 'random');

    expect(shellItem).toBeDefined();
    expect(shellItem.dataset.group).toBe('shell');
    expect(cometItem).toBeDefined();
    expect(cometItem.dataset.group).toBe('comet');
    expect(randomItem).toBeDefined();
  });

  it('should auto-synchronize event.type when choosing a comet vs shell preset', () => {
    const event = {
      type: 'sequence',
      time: 1.0,
      duration: 2.0,
      count: 10,
      preset: 'crysanthemum',
      pattern: 'random'
    };

    inspector.show(event);

    const menus = mockBody.querySelectorAll('.custom-select-menu');
    const selectMenu = menus.find((m) => m.dataset.fieldName === 'preset');
    expect(selectMenu).toBeDefined();

    const cometItem = selectMenu.querySelectorAll('.custom-select-item')
      .find((i) => i.dataset.value === 'comet_cluster');

    cometItem.click();

    expect(event.preset).toBe('comet_cluster');
    expect(event.type).toBe('cometsequence');
    expect(onChange).toHaveBeenCalled();

    const shellItem = selectMenu.querySelectorAll('.custom-select-item')
      .find((i) => i.dataset.value === 'crysanthemum');

    shellItem.click();

    expect(event.preset).toBe('crysanthemum');
    expect(event.type).toBe('sequence');
  });
});
