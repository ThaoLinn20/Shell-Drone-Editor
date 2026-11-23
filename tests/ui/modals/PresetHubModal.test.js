import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('PresetHubModal Component', () => {
  let PresetHubModal;
  let modal;
  let onApplySpy;

  const createMockElement = (tag = 'div') => {
    let _innerHTML = '';
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
      className: '',
      dataset: {},
      textContent: '',
      get innerHTML() {
        return _innerHTML;
      },
      set innerHTML(val) {
        _innerHTML = val;
        if (val === '') {
          el.children = [];
        }
      },
      value: '',
      placeholder: '',
      type: '',
      children: [],
      parentElement: null,
      focus: vi.fn(),
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
      remove: vi.fn(() => {
        if (el.parentElement && el.parentElement.children) {
          el.parentElement.children = el.parentElement.children.filter(
            (c) => c !== el
          );
        }
      }),
      addEventListener: vi.fn((type, handler) => {
        if (!el._listeners) el._listeners = {};
        if (!el._listeners[type]) el._listeners[type] = [];
        el._listeners[type].push(handler);
      }),
      removeEventListener: vi.fn((type, handler) => {
        if (el._listeners && el._listeners[type]) {
          el._listeners[type] = el._listeners[type].filter((h) => h !== handler);
        }
      }),
      click: vi.fn(() => {
        if (el._listeners && el._listeners.click) {
          el._listeners.click.forEach((fn) => fn({ target: el, preventDefault: vi.fn(), stopPropagation: vi.fn() }));
        }
      }),
      querySelector: vi.fn((selector) => {
        const findRecursive = (node) => {
          if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            if (node.className && node.className.split(' ').includes(cls)) return node;
          } else {
            if (node.tagName === selector.toUpperCase()) return node;
          }
          for (const child of node.children) {
            const found = findRecursive(child);
            if (found) return found;
          }
          return null;
        };
        return findRecursive(el);
      }),
      querySelectorAll: vi.fn((selector) => {
        const matches = [];
        const findRecursive = (node) => {
          if (selector.startsWith('.')) {
            const cls = selector.slice(1);
            if (node.className && node.className.split(' ').includes(cls)) matches.push(node);
          } else {
            if (node.tagName === selector.toUpperCase()) matches.push(node);
          }
          for (const child of node.children) {
            findRecursive(child);
          }
        };
        for (const child of el.children) {
          findRecursive(child);
        }
        return matches;
      })
    };
    return el;
  };

  beforeEach(async () => {
    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => createMockElement(tag)),
      body: createMockElement('body'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      querySelector: vi.fn(() => null)
    });

    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      confirm: vi.fn(() => true)
    });

    onApplySpy = vi.fn();
    const mod = await import('../../../src/ui/modals/PresetHubModal.js');
    PresetHubModal = mod.PresetHubModal;
    modal = new PresetHubModal({
      onApply: onApplySpy
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders modal dialog and elements properly', () => {
    expect(modal.overlay).toBeDefined();
    expect(modal.dialog).toBeDefined();
    expect(modal.searchInput).toBeDefined();
    expect(modal.gridContainer).toBeDefined();
    expect(modal.drawer).toBeDefined();
  });

  it('shows and hides overlay on show() and hide()', () => {
    expect(modal.overlay.style.display).toBe('none');
    modal.show();
    expect(modal.overlay.style.display).toBe('flex');
    expect(modal.isVisible).toBe(true);

    modal.hide();
    expect(modal.overlay.style.display).toBe('none');
    expect(modal.isVisible).toBe(false);
  });

  it('filters presets based on search query', () => {
    modal.renderGrid();
    const initialCards = modal.gridContainer.querySelectorAll('.preset-card');
    expect(initialCards.length).toBeGreaterThan(0);

    modal.searchQuery = 'non_existent_preset_xyz_123';
    modal.renderGrid();
    const emptyCards = modal.gridContainer.querySelectorAll('.preset-card');
    expect(emptyCards.length).toBe(0);
  });

  it('opens and closes drawer for editing and creating presets', () => {
    modal.openDrawerForNew();
    expect(modal.drawer.style.display).toBe('flex');
    expect(modal.drawer.querySelector('input')).toBeDefined();

    modal.closeDrawer();
    expect(modal.drawer.style.display).toBe('none');
  });

  it('invokes onApply when apply button is clicked on a preset card', () => {
    modal.renderGrid();
    const firstCard = modal.gridContainer.querySelector('.preset-card');
    expect(firstCard).toBeDefined();

    const applyBtn = firstCard.querySelector('button');
    expect(applyBtn).toBeDefined();
    applyBtn.click();

    expect(onApplySpy).toHaveBeenCalled();
    expect(modal.isVisible).toBe(false);
  });
});
