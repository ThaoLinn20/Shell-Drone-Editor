export const TIMELINE_CONTROLS_STEPS = {
  MOVE_BLOCK: 'move_block',
  RESIZE_BLOCK: 'resize_block',
  SELECT_ANCHOR: 'select_anchor',
  COPY_BLOCK: 'copy_block',
  PASTE_BLOCK: 'paste_block',
  RIGHT_CLICK_BLOCK: 'right_click_block',
  RIGHT_CLICK_EMPTY: 'right_click_empty',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed'
};

const STEP_ORDER = [
  TIMELINE_CONTROLS_STEPS.MOVE_BLOCK,
  TIMELINE_CONTROLS_STEPS.RESIZE_BLOCK,
  TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR,
  TIMELINE_CONTROLS_STEPS.COPY_BLOCK,
  TIMELINE_CONTROLS_STEPS.PASTE_BLOCK,
  TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK,
  TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY
];

export class TimelineControlsStateMachine {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.currentStep = null;
    this.selectedCount = 0;
    this.targetEvent = null;
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

  start(initialState = {}) {
    this.selectedCount = Number(initialState.selectedCount) || 0;
    this.targetEvent = initialState.targetEvent || null;
    this.currentStep = TIMELINE_CONTROLS_STEPS.MOVE_BLOCK;
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
      'timeline:selection-changed',
      (payload) => this.handleSelectionChanged(payload)
    );
    subscribe(
      'timeline:block-moved',
      (payload) => this.handleBlockMoved(payload)
    );
    subscribe(
      'timeline:block-resized',
      (payload) => this.handleBlockResized(payload)
    );
    subscribe(
      'timeline:anchor-changed',
      (payload) => this.handleAnchorChanged(payload)
    );
    subscribe(
      'timeline:copied',
      (payload) => this.handleCopied(payload)
    );
    subscribe(
      'timeline:pasted',
      (payload) => this.handlePasted(payload)
    );
    subscribe(
      'timeline:context-menu-shown',
      (payload) => this.handleContextMenuShown(payload)
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
      this.notify();
      return;
    }
    this.complete();
  }

  handleSelectionChanged(payload = {}) {
    if (!this.isActive) {
      return;
    }

    const nextCount = Number(payload.selectedCount) || 0;
    if (nextCount === this.selectedCount) {
      return;
    }

    this.selectedCount = nextCount;
    if (
      this.currentStep === TIMELINE_CONTROLS_STEPS.COPY_BLOCK ||
      this.currentStep === TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK
    ) {
      this.notify();
    }
  }

  handleBlockMoved(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === TIMELINE_CONTROLS_STEPS.MOVE_BLOCK) {
      if (payload.event) {
        this.targetEvent = payload.event;
      }
      this.currentStep = TIMELINE_CONTROLS_STEPS.RESIZE_BLOCK;
      this.notify();
    }
  }

  handleBlockResized(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === TIMELINE_CONTROLS_STEPS.RESIZE_BLOCK) {
      if (payload.event) {
        this.targetEvent = payload.event;
      }
      this.currentStep = TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR;
      this.notify();
    }
  }

  handleAnchorChanged(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep === TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR &&
      payload.source === 'ruler'
    ) {
      this.currentStep = TIMELINE_CONTROLS_STEPS.COPY_BLOCK;
      this.notify();
    }
  }

  handleCopied(payload = {}) {
    if (!this.isActive) {
      return;
    }
    const count = Number(payload.count) || 0;
    if (
      this.currentStep === TIMELINE_CONTROLS_STEPS.COPY_BLOCK &&
      count > 0
    ) {
      this.currentStep = TIMELINE_CONTROLS_STEPS.PASTE_BLOCK;
      this.notify();
    }
  }

  handlePasted(payload = {}) {
    if (!this.isActive) {
      return;
    }
    const count = Number(payload.count) || 0;
    if (
      this.currentStep === TIMELINE_CONTROLS_STEPS.PASTE_BLOCK &&
      count > 0
    ) {
      if (Array.isArray(payload.events) && payload.events.length > 0) {
        this.targetEvent = payload.events[0];
        this.selectedCount = payload.events.length;
      }
      this.currentStep = TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK;
      this.notify();
    }
  }

  handleContextMenuShown(payload = {}) {
    if (!this.isActive) {
      return;
    }
    const targetType = payload.targetType;
    if (
      this.currentStep === TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK &&
      targetType === 'block'
    ) {
      this.currentStep = TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY;
      this.notify();
      return;
    }

    if (
      this.currentStep === TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY &&
      targetType === 'empty_space'
    ) {
      this.complete();
    }
  }

  complete() {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.currentStep = TIMELINE_CONTROLS_STEPS.COMPLETED;
    this.unbindEvents();
    this.notify();
  }

  dismiss() {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;
    this.currentStep = TIMELINE_CONTROLS_STEPS.DISMISSED;
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

