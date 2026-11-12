export const CREATE_SCRIPT_STEPS = {
  NEW_SCRIPT: 'new_script',
  CONFIRM_NEW_SCRIPT: 'confirm_new_script',
  ADD_SEQUENCE_BTN: 'add_sequence_btn',
  ADD_SEQUENCE_MENU: 'add_sequence_menu',
  PLAY_PREVIEW: 'play_preview',
  SAVE_SCRIPT: 'save_script',
  EXPORT_ALL: 'export_all',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed'
};

const STEP_ORDER = [
  CREATE_SCRIPT_STEPS.NEW_SCRIPT,
  CREATE_SCRIPT_STEPS.CONFIRM_NEW_SCRIPT,
  CREATE_SCRIPT_STEPS.ADD_SEQUENCE_BTN,
  CREATE_SCRIPT_STEPS.ADD_SEQUENCE_MENU,
  CREATE_SCRIPT_STEPS.PLAY_PREVIEW,
  CREATE_SCRIPT_STEPS.SAVE_SCRIPT,
  CREATE_SCRIPT_STEPS.EXPORT_ALL
];

export class CreateScriptStateMachine {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.currentStep = null;
    this.activeContextMenuType = null;
    this.activeContextMenuElement = null;
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

  start() {
    this.currentStep = CREATE_SCRIPT_STEPS.NEW_SCRIPT;
    this.activeContextMenuType = null;
    this.activeContextMenuElement = null;
    this.isActive = true;
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
      'timeline:new-script-confirm-opened',
      () => this.handleNewScriptConfirmOpened()
    );
    subscribe(
      'timeline:new-script-confirm-cancelled',
      () => this.handleNewScriptConfirmCancelled()
    );
    subscribe(
      'timeline:new-script-created',
      () => this.handleNewScriptCreated()
    );
    subscribe(
      'timeline:sequence-added',
      (payload) => this.handleSequenceAdded(payload)
    );
    subscribe(
      'timeline:context-menu-shown',
      (payload) => this.handleContextMenuShown(payload)
    );
    subscribe(
      'timeline:context-menu-hidden',
      () => this.handleContextMenuHidden()
    );
    subscribe(
      'timeline:playback-started',
      () => this.handlePlaybackStarted()
    );
    subscribe(
      'timeline:script-saved',
      () => this.handleScriptSaved()
    );
    subscribe(
      'timeline:blocks-exported',
      (payload) => this.handleBlocksExported(payload)
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

  previousStep() {
    if (!this.isActive) {
      return;
    }
    const idx = this.getStepIndex();
    if (idx > 0) {
      this.currentStep = STEP_ORDER[idx - 1];
      this.activeContextMenuType = null;
      this.activeContextMenuElement = null;
      this.notify();
    }
  }

  nextStep() {
    if (!this.isActive) {
      return;
    }
    const idx = this.getStepIndex();
    if (idx >= 0 && idx + 1 < STEP_ORDER.length) {
      this.currentStep = STEP_ORDER[idx + 1];
      this.activeContextMenuType = null;
      this.activeContextMenuElement = null;
      this.notify();
      return;
    }
    this.complete();
  }

  handleNewScriptConfirmOpened() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === CREATE_SCRIPT_STEPS.NEW_SCRIPT) {
      this.currentStep = CREATE_SCRIPT_STEPS.CONFIRM_NEW_SCRIPT;
      this.notify();
    }
  }

  handleNewScriptConfirmCancelled() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === CREATE_SCRIPT_STEPS.CONFIRM_NEW_SCRIPT) {
      this.currentStep = CREATE_SCRIPT_STEPS.NEW_SCRIPT;
      this.notify();
    }
  }

  handleNewScriptCreated() {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep === CREATE_SCRIPT_STEPS.NEW_SCRIPT ||
      this.currentStep === CREATE_SCRIPT_STEPS.CONFIRM_NEW_SCRIPT
    ) {
      this.currentStep = CREATE_SCRIPT_STEPS.ADD_SEQUENCE_BTN;
      this.notify();
    }
  }

  handleSequenceAdded(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === CREATE_SCRIPT_STEPS.ADD_SEQUENCE_BTN) {
      this.currentStep = CREATE_SCRIPT_STEPS.ADD_SEQUENCE_MENU;
      this.notify();
      return;
    }
    if (
      this.currentStep === CREATE_SCRIPT_STEPS.ADD_SEQUENCE_MENU &&
      payload.source === 'context_menu'
    ) {
      this.currentStep = CREATE_SCRIPT_STEPS.PLAY_PREVIEW;
      this.activeContextMenuType = null;
      this.activeContextMenuElement = null;
      this.notify();
    }
  }

  handleContextMenuShown(payload = {}) {
    if (!this.isActive) {
      return;
    }
    this.activeContextMenuType = payload.targetType || 'block';
    this.activeContextMenuElement = payload.menuElement || null;
    this.notify();
  }

  handleContextMenuHidden() {
    if (!this.isActive) {
      return;
    }
    this.activeContextMenuType = null;
    this.activeContextMenuElement = null;
    this.notify();
  }

  handlePlaybackStarted() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === CREATE_SCRIPT_STEPS.PLAY_PREVIEW) {
      this.currentStep = CREATE_SCRIPT_STEPS.SAVE_SCRIPT;
      this.notify();
    }
  }

  handleScriptSaved() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === CREATE_SCRIPT_STEPS.SAVE_SCRIPT) {
      this.currentStep = CREATE_SCRIPT_STEPS.EXPORT_ALL;
      this.notify();
    }
  }

  handleBlocksExported(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep === CREATE_SCRIPT_STEPS.EXPORT_ALL &&
      payload.onlySelected === false
    ) {
      this.complete();
    }
  }

  complete() {
    this.currentStep = CREATE_SCRIPT_STEPS.COMPLETED;
    this.isActive = false;
    this.activeContextMenuType = null;
    this.activeContextMenuElement = null;
    this.unbindEvents();
    this.notify();
  }

  dismiss() {
    this.currentStep = CREATE_SCRIPT_STEPS.DISMISSED;
    this.isActive = false;
    this.activeContextMenuType = null;
    this.activeContextMenuElement = null;
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

