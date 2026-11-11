import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  OnboardingStateMachine,
  ONBOARDING_STEPS,
  ONBOARDING_STORAGE_KEY
} from '../../src/ui/OnboardingStateMachine.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, val) => map.set(key, String(val)),
    removeItem: (key) => map.delete(key)
  };
}

function createEventBus() {
  const listeners = new Map();
  return {
    on: vi.fn((event, handler) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event).add(handler);
    }),
    off: vi.fn((event, handler) => {
      if (listeners.has(event)) {
        listeners.get(event).delete(handler);
      }
    }),
    emit: vi.fn((event, payload) => {
      if (listeners.has(event)) {
        for (const handler of listeners.get(event)) {
          handler(payload);
        }
      }
    }),
    listenerCount: (event) => (listeners.has(event) ? listeners.get(event).size : 0)
  };
}

describe('OnboardingStateMachine', () => {
  let eventBus;
  let storage;
  let machine;

  beforeEach(() => {
    eventBus = createEventBus();
    storage = createMemoryStorage();
    machine = new OnboardingStateMachine(eventBus, storage);
  });

  it('should walk through all 4 interactive steps and complete on playback start', () => {
    const started = machine.startIfNeeded();
    expect(started).toBe(true);
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.DOWNLOAD_SCRIPTS);
    expect(machine.waitingForDownload).toBe(false);

    // Step 1: user clicks download link -> waiting state
    eventBus.emit('onboarding:drive-opened');
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.DOWNLOAD_SCRIPTS);
    expect(machine.waitingForDownload).toBe(true);

    // User confirms download -> Step 2
    machine.advanceToSelectFolder();
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.SELECT_FOLDER);
    expect(machine.waitingForDownload).toBe(false);

    // Step 2: folder scanned with valid scripts -> Step 3
    eventBus.emit('scripts:folder-scanned', { count: 3, archiveCount: 0 });
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.IMPORT_SCRIPT);

    // Step 3: user imports a script -> Step 4
    eventBus.emit('timeline:show-loaded', { filename: 'demo.json' });
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.PLAY_SHOW);

    // Step 4: user clicks Play or presses Space -> completed & unsubscribed
    eventBus.emit('timeline:playback-started');
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.COMPLETED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('scripts:folder-scanned')).toBe(0);
    expect(eventBus.listenerCount('timeline:show-loaded')).toBe(0);
    expect(eventBus.listenerCount('timeline:playback-started')).toBe(0);

    // Subsequent launches should not auto-start
    const nextMachine = new OnboardingStateMachine(eventBus, storage);
    expect(nextMachine.startIfNeeded()).toBe(false);
  });

  it('should stay on select_folder and flag zipDetected when only archives are found', () => {
    machine.startIfNeeded();
    machine.advanceToSelectFolder();
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.SELECT_FOLDER);

    eventBus.emit('scripts:folder-scanned', { count: 0, archiveCount: 2 });
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.SELECT_FOLDER);
    expect(machine.zipDetected).toBe(true);
  });

  it('should resume at persisted mid-flow step across restarts', () => {
    storage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({ step: ONBOARDING_STEPS.SELECT_FOLDER })
    );

    const resumed = machine.startIfNeeded();
    expect(resumed).toBe(true);
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.SELECT_FOLDER);
  });

  it('should unbind all listeners and persist dismissed status on dismiss', () => {
    machine.startIfNeeded();
    expect(eventBus.listenerCount('onboarding:drive-opened')).toBe(1);

    machine.dismiss();
    expect(machine.currentStep).toBe(ONBOARDING_STEPS.DISMISSED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('onboarding:drive-opened')).toBe(0);

    const nextMachine = new OnboardingStateMachine(eventBus, storage);
    expect(nextMachine.startIfNeeded()).toBe(false);
  });
});

