export const INSPECTOR_GUIDE_STATUS = {
  COMPLETED: 'completed',
  DISMISSED: 'dismissed'
};

export class InspectorSectionStateMachine {
  constructor(eventBus, config) {
    this.eventBus = eventBus;
    this.config = config;
    this.steps = Array.isArray(config?.steps) ? config.steps : [];
    this.currentStepIndex = -1;
    this.currentStep = null;
    this.hasTriggeredPreview = false;
    this.isActive = false;
    this.listeners = [];
    this.onChange = null;
  }

  getStepIndex() {
    return this.currentStepIndex;
  }

  getTotalSteps() {
    return this.steps.length;
  }

  getActiveStepConfig() {
    if (
      this.currentStepIndex < 0 ||
      this.currentStepIndex >= this.steps.length
    ) {
      return null;
    }
    return this.steps[this.currentStepIndex];
  }

  start() {
    if (this.steps.length === 0) {
      return;
    }
    this.currentStepIndex = 0;
    this.currentStep = this.steps[0].id;
    this.hasTriggeredPreview = false;
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
      'inspector:field-changed',
      (payload) => this.handleFieldChanged(payload)
    );
    subscribe(
      'inspector:preview-triggered',
      () => this.handlePreviewTriggered()
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

  advanceToNextStep() {
    if (!this.isActive) {
      return;
    }
    const nextIndex = this.currentStepIndex + 1;
    if (nextIndex >= this.steps.length) {
      this.complete();
      return;
    }
    this.currentStepIndex = nextIndex;
    this.currentStep = this.steps[nextIndex].id;
    this.hasTriggeredPreview = false;
    this.notify();
  }

  previousStep() {
    if (!this.isActive || this.currentStepIndex <= 0) {
      return;
    }
    const prevIndex = this.currentStepIndex - 1;
    this.currentStepIndex = prevIndex;
    this.currentStep = this.steps[prevIndex].id;
    this.hasTriggeredPreview = false;
    this.notify();
  }

  nextStep() {
    this.advanceToNextStep();
  }

  advanceOverview() {
    const active = this.getActiveStepConfig();
    if (!this.isActive || !active || active.kind !== 'overview') {
      return;
    }
    this.advanceToNextStep();
  }

  handleFieldChanged() {
    // Property Inspector guides never auto-advance; users explore freely and click Next / Previous
  }

  handlePreviewTriggered() {
    const active = this.getActiveStepConfig();
    if (!this.isActive || !active || active.kind !== 'preview') {
      return;
    }
    if (!this.hasTriggeredPreview) {
      this.hasTriggeredPreview = true;
      this.notify();
    }
  }

  complete() {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.currentStep = INSPECTOR_GUIDE_STATUS.COMPLETED;
    this.unbindEvents();
    this.notify();
  }

  dismiss() {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.currentStep = INSPECTOR_GUIDE_STATUS.DISMISSED;
    this.unbindEvents();
    this.notify();
  }

  destroy() {
    this.isActive = false;
    this.unbindEvents();
  }

  notify() {
    if (typeof this.onChange === 'function') {
      this.onChange(this.currentStep);
    }
  }
}

