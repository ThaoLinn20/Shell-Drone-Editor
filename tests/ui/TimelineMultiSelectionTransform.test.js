import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi
} from 'vitest';
import { TimelineContextMenu } from '../../src/ui/TimelineContextMenu.js';
import {
  distributeSpacing,
  distributeStarts,
  stretchEvents
} from '../../src/utils/timelineTransform.js';

describe('Timeline Multi-Selection Transform', () => {
  let mockTimelineEditor;
  let contextMenu;
  let listeners = {};

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
        return child;
      }),
      remove: vi.fn(() => {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
        }
      }),
      addEventListener: vi.fn((type, handler) => {
        if (!listeners[type]) {
          listeners[type] = [];
        }
        listeners[type].push(handler);
      }),
      removeEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        top: 0,
        left: 0,
        right: 200,
        bottom: 100,
        width: 200,
        height: 100
      })),
      click: () => {
        if (listeners.click) {
          listeners.click.forEach((fn) => {
            fn({
              stopPropagation: vi.fn()
            });
          });
        }
      }
    };
    return el;
  };

  beforeEach(() => {
    listeners = {};

    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => createMockElement(tag)),
      getElementById: vi.fn(() => null),
      body: createMockElement('body')
    });

    vi.stubGlobal('window', {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });

    mockTimelineEditor = {
      selectedEvents: [],
      sequences: [],
      saveHistoryState: vi.fn(),
      setSaveStatus: vi.fn(),
      renderTracks: vi.fn(),
      distributeSelectedSpacing: vi.fn(function () {
        if (!this.selectedEvents || this.selectedEvents.length < 3) return;
        this.saveHistoryState();
        const res = distributeSpacing(this.selectedEvents);
        if (res.modified) {
          this.setSaveStatus('unsaved');
          this.renderTracks();
        }
      }),
      distributeSelectedStarts: vi.fn(function () {
        if (!this.selectedEvents || this.selectedEvents.length < 3) return;
        this.saveHistoryState();
        const res = distributeStarts(this.selectedEvents);
        if (res.modified) {
          this.setSaveStatus('unsaved');
          this.renderTracks();
        }
      }),
      initSelectionStretch: vi.fn(function (seq) {
        if (!this.selectedEvents || this.selectedEvents.length < 2) return;
        const times = this.selectedEvents.map((s) => s.time || 0);
        this.stretchAnchorTime = Math.min(...times);
        const maxTime = Math.max(...times);
        this.stretchInitialSpan = maxTime - this.stretchAnchorTime;
        this.selectedEvents.forEach((s) => {
          s._stretchInitialTime = s.time;
        });
      }),
      updateSelectionStretch: vi.fn(function (dTime) {
        if (!this.selectedEvents || this.selectedEvents.length < 2) return;
        if (this.stretchInitialSpan <= 0.001) return;
        stretchEvents(
          this.selectedEvents,
          dTime,
          this.stretchAnchorTime
        );
        this.renderTracks();
      })
    };

    contextMenu = new TimelineContextMenu();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows distribute actions in context menu only when 3 or more blocks are selected', () => {
    // 2 blocks selected: distribute should NOT be visible
    const context2 = {
      targetType: 'block',
      targetEvent: { id: 1, time: 0 },
      selectedEvents: [
        { id: 1, time: 0 },
        { id: 2, time: 2 }
      ],
      timelineEditor: mockTimelineEditor
    };

    const actionSpacing = contextMenu.actions.find(
      (a) => a.id === 'distribute-spacing'
    );
    const actionStarts = contextMenu.actions.find(
      (a) => a.id === 'distribute-starts'
    );

    expect(actionSpacing.isVisible(context2)).toBe(false);
    expect(actionStarts.isVisible(context2)).toBe(false);

    // 3 blocks selected: distribute should be visible
    const context3 = {
      targetType: 'block',
      targetEvent: { id: 1, time: 0 },
      selectedEvents: [
        { id: 1, time: 0 },
        { id: 2, time: 2 },
        { id: 3, time: 5 }
      ],
      timelineEditor: mockTimelineEditor
    };

    expect(actionSpacing.isVisible(context3)).toBe(true);
    expect(actionStarts.isVisible(context3)).toBe(true);
  });

  it('executes distributeSelectedSpacing when distribute-spacing action is triggered', () => {
    const events = [
      { id: 1, time: 0.0, duration: 1.0 },
      { id: 2, time: 1.2, duration: 1.0 },
      { id: 3, time: 5.0, duration: 1.0 }
    ];
    mockTimelineEditor.selectedEvents = events;

    const actionSpacing = contextMenu.actions.find(
      (a) => a.id === 'distribute-spacing'
    );
    actionSpacing.execute({
      timelineEditor: mockTimelineEditor
    });

    expect(mockTimelineEditor.distributeSelectedSpacing).toHaveBeenCalled();
    expect(mockTimelineEditor.saveHistoryState).toHaveBeenCalled();
    expect(mockTimelineEditor.setSaveStatus).toHaveBeenCalledWith('unsaved');
    expect(mockTimelineEditor.renderTracks).toHaveBeenCalled();
    expect(events[1].time).toBe(2.5);
  });

  it('executes distributeSelectedStarts when distribute-starts action is triggered', () => {
    const events = [
      { id: 1, time: 1.0 },
      { id: 2, time: 1.2 },
      { id: 3, time: 4.0 }
    ];
    mockTimelineEditor.selectedEvents = events;

    const actionStarts = contextMenu.actions.find(
      (a) => a.id === 'distribute-starts'
    );
    actionStarts.execute({
      timelineEditor: mockTimelineEditor
    });

    expect(mockTimelineEditor.distributeSelectedStarts).toHaveBeenCalled();
    expect(mockTimelineEditor.saveHistoryState).toHaveBeenCalled();
    expect(mockTimelineEditor.setSaveStatus).toHaveBeenCalledWith('unsaved');
    expect(mockTimelineEditor.renderTracks).toHaveBeenCalled();
    expect(events[1].time).toBe(2.5);
  });

  it('correctly initializes and updates selection stretch', () => {
    const events = [
      { id: 'a', time: 1.0 },
      { id: 'b', time: 2.0 },
      { id: 'c', time: 3.0 }
    ];
    mockTimelineEditor.selectedEvents = events;

    mockTimelineEditor.initSelectionStretch(events[2]);
    expect(mockTimelineEditor.stretchAnchorTime).toBe(1.0);
    expect(mockTimelineEditor.stretchInitialSpan).toBe(2.0);
    expect(events[1]._stretchInitialTime).toBe(2.0);

    // Stretch by +2.0s (new span = 4.0s, scale = 2.0x)
    mockTimelineEditor.updateSelectionStretch(2.0);
    expect(mockTimelineEditor.renderTracks).toHaveBeenCalled();
    expect(events[0].time).toBe(1.0);
    expect(events[1].time).toBe(3.0);
    expect(events[2].time).toBe(5.0);
  });
});
