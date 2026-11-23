import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
    children: [],
    parentElement: null,
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
        el.parentElement.children = el.parentElement.children.filter((c) => c !== el);
      }
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  };
  return el;
};

describe('ShortcutGuideModal', () => {
  let ShortcutGuideModal;
  let modal;

  beforeEach(async () => {
    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => createMockElement(tag)),
      body: createMockElement('body'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    const mod = await import('../../../src/ui/guides/ShortcutGuideModal.js');
    ShortcutGuideModal = mod.ShortcutGuideModal;
    modal = new ShortcutGuideModal();
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
      modal = null;
    }
    vi.unstubAllGlobals();
  });

  it('initializes overlay and modal structure', () => {
    expect(modal.overlay).toBeDefined();
    expect(modal.dialog).toBeDefined();
    expect(modal.contentContainer).toBeDefined();
    expect(modal.isVisible).toBe(false);
  });

  it('renders 3 sections of shortcuts with keycaps and descriptions', () => {
    modal.open();
    expect(modal.isVisible).toBe(true);
    expect(modal.overlay.style.display).toBe('flex');

    const sections = modal.getSections();
    expect(sections.length).toBe(3);
    expect(sections[0].title).toContain('Timeline');
    expect(sections[1].title).toContain('Selection');
    expect(sections[2].title).toContain('Camera');

    expect(modal.contentContainer.children.length).toBe(1);
    const grid = modal.contentContainer.children[0];
    expect(grid.children.length).toBe(3);

    // Timeline section has 8 items
    expect(sections[0].items.length).toBe(8);
  });

  it('opens and closes via close method and Escape key', () => {
    modal.open();
    expect(modal.isVisible).toBe(true);

    // Simulate Escape key
    modal.onKeyDown({ key: 'Escape' });
    expect(modal.isVisible).toBe(false);
    expect(modal.overlay.style.display).toBe('none');

    // Reopen and close directly
    modal.open();
    expect(modal.isVisible).toBe(true);
    modal.close();
    expect(modal.isVisible).toBe(false);
  });

  it('destroys cleanly and removes overlay from DOM', () => {
    modal.open();
    modal.destroy();
    expect(modal.overlay).toBeNull();
    expect(modal.dialog).toBeNull();
  });
});
