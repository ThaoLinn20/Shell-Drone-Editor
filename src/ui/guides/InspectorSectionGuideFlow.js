import { t } from '../../config/lang/i18n.js';
import { globalEventBus } from '../../core/EventBus.js';
import { showToast } from '../../utils/Toast.js';
import { InteractiveSpotlight } from './InteractiveSpotlight.js';
import { INSPECTOR_GUIDE_CONFIGS } from './inspectorGuideConfigs.js';
import {
  buildStepNavigationActions,
  prepareGuideFlowStart
} from './guideFlowHelpers.js';
import {
  InspectorSectionStateMachine,
  INSPECTOR_GUIDE_STATUS
} from './InspectorSectionStateMachine.js';

export class InspectorSectionGuideFlow {
  constructor(
    timelineEditor,
    config,
    eventBus = globalEventBus
  ) {
    this.timelineEditor = timelineEditor;
    this.config = config;
    this.eventBus = eventBus;
    this.stateMachine = new InspectorSectionStateMachine(
      eventBus,
      config
    );
    this.spotlight = new InteractiveSpotlight();
    this.boundOnInspectorScroll = () => {
      if (this.spotlight && this.spotlight.isVisible) {
        this.spotlight.updatePosition();
      }
    };

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  ensureSequenceAndInspector() {
    const editor = this.timelineEditor;
    if (!editor || !Array.isArray(editor.sequences)) {
      return null;
    }

    let targetSeq = editor.selectedEvents?.find((seq) => {
      return (
        seq &&
        !seq._deleted &&
        seq.type !== 'audio' &&
        seq.type !== 'droneshow' &&
        seq.type !== 'group'
      );
    });

    if (!targetSeq) {
      targetSeq = editor.sequences.find((seq) => {
        return (
          seq &&
          !seq._deleted &&
          seq.type !== 'audio' &&
          seq.type !== 'droneshow' &&
          seq.type !== 'group'
        );
      });
    }

    if (!targetSeq) {
      targetSeq = {
        time: 1.0,
        type: 'sequence',
        pattern: 'sweep-left',
        count: 5,
        duration: 1.0,
        preset: 'crysanthemum',
        sectorId: 'center'
      };
      editor.sequences.push(targetSeq);
    }

    editor.selectedEvents = [targetSeq];
    if (editor.inspector) {
      if (editor.inspector.collapsedGroups) {
        editor.inspector.collapsedGroups[this.config.groupKey] = false;
      }
      if (typeof editor.inspector.show === 'function') {
        editor.inspector.show(
          targetSeq,
          editor.selectedEvents
        );
      }
    }
    if (typeof editor.renderTracks === 'function') {
      editor.renderTracks();
    }
    return targetSeq;
  }

  ensureGroupExpanded() {
    const inspector = this.timelineEditor?.inspector;
    if (!inspector) {
      return;
    }
    if (
      inspector.collapsedGroups &&
      inspector.collapsedGroups[this.config.groupKey] === true
    ) {
      inspector.collapsedGroups[this.config.groupKey] = false;
      if (typeof inspector.render === 'function') {
        inspector.render();
      }
    }
  }

  resolveStepTarget(stepConfig) {
    const container = this.timelineEditor?.inspector?.container;
    if (!container || typeof container.querySelector !== 'function') {
      return container || null;
    }

    if (stepConfig.kind === 'preview') {
      return container.querySelector('.inspector-preview-btn') || container;
    }

    if (stepConfig.kind === 'field' && stepConfig.fieldName) {
      return (
        container.querySelector(
          `[data-group-key="${this.config.groupKey}"] [data-field-name="${stepConfig.fieldName}"]`
        ) ||
        container.querySelector(`[data-field-name="${stepConfig.fieldName}"]`) ||
        container.querySelector(`[data-group-key="${this.config.groupKey}"]`) ||
        container
      );
    }

    return (
      container.querySelector(`[data-group-key="${this.config.groupKey}"]`) ||
      container
    );
  }

  start() {
    if (!prepareGuideFlowStart(this.timelineEditor, this)) {
      return;
    }

    this.ensureSequenceAndInspector();
    this.bindInspectorScroll();
    this.spotlight.initDOM();
    this.stateMachine.start();
  }

  bindInspectorScroll() {
    const container = this.timelineEditor?.inspector?.container;
    if (
      container &&
      typeof container.addEventListener === 'function' &&
      typeof container.removeEventListener === 'function'
    ) {
      container.removeEventListener(
        'scroll',
        this.boundOnInspectorScroll
      );
      container.addEventListener(
        'scroll',
        this.boundOnInspectorScroll
      );
    }
  }

  unbindInspectorScroll() {
    const container = this.timelineEditor?.inspector?.container;
    if (container && typeof container.removeEventListener === 'function') {
      container.removeEventListener(
        'scroll',
        this.boundOnInspectorScroll
      );
    }
  }

  handleStepChange(step) {
    if (step === INSPECTOR_GUIDE_STATUS.COMPLETED) {
      this.finish();
      const baseKey = `editor.inspectorGuides.${this.config.i18nKey}`;
      showToast(
        t(`${baseKey}.completedToast`) ||
          'Inspector section guide completed.',
        'success',
        3500
      );
      return;
    }

    if (step === INSPECTOR_GUIDE_STATUS.DISMISSED) {
      this.finish();
      return;
    }

    this.ensureGroupExpanded();
    this.renderCurrentStep();
  }

  getNextGuideConfig() {
    if (!this.config || !this.config.id) {
      return null;
    }
    const idx = INSPECTOR_GUIDE_CONFIGS.findIndex(
      (cfg) => cfg.id === this.config.id
    );
    if (idx >= 0 && idx + 1 < INSPECTOR_GUIDE_CONFIGS.length) {
      return INSPECTOR_GUIDE_CONFIGS[idx + 1];
    }
    return null;
  }

  getStepActions() {
    const stepIndex = this.stateMachine.getStepIndex();
    const totalSteps = this.stateMachine.getTotalSteps();
    const isLastStep = stepIndex >= totalSteps - 1;
    const nextGuideCfg = isLastStep ? this.getNextGuideConfig() : null;

    const extraActions = nextGuideCfg
      ? [
        {
          label:
            t('editor.inspectorGuides.nextGuideBtn') ||
            'Next Guide',
          primary: false,
          variant: 'accent',
          onClick: () => {
            this.stateMachine.complete();
            if (
              this.timelineEditor &&
              typeof this.timelineEditor.startInspectorGuide === 'function'
            ) {
              this.timelineEditor.startInspectorGuide(nextGuideCfg.id);
            }
          }
        }
      ]
      : [];

    return buildStepNavigationActions({
      stepIndex,
      totalSteps,
      onPrev: () => {
        this.stateMachine.previousStep();
      },
      onNext: () => {
        this.stateMachine.nextStep();
      },
      extraActions
    });
  }

  renderCurrentStep() {
    if (!this.stateMachine.isActive) {
      return;
    }

    const stepConfig = this.stateMachine.getActiveStepConfig();
    if (!stepConfig) {
      return;
    }

    const baseKey = `editor.inspectorGuides.${this.config.i18nKey}.${stepConfig.i18nKey}`;
    const stepNum = Math.max(
      1,
      this.stateMachine.getStepIndex() + 1
    );
    const total = this.stateMachine.getTotalSteps();
    const badgeTpl =
      t('editor.inspectorGuides.stepIndicator') ||
      'Practice {current} of {total}';
    const badge = badgeTpl
      .replace('{current}', String(stepNum))
      .replace('{total}', String(total));

    const targetEl = this.resolveStepTarget(stepConfig);
    if (targetEl && typeof targetEl.scrollIntoView === 'function') {
      targetEl.scrollIntoView({
        behavior: 'auto',
        block: 'center'
      });
    }

    const actions = this.getStepActions();

    this.spotlight.render({
      badge,
      title: t(`${baseKey}Title`) || stepConfig.id,
      desc: t(`${baseKey}Desc`) || '',
      progressText: t(`${baseKey}Hint`) || '',
      skipLabel: t('editor.onboarding.skipBtn') || 'Skip',
      actions,
      onDismiss: () => {
        this.stateMachine.dismiss();
      },
      getTarget: () => this.resolveStepTarget(stepConfig),
      getTooltipAnchor: () => this.timelineEditor?.inspector?.container,
      placement: 'left',
      dimBackdrop: false
    });
  }

  finish() {
    this.unbindInspectorScroll();
    this.spotlight.destroyDOM();
  }

  destroy() {
    this.finish();
    this.stateMachine.destroy();
  }
}

