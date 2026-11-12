import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PropertyInspector Isolated Preview Action', () => {
  let PropertyInspector;
  let globalEventBus;
  let createMockElement;

  beforeEach(async () => {
    vi.resetModules();

    const store = new Map();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => (store.has(k) ? store.get(k) : null)),
      setItem: vi.fn((k, v) => store.set(k, String(v))),
      removeItem: vi.fn((k) => store.delete(k)),
      clear: vi.fn(() => store.clear())
    });

    createMockElement = (tag = 'div') => {
      let _innerHTML = '';
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        dataset: {},
        children: [],
        parentElement: null,
        className: '',
        value: '',
        disabled: false,
        title: '',
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
        type: tag === 'input' ? 'text' : '',
        listeners: {},
        appendChild: (child) => {
          el.children.push(child);
          child.parentElement = el;
          return child;
        },
        contains: () => false,
        getBoundingClientRect: () => ({
          top: 0,
          bottom: 30,
          left: 0,
          right: 100,
          width: 100,
          height: 30
        }),
        setAttribute: vi.fn((attr, val) => {
          el[attr] = val;
        }),
        getAttribute: vi.fn((attr) => el[attr] || null),
        addEventListener: (event, cb) => {
          if (!el.listeners[event]) el.listeners[event] = [];
          el.listeners[event].push(cb);
        },
        removeEventListener: vi.fn(),
        trigger: (event, payload = {}) => {
          if (el.listeners[event]) {
            el.listeners[event].forEach((cb) => cb(payload));
          }
        },
        querySelector: (selector) => {
          const isClass = selector.startsWith('.');
          const target = isClass ? selector.slice(1) : selector.toLowerCase();
          const findRecursive = (node) => {
            if (
              isClass &&
              node.className &&
              node.className.split(' ').includes(target)
            ) {
              return node;
            }
            if (
              !isClass &&
              node.tagName &&
              node.tagName.toLowerCase() === target
            ) {
              return node;
            }
            for (const child of node.children) {
              const found = findRecursive(child);
              if (found) return found;
            }
            return null;
          };
          return findRecursive(el);
        }
      };
      return el;
    };

    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => createMockElement(tag)),
      activeElement: null,
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
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const mod = await import('../../src/ui/PropertyInspector.js');
    PropertyInspector = mod.PropertyInspector;
    const busMod = await import('../../src/core/EventBus.js');
    globalEventBus = busMod.globalEventBus;
  });

  it('should render sticky preview button for single and batch firework selections and invoke onPreview', () => {
    const container = createMockElement('div');
    const onPreview = vi.fn();
    const previewEventsEmitted = [];
    globalEventBus.on('inspector:preview-triggered', (payload) => {
      previewEventsEmitted.push(payload);
    });

    const inspector = new PropertyInspector(
      container,
      vi.fn(),
      ['crysanthemum'],
      null,
      onPreview
    );

    const seq1 = { time: 2.0, type: 'sequence', preset: 'crysanthemum', count: 5 };
    const seq2 = { time: 4.0, type: 'single', preset: 'ring' };

    // Single selection
    inspector.show(seq1, [seq1]);
    const bar = container.querySelector('.inspector-preview-bar');
    const btn = container.querySelector('.inspector-preview-btn');
    expect(bar).not.toBeNull();
    expect(bar.style.position).toBe('sticky');
    expect(bar.style.bottom).toBe('-16px');
    expect(container.children[container.children.length - 1]).toBe(bar);
    expect(btn.disabled).toBe(false);

    btn.trigger('click', { stopPropagation: vi.fn() });
    btn.trigger('click', { stopPropagation: vi.fn() });
    expect(onPreview).toHaveBeenCalledTimes(2);
    expect(onPreview).toHaveBeenCalledWith([seq1]);
    expect(previewEventsEmitted).toEqual([{ count: 1 }, { count: 1 }]);

    // Batch selection
    inspector.show(seq2, [seq1, seq2]);
    const batchBtn = container.querySelector('.inspector-preview-btn');
    expect(batchBtn.disabled).toBe(false);
    batchBtn.trigger('click', { stopPropagation: vi.fn() });
    expect(onPreview).toHaveBeenLastCalledWith([seq1, seq2]);
  });

  it('should disable preview button for audio-only or droneshow-only selection and enable for groups with fireworks', () => {
    const container = createMockElement('div');
    const onPreview = vi.fn();
    const inspector = new PropertyInspector(
      container,
      vi.fn(),
      ['crysanthemum'],
      null,
      onPreview
    );

    const audioSeq = { time: 0, type: 'audio', url: 'bgm.mp3' };
    inspector.show(audioSeq, [audioSeq]);
    const audioBtn = container.querySelector('.inspector-preview-btn');
    expect(audioBtn.disabled).toBe(true);
    audioBtn.trigger('click', { stopPropagation: vi.fn() });
    expect(onPreview).not.toHaveBeenCalled();

    const droneSeq = { time: 1, type: 'droneshow', name: 'Formation' };
    inspector.show(droneSeq, [droneSeq]);
    expect(container.querySelector('.inspector-preview-btn').disabled).toBe(true);

    const groupSeq = {
      time: 5,
      type: 'group',
      children: [{ timeOffset: 0, type: 'single', preset: 'crysanthemum' }]
    };
    inspector.show(groupSeq, [groupSeq]);
    expect(container.querySelector('.inspector-preview-btn').disabled).toBe(false);
  });

  it('should pause full-show playback in TimelineEditor when previewing selected sequences without moving anchorTime', async () => {
    const { TimelineEditor } = await import('../../src/ui/TimelineEditor.js');

    const mockDirector = {
      elapsedTime: 14.5,
      isPlaying: true,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(() => {
        mockDirector.isPlaying = false;
      }),
      play: vi.fn(),
      previewEvents: vi.fn(() => true)
    };

    const editor = new TimelineEditor(mockDirector, null);
    editor.anchorTime = 8.0;
    const seq = { time: 12.0, type: 'sequence', preset: 'crysanthemum', count: 4 };
    editor.selectedEvents = [seq];

    const pausedEvents = [];
    globalEventBus.on('timeline:playback-paused', () => pausedEvents.push(true));

    const result = editor.previewInspectorSelection();

    expect(result).toBe(true);
    expect(mockDirector.pause).toHaveBeenCalledTimes(1);
    expect(pausedEvents.length).toBe(1);
    expect(mockDirector.previewEvents).toHaveBeenCalledWith([seq]);
    expect(editor.anchorTime).toBe(8.0);
    expect(mockDirector.elapsedTime).toBe(14.5);
  });
});

