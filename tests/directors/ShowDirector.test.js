import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShowDirector } from '../../src/directors/ShowDirector.js';

describe('ShowDirector', () => {
  let mockSequencer;
  let mockFireworkSystem;
  let director;

  beforeEach(() => {
    // Mock audio global class
    global.Audio = class {
      constructor(url) {
        this.src = url;
        this.volume = 1.0;
        this.currentTime = 0;
        this.paused = true;
      }
      play() {
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
    };

    mockSequencer = {
      clear: vi.fn(),
      playPattern: vi.fn(),
      playCometSequence: vi.fn(),
      playFinale: vi.fn(),
      cometSystem: {
        clear: vi.fn(),
        launchRandom: vi.fn()
      }
    };

    mockFireworkSystem = {
      clear: vi.fn(),
      launchRandom: vi.fn()
    };

    director = new ShowDirector(mockSequencer, mockFireworkSystem);
  });

  it('should load script and sort events by time', () => {
    const script = [
      { time: 5.0, type: 'single', preset: 'crysanthemum' },
      { time: 1.0, type: 'audio', url: 'sound.mp3' },
      { time: 3.0, type: 'sequence', pattern: 'sweep-left' }
    ];

    director.loadScript(script);

    expect(director.scriptConfig[0].time).toBe(1.0);
    expect(director.scriptConfig[1].time).toBe(3.0);
    expect(director.scriptConfig[2].time).toBe(5.0);
    expect(director.events.length).toBe(3);
    expect(mockSequencer.clear).toHaveBeenCalled();
  });

  it('should toggle playing state with play, pause and stop', () => {
    expect(director.isPlaying).toBe(false);
    
    director.play();
    expect(director.isPlaying).toBe(true);

    director.pause();
    expect(director.isPlaying).toBe(false);

    director.play();
    director.stop();
    expect(director.isPlaying).toBe(false);
    expect(director.elapsedTime).toBe(0);
  });

  it('should filter events and sync audio on seek', () => {
    const script = [
      { time: 1.0, type: 'audio', url: 'sound.mp3', duration: 10 },
      { time: 3.0, type: 'single', preset: 'crysanthemum' },
      { time: 5.0, type: 'single', preset: 'ring' }
    ];

    director.loadScript(script);
    director.seek(4.0);

    expect(director.elapsedTime).toBe(4.0);
    expect(director.events.length).toBe(1); // Only the 5.0s event left
    expect(director.events[0].preset).toBe('ring');
    expect(mockFireworkSystem.clear).toHaveBeenCalled();
  });

  it('should execute events during update loop', () => {
    const script = [
      { time: 1.0, type: 'single', preset: 'crysanthemum', ratioX: 0.1, ratioY: 0.2 },
      { time: 2.0, type: 'sequence', pattern: 'sweep-left', count: 5 }
    ];

    director.loadScript(script);
    director.play();

    // Update by 1.5 seconds, triggering first event
    director.update(1.5);
    expect(director.elapsedTime).toBe(1.5);
    expect(mockFireworkSystem.launchRandom).toHaveBeenCalledWith('crysanthemum', {
      ratioX: 0.1,
      ratioY: 0.2,
      ratioZ: undefined,
      sectorId: undefined,
      color: undefined,
      effectOverrides: undefined
    });
    expect(director.events.length).toBe(1); // 2.0s event left

    // Update by 1.0 seconds, triggering second event
    director.update(1.0);
    expect(director.elapsedTime).toBe(2.5);
    expect(mockSequencer.playPattern).toHaveBeenCalledWith('sweep-left', expect.any(Object));
    expect(director.events.length).toBe(0);
  });

  it('should support dynamic registration of new event handlers (OCP)', () => {
    const customHandler = vi.fn();
    director.dispatcher.register('laser', customHandler);

    const script = [
      { time: 1.0, type: 'laser', intensity: 0.8 }
    ];

    director.loadScript(script);
    director.play();
    director.update(1.5);

    expect(customHandler).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'laser', intensity: 0.8 }),
      expect.objectContaining({ sequencer: mockSequencer, fireworkSystem: mockFireworkSystem })
    );
  });

  it('should forward starLifeMultiplier in effectOverrides when executing single firework', () => {
    const script = [
      {
        time: 1.0,
        type: 'single',
        preset: 'crysanthemum',
        starLifeMultiplier: 5.0
      }
    ];

    director.loadScript(script);
    director.play();
    director.update(1.5);

    expect(mockFireworkSystem.launchRandom).toHaveBeenCalledWith('crysanthemum', expect.objectContaining({
      effectOverrides: expect.objectContaining({
        starLifeMultiplier: 5.0
      })
    }));
  });

  it('should preview selected sequences immediately with relative timing without mutating timeline state', () => {
    const seq1 = { time: 12.0, type: 'single', preset: 'ring' };
    const seq2 = { time: 13.5, type: 'sequence', pattern: 'sweep-left', count: 4 };
    const audioEvt = { time: 10.0, type: 'audio', url: 'music.mp3' };
    const droneEvt = { time: 11.0, type: 'droneshow', name: 'Drone' };

    director.elapsedTime = 5.0;
    const started = director.previewEvents([audioEvt, droneEvt, seq1, seq2]);

    expect(started).toBe(true);
    expect(director.isPlaying).toBe(false);
    expect(director.elapsedTime).toBe(5.0);
    // Earliest firework (12.0s) executes immediately at t=0
    expect(mockFireworkSystem.launchRandom).toHaveBeenCalledTimes(1);
    expect(mockFireworkSystem.launchRandom).toHaveBeenCalledWith(
      'ring',
      expect.any(Object)
    );
    expect(mockSequencer.playPattern).not.toHaveBeenCalled();

    // Advance dt by 1.0s (still 0.5s remaining for seq2)
    director.update(1.0);
    expect(director.elapsedTime).toBe(5.0);
    expect(mockSequencer.playPattern).not.toHaveBeenCalled();

    // Advance dt by 0.6s -> seq2 fires at +1.5s relative offset
    director.update(0.6);
    expect(mockSequencer.playPattern).toHaveBeenCalledTimes(1);
    expect(director.previewQueue.length).toBe(0);
  });

  it('should flatten group children for preview, allow overlapping clicks, and clear queue on play or stop', () => {
    const group = {
      time: 20.0,
      type: 'group',
      children: [
        { timeOffset: 0, type: 'single', preset: 'peony' },
        { timeOffset: 1.0, type: 'single', preset: 'willow' },
        { timeOffset: 0.5, type: 'audio', url: 'skip.mp3' }
      ]
    };

    expect(director.previewEvents([{ time: 0, type: 'audio', url: 'x.mp3' }])).toBe(false);

    expect(director.previewEvents([group])).toBe(true);
    expect(mockFireworkSystem.launchRandom).toHaveBeenCalledTimes(1);
    expect(director.previewQueue.length).toBe(1);

    // Consecutive preview call appends rather than cancelling in-flight preview
    expect(director.previewEvents([group])).toBe(true);
    expect(mockFireworkSystem.launchRandom).toHaveBeenCalledTimes(2);
    expect(director.previewQueue.length).toBe(2);

    // play() clears pending previewQueue so main show playback stays clean
    director.play();
    expect(director.previewQueue.length).toBe(0);
  });
});
