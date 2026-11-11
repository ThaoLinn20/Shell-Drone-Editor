import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};

describe('TimelineEditor Empty Space Right-Click', () => {
  let TimelineEditor;
  let mockShowDirector;
  let mockHotkeyManager;

  beforeAll(async () => {
    const mod = await import('../../src/ui/TimelineEditor.js');
    TimelineEditor = mod.TimelineEditor;
  });

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());

    const createMockElement = () => {
      const el = {
        style: {},
        dataset: {},
        children: [],
        appendChild: vi.fn((child) => {
          el.children.push(child);
          return child;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        contains: vi.fn((child) => el.children.includes(child) || child === el),
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 0,
          top: 20,
          width: 10000,
          height: 1000
        }),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        click: vi.fn(),
        title: '',
        innerHTML: '',
        textContent: ''
      };
      return el;
    };

    vi.stubGlobal('document', {
      createElement: vi.fn().mockImplementation(() => createMockElement()),
      getElementById: vi.fn().mockReturnValue(null),
      body: {
        appendChild: vi.fn(),
        style: {}
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    vi.stubGlobal('window', {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    mockShowDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn()
    };

    mockHotkeyManager = {
      register: vi.fn(),
      setActiveContext: vi.fn()
    };
  });

  it('should jump Anchor Head and Playhead, keep selection, and open empty_space menu on right-click', () => {
    const editor = new TimelineEditor(mockShowDirector, mockHotkeyManager);
    editor.pixelsPerSecond = 50;
    const seq = { time: 1.0, duration: 2.0, type: 'sequence' };
    editor.sequences = [seq];
    editor.selectedEvents = [seq];

    const showSpy = vi.spyOn(editor.contextMenu, 'show');
    const contextmenuHandler = editor.tracksArea.addEventListener.mock.calls.find(
      (call) => call[0] === 'contextmenu'
    )?.[1];

    expect(contextmenuHandler).toBeDefined();

    const preventDefault = vi.fn();
    contextmenuHandler({
      target: editor.tracksArea,
      clientX: 250,
      clientY: 120,
      preventDefault
    });

    expect(preventDefault).toHaveBeenCalled();
    expect(editor.anchorTime).toBe(5);
    expect(editor.anchorHead.style.left).toBe('250px');
    expect(mockShowDirector.seek).toHaveBeenCalledWith(5);
    expect(editor.playhead.style.left).toBe('250px');
    expect(editor.selectedEvents).toEqual([seq]);
    expect(showSpy).toHaveBeenCalledWith(
      250,
      120,
      {
        targetType: 'empty_space',
        targetEvent: null,
        selectedEvents: [seq],
        timelineEditor: editor
      }
    );
  });

  it('should ignore tracksArea contextmenu when event bubbles from a block or child element', () => {
    const editor = new TimelineEditor(mockShowDirector, mockHotkeyManager);
    editor.anchorTime = 2;
    const showSpy = vi.spyOn(editor.contextMenu, 'show');

    const contextmenuHandler = editor.tracksArea.addEventListener.mock.calls.find(
      (call) => call[0] === 'contextmenu'
    )?.[1];

    const preventDefault = vi.fn();
    contextmenuHandler({
      target: { mockBlock: true },
      clientX: 400,
      clientY: 100,
      preventDefault
    });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(editor.anchorTime).toBe(2);
    expect(mockShowDirector.seek).not.toHaveBeenCalled();
    expect(showSpy).not.toHaveBeenCalled();
  });
});

