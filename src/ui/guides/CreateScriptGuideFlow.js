import { t } from '../../config/lang/i18n.js';
import { globalEventBus } from '../../core/EventBus.js';
import { showToast } from '../../utils/Toast.js';
import { InteractiveSpotlight } from './InteractiveSpotlight.js';
import {
  buildStepNavigationActions,
  prepareGuideFlowStart
} from './guideFlowHelpers.js';
import {
  CreateScriptStateMachine,
  CREATE_SCRIPT_STEPS
} from './CreateScriptStateMachine.js';

export class CreateScriptGuideFlow {
  constructor(timelineEditor, eventBus = globalEventBus) {
    this.timelineEditor = timelineEditor;
    this.eventBus = eventBus;
    this.stateMachine = new CreateScriptStateMachine(eventBus);
    this.spotlight = new InteractiveSpotlight();

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  start() {
    if (!prepareGuideFlowStart(this.timelineEditor, this)) {
      return;
    }

    this.spotlight.initDOM();
    this.stateMachine.start();
  }

  handleStepChange(step) {
    if (step === CREATE_SCRIPT_STEPS.COMPLETED) {
      this.finish();
      showToast(
        t('editor.createScriptGuide.completedToast') ||
          'Created, saved, and exported your script successfully.',
        'success',
        3500
      );
      return;
    }

    if (step === CREATE_SCRIPT_STEPS.DISMISSED) {
      this.finish();
      return;
    }

    this.renderCurrentStep();
  }

  getStepConfig(step) {
    const editor = this.timelineEditor;
    const menuType = this.stateMachine.activeContextMenuType;
    const menuEl = this.stateMachine.activeContextMenuElement;

    if (step === CREATE_SCRIPT_STEPS.NEW_SCRIPT) {
      return {
        title:
          t('editor.createScriptGuide.step1Title') ||
          'Create a New Blank Script',
        desc:
          t('editor.createScriptGuide.step1Desc') ||
          'Click the New button to clear the timeline and start a fresh blank script.',
        progressText: '',
        getTarget: () => editor?.newBtn || editor?.toolbar
      };
    }

    if (step === CREATE_SCRIPT_STEPS.CONFIRM_NEW_SCRIPT) {
      return {
        title:
          t('editor.createScriptGuide.confirmTitle') ||
          'Confirm New Script',
        desc:
          t('editor.createScriptGuide.confirmDesc') ||
          'Click OK in the confirmation dialog to reset the timeline and start a fresh blank script.',
        progressText: '',
        getTarget: () => {
          if (
            typeof document !== 'undefined' &&
            typeof document.querySelectorAll === 'function'
          ) {
            const okButtons = document.querySelectorAll(
              '[data-confirm-modal="true"] [data-confirm-action="ok"]'
            );
            if (okButtons.length > 0) {
              return okButtons[okButtons.length - 1];
            }
          }
          if (
            typeof document !== 'undefined' &&
            typeof document.querySelector === 'function'
          ) {
            const okBtn = document.querySelector('[data-confirm-action="ok"]');
            if (okBtn) {
              return okBtn;
            }
          }
          return editor?.newBtn || editor?.toolbar;
        }
      };
    }

    if (step === CREATE_SCRIPT_STEPS.ADD_SEQUENCE_BTN) {
      return {
        title:
          t('editor.createScriptGuide.step2Title') ||
          'Add Sequence from Toolbar',
        desc:
          t('editor.createScriptGuide.step2Desc') ||
          'Click Add Sequence on the toolbar to insert your first firework event at the Anchor Head position.',
        progressText: '',
        getTarget: () => editor?.addBtn || editor?.toolbar
      };
    }

    if (step === CREATE_SCRIPT_STEPS.ADD_SEQUENCE_MENU) {
      if (menuType === 'empty_space' && menuEl) {
        return {
          title:
            t('editor.createScriptGuide.step3MenuTitle') ||
            'Click Add Sequence',
          desc:
            t('editor.createScriptGuide.step3MenuDesc') ||
            'Click Add Sequence in the Empty Space Context Menu to insert a new sequence at this exact spot.',
          progressText: '',
          getTarget: () => {
            if (typeof menuEl.querySelector === 'function') {
              return (
                menuEl.querySelector('[data-action-id="add-sequence"]') ||
                menuEl
              );
            }
            return menuEl;
          }
        };
      }

      return {
        title:
          t('editor.createScriptGuide.step3Title') ||
          'Add Sequence at Empty Spot',
        desc:
          t('editor.createScriptGuide.step3Desc') ||
          'Right-click on another empty spot in the Tracks Area to jump Anchor Head there and open the Empty Space Context Menu.',
        progressText: '',
        getTarget: () => editor?.trackContainer || editor?.tracksArea
      };
    }

    if (step === CREATE_SCRIPT_STEPS.PLAY_PREVIEW) {
      return {
        title:
          t('editor.createScriptGuide.step4Title') ||
          'Preview with Spacebar',
        desc:
          t('editor.createScriptGuide.step4Desc') ||
          'Click on the timeline area or Play button and press Spacebar to preview your sequences in 3D.',
        progressText:
          t('editor.createScriptGuide.step4Hint') ||
          'Shortcut: Press Space or click Play',
        getTarget: () => editor?.playBtn || editor?.toolbar
      };
    }

    if (step === CREATE_SCRIPT_STEPS.SAVE_SCRIPT) {
      return {
        title:
          t('editor.createScriptGuide.step5Title') ||
          'Save Your Script',
        desc:
          t('editor.createScriptGuide.step5Desc') ||
          'Press Ctrl+S to save your working show script to disk.',
        progressText:
          t('editor.createScriptGuide.step5Hint') ||
          'Shortcut: Press Ctrl+S',
        getTarget: () => editor?.saveStatusBadge || editor?.toolbar
      };
    }

    if (step === CREATE_SCRIPT_STEPS.EXPORT_ALL) {
      return {
        title:
          t('editor.createScriptGuide.step6Title') ||
          'Export Full Script',
        desc:
          t('editor.createScriptGuide.step6Desc') ||
          'Click Export As to export your complete show script as a shareable JSON file.',
        progressText: '',
        getTarget: () => editor?.exportBtn || editor?.toolbar
      };
    }

    return null;
  }

  renderCurrentStep() {
    if (!this.stateMachine.isActive) {
      return;
    }
    const config = this.getStepConfig(this.stateMachine.currentStep);
    if (!config) {
      return;
    }

    const stepNum = Math.max(
      1,
      this.stateMachine.getStepIndex() + 1
    );
    const total = this.stateMachine.getTotalSteps();
    const badgeTpl =
      t('editor.createScriptGuide.stepIndicator') ||
      'Practice {current} of {total}';
    const badge = badgeTpl
      .replace('{current}', String(stepNum))
      .replace('{total}', String(total));

    this.spotlight.render({
      badge,
      title: config.title,
      desc: config.desc,
      progressText: config.progressText,
      skipLabel: t('editor.onboarding.skipBtn') || 'Skip',
      actions: buildStepNavigationActions({
        stepIndex: this.stateMachine.getStepIndex(),
        totalSteps: this.stateMachine.getTotalSteps(),
        onPrev: () => {
          this.stateMachine.previousStep();
        },
        onNext: () => {
          this.stateMachine.nextStep();
        }
      }),
      onDismiss: () => {
        this.stateMachine.dismiss();
      },
      getTarget: config.getTarget
    });
  }

  finish() {
    this.spotlight.destroyDOM();
  }

  destroy() {
    this.finish();
    this.stateMachine.destroy();
  }
}

