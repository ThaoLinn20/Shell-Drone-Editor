import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('GuideHubModal', () => {
  let GuideHubModal;
  let windowListeners;
  let mockTimelineEditor;
  let modal;

  const createMockElement = (tag = 'div') => {
    const el = {
      tagName: tag.toUpperCase(),
      style: {},
      className: '',
      dataset: {},
      textContent: '',
      innerHTML: '',
      children: [],
      parentElement: null,
      appendChild: vi.fn((child) => {
        el.children.push(child);
        child.parentElement = el;
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
      trigger: (type, eventObj = {}) => {
        if (el._listeners && el._listeners[type]) {
          el._listeners[type].forEach((fn) => fn(eventObj));
        }
      }
    };
    return el;
  };

  beforeEach(async () => {
    windowListeners = {};
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {}
    });

    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => createMockElement(tag)),
      body: createMockElement('body')
    });

    vi.stubGlobal('window', {
      addEventListener: vi.fn((type, handler) => {
        if (!windowListeners[type]) windowListeners[type] = [];
        windowListeners[type].push(handler);
      }),
      removeEventListener: vi.fn((type, handler) => {
        if (windowListeners[type]) {
          windowListeners[type] = windowListeners[type].filter(
            (h) => h !== handler
          );
        }
      }),
      open: vi.fn()
    });

    mockTimelineEditor = {
      onboardingFlow: {
        restart: vi.fn()
      },
      reuseBlocksGuide: {
        start: vi.fn()
      },
      tourGuide: {
        startTour: vi.fn(),
        startInspectorTour: vi.fn(),
        startReuseBlocksTour: vi.fn()
      }
    };

    const mod = await import('../../src/ui/GuideHubModal.js');
    GuideHubModal = mod.GuideHubModal;
    modal = new GuideHubModal(mockTimelineEditor);
  });

  afterEach(() => {
    if (modal) {
      modal.destroy();
    }
    vi.restoreAllMocks();
  });

  it('should render all 4 default guides and support custom registered guides', () => {
    modal.registerGuide({
      id: 'custom_guide',
      title: 'Custom Guide',
      desc: 'Extra workflow guide',
      badge: 'New',
      actionLabel: 'Open',
      execute: vi.fn()
    });

    modal.open();

    expect(modal.isVisible).toBe(true);
    expect(modal.overlay.style.display).toBe('flex');
    expect(modal.listContainer.children.length).toBe(5);
    expect(modal.listContainer.children[0].dataset.guideId).toBe('quick_start');
    expect(modal.listContainer.children[1].dataset.guideId).toBe('timeline_tour');
    expect(modal.listContainer.children[2].dataset.guideId).toBe('inspector_tour');
    expect(modal.listContainer.children[3].dataset.guideId).toBe('reuse_blocks');
    expect(modal.listContainer.children[4].dataset.guideId).toBe('custom_guide');
  });

  it('should close modal before executing guide action', () => {
    const callOrder = [];
    const closeSpy = vi.spyOn(modal, 'close').mockImplementation(() => {
      callOrder.push('close');
      modal.isVisible = false;
    });
    mockTimelineEditor.tourGuide.startTour.mockImplementation(() => {
      callOrder.push('startTour');
    });

    modal.open();
    const timelineCard = modal.listContainer.children[1];
    const actionBtn = timelineCard.children[1];
    actionBtn.trigger('click');

    expect(closeSpy).toHaveBeenCalled();
    expect(mockTimelineEditor.tourGuide.startTour).toHaveBeenCalledWith('timeline');
    expect(callOrder).toEqual(['close', 'startTour']);
  });

  it('should trigger onboarding restart, inspector tour, and reuse blocks tour', () => {
    modal.open();

    // Quick Start
    modal.listContainer.children[0].children[1].trigger('click');
    expect(mockTimelineEditor.onboardingFlow.restart).toHaveBeenCalled();

    // Inspector Tour
    modal.open();
    modal.listContainer.children[2].children[1].trigger('click');
    expect(mockTimelineEditor.tourGuide.startInspectorTour).toHaveBeenCalled();

    // Reuse Blocks Interactive Guide
    modal.open();
    modal.listContainer.children[3].children[1].trigger('click');
    expect(mockTimelineEditor.reuseBlocksGuide.start).toHaveBeenCalled();
  });

  it('should close when pressing Escape or clicking overlay backdrop', () => {
    modal.open();
    expect(modal.isVisible).toBe(true);

    windowListeners.keydown.forEach((fn) => fn({ key: 'Escape' }));
    expect(modal.isVisible).toBe(false);
    expect(modal.overlay.style.display).toBe('none');

    modal.open();
    expect(modal.isVisible).toBe(true);
    modal.overlay.trigger('click', { target: modal.overlay });
    expect(modal.isVisible).toBe(false);
  });
});

