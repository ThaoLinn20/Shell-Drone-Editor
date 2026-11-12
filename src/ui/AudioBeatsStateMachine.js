export const AUDIO_BEATS_STEPS = {
  OPEN_ADD_MENU: 'open_add_menu',
  CLICK_ADD_AUDIO: 'click_add_audio',
  WAIT_AUDIO_IMPORT: 'wait_audio_import',
  SELECT_AUDIO_BLOCK: 'select_audio_block',
  AUTO_DETECT_BEATS: 'auto_detect_beats',
  EXPLAIN_BEATS: 'explain_beats',
  CLEAR_BEATS: 'clear_beats',
  PLAY_AUDIO: 'play_audio',
  TAP_BEATS: 'tap_beats',
  SELECT_BEAT_ON_TIMELINE: 'select_beat_on_timeline',
  DELETE_ONE_BEAT: 'delete_one_beat',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed'
};

const STEP_ORDER = [
  AUDIO_BEATS_STEPS.OPEN_ADD_MENU,
  AUDIO_BEATS_STEPS.CLICK_ADD_AUDIO,
  AUDIO_BEATS_STEPS.WAIT_AUDIO_IMPORT,
  AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK,
  AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS,
  AUDIO_BEATS_STEPS.EXPLAIN_BEATS,
  AUDIO_BEATS_STEPS.CLEAR_BEATS,
  AUDIO_BEATS_STEPS.PLAY_AUDIO,
  AUDIO_BEATS_STEPS.TAP_BEATS,
  AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE,
  AUDIO_BEATS_STEPS.DELETE_ONE_BEAT
];

export const DEFAULT_TARGET_BEATS = 5;

export class AudioBeatsStateMachine {
  constructor(
    eventBus,
    targetBeatCount = DEFAULT_TARGET_BEATS
  ) {
    this.eventBus = eventBus;
    this.targetBeatCount = targetBeatCount;
    this.currentStep = null;
    this.isActive = false;
    this.isPlaying = false;
    this.tappedBeatsCount = 0;
    this.activeAudioEvent = null;
    this.listeners = [];
    this.onChange = null;
  }

  getStepIndex() {
    return STEP_ORDER.indexOf(this.currentStep);
  }

  getTotalSteps() {
    return STEP_ORDER.length;
  }

  start({ isPlaying = false } = {}) {
    this.currentStep = AUDIO_BEATS_STEPS.OPEN_ADD_MENU;
    this.isActive = true;
    this.isPlaying = Boolean(isPlaying);
    this.tappedBeatsCount = 0;
    this.activeAudioEvent = null;
    this.bindEvents();
    this.notify();
  }

  bindEvents() {
    this.unbindEvents();
    if (!this.eventBus || typeof this.eventBus.on !== 'function') {
      return;
    }

    const subscribe = (eventName, handler) => {
      this.eventBus.on(
        eventName,
        handler
      );
      this.listeners.push({
        eventName,
        handler
      });
    };

    subscribe(
      'timeline:add-file-menu-toggled',
      (payload) => this.handleAddFileMenuToggled(payload)
    );
    subscribe(
      'timeline:audio-picker-opened',
      () => this.handleAudioPickerOpened()
    );
    subscribe(
      'timeline:audio-imported',
      (payload) => this.handleAudioImported(payload)
    );
    subscribe(
      'timeline:selection-changed',
      (payload) => this.handleSelectionChanged(payload)
    );
    subscribe(
      'audio:beats-auto-detected',
      () => this.handleBeatsAutoDetected()
    );
    subscribe(
      'audio:beats-cleared',
      () => this.handleBeatsCleared()
    );
    subscribe(
      'timeline:playback-started',
      () => this.handlePlaybackStarted()
    );
    subscribe(
      'timeline:playback-paused',
      () => this.handlePlaybackPaused()
    );
    subscribe(
      'audio:beat-tapped',
      (payload) => this.handleBeatTapped(payload)
    );
    subscribe(
      'audio:beat-focused',
      () => this.handleBeatFocused()
    );
    subscribe(
      'audio:beat-unfocused',
      () => this.handleBeatUnfocused()
    );
    subscribe(
      'audio:beat-deleted',
      () => this.handleBeatDeleted()
    );
  }

  unbindEvents() {
    if (this.eventBus && typeof this.eventBus.off === 'function') {
      this.listeners.forEach(({ eventName, handler }) => {
        this.eventBus.off(
          eventName,
          handler
        );
      });
    }
    this.listeners = [];
  }

  handleAddFileMenuToggled(payload = {}) {
    if (!this.isActive) {
      return;
    }
    const isOpen = Boolean(payload.isOpen);

    if (
      (
        this.currentStep === AUDIO_BEATS_STEPS.OPEN_ADD_MENU ||
        this.currentStep === AUDIO_BEATS_STEPS.WAIT_AUDIO_IMPORT
      ) &&
      isOpen
    ) {
      this.currentStep = AUDIO_BEATS_STEPS.CLICK_ADD_AUDIO;
      this.notify();
      return;
    }

    if (
      this.currentStep === AUDIO_BEATS_STEPS.CLICK_ADD_AUDIO &&
      !isOpen
    ) {
      this.currentStep = AUDIO_BEATS_STEPS.OPEN_ADD_MENU;
      this.notify();
    }
  }

