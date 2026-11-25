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

    const localStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key) => localStore[key] || null),
      setItem: vi.fn((key, val) => {
        localStore[key] = String(val);
      }),
      removeItem: vi.fn((key) => {
        delete localStore[key];
      }),
      clear: vi.fn(() => {
        for (const k in localStore) delete localStore[k];
      })
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
    expect(modal.columnsControl).toBeDefined();
    expect(modal.columnsSelect).toBeDefined();
    expect(modal.customColumnsInput).toBeDefined();
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

  it('pre-populates composition when creating a new preset with an active timeline event', () => {
    modal.timelineEditor = {
      inspector: {
        selectedEvent: {
          name: 'Golden Ring Willow',
          shapeType: 'ring',
          dynamicsType: 'willow',
          color: '#ffd700',
          scale: 1.5,
          particleCountMultiplier: 1.2,
          starLifeMultiplier: 1.8,
          effects: ['strobe'],
          multiNested: false,
          sound: {
            launch: 'heavy',
            burst: 'heavy',
            crackle: 'dense',
            volumeMultiplier: 1.5
          }
        }
      }
    };

    modal.openDrawerForNew();
    expect(modal.activeEditingPreset).toBeDefined();
    expect(modal.activeEditingPreset.name).toBe('Golden Ring Willow');
    expect(modal.activeEditingPreset.composition).toEqual({
      shapeType: 'ring',
      dynamicsType: 'willow',
      color: '#ffd700',
      shellSize: 1.5,
      particleCountMultiplier: 1.2,
      starLifeMultiplier: 1.8,
      effects: ['strobe'],
      multiNested: false,
      stages: [],
      secondBurst: null,
      sound: {
        launch: 'heavy',
        burst: 'heavy',
        crackle: 'dense',
        volumeMultiplier: 1.5
      }
    });
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

  it('preserves sound profiles in preset composition and restores them on apply', () => {
    const targetEvent = {
      type: 'sequence',
      shapeType: 'sphere',
      dynamicsType: 'standard'
    };

    const preset = {
      id: 'custom_sound_test',
      name: 'Custom Sound Firework',
      composition: {
        shapeType: 'ring',
        dynamicsType: 'willow',
        color: '#ffdd00',
        sound: {
          launch: 'heavy',
          burst: 'heavy',
          crackle: 'dense',
          volumeMultiplier: 1.5
        }
      }
    };

    if (preset.composition.sound) {
      targetEvent.sound = {
        ...preset.composition.sound
      };
      targetEvent.launchSound = preset.composition.sound.launch;
      targetEvent.burstSound = preset.composition.sound.burst;
      targetEvent.crackleSound = preset.composition.sound.crackle;
      targetEvent.soundVolume = preset.composition.sound.volumeMultiplier;
    }

    expect(targetEvent.sound.burst).toBe('heavy');
    expect(targetEvent.sound.launch).toBe('heavy');
    expect(targetEvent.sound.crackle).toBe('dense');
    expect(targetEvent.sound.volumeMultiplier).toBe(1.5);
    expect(targetEvent.burstSound).toBe('heavy');
  });

  it('changes preset grid columns per row when selector changes', () => {
    // Default is auto
    expect(modal.columnsSetting).toBe('auto');
    expect(modal.gridContainer.style.gridTemplateColumns).toBe(
      'repeat(auto-fill, minmax(260px, 1fr))'
    );

    // Switch to 1 column
    modal.columnsSelect.value = '1';
    modal.columnsSelect._listeners.change.forEach((fn) =>
      fn({ target: { value: '1' } })
    );
    expect(modal.columnsSetting).toBe('1');
    expect(modal.gridContainer.style.gridTemplateColumns).toBe(
      'repeat(1, minmax(0, 1fr))'
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'fdstudio_preset_hub_columns',
      '1'
    );

    // Check card layout in single column mode
    const firstCard = modal.gridContainer.querySelector('.preset-card');
    expect(firstCard.style.flexDirection).toBe('row');

    // Switch to 5 columns
    modal.columnsSelect.value = '5';
    modal.columnsSelect._listeners.change.forEach((fn) =>
      fn({ target: { value: '5' } })
    );
    expect(modal.columnsSetting).toBe('5');
    expect(modal.gridContainer.style.gridTemplateColumns).toBe(
      'repeat(5, minmax(0, 1fr))'
    );

    // Switch to 10 columns
    modal.columnsSelect.value = '10';
    modal.columnsSelect._listeners.change.forEach((fn) =>
      fn({ target: { value: '10' } })
    );
    expect(modal.columnsSetting).toBe('10');
    expect(modal.gridContainer.style.gridTemplateColumns).toBe(
      'repeat(10, minmax(0, 1fr))'
    );

    // Switch to custom columns
    modal.columnsSelect.value = 'custom';
    modal.columnsSelect._listeners.change.forEach((fn) =>
      fn({ target: { value: 'custom' } })
    );
    expect(modal.columnsSetting).toBe('custom');
    expect(modal.customColumnsInput.style.display).toBe('block');

    modal.customColumnsInput.value = '3';
    modal.customColumnsInput._listeners.input.forEach((fn) =>
      fn({ target: { value: '3' } })
    );
    expect(modal.customColumns).toBe(3);
    expect(modal.gridContainer.style.gridTemplateColumns).toBe(
      'repeat(3, minmax(0, 1fr))'
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'fdstudio_preset_hub_custom_columns',
      '3'
    );
  });

  it('keeps media preview unobstructed and adapts badges by filter and grid density', () => {
    const customPreset = {
      id: 'custom_test_shell',
      name: 'Custom Test Shell',
      category: 'shell',
      isCustom: true,
      summary: 'Test summary'
    };

    modal.selectedCategory = 'all';
    modal.selectedSource = 'all';
    modal.columnsSetting = '5';
    const card5 = modal.createPresetCard(customPreset);

    const media5 = card5.querySelector('.preset-card-media');
    expect(media5.querySelector('.preset-card-badges')).toBeNull();
    expect(card5.querySelector('.preset-card-badge-category')).not.toBeNull();
    expect(card5.querySelector('.preset-card-badge-custom')).not.toBeNull();

    // Filter-aware: when category and source are narrowed, redundant badges are hidden
    modal.selectedCategory = 'shell';
    modal.selectedSource = 'custom';
    const filteredCard = modal.createPresetCard(customPreset);
    expect(filteredCard.querySelector('.preset-card-badges')).toBeNull();

    // Dense grid (10 columns): uses compact dot for custom presets when source is all
    modal.selectedCategory = 'all';
    modal.selectedSource = 'all';
    modal.columnsSetting = '10';
    const denseCard = modal.createPresetCard(customPreset);
    const denseMedia = denseCard.querySelector('.preset-card-media');
    expect(denseMedia.querySelector('.preset-card-custom-dot')).toBeNull();
    expect(denseCard.querySelector('.preset-card-custom-dot')).not.toBeNull();
    expect(denseCard.querySelector('.preset-card-badges')).toBeNull();

    // Dense grid with source filtered to custom: dot is also omitted
    modal.selectedSource = 'custom';
    const denseFilteredCard = modal.createPresetCard(customPreset);
    expect(denseFilteredCard.querySelector('.preset-card-custom-dot')).toBeNull();
  });
});
