import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('GuideHubModal', () => {
  let GuideHubModal;
  let setLanguage;
  let windowListeners;
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
      createScriptGuide: {
        start: vi.fn()
      },
      welcomeGuide: {
        start: vi.fn()
      },
      tourGuide: {
        startTour: vi.fn(),
        startInspectorTour: vi.fn(),
        startReuseBlocksTour: vi.fn()
      }
    };

    const i18nMod = await import('../../src/config/lang/i18n.js');
    setLanguage = i18nMod.setLanguage;
    setLanguage('en');
    const mod = await import('../../src/ui/GuideHubModal.js');
    GuideHubModal = mod.GuideHubModal;
    modal = new GuideHubModal(mockTimelineEditor);
  });

  afterEach(() => {
    if (setLanguage) {
      setLanguage('en');
    }
    if (modal) {
      modal.destroy();
    }
    vi.restoreAllMocks();
  });

  it('should render all 6 default guides sorted with important/basic first and support custom guides', () => {
    modal.registerGuide({
      id: 'custom_guide',
      title: 'Custom Guide',
      desc: 'Extra workflow guide',
      badge: 'New',
      tags: ['audio'],
      actionLabel: 'Open',
      execute: vi.fn()
    });

    modal.open();

    expect(modal.isVisible).toBe(true);
    expect(modal.overlay.style.display).toBe('flex');
    expect(modal.listContainer.children.length).toBe(7);
    expect(modal.listContainer.children[0].dataset.guideId).toBe('quick_start');
    expect(modal.listContainer.children[1].dataset.guideId).toBe('reuse_blocks');
    expect(modal.listContainer.children[2].dataset.guideId).toBe('create_and_export_script');
    expect(modal.listContainer.children[3].dataset.guideId).toBe('welcome_guide');
    expect(modal.listContainer.children[4].dataset.guideId).toBe('timeline_tour');
    expect(modal.listContainer.children[5].dataset.guideId).toBe('inspector_tour');
    expect(modal.listContainer.children[6].dataset.guideId).toBe('custom_guide');

    const guides = modal.getDefaultGuides();
    expect(guides.find((g) => g.id === 'quick_start').tags).toEqual([
      'important',
      'basic'
    ]);
    expect(guides.find((g) => g.id === 'reuse_blocks').tags).toEqual([
      'important',
      'basic'
    ]);
    expect(guides.find((g) => g.id === 'welcome_guide').tags).toEqual([
      'intro'
    ]);
    expect(guides.find((g) => g.id === 'timeline_tour').tags).toEqual([
      'intro'
    ]);
    expect(guides.find((g) => g.id === 'inspector_tour').tags).toEqual([
      'intro'
    ]);
  });

  it('should filter guides by tag chip and preserve search input element instance', () => {
    modal.open();
    const initialSearchInput = modal.searchInput;

    const introChip = modal.tagsContainer.children.find(
      (chip) => chip.dataset.tagId === 'intro'
    );
    expect(introChip).toBeDefined();

    introChip.trigger('click');
    expect(modal.activeTag).toBe('intro');
    expect(modal.listContainer.children.length).toBe(3);
    expect(modal.listContainer.children[0].dataset.guideId).toBe('welcome_guide');
    expect(modal.listContainer.children[1].dataset.guideId).toBe('timeline_tour');
    expect(modal.listContainer.children[2].dataset.guideId).toBe('inspector_tour');
    expect(modal.searchInput).toBe(initialSearchInput);

    const basicChip = modal.tagsContainer.children.find(
      (chip) => chip.dataset.tagId === 'basic'
    );
    basicChip.trigger('click');
    expect(modal.listContainer.children.length).toBe(3);
    expect(modal.listContainer.children[0].dataset.guideId).toBe('quick_start');
    expect(modal.listContainer.children[1].dataset.guideId).toBe('reuse_blocks');
    expect(modal.listContainer.children[2].dataset.guideId).toBe('create_and_export_script');
  });

  it('should search guides case-insensitively and diacritic-insensitively across title, desc, and tags', () => {
    setLanguage('vi');
    modal.open();
    const inputEl = modal.searchInput;

    // Vietnamese diacritic-insensitive match against Vietnamese tag labels ("Cơ bản")
    inputEl.value = 'co ban';
    inputEl.trigger('input', { target: { value: 'co ban' } });
    expect(modal.listContainer.children.length).toBe(3);
    expect(modal.clearSearchBtn.style.display).toBe('block');

    // Search specific guide keyword
    inputEl.value = 'inspector';
    inputEl.trigger('input', { target: { value: 'inspector' } });
    expect(modal.listContainer.children.length).toBe(1);
    expect(modal.listContainer.children[0].dataset.guideId).toBe('inspector_tour');
    expect(modal.searchInput).toBe(inputEl);
  });

  it('should show empty state when no guide matches and reset filters cleanly', () => {
    modal.open();
    modal.searchInput.value = 'nonexistent-xyz-query';
    modal.searchInput.trigger('input', {
      target: { value: 'nonexistent-xyz-query' }
    });

    expect(modal.listContainer.children.length).toBe(1);
    const emptyBox = modal.listContainer.children[0];
    expect(emptyBox.className).toBe('guide-hub-empty-state');

    const clearFiltersBtn = emptyBox.children[2];
    clearFiltersBtn.trigger('click');
    expect(modal.activeTag).toBe('all');
    expect(modal.searchQuery).toBe('');
    expect(modal.searchInput.value).toBe('');
    expect(modal.listContainer.children.length).toBe(6);
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
    const timelineCard = modal.listContainer.children[4];
    const actionBtn = timelineCard.children[1];
    actionBtn.trigger('click');

    expect(closeSpy).toHaveBeenCalled();
    expect(mockTimelineEditor.tourGuide.startTour).toHaveBeenCalledWith('timeline');
    expect(callOrder).toEqual(['close', 'startTour']);
  });

  it('should trigger quick_start, reuse_blocks, create_and_export_script, welcome_guide, and inspector_tour actions', () => {
    modal.open();

    // Quick Start
    modal.listContainer.children[0].children[1].trigger('click');
    expect(mockTimelineEditor.onboardingFlow.restart).toHaveBeenCalled();

    // Reuse Blocks Interactive Guide
    modal.open();
    modal.listContainer.children[1].children[1].trigger('click');
    expect(mockTimelineEditor.reuseBlocksGuide.start).toHaveBeenCalled();

    // Create and Export Script Interactive Guide
    modal.open();
    modal.listContainer.children[2].children[1].trigger('click');
    expect(mockTimelineEditor.createScriptGuide.start).toHaveBeenCalled();

    // Welcome Overview Guide
    modal.open();
    modal.listContainer.children[3].children[1].trigger('click');
    expect(mockTimelineEditor.welcomeGuide.start).toHaveBeenCalled();

    // Inspector Tour
    modal.open();
    modal.listContainer.children[5].children[1].trigger('click');
    expect(mockTimelineEditor.tourGuide.startInspectorTour).toHaveBeenCalled();
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