  handleAudioPickerOpened() {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep === AUDIO_BEATS_STEPS.CLICK_ADD_AUDIO ||
      this.currentStep === AUDIO_BEATS_STEPS.OPEN_ADD_MENU
    ) {
      this.currentStep = AUDIO_BEATS_STEPS.WAIT_AUDIO_IMPORT;
      this.notify();
    }
  }

  handleAudioImported(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep === AUDIO_BEATS_STEPS.WAIT_AUDIO_IMPORT ||
      this.currentStep === AUDIO_BEATS_STEPS.CLICK_ADD_AUDIO ||
      this.currentStep === AUDIO_BEATS_STEPS.OPEN_ADD_MENU
    ) {
      this.activeAudioEvent = payload.event || null;
      this.currentStep = AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK;
      this.notify();
    }
  }

  hasAudioSelected(selectedEvents) {
    if (!Array.isArray(selectedEvents)) {
      return false;
    }
    return selectedEvents.some((ev) => {
      return ev && ev.type === 'audio' && !ev._deleted;
    });
  }

  handleSelectionChanged(payload = {}) {
    if (!this.isActive) {
      return;
    }
    const selectedEvents = payload.selectedEvents || [];
    const selectedAudio = selectedEvents.find((ev) => {
      return ev && ev.type === 'audio' && !ev._deleted;
    });

    if (selectedAudio) {
      this.activeAudioEvent = selectedAudio;
    }

    if (
      this.currentStep === AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK &&
      this.hasAudioSelected(selectedEvents)
    ) {
      this.currentStep = AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS;
      this.notify();
      return;
    }

    if (
      (
        this.currentStep === AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS ||
        this.currentStep === AUDIO_BEATS_STEPS.EXPLAIN_BEATS ||
        this.currentStep === AUDIO_BEATS_STEPS.CLEAR_BEATS
      ) &&
      !this.hasAudioSelected(selectedEvents)
    ) {
      this.currentStep = AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK;
      this.notify();
    }
  }

  handleBeatsAutoDetected() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS) {
      this.currentStep = AUDIO_BEATS_STEPS.EXPLAIN_BEATS;
      this.notify();
    }
  }

  advanceFromExplainBeats() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === AUDIO_BEATS_STEPS.EXPLAIN_BEATS) {
      this.currentStep = AUDIO_BEATS_STEPS.CLEAR_BEATS;
      this.notify();
    }
  }

  handleBeatsCleared() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === AUDIO_BEATS_STEPS.CLEAR_BEATS) {
      this.tappedBeatsCount = 0;
      this.currentStep = this.isPlaying
        ? AUDIO_BEATS_STEPS.TAP_BEATS
        : AUDIO_BEATS_STEPS.PLAY_AUDIO;
      this.notify();
    }
  }

  handlePlaybackStarted() {
    this.isPlaying = true;
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === AUDIO_BEATS_STEPS.PLAY_AUDIO) {
      this.currentStep = AUDIO_BEATS_STEPS.TAP_BEATS;
      this.notify();
    }
  }

  handlePlaybackPaused() {
    this.isPlaying = false;
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === AUDIO_BEATS_STEPS.TAP_BEATS) {
      this.currentStep = AUDIO_BEATS_STEPS.PLAY_AUDIO;
      this.notify();
    }
  }

  handleBeatTapped(payload = {}) {
    if (!this.isActive) {
      return;
    }
    const isCurrentlyPlaying =
      payload.isPlaying !== undefined
        ? Boolean(payload.isPlaying)
        : this.isPlaying;

    if (
      this.currentStep === AUDIO_BEATS_STEPS.TAP_BEATS &&
      isCurrentlyPlaying
    ) {
      this.tappedBeatsCount += 1;
      if (this.tappedBeatsCount >= this.targetBeatCount) {
        this.currentStep = AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE;
      }
      this.notify();
    }
  }

  handleBeatFocused() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE) {
      this.currentStep = AUDIO_BEATS_STEPS.DELETE_ONE_BEAT;
      this.notify();
    }
  }

  handleBeatUnfocused() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === AUDIO_BEATS_STEPS.DELETE_ONE_BEAT) {
      this.currentStep = AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE;
      this.notify();
    }
  }

  handleBeatDeleted() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === AUDIO_BEATS_STEPS.DELETE_ONE_BEAT) {
      this.complete();
    }
  }

  complete() {
    this.currentStep = AUDIO_BEATS_STEPS.COMPLETED;
    this.isActive = false;
    this.unbindEvents();
    this.notify();
  }

  dismiss() {
    this.currentStep = AUDIO_BEATS_STEPS.DISMISSED;
    this.isActive = false;
    this.unbindEvents();
    this.notify();
  }

  notify() {
    if (typeof this.onChange === 'function') {
      this.onChange(this.currentStep);
    }
  }

  destroy() {
    this.unbindEvents();
  }
}

