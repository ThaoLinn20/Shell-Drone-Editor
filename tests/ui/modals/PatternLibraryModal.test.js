import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi
} from 'vitest';

function createMockElement(tag = 'div') {
  let _innerHTML = '';
  const listeners = {};
  const el = {
    tagName: tag.toUpperCase(),
    style: {},
    className: '',
    dataset: {},
    textContent: '',
    value: '',
    checked: false,
    placeholder: '',
    type: '',
    title: '',
    children: [],
    parentElement: null,
    focus: vi.fn(),
    setAttribute: vi.fn(),
    getContext: vi.fn(() => ({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn()
    })),
    get innerHTML() {
      return _innerHTML;
    },
    set innerHTML(val) {
      _innerHTML = val;
      if (val === '') {
        el.children = [];
      }
    },
    appendChild: vi.fn((child) => {
      el.children.push(child);
      child.parentElement = el;
      return child;
    }),
    removeChild: vi.fn((child) => {
      el.children = el.children.filter((c) => c !== child);
      if (child) child.parentElement = null;
      return child;
    }),
    addEventListener: vi.fn((evt, cb) => {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(cb);
    }),
    trigger: (evt, payload = {}) => {
      const list = listeners[evt] || [];
      for (const cb of list) {
        cb({ target: el, preventDefault: vi.fn(), ...payload });
      }
    },
    click: () => {
      if (typeof el.onclick === 'function') {
        el.onclick({ target: el, preventDefault: vi.fn() });
      }
      el.trigger('click');
    },
    querySelectorAll: (selector) => {
      const cls = selector.startsWith('.') ? selector.slice(1) : selector;
      const matches = [];
      const walk = (node) => {
        if (node.className && node.className.split(' ').includes(cls)) {
          matches.push(node);
        }
        for (const child of node.children || []) {
          walk(child);
        }
      };
      walk(el);
      return matches;
    },
    querySelector: (selector) => el.querySelectorAll(selector)[0] || null
  };
  return el;
}

describe('PatternLibraryModal', () => {
  let PatternLibraryModal;
  let patternRegistry;
  let origDocument;

  beforeEach(async () => {
    origDocument = globalThis.document;
    globalThis.document = {
      body: createMockElement('body'),
      getElementById: vi.fn(() => null),
      createElement: vi.fn((tag) => createMockElement(tag)),
      createElementNS: vi.fn((_ns, tag) => createMockElement(tag))
    };

    const modalMod = await import('../../../src/ui/modals/PatternLibraryModal.js');
    const regMod = await import('../../../src/core/PatternRegistry.js');
    PatternLibraryModal = modalMod.PatternLibraryModal;
    patternRegistry = regMod.patternRegistry;

    patternRegistry.patterns = [];
    patternRegistry.memoryFallback.clear();
    await patternRegistry.savePattern({
      name: 'High Crown',
      points: [
        { x: 0.0, y: 0.25 },
        { x: 0.5, y: 0.95 },
        { x: 1.0, y: 0.25 }
      ],
      defaultShellCount: 8
    });
  });

  afterEach(() => {
    globalThis.document = origDocument;
    vi.restoreAllMocks();
  });

  it('renders saved patterns, filters by search, and invokes onApply with matchShellCount option', async () => {
    const onApply = vi.fn();
    const modal = new PatternLibraryModal({ onApply });
    await modal.show();

    const cards = modal.gridContainer.querySelectorAll('.pattern-library-card');
    expect(cards.length).toBe(1);
    expect(cards[0].querySelector('.pattern-card-name').textContent).toBe('High Crown');

    // Search miss
    modal.searchInput.value = 'Nonexistent';
    modal.searchInput.trigger('input');
    expect(modal.gridContainer.querySelectorAll('.pattern-library-card').length).toBe(0);

    // Search hit and apply with matchShellCount checked
    modal.searchInput.value = 'Crown';
    modal.searchInput.trigger('input');
    modal.matchCheckbox.checked = true;
    modal.matchCheckbox.trigger('change');

    const hitCards = modal.gridContainer.querySelectorAll('.pattern-library-card');
    expect(hitCards.length).toBe(1);

    // Find the Apply button inside actionRow
    const findButtons = (node, out = []) => {
      if (node.tagName === 'BUTTON') out.push(node);
      for (const c of node.children || []) findButtons(c, out);
      return out;
    };
    const cardButtons = findButtons(hitCards[0]);
    cardButtons[0].click();

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].slug).toBe('high_crown');
    expect(onApply.mock.calls[0][1]).toEqual({ matchShellCount: true });

    modal.destroy();
  });
});
