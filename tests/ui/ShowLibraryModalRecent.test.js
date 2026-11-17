import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi
} from 'vitest';
import { ShowLibraryModal } from '../../src/ui/ShowLibraryModal.js';
import { fileStorage } from '../../src/core/FileStorageAdapter.js';
import {
  RECENT_SCRIPTS_STORAGE_KEY,
  addRecentScript,
  clearRecentScripts
} from '../../src/utils/recentScripts.js';

describe('ShowLibraryModal Recent Scripts', () => {
  let mockTimelineEditor;
  let modal;
  let mockStorage = {};
  let windowListeners = {};

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
      title: '',
      children: [],
      parentElement: null,
      _listeners: {},
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
        if (el.parentElement && el.parentElement.children) {
          el.parentElement.children = el.parentElement.children.filter(
            (c) => c !== el
          );
        }
      }),
      addEventListener: vi.fn((type, handler) => {
        if (!el._listeners[type]) {
          el._listeners[type] = [];
        }
        el._listeners[type].push(handler);
      }),
      click: () => {
        if (el._listeners && el._listeners.click) {
          el._listeners.click.forEach((fn) => {
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
    mockStorage = {};
    windowListeners = {};

    vi.stubGlobal('localStorage', {
      getItem: (key) => mockStorage[key] || null,
      setItem: (key, val) => {
        mockStorage[key] = String(val);
      },
      removeItem: (key) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      }
    });

    vi.stubGlobal('window', {
      addEventListener: vi.fn((type, handler) => {
        if (!windowListeners[type]) {
          windowListeners[type] = [];
        }
        windowListeners[type].push(handler);
      }),
      removeEventListener: vi.fn((type, handler) => {
        if (windowListeners[type]) {
          windowListeners[type] = windowListeners[type].filter(
            (h) => h !== handler
          );
        }
      }),
      confirm: vi.fn(() => true),
      requestAnimationFrame: vi.fn((cb) => cb())
    });

    vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => cb()));
    vi.stubGlobal('document', {
      createElement: vi.fn((tag) => createMockElement(tag)),
      getElementById: vi.fn(() => null),
      body: createMockElement('body')
    });

    mockTimelineEditor = {
      loadShowFromFileData: vi.fn().mockResolvedValue(true),
      openScriptsDrive: vi.fn(),
      openSingleScriptFile: vi.fn()
    };

    modal = new ShowLibraryModal(mockTimelineEditor);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('activates recent tab by default when recent scripts exist', async () => {
    addRecentScript({
      filePath: 'C:/shows/show1.json',
      filename: 'show1.json',
      eventCount: 42,
      duration: 120
    });

    await modal.open();

    expect(modal.activeTab).toBe('recent');
    expect(modal.recentTabBtn.style.color).toBe('#00e5ff');
    expect(modal.folderControlsEl.style.display).toBe('none');
    expect(modal.recentCountBadge.textContent).toBe('1');
    expect(modal.recentCountBadge.style.display).toBe('inline-block');
  });

  it('activates folder tab by default when no recent scripts exist', async () => {
    clearRecentScripts();

    await modal.open();

    expect(modal.activeTab).toBe('folder');
    expect(modal.folderTabBtn.style.color).toBe('#00e5ff');
    expect(modal.folderControlsEl.style.display).toBe('flex');
    expect(modal.recentCountBadge.style.display).toBe('none');
  });

  it('allows overriding default tab via open preferredTab parameter', async () => {
    addRecentScript({
      filePath: 'C:/shows/show1.json',
      filename: 'show1.json'
    });

    await modal.open('folder');

    expect(modal.activeTab).toBe('folder');
    expect(modal.folderControlsEl.style.display).toBe('flex');
  });

  it('switches between recent and folder tabs on click', async () => {
    addRecentScript({
      filePath: 'C:/shows/show1.json',
      filename: 'show1.json'
    });

    await modal.open();
    expect(modal.activeTab).toBe('recent');

    modal.folderTabBtn.click();
    expect(modal.activeTab).toBe('folder');
    expect(modal.folderControlsEl.style.display).toBe('flex');

    modal.recentTabBtn.click();
    expect(modal.activeTab).toBe('recent');
    expect(modal.folderControlsEl.style.display).toBe('none');
  });

  it('renders recent script cards with metadata and action buttons', async () => {
    addRecentScript({
      filePath: 'D:/shows/vietnam_show.json',
      filename: 'vietnam_show.json',
      eventCount: 150,
      duration: 360,
      lastOpenedAt: Date.now()
    });

    await modal.open('recent');

    const cards = modal.listContainer.children.filter(
      (c) => c.className === 'show-library-recent-card'
    );
    expect(cards.length).toBe(1);

    const openBtn = cards[0].children
      .find((c) => c.style.display === 'flex')
      .children.find((c) => c.className === 'recent-script-open-btn');
    expect(openBtn).toBeTruthy();

    const removeBtn = cards[0].children
      .find((c) => c.style.display === 'flex')
      .children.find((c) => c.className === 'recent-script-remove-btn');
    expect(removeBtn).toBeTruthy();
  });

  it('handles open action successfully and closes modal', async () => {
    addRecentScript({
      filePath: 'D:/shows/vietnam_show.json',
      filename: 'vietnam_show.json'
    });

    const mockFileData = {
      filename: 'vietnam_show.json',
      content: { version: '2.0', sequences: [] }
    };
    vi.spyOn(fileStorage, 'readScriptFile').mockResolvedValue(mockFileData);

    await modal.open('recent');

    const card = modal.listContainer.children.find(
      (c) => c.className === 'show-library-recent-card'
    );
    const openBtn = card.children
      .find((c) => c.style.display === 'flex')
      .children.find((c) => c.className === 'recent-script-open-btn');

    openBtn.click();
    // Allow async handleOpenRecentScript to settle
    await Promise.resolve();
    await Promise.resolve();

    expect(fileStorage.readScriptFile).toHaveBeenCalledWith(
      'D:/shows/vietnam_show.json'
    );
    expect(mockTimelineEditor.loadShowFromFileData).toHaveBeenCalledWith(
      mockFileData,
      {
        silentSuccess: true,
        resetPlaybackPosition: true
      }
    );
    expect(modal.isVisible).toBe(false);
  });

  it('prompts to remove item when opened file is missing or deleted', async () => {
    addRecentScript({
      filePath: 'D:/shows/deleted_show.json',
      filename: 'deleted_show.json'
    });

    vi.spyOn(fileStorage, 'readScriptFile').mockResolvedValue(null);
    window.confirm = vi.fn(() => true);

    await modal.open('recent');

    const card = modal.listContainer.children.find(
      (c) => c.className === 'show-library-recent-card'
    );
    const openBtn = card.children
      .find((c) => c.style.display === 'flex')
      .children.find((c) => c.className === 'recent-script-open-btn');

    openBtn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(window.confirm).toHaveBeenCalled();
    const stored = JSON.parse(mockStorage[RECENT_SCRIPTS_STORAGE_KEY] || '[]');
    expect(stored.some((item) => item.filePath === 'D:/shows/deleted_show.json')).toBe(false);
  });

  it('removes item when remove button is clicked', async () => {
    addRecentScript({
      filePath: 'D:/shows/show_to_remove.json',
      filename: 'show_to_remove.json'
    });

    await modal.open('recent');

    const card = modal.listContainer.children.find(
      (c) => c.className === 'show-library-recent-card'
    );
    const removeBtn = card.children
      .find((c) => c.style.display === 'flex')
      .children.find((c) => c.className === 'recent-script-remove-btn');

    removeBtn.click();

    const stored = JSON.parse(mockStorage[RECENT_SCRIPTS_STORAGE_KEY] || '[]');
    expect(stored.length).toBe(0);
    expect(modal.recentCountBadge.style.display).toBe('none');
  });

  it('clears all recent scripts when clear history button is clicked', async () => {
    addRecentScript({ filePath: 'D:/shows/show_a.json' });
    addRecentScript({ filePath: 'D:/shows/show_b.json' });

    window.confirm = vi.fn(() => true);
    await modal.open('recent');

    const headerRow = modal.listContainer.children.find(
      (c) => c.className === 'recent-scripts-header-row'
    );
    const clearBtn = headerRow.children.find(
      (c) => c.className === 'clear-recent-history-btn'
    );

    clearBtn.click();

    const stored = JSON.parse(mockStorage[RECENT_SCRIPTS_STORAGE_KEY] || '[]');
    expect(stored.length).toBe(0);
    expect(modal.recentCountBadge.style.display).toBe('none');
  });
});
