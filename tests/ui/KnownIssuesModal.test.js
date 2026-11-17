import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

describe('KnownIssuesModal', () => {
  let KnownIssuesModal;
  let KNOWN_ISSUES;
  let TimelineEditor;
  let mockTimelineEditor;
  let modal;

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
      trigger: (type, eventObj = {}) => {
        if (el._listeners && el._listeners[type]) {
          el._listeners[type].forEach((fn) => fn(eventObj));
        }
      }
    };
    return el;
  };

  beforeEach(async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => createMockElement(tag)),
      body: createMockElement('body'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      activeElement: null
    });

    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      focus: vi.fn()
    });

    const modalMod = await import('../../src/ui/KnownIssuesModal.js');
    KnownIssuesModal = modalMod.KnownIssuesModal;
    KNOWN_ISSUES = modalMod.KNOWN_ISSUES;

    const editorMod = await import('../../src/ui/TimelineEditor.js');
    TimelineEditor = editorMod.TimelineEditor;

    mockTimelineEditor = {
      openKnownIssuesModal: vi.fn()
    };
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
      modal = null;
    }
    vi.restoreAllMocks();
  });

  it('exports KNOWN_ISSUES containing the input focus issue with critical priority', () => {
    expect(Array.isArray(KNOWN_ISSUES)).toBe(true);
    expect(KNOWN_ISSUES.length).toBeGreaterThan(0);

    const inputIssue = KNOWN_ISSUES.find((i) => i.id === 'input_focus_lost');
    expect(inputIssue).toBeDefined();
    expect(inputIssue.priority).toBe('critical');
    expect(inputIssue.defaultTitle).toContain('Input');
    expect(inputIssue.defaultWorkaround).toContain('Windows');
  });

  it('initializes KnownIssuesModal with shell, cards, and red critical priority badge', () => {
    modal = new KnownIssuesModal(mockTimelineEditor);

    expect(modal.overlay).toBeDefined();
    expect(modal.dialog).toBeDefined();
    expect(modal.body).toBeDefined();
    expect(modal.isVisible).toBe(false);

    const cards = modal.body.children;
    expect(cards.length).toBe(KNOWN_ISSUES.length);

    const firstCard = cards[0];
    expect(firstCard.className).toContain('known-issue-card');

    const priorityBadge = firstCard.children[0].children[0].children[1];
    expect(priorityBadge.className).toBe('issue-priority-badge');
    expect(priorityBadge.textContent).toBe('Critical Priority');
    expect(priorityBadge.style.background).toBe('#dc2626');
  });

  it('renders workaround box in issue card with clear action guidance', () => {
    modal = new KnownIssuesModal(mockTimelineEditor);

    const firstCard = modal.body.children[0];
    const workaroundBox = firstCard.children.find((c) =>
      c.className === 'issue-workaround-box'
    );
    expect(workaroundBox).toBeDefined();

    const label = workaroundBox.children[0];
    const text = workaroundBox.children[1];

    expect(label.textContent).toBe('Workaround');
    expect(text.textContent).toContain('Windows');
  });

  it('opens and closes modal cleanly via open, close, and Escape key', () => {
    modal = new KnownIssuesModal(mockTimelineEditor);

    modal.open();
    expect(modal.overlay.style.display).toBe('flex');
    expect(modal.isVisible).toBe(true);
    expect(window.addEventListener).toHaveBeenCalledWith('keydown', modal.onKeyDown);

    modal.onKeyDown({ key: 'Escape' });
    expect(modal.overlay.style.display).toBe('none');
    expect(modal.isVisible).toBe(false);
    expect(window.removeEventListener).toHaveBeenCalledWith('keydown', modal.onKeyDown);
  });

  it('TimelineEditor bugBtn triggers openKnownIssuesModal and opens the modal', () => {
    const mockShowDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn()
    };
    const mockHotkeyManager = {
      register: vi.fn(),
      setActiveContext: vi.fn()
    };

    const editor = new TimelineEditor(mockShowDirector, mockHotkeyManager);
    expect(editor.bugBtn).toBeDefined();

    const openSpy = vi.spyOn(editor, 'openKnownIssuesModal');
    editor.bugBtn.trigger('click');

    expect(openSpy).toHaveBeenCalled();
    expect(editor.knownIssuesModal).toBeDefined();
    expect(editor.knownIssuesModal.isVisible).toBe(true);
  });
});