describe('ShowLibraryModal and TimelineEditor show loading', () => {
  let ShowLibraryModal;
  let TimelineEditor;
  let globalEventBus;

  beforeEach(async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', createMemoryStorage());

    const createMockElement = () => {
      const el = {
        style: {},
        dataset: {},
        className: '',
        children: [],
        appendChild: vi.fn((child) => {
          el.children.push(child);
          return child;
        }),
        addEventListener: vi.fn((type, handler) => {
          if (!el._listeners) el._listeners = {};
          if (!el._listeners[type]) el._listeners[type] = [];
          el._listeners[type].push(handler);
        }),
        removeEventListener: vi.fn(),
        remove: vi.fn(),
        contains: vi.fn(() => false),
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 0,
          top: 20,
          width: 200,
          height: 30
        }),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        click: vi.fn(() => {
          if (el._listeners && el._listeners.click) {
            el._listeners.click.forEach((fn) => fn({ stopPropagation: vi.fn() }));
          }
        }),
        title: '',
        innerHTML: '',
        textContent: '',
        querySelector: vi.fn(() => null)
      };
      return el;
    };

    vi.stubGlobal('document', {
      createElement: vi.fn(() => createMockElement()),
      getElementById: vi.fn(() => null),
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
      removeEventListener: vi.fn(),
      open: vi.fn()
    });

    const libMod = await import('../../src/ui/ShowLibraryModal.js');
    ShowLibraryModal = libMod.ShowLibraryModal;
    const editorMod = await import('../../src/ui/TimelineEditor.js');
    TimelineEditor = editorMod.TimelineEditor;
    const busMod = await import('../../src/core/EventBus.js');
    globalEventBus = busMod.globalEventBus;
  });

  it('should emit onboarding:drive-opened when opening scripts Drive link', () => {
    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn()
    };
    const editor = new TimelineEditor(mockDirector, null);
    const emitSpy = vi.spyOn(globalEventBus, 'emit');

    editor.openScriptsDrive();

    expect(emitSpy).toHaveBeenCalledWith('onboarding:drive-opened');
  });

  it('should render scanned scripts and load selected script with companion audio', async () => {
    const mockDirector = {
      elapsedTime: 4,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn()
    };
    const editor = new TimelineEditor(mockDirector, null);
    const modal = new ShowLibraryModal(editor);
    modal.initDOM();

    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    editor.activeAudioBlobUrls = ['blob:old-url'];

    modal.renderScanResult({
      folderPath: 'D:/Shows',
      exists: true,
      scripts: [
        {
          filename: 'tet_show.json',
          filePath: 'D:/Shows/tet_show.json',
          relativePath: 'tet_show.json',
          folderName: '',
          eventCount: 2,
          duration: 60,
          hasAudio: true,
          companionAudioReady: true
        }
      ],
      archiveFiles: []
    });

    expect(modal.listContainer.children.length).toBe(1);

    const loaded = editor.loadShowFromFileData(
      {
        filePath: 'D:/Shows/tet_show.json',
        filename: 'tet_show.json',
        content: JSON.stringify([
          { time: 0, type: 'audio', url: 'music.mp3', duration: 60 },
          { time: 2, type: 'sequence', preset: 'crysanthemum', count: 5, duration: 0.1 }
        ]),
        companionAudios: {
          'music.mp3': {
            buffer: new ArrayBuffer(8),
            mimeType: 'audio/mpeg'
          }
        }
      },
      {
        silentSuccess: true,
        resetPlaybackPosition: true,
        skipConfirm: true
      }
    );

    expect(loaded).toBe(true);
    expect(revokeSpy).toHaveBeenCalledWith('blob:old-url');
    expect(editor.sequences[0]._blobUrl).toBe('blob:mock-audio-url');
    expect(editor.anchorTime).toBe(0);
    expect(mockDirector.seek).toHaveBeenCalledWith(0);
    createSpy.mockRestore();
    revokeSpy.mockRestore();
  });

  it('should trigger openSingleScriptFile from ShowLibraryModal openSingleFileBtn and close on load', () => {
    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn()
    };
    const editor = new TimelineEditor(mockDirector, null);
    const singleSpy = vi.spyOn(editor, 'openSingleScriptFile').mockResolvedValue(true);

    editor.showLibraryModal.open();
    expect(editor.showLibraryModal.isVisible).toBe(true);
    expect(editor.showLibraryModal.openSingleFileBtn).toBeDefined();

    editor.showLibraryModal.openSingleFileBtn.click();
    expect(singleSpy).toHaveBeenCalled();

    globalEventBus.emit('timeline:show-loaded', { filename: 'single.json' });
    expect(editor.showLibraryModal.isVisible).toBe(false);
  });
});
