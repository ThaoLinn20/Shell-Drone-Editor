import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll
} from 'vitest';

const customConfirmMock = vi.fn();

vi.mock(
  '../../src/editor/ui/utils/Modal.js',
  () => ({
    customChoicePrompt: vi.fn(),
    customConfirm: customConfirmMock
  })
);

describe('TimelineEditor Language Selector', () => {
  let TimelineEditor;
  let SUPPORTED_LANGUAGES;
  let getLanguage;
  let setLanguage;
  let mockShowDirector;
  let mockHotkeyManager;
  let reloadMock;
  let storage;

  beforeAll(async () => {
    storage = {
      app_lang: 'en'
    };
    vi.stubGlobal(
      'localStorage',
      {
        getItem: vi.fn((key) => storage[key] || null),
        setItem: vi.fn((key, val) => {
          storage[key] = val;
        })
      }
    );

    const i18nMod = await import('../../src/config/lang/i18n.js');
    SUPPORTED_LANGUAGES = i18nMod.SUPPORTED_LANGUAGES;
    getLanguage = i18nMod.getLanguage;
    setLanguage = i18nMod.setLanguage;

    const editorMod = await import('../../src/ui/TimelineEditor.js');
    TimelineEditor = editorMod.TimelineEditor;
  });

  beforeEach(() => {
    customConfirmMock.mockReset();
    setLanguage('en');

    reloadMock = vi.fn();
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn()
    );

    const createMockElement = (tag = 'div') => {
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        dataset: {},
        children: [],
        parentElement: null,
        appendChild: vi.fn((child) => {
          el.children.push(child);
          child.parentElement = el;
          return child;
        }),
        removeChild: vi.fn((child) => {
          el.children = el.children.filter((c) => c !== child);
          child.parentElement = null;
        }),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        contains: vi.fn(
          (child) => el.children.includes(child) || child === el
        ),
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 0,
          top: 20,
          width: 1000,
          height: 500
        }),
        querySelector: vi.fn().mockReturnValue(null),
        querySelectorAll: vi.fn().mockReturnValue([]),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        click: vi.fn(),
        focus: vi.fn(),
        title: '',
        innerHTML: '',
        textContent: ''
      };
      return el;
    };

    const bodyEl = createMockElement('body');

    vi.stubGlobal(
      'document',
      {
        createElement: vi.fn((tag) => createMockElement(tag)),
        getElementById: vi.fn().mockReturnValue(null),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        body: bodyEl
      }
    );

    vi.stubGlobal(
      'window',
      {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        innerHeight: 800,
        innerWidth: 1200,
        location: {
          reload: reloadMock
        }
      }
    );

    mockShowDirector = {
      totalDuration: 60,
      isPlaying: false,
      currentTime: 0,
      sequences: [],
      setSequences: vi.fn(),
      play: vi.fn(),
      pause: vi.fn(),
      seek: vi.fn(),
      onUpdate: null,
      onAudioUpdate: null
    };

    mockHotkeyManager = {
      register: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exports all 4 supported languages with clean native labels', () => {
    expect(SUPPORTED_LANGUAGES).toEqual([
      {
        value: 'en',
        label: 'English'
      },
      {
        value: 'vi',
        label: 'Tiếng Việt'
      },
      {
        value: 'zh',
        label: '中文'
      },
      {
        value: 'ja',
        label: '日本語'
      }
    ]);
  });

  it('mounts langSelect next to helpBtn in the right-aligned toolbar group', () => {
    const editor = new TimelineEditor(
      mockShowDirector,
      mockHotkeyManager
    );

    expect(editor.helpBtn).toBeDefined();
    expect(editor.langSelect).toBeDefined();
    expect(editor.langSelect.value).toBe('en');
    expect(editor.langSelect.enableSearch).toBe(false);

    const rightGroup = editor.helpBtn.parentElement;
    expect(rightGroup).toBeDefined();
    expect(rightGroup.style.marginLeft).toBe('auto');
    expect(rightGroup.children[0]).toBe(editor.helpBtn);
    expect(rightGroup.children[1]).toBe(editor.langSelect.element);
  });

  it('reverts language selection without reloading when user cancels confirmation', async () => {
    customConfirmMock.mockResolvedValue(false);

    const editor = new TimelineEditor(
      mockShowDirector,
      mockHotkeyManager
    );

    await editor.langSelect.onChange('vi');

    expect(customConfirmMock).toHaveBeenCalledTimes(1);
    expect(getLanguage()).toBe('en');
    expect(editor.langSelect.value).toBe('en');
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('persists new language and reloads when user confirms warning', async () => {
    customConfirmMock.mockResolvedValue(true);

    const editor = new TimelineEditor(
      mockShowDirector,
      mockHotkeyManager
    );

    await editor.langSelect.onChange('ja');

    expect(customConfirmMock).toHaveBeenCalledTimes(1);
    expect(getLanguage()).toBe('ja');
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});

