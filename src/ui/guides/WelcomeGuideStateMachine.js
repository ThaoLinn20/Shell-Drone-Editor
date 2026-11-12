export const WELCOME_GUIDE_STORAGE_KEY = 'fdshow_welcome_guide_state';

export const WELCOME_GUIDE_STEPS = {
  OPEN_GUIDE_HUB: 'open_guide_hub',
  PICK_GUIDE: 'pick_guide',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed'
};

const STEP_ORDER = [
  WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB,
  WELCOME_GUIDE_STEPS.PICK_GUIDE
];

export class WelcomeGuideStateMachine {
  constructor(
    eventBus,
    storage = null
  ) {
    this.eventBus = eventBus;
    this.storage = storage ||
      (typeof localStorage !== 'undefined' ? localStorage : null);
    this.currentStep = null;
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
      const raw = this.storage.getItem(WELCOME_GUIDE_STORAGE_KEY);
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
        updatedAt: Date.now()
      };
      this.storage.setItem(
        WELCOME_GUIDE_STORAGE_KEY,
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
      saved.step !== WELCOME_GUIDE_STEPS.COMPLETED &&
      saved.step !== WELCOME_GUIDE_STEPS.DISMISSED
    );
  }

  startIfNeeded() {
    if (!this.shouldAutoStart()) {
      return false;
    }
    this.currentStep = WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB;
    this.isActive = true;
    this.bindEvents();
    this.persistState();
    return true;
  }

  start() {
    this.currentStep = WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB;
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
      'guidehub:opened',
      () => this.handleGuideHubOpened()
    );
    subscribe(
      'guidehub:closed',
      () => this.handleGuideHubClosed()
    );
    subscribe(
      'guidehub:guide-executed',
      (payload) => this.handleGuideExecuted(payload)
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

  handleGuideHubOpened() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB) {
      this.currentStep = WELCOME_GUIDE_STEPS.PICK_GUIDE;
      this.persistState();
      this.notify();
    }
  }

  handleGuideHubClosed() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === WELCOME_GUIDE_STEPS.PICK_GUIDE) {
      this.currentStep = WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB;
      this.persistState();
      this.notify();
    }
  }

  handleGuideExecuted(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (payload.guideId === 'welcome_guide') {
      return;
    }
    if (
      this.currentStep === WELCOME_GUIDE_STEPS.PICK_GUIDE ||
      this.currentStep === WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB
    ) {
      this.complete();
    }
  }

  complete() {
    this.currentStep = WELCOME_GUIDE_STEPS.COMPLETED;
    this.isActive = false;
    this.unbindEvents();
    this.persistState();
    this.notify();
  }

  dismiss() {
    this.currentStep = WELCOME_GUIDE_STEPS.DISMISSED;
    this.isActive = false;
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

