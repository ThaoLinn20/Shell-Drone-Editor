import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AudioBeatsStateMachine,
  AUDIO_BEATS_STEPS,
  DEFAULT_TARGET_BEATS
} from '../../../src/ui/guides/AudioBeatsStateMachine.js';

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

describe('AudioBeatsStateMachine', () => {
  let eventBus;
  let machine;

  beforeEach(() => {
    eventBus = createEventBus();
    machine = new AudioBeatsStateMachine(
      eventBus,
      DEFAULT_TARGET_BEATS
    );
  });

  it('should walk through all 11 steps including selecting a beat on timeline before double-B delete', () => {
    machine.start();
    expect(machine.isActive).toBe(true);
    expect(machine.getTotalSteps()).toBe(11);
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.OPEN_ADD_MENU);

    // Step 1 -> Step 2 when Add Drone/Audio menu opens
    eventBus.emit('timeline:add-file-menu-toggled', { isOpen: true });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.CLICK_ADD_AUDIO);

    // Closing dropdown without clicking Add Audio reverts to Step 1
    eventBus.emit('timeline:add-file-menu-toggled', { isOpen: false });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.OPEN_ADD_MENU);

    // Re-open dropdown -> click Add Audio MP3/WAV -> wait import (Step 3)
    eventBus.emit('timeline:add-file-menu-toggled', { isOpen: true });
    eventBus.emit('timeline:audio-picker-opened');
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.WAIT_AUDIO_IMPORT);

    // Imported audio event -> Step 4 (select added audio block)
    const audioEvent = {
      type: 'audio',
      name: 'song.mp3',
      beats: []
    };
    eventBus.emit('timeline:audio-imported', { event: audioEvent });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK);
    expect(machine.activeAudioEvent).toBe(audioEvent);

    // Selecting non-audio block does NOT satisfy Step 4
    eventBus.emit('timeline:selection-changed', {
      selectedEvents: [{ type: 'sequence' }]
    });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK);

    // Selecting audio block advances to Step 5 (Auto Detect Beats)
    eventBus.emit('timeline:selection-changed', {
      selectedEvents: [audioEvent]
    });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS);

    // Deselecting audio block reverts to Step 4 cleanly
    eventBus.emit('timeline:selection-changed', { selectedEvents: [] });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK);

    // Re-select -> Auto Detect -> Step 6 (Explain Beats) -> Step 7 (Clear All Beats)
    eventBus.emit('timeline:selection-changed', {
      selectedEvents: [audioEvent]
    });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS);
    eventBus.emit('audio:beats-auto-detected', { count: 24, event: audioEvent });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.EXPLAIN_BEATS);

    machine.advanceFromExplainBeats();
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.CLEAR_BEATS);

    // Clearing beats -> Step 8 (Play Audio)
    eventBus.emit('audio:beats-cleared', { event: audioEvent });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.PLAY_AUDIO);

    // Beat tapped while paused does NOT count toward completion
    eventBus.emit('audio:beat-tapped', { isPlaying: false });
    expect(machine.tappedBeatsCount).toBe(0);
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.PLAY_AUDIO);

    // Start playing -> Step 8 (Tap 5 beats with key B)
    eventBus.emit('timeline:playback-started');
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.TAP_BEATS);

    for (let i = 1; i <= 3; i++) {
      eventBus.emit('audio:beat-tapped', { isPlaying: true });
      expect(machine.tappedBeatsCount).toBe(i);
      expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.TAP_BEATS);
    }

    // Pausing mid-tapping returns to PLAY_AUDIO while preserving tapped count
    eventBus.emit('timeline:playback-paused');
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.PLAY_AUDIO);
    expect(machine.tappedBeatsCount).toBe(3);

    // Resume playback and tap remaining 2 beats -> Step 10 (Select beat on timeline)
    eventBus.emit('timeline:playback-started');
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.TAP_BEATS);
    eventBus.emit('audio:beat-tapped', { isPlaying: true });
    expect(machine.tappedBeatsCount).toBe(4);
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.TAP_BEATS);

    // Deleting a beat before reaching final step does NOT complete early
    eventBus.emit('audio:beat-deleted', { beatCount: 3 });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.TAP_BEATS);

    eventBus.emit('audio:beat-tapped', { isPlaying: true });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE);

    // Clicking empty ruler away from beats stays on SELECT_BEAT_ON_TIMELINE
    eventBus.emit('audio:beat-unfocused');
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE);

    // Selecting a beat dot on timeline -> Step 11 (Press B twice to delete)
    eventBus.emit('audio:beat-focused', { beatTime: 2.0 });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.DELETE_ONE_BEAT);

    // Clicking elsewhere off-beat reverts Step 11 -> Step 10 cleanly
    eventBus.emit('audio:beat-unfocused');
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE);

    eventBus.emit('audio:beat-focused', { beatTime: 2.0 });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.DELETE_ONE_BEAT);

    // Pausing does not revert DELETE_ONE_BEAT
    eventBus.emit('timeline:playback-paused');
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.DELETE_ONE_BEAT);

    // Pressing B twice to delete completes and unbinds all listeners
    eventBus.emit('audio:beat-deleted', { beatCount: 4, source: 'double_press_b' });
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.COMPLETED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('timeline:add-file-menu-toggled')).toBe(0);
    expect(eventBus.listenerCount('audio:beats-auto-detected')).toBe(0);
    expect(eventBus.listenerCount('audio:beats-cleared')).toBe(0);
    expect(eventBus.listenerCount('audio:beat-tapped')).toBe(0);
    expect(eventBus.listenerCount('audio:beat-focused')).toBe(0);
    expect(eventBus.listenerCount('audio:beat-unfocused')).toBe(0);
    expect(eventBus.listenerCount('audio:beat-deleted')).toBe(0);
  });

  it('should unbind all listeners cleanly on dismiss', () => {
    machine.start();
    expect(eventBus.listenerCount('audio:beat-tapped')).toBe(1);

    machine.dismiss();
    expect(machine.currentStep).toBe(AUDIO_BEATS_STEPS.DISMISSED);
    expect(machine.isActive).toBe(false);
    expect(eventBus.listenerCount('audio:beat-tapped')).toBe(0);
  });
});

