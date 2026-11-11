import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';

let store = {};
global.localStorage = {
  getItem: vi.fn((key) => store[key] || null),
  setItem: vi.fn((key, val) => {
    store[key] = String(val);
  }),
  removeItem: vi.fn((key) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    store = {};
  })
};

describe('TimelineContextMenu', () => {
  let TimelineContextMenu;
  let mockTimelineEditor;
  let contextMenu;
  let domElements = [];
  let windowListeners = {};

  const createMockElement = (tag = 'div') => {
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
      className: '',
      textContent: '',
      innerHTML: '',
      children: [],
      parentElement: null,
      offsetHeight: 100,
      offsetWidth: 200,
      appendChild: vi.fn((child) => {
        el.children.push(child);
        child.parentElement = el;
        return child;
      }),
      removeChild: vi.fn((child) => {
        el.children = el.children.filter((c) => c !== child);
        child.parentElement = null;
      }),
      remove: vi.fn(() => {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
        }
        domElements = domElements.filter((item) => item !== el);
      }),
      contains: vi.fn((child) => el.children.includes(child) || child === el),
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
      querySelector: vi.fn((sel) => {
        const cls = sel.replace('.', '');
        return el.children.find((c) => c.className && c.className.includes(cls)) || null;
      }),
      querySelectorAll: vi.fn((sel) => {
        const cls = sel.replace('.', '');
        return el.children.filter((c) => c.className && c.className.includes(cls));
      }),
      getBoundingClientRect: vi.fn(() => ({
        top: 0,
        bottom: 100,
        left: 0,
        right: 200,
        width: 200,
        height: 100
      })),
      click: vi.fn(() => {
        if (el._listeners && el._listeners.click) {
          el._listeners.click.forEach((fn) => fn({ stopPropagation: vi.fn() }));
        }
      })
    };
    return el;
  };

  beforeAll(async () => {
    const mod = await import('../../src/ui/TimelineContextMenu.js');
    TimelineContextMenu = mod.TimelineContextMenu;
  });

  beforeEach(() => {
    store = {};
    domElements = [];
    windowListeners = {};

    const mockBody = {
      appendChild: vi.fn((el) => {
        domElements.push(el);
        el.parentElement = mockBody;
        return el;
      }),
      removeChild: vi.fn((el) => {
        domElements = domElements.filter((item) => item !== el);
        el.parentElement = null;
      }),
      contains: vi.fn((child) => domElements.includes(child))
    };

    global.document = {
      body: mockBody,
      createElement: vi.fn((tag) => createMockElement(tag)),
      querySelector: vi.fn((sel) => {
        const cls = sel.replace('.', '');
        return domElements.find((el) => el.className && el.className.includes(cls)) || null;
      })
    };

    global.window = {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn((event, handler) => {
        if (!windowListeners[event]) {
          windowListeners[event] = [];
        }
        windowListeners[event].push(handler);
      }),
      removeEventListener: vi.fn((event, handler) => {
        if (windowListeners[event]) {
          windowListeners[event] = windowListeners[event].filter((h) => h !== handler);
        }
      })
    };

    mockTimelineEditor = {
      exportSequence: vi.fn(),
      groupSelected: vi.fn(),
      ungroupSelected: vi.fn(),
      pasteSelected: vi.fn(),
      addSequence: vi.fn(),
      triggerJsonImport: vi.fn(),
      anchorTime: 5,
      clipboardEvents: []
    };
    contextMenu = new TimelineContextMenu(mockTimelineEditor);
  });

  afterEach(() => {
    if (contextMenu) {
      contextMenu.destroy();
    }
  });

  it('should initialize DOM element attached to body', () => {
    expect(contextMenu.menuElement).toBeDefined();
    expect(contextMenu.menuElement.className).toBe('timeline-context-menu');
    expect(contextMenu.menuElement.style.display).toBe('none');
    expect(domElements.includes(contextMenu.menuElement)).toBe(true);
  });

  it('should have default export-selected action registered with correct visibility', () => {
    const action = contextMenu.actions.find((a) => a.id === 'export-selected');
    expect(action).toBeDefined();

    const emptyContext = { selectedEvents: [] };
    expect(action.isVisible(emptyContext)).toBe(false);

    const validContext = {
      selectedEvents: [{ id: 'evt-1' }]
    };
    expect(action.isVisible(validContext)).toBe(true);
    expect(action.isEnabled(validContext)).toBe(true);
  });

  it('should show menu when valid context is provided and clamp position', () => {
    const fakeSeq = { id: 'evt-1', time: 5 };
    const context = {
      targetEvent: fakeSeq,
      selectedEvents: [fakeSeq],
      timelineEditor: mockTimelineEditor
    };

    contextMenu.show(150, 200, context);

    expect(contextMenu.isVisible).toBe(true);
    expect(contextMenu.menuElement.style.display).toBe('block');
    expect(contextMenu.menuElement.style.left).toBe('150px');
    expect(contextMenu.menuElement.style.top).toBe('200px');
  });

  it('should hide menu if no actions are visible', () => {
    const context = {
      targetEvent: null,
      selectedEvents: []
    };

    contextMenu.show(100, 100, context);

    expect(contextMenu.isVisible).toBe(false);
    expect(contextMenu.menuElement.style.display).toBe('none');
  });

  it('should execute exportSequence on export-selected item click', () => {
    const fakeSeq = { id: 'evt-1', time: 5 };
    const context = {
      targetEvent: fakeSeq,
      selectedEvents: [fakeSeq],
      timelineEditor: mockTimelineEditor
    };

    contextMenu.show(50, 50, context);

    const item = contextMenu.menuElement.querySelector('.timeline-context-menu-item');
    expect(item).not.toBeNull();

    item.click();

    expect(mockTimelineEditor.exportSequence).toHaveBeenCalledWith(true);
    expect(contextMenu.isVisible).toBe(false);
  });

  it('should hide menu when Escape key is pressed', () => {
    const fakeSeq = { id: 'evt-1', time: 5 };
    contextMenu.show(50, 50, {
      selectedEvents: [fakeSeq],
      timelineEditor: mockTimelineEditor
    });
    expect(contextMenu.isVisible).toBe(true);

    const keydownHandlers = windowListeners.keydown || [];
    keydownHandlers.forEach((handler) => handler({ key: 'Escape' }));

    expect(contextMenu.isVisible).toBe(false);
    expect(contextMenu.menuElement.style.display).toBe('none');
  });

  it('should hide menu when clicking outside', () => {
    const fakeSeq = { id: 'evt-1', time: 5 };
    contextMenu.show(50, 50, {
      selectedEvents: [fakeSeq],
      timelineEditor: mockTimelineEditor
    });
    expect(contextMenu.isVisible).toBe(true);

    const outsideTarget = createMockElement('div');
    const pointerdownHandlers = windowListeners.pointerdown || [];
    pointerdownHandlers.forEach((handler) => handler({ target: outsideTarget }));

    expect(contextMenu.isVisible).toBe(false);
  });

  it('should have group action registered and trigger groupSelected on click', () => {
    const groupAction = contextMenu.actions.find((a) => a.id === 'group');
    expect(groupAction).toBeDefined();

    const singleContext = { selectedEvents: [{ id: 'evt-1' }] };
    expect(groupAction.isVisible(singleContext)).toBe(false);

    const multiContext = {
      selectedEvents: [
        { id: 'evt-1' },
        { id: 'evt-2' }
      ],
      timelineEditor: mockTimelineEditor
    };
    expect(groupAction.isVisible(multiContext)).toBe(true);

    groupAction.execute(multiContext);
    expect(mockTimelineEditor.groupSelected).toHaveBeenCalled();
  });

  it('should have ungroup action registered and trigger ungroupSelected on click', () => {
    const ungroupAction = contextMenu.actions.find((a) => a.id === 'ungroup');
    expect(ungroupAction).toBeDefined();

    const nonGroupContext = { selectedEvents: [{ id: 'evt-1', type: 'sequence' }] };
    expect(ungroupAction.isVisible(nonGroupContext)).toBe(false);

    const groupContext = {
      selectedEvents: [{ id: 'evt-g', type: 'group' }],
      timelineEditor: mockTimelineEditor
    };
    expect(ungroupAction.isVisible(groupContext)).toBe(true);

    ungroupAction.execute(groupContext);
    expect(mockTimelineEditor.ungroupSelected).toHaveBeenCalled();
  });

  it('should show only paste, add-sequence, and add-drone-json in empty_space context even when events are selected', () => {
    const context = {
      targetType: 'empty_space',
      targetEvent: null,
      selectedEvents: [
        { id: 'evt-1', type: 'group' },
        { id: 'evt-2', type: 'sequence' }
      ],
      timelineEditor: mockTimelineEditor
    };

    contextMenu.show(120, 240, context);

    expect(contextMenu.isVisible).toBe(true);
    const items = contextMenu.menuElement.querySelectorAll('.timeline-context-menu-item');
    expect(items.length).toBe(3);

    const groupAction = contextMenu.actions.find((a) => a.id === 'group');
    const ungroupAction = contextMenu.actions.find((a) => a.id === 'ungroup');
    const exportAction = contextMenu.actions.find((a) => a.id === 'export-selected');
    expect(groupAction.isVisible(context)).toBe(false);
    expect(ungroupAction.isVisible(context)).toBe(false);
    expect(exportAction.isVisible(context)).toBe(false);
  });

  it('should trigger addSequence at anchorTime when add-sequence action executes', () => {
    const addSeqAction = contextMenu.actions.find((a) => a.id === 'add-sequence');
    expect(addSeqAction).toBeDefined();

    const context = {
      targetType: 'empty_space',
      timelineEditor: mockTimelineEditor
    };
    expect(addSeqAction.isVisible(context)).toBe(true);
    expect(addSeqAction.isEnabled(context)).toBe(true);

    addSeqAction.execute(context);
    expect(mockTimelineEditor.addSequence).toHaveBeenCalledWith(5, 'context_menu');
  });

  it('should disable paste when clipboardEvents is empty and enable when non-empty', () => {
    const pasteAction = contextMenu.actions.find((a) => a.id === 'paste');
    expect(pasteAction).toBeDefined();

    const emptyClipboardContext = {
      targetType: 'empty_space',
      timelineEditor: mockTimelineEditor
    };
    expect(pasteAction.isVisible(emptyClipboardContext)).toBe(true);
    expect(pasteAction.isEnabled(emptyClipboardContext)).toBe(false);

    mockTimelineEditor.clipboardEvents = [{ event: { type: 'sequence' }, offset: 0 }];
    expect(pasteAction.isEnabled(emptyClipboardContext)).toBe(true);

    pasteAction.execute(emptyClipboardContext);
    expect(mockTimelineEditor.pasteSelected).toHaveBeenCalled();
  });

  it('should trigger triggerJsonImport when add-drone-json action executes', () => {
    const addJsonAction = contextMenu.actions.find((a) => a.id === 'add-drone-json');
    expect(addJsonAction).toBeDefined();

    const context = {
      targetType: 'empty_space',
      timelineEditor: mockTimelineEditor
    };
    expect(addJsonAction.isVisible(context)).toBe(true);
    expect(addJsonAction.isEnabled(context)).toBe(true);

    addJsonAction.execute(context);
    expect(mockTimelineEditor.triggerJsonImport).toHaveBeenCalled();
  });
});

