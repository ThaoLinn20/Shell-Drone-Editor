export const ONBOARDING_STORAGE_KEY = 'fdshow_onboarding_state';

export const ONBOARDING_STEPS = {
  DOWNLOAD_SCRIPTS: 'download_scripts',
  SELECT_FOLDER: 'select_folder',
  IMPORT_SCRIPT: 'import_script',
  PLAY_SHOW: 'play_show',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed'
};

const STEP_ORDER = [
  ONBOARDING_STEPS.DOWNLOAD_SCRIPTS,
  ONBOARDING_STEPS.SELECT_FOLDER,
  ONBOARDING_STEPS.IMPORT_SCRIPT,
  ONBOARDING_STEPS.PLAY_SHOW
];

export class OnboardingStateMachine {
  constructor(eventBus, storage = null) {
    this.eventBus = eventBus;
    this.storage = storage ||
      (typeof localStorage !== 'undefined' ? localStorage : null);
    this.currentStep = null;
    this.waitingForDownload = false;
    this.zipDetected = false;
    this.isActive = false;
    this.listeners = [];
    this.onChange = null;
  }

  getStepIndex() {
    return STEP_ORDER.indexOf(this.currentStep);
  }

  getTotalSteps() {
    return STEP_ORDER.length;
  }

  readPersistedState() {
    if (!this.storage) {
      return null;
    }
    try {
      const raw = this.storage.getItem(ONBOARDING_STORAGE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  persistState() {
    if (!this.storage) {
      return;
    }
    try {
      const payload = {
        step: this.currentStep,
        waitingForDownload: this.waitingForDownload,
        updatedAt: Date.now()
      };
      this.storage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch (err) {
      // Ignore storage quota errors
    }
  }

  shouldAutoStart() {
    const saved = this.readPersistedState();
    if (!saved) {
      return true;
    }
    return (
      saved.step !== ONBOARDING_STEPS.COMPLETED &&
      saved.step !== ONBOARDING_STEPS.DISMISSED
    );
  }

  startIfNeeded() {
    if (!this.shouldAutoStart()) {
      return false;
    }
    const saved = this.readPersistedState();
    const initialStep =
      saved && STEP_ORDER.includes(saved.step)
        ? saved.step
        : ONBOARDING_STEPS.DOWNLOAD_SCRIPTS;
    this.currentStep = initialStep;
    this.waitingForDownload = Boolean(
      saved &&
      saved.waitingForDownload &&
      initialStep === ONBOARDING_STEPS.DOWNLOAD_SCRIPTS
    );
    this.zipDetected = false;
    this.isActive = true;
    this.bindEvents();
    this.persistState();
    this.notify();
    return true;
  }

  restart() {
    this.currentStep = ONBOARDING_STEPS.DOWNLOAD_SCRIPTS;
    this.waitingForDownload = false;
    this.zipDetected = false;
    this.isActive = true;
    this.bindEvents();
    this.persistState();
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
      'onboarding:drive-opened',
      () => this.markDriveOpened()
    );
    subscribe(
      'scripts:folder-scanned',
      (payload) => this.handleFolderScanned(payload)
    );
    subscribe(
      'timeline:show-loaded',
      () => this.handleShowLoaded()
    );
    subscribe(
      'timeline:playback-started',
      () => this.handlePlaybackStarted()
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

  markDriveOpened() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === ONBOARDING_STEPS.DOWNLOAD_SCRIPTS) {
      this.waitingForDownload = true;
      this.persistState();
      this.notify();
    }
  }

  advanceToSelectFolder() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === ONBOARDING_STEPS.DOWNLOAD_SCRIPTS) {
      this.currentStep = ONBOARDING_STEPS.SELECT_FOLDER;
      this.waitingForDownload = false;
      this.zipDetected = false;
      this.persistState();
      this.notify();
    }
  }

  handleFolderScanned(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep !== ONBOARDING_STEPS.SELECT_FOLDER &&
      this.currentStep !== ONBOARDING_STEPS.DOWNLOAD_SCRIPTS
    ) {
      return;
    }
    const count = Number(payload.count) || 0;
    const archiveCount = Number(payload.archiveCount) || 0;
    if (count > 0) {
      this.currentStep = ONBOARDING_STEPS.IMPORT_SCRIPT;
      this.zipDetected = false;
      this.waitingForDownload = false;
      this.persistState();
      this.notify();
    } else {
      this.currentStep = ONBOARDING_STEPS.SELECT_FOLDER;
      this.zipDetected = archiveCount > 0;
      this.persistState();
      this.notify();
    }
  }

  handleShowLoaded() {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep === ONBOARDING_STEPS.IMPORT_SCRIPT ||
      this.currentStep === ONBOARDING_STEPS.SELECT_FOLDER
    ) {
      this.currentStep = ONBOARDING_STEPS.PLAY_SHOW;
      this.zipDetected = false;
      this.persistState();
      this.notify();
    }
  }

  handlePlaybackStarted() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === ONBOARDING_STEPS.PLAY_SHOW) {
      this.complete();
    }
  }

  complete() {
    this.currentStep = ONBOARDING_STEPS.COMPLETED;
    this.isActive = false;
    this.waitingForDownload = false;
    this.zipDetected = false;
    this.unbindEvents();
    this.persistState();
    this.notify();
  }

  dismiss() {
    this.currentStep = ONBOARDING_STEPS.DISMISSED;
    this.isActive = false;
    this.waitingForDownload = false;
    this.zipDetected = false;
    this.unbindEvents();
    this.persistState();
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