describe('AudioBeatsGuideFlow with TimelineEditor and PropertyInspector', () => {
  it('should clear auto-selection upon audio import so user clicks audio block, then target inspector actions', async () => {
    vi.stubGlobal('requestAnimationFrame', vi.fn());
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {}
    });

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
        trigger: (type, eventObj = {}) => {
          const list = (el._listeners && el._listeners[type]) || [];
          list.forEach((fn) => fn(eventObj));
        },
        scrollIntoView: vi.fn(),
        getBoundingClientRect: vi.fn().mockReturnValue({
          left: 20,
          top: 30,
          width: 140,
          height: 32
        }),
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        click: vi.fn(() => {
          el.trigger('click', { stopPropagation: vi.fn() });
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
      removeEventListener: vi.fn(),
      querySelector: vi.fn(() => null)
    });

    vi.stubGlobal('window', {
      innerWidth: 1920,
      innerHeight: 1080,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      open: vi.fn()
    });

    const { TimelineEditor } = await import('../../../src/ui/TimelineEditor.js');
    const { AudioBeatsGuideFlow } = await import('../../../src/ui/guides/AudioBeatsGuideFlow.js');
    const { globalEventBus } = await import('../../../src/core/EventBus.js');

    const mockDirector = {
      elapsedTime: 0,
      isPlaying: false,
      loadScript: vi.fn(),
      seek: vi.fn(),
      pause: vi.fn(),
      play: vi.fn()
    };

    const editor = new TimelineEditor(mockDirector, null);
    const flow = new AudioBeatsGuideFlow(editor, globalEventBus);

    flow.start();
    expect(flow.stateMachine.currentStep).toBe(AUDIO_BEATS_STEPS.OPEN_ADD_MENU);
    expect(flow.spotlight.isVisible).toBe(true);
    expect(editor.addFileBtn).toBeDefined();
    expect(editor.addAudioOpt).toBeDefined();

    // Simulate clicking addFileBtn and addAudioOpt
    editor.addFileBtn.trigger('click', { stopPropagation: vi.fn() });
    expect(flow.stateMachine.currentStep).toBe(AUDIO_BEATS_STEPS.CLICK_ADD_AUDIO);

    editor.addAudioOpt.trigger('click', { stopPropagation: vi.fn() });
    expect(flow.stateMachine.currentStep).toBe(AUDIO_BEATS_STEPS.WAIT_AUDIO_IMPORT);

    // Simulate audio loaded onto timeline
    const audioSeq = {
      time: 0,
      type: 'audio',
      name: 'demo.mp3',
      duration: 60,
      beats: []
    };
    editor.sequences.push(audioSeq);
    editor.selectedEvents = [audioSeq];
    editor.renderTracks();
    globalEventBus.emit('timeline:audio-imported', { event: audioSeq });

    // Guide clears auto-selection so user manually clicks the audio block
    expect(flow.stateMachine.currentStep).toBe(AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK);
    expect(editor.selectedEvents).toEqual([]);
    const step4Target = flow.getStepConfig(AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK).getTarget();
    expect(step4Target).toBe(editor.blockDomMap.get(audioSeq));

    // User clicks audio block -> Step 5 (Auto Detect Beats)
    editor.selectedEvents = [audioSeq];
    globalEventBus.emit('timeline:selection-changed', { selectedEvents: [audioSeq] });
    expect(flow.stateMachine.currentStep).toBe(AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS);

    const mockAutoBtn = createMockElement();
    editor.inspector.container.querySelector = vi.fn((sel) => {
      if (sel === '[data-inspector-action="auto-detect-beats"]') return mockAutoBtn;
      return null;
    });
    expect(flow.getStepConfig(AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS).getTarget()).toBe(mockAutoBtn);

    const explainActions = flow.getStepActions(AUDIO_BEATS_STEPS.EXPLAIN_BEATS);
    expect(explainActions.length).toBe(1);
    expect(explainActions[0].primary).toBe(true);

    // Selecting beat dot / seeking near beat transitions SELECT_BEAT_ON_TIMELINE -> DELETE_ONE_BEAT
    audioSeq.beats = [1.5, 3.0];
    globalEventBus.emit('audio:beats-auto-detected');
    flow.stateMachine.advanceFromExplainBeats();
    globalEventBus.emit('audio:beats-cleared');
    mockDirector.isPlaying = true;
    globalEventBus.emit('timeline:playback-started');
    for (let i = 0; i < 5; i++) {
      globalEventBus.emit('audio:beat-tapped', { isPlaying: true });
    }
    expect(flow.stateMachine.currentStep).toBe(AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE);
    expect(mockDirector.pause).toHaveBeenCalled();

    editor.setAnchorTime(1.5, true);
    expect(flow.stateMachine.currentStep).toBe(AUDIO_BEATS_STEPS.DELETE_ONE_BEAT);

    flow.destroy();
  });
});

