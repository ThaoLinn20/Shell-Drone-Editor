export const REUSE_GUIDE_STEPS = {
  ADD_TWO_BLOCKS: 'add_two_blocks',
  EXPLAIN_SEQUENCE: 'explain_sequence',
  SELECT_MULTIPLE: 'select_multiple',
  EXPORT_SELECTED: 'export_selected',
  REIMPORT_EMPTY_SPACE: 'reimport_empty_space',
  COMPLETED: 'completed',
  DISMISSED: 'dismissed'
};

const STEP_ORDER = [
  REUSE_GUIDE_STEPS.ADD_TWO_BLOCKS,
  REUSE_GUIDE_STEPS.EXPLAIN_SEQUENCE,
  REUSE_GUIDE_STEPS.SELECT_MULTIPLE,
  REUSE_GUIDE_STEPS.EXPORT_SELECTED,
  REUSE_GUIDE_STEPS.REIMPORT_EMPTY_SPACE
];

export class ReuseBlocksStateMachine {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.currentStep = null;
    this.addedBlocksCount = 0;
    this.targetBlocksCount = 2;
    this.selectedCount = 0;
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
    this.addedBlocksCount = 0;
    this.selectedCount = 0;
    this.activeContextMenuType = null;
    this.activeContextMenuElement = null;
    this.currentStep = REUSE_GUIDE_STEPS.ADD_TWO_BLOCKS;
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
      'timeline:sequence-added',
      (payload) => this.handleSequenceAdded(payload)
    );
    subscribe(
      'timeline:selection-changed',
      (payload) => this.handleSelectionChanged(payload)
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
      'timeline:blocks-exported',
      (payload) => this.handleBlocksExported(payload)
    );
    subscribe(
      'timeline:json-imported',
      () => this.handleJsonImported()
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

  handleSequenceAdded(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep === REUSE_GUIDE_STEPS.ADD_TWO_BLOCKS &&
      payload.source !== 'context_menu'
    ) {
      this.addedBlocksCount += 1;
      if (this.addedBlocksCount >= this.targetBlocksCount) {
        this.selectedCount = 0;
        this.currentStep = REUSE_GUIDE_STEPS.EXPLAIN_SEQUENCE;
      }
      this.notify();
    }
  }

  advanceFromExplainSequence() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === REUSE_GUIDE_STEPS.EXPLAIN_SEQUENCE) {
      this.selectedCount = 0;
      this.currentStep = REUSE_GUIDE_STEPS.SELECT_MULTIPLE;
      this.notify();
    }
  }

  handleSelectionChanged(payload = {}) {
    if (!this.isActive) {
      return;
    }
    const count = Number(payload.selectedCount) || 0;
    this.selectedCount = count;

    if (
      this.currentStep === REUSE_GUIDE_STEPS.SELECT_MULTIPLE &&
      count >= 2
    ) {
      this.currentStep = REUSE_GUIDE_STEPS.EXPORT_SELECTED;
      this.notify();
      return;
    }

    if (
      this.currentStep === REUSE_GUIDE_STEPS.EXPORT_SELECTED &&
      count === 0 &&
      !this.activeContextMenuType
    ) {
      this.currentStep = REUSE_GUIDE_STEPS.SELECT_MULTIPLE;
      this.notify();
      return;
    }

    this.notify();
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

  handleBlocksExported(payload = {}) {
    if (!this.isActive) {
      return;
    }
    if (
      this.currentStep === REUSE_GUIDE_STEPS.EXPORT_SELECTED &&
      payload.onlySelected !== false
    ) {
      this.currentStep = REUSE_GUIDE_STEPS.REIMPORT_EMPTY_SPACE;
      this.activeContextMenuType = null;
      this.activeContextMenuElement = null;
      this.notify();
    }
  }

  handleJsonImported() {
    if (!this.isActive) {
      return;
    }
    if (this.currentStep === REUSE_GUIDE_STEPS.REIMPORT_EMPTY_SPACE) {
      this.complete();
    }
  }

  complete() {
    this.currentStep = REUSE_GUIDE_STEPS.COMPLETED;
    this.isActive = false;
    this.activeContextMenuType = null;
    this.activeContextMenuElement = null;
    this.unbindEvents();
    this.notify();
  }

  dismiss() {
    this.currentStep = REUSE_GUIDE_STEPS.DISMISSED;
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

