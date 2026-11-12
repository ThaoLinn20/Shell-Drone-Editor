import { t } from '../../config/lang/i18n.js';
import { globalEventBus } from '../../core/EventBus.js';
import { showToast } from '../../utils/Toast.js';
import { InteractiveSpotlight } from './InteractiveSpotlight.js';
import {
  ReuseBlocksStateMachine,
  REUSE_GUIDE_STEPS
} from './ReuseBlocksStateMachine.js';

export class ReuseBlocksGuideFlow {
  constructor(timelineEditor, eventBus = globalEventBus) {
    this.timelineEditor = timelineEditor;
    this.eventBus = eventBus;
    this.stateMachine = new ReuseBlocksStateMachine(eventBus);
    this.spotlight = new InteractiveSpotlight();
    this.clearedSelectionForSelectStep = false;

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  start() {
    if (!this.timelineEditor) {
      return;
    }
    if (!this.timelineEditor.visible) {
      this.timelineEditor.toggle();
    }
    if (
      this.timelineEditor.onboardingFlow &&
      this.timelineEditor.onboardingFlow.stateMachine?.isActive
    ) {
      this.timelineEditor.onboardingFlow.stateMachine.dismiss();
    }
    if (
      this.timelineEditor.welcomeGuide &&
      this.timelineEditor.welcomeGuide.stateMachine?.isActive
    ) {
      this.timelineEditor.welcomeGuide.stateMachine.dismiss();
    }
    if (
      this.timelineEditor.createScriptGuide &&
      this.timelineEditor.createScriptGuide.stateMachine?.isActive
    ) {
      this.timelineEditor.createScriptGuide.stateMachine.dismiss();
    }
    if (
      this.timelineEditor.audioBeatsGuide &&
      this.timelineEditor.audioBeatsGuide.stateMachine?.isActive
    ) {
      this.timelineEditor.audioBeatsGuide.stateMachine.dismiss();
    }

    this.clearedSelectionForSelectStep = false;
    this.timelineEditor.selectedEvents = [];
    if (this.timelineEditor.inspector) {
      this.timelineEditor.inspector.hide();
    }
    if (typeof this.timelineEditor.renderTracks === 'function') {
      this.timelineEditor.renderTracks();
    }

    this.spotlight.initDOM();
    this.stateMachine.start();
  }

  prepareStepSideEffects(step) {
    const editor = this.timelineEditor;
    if (!editor) {
      return;
    }

    if (
      step === REUSE_GUIDE_STEPS.ADD_TWO_BLOCKS &&
      this.stateMachine.addedBlocksCount === 1 &&
      typeof editor.setAnchorTime === 'function'
    ) {
      editor.setAnchorTime(
        (editor.anchorTime || 0) + 2.0,
        false
      );
      return;
    }

    if (
      (
        step === REUSE_GUIDE_STEPS.EXPLAIN_SEQUENCE ||
        step === REUSE_GUIDE_STEPS.SELECT_MULTIPLE
      ) &&
      !this.clearedSelectionForSelectStep
    ) {
      this.clearedSelectionForSelectStep = true;
      editor.selectedEvents = [];
      if (editor.inspector) {
        editor.inspector.hide();
      }
      if (typeof editor.renderTracks === 'function') {
        editor.renderTracks();
      }
    }
  }

  handleStepChange(step) {
    if (step === REUSE_GUIDE_STEPS.COMPLETED) {
      this.finish();
      showToast(
        t('editor.reuseBlocksGuide.completedToast') ||
          'Exported and reused blocks successfully.',
        'success',
        3500
      );
      return;
    }

    if (step === REUSE_GUIDE_STEPS.DISMISSED) {
      this.finish();
      return;
    }

    this.prepareStepSideEffects(step);
    this.renderCurrentStep();
  }

  getStepConfig(step) {
    const editor = this.timelineEditor;
    const menuType = this.stateMachine.activeContextMenuType;
    const menuEl = this.stateMachine.activeContextMenuElement;

    if (step === REUSE_GUIDE_STEPS.ADD_TWO_BLOCKS) {
      const added = this.stateMachine.addedBlocksCount;
      const progressTpl =
        t('editor.reuseBlocksGuide.addBlocksProgress') ||
        'Blocks added: {count} of 2';
      return {
        title:
          t('editor.reuseBlocksGuide.addBlocksTitle') ||
          'Add 2 Sequence Blocks',
        desc:
          t('editor.reuseBlocksGuide.addBlocksDesc') ||
          'Click the Add Sequence button on the toolbar twice to place 2 firework blocks onto the timeline.',
        progressText: progressTpl.replace('{count}', String(added)),
        getTarget: () => editor?.addBtn || editor?.toolbar
      };
    }

    if (step === REUSE_GUIDE_STEPS.EXPLAIN_SEQUENCE) {
      return {
        title:
          t('editor.reuseBlocksGuide.explainSeqTitle') ||
          'What Is a Sequence Block',
        desc:
          t('editor.reuseBlocksGuide.explainSeqDesc') ||
          'Each colored block on the timeline is a Sequence representing a timed series of firework shots with its own start time, launch pattern, effect preset, and duration.',
        progressText:
          t('editor.reuseBlocksGuide.explainSeqHint') ||
          'Review the 2 Sequence blocks on the timeline, then click Next to select them',
        getTarget: () => editor?.tracksArea || editor?.trackContainer
      };
    }

    if (step === REUSE_GUIDE_STEPS.SELECT_MULTIPLE) {
      const count = this.stateMachine.selectedCount;
      const progressTpl =
        t('editor.reuseBlocksGuide.selectionProgress') ||
        'Selected: {count} of 2+ blocks';
      return {
        title:
          t('editor.reuseBlocksGuide.step1Title') ||
          'Select Multiple Blocks',
        desc:
          t('editor.reuseBlocksGuide.step1Desc') ||
          'Hold Ctrl and click at least 2 blocks, or click and drag across empty Tracks Area to select a region.',
        progressText: progressTpl.replace('{count}', String(count)),
        getTarget: () => editor?.trackContainer || editor?.tracksArea
      };
    }

    if (step === REUSE_GUIDE_STEPS.EXPORT_SELECTED) {
      if (menuType === 'block' && menuEl) {
        return {
          title:
            t('editor.reuseBlocksGuide.step2MenuTitle') ||
            'Click Export Selected Blocks',
          desc:
            t('editor.reuseBlocksGuide.step2MenuDesc') ||
            'Click Export selected blocks in the menu and save the JSON file to your computer.',
          progressText: '',
          getTarget: () => {
            if (typeof menuEl.querySelector === 'function') {
              return (
                menuEl.querySelector('[data-action-id="export-selected"]') ||
                menuEl
              );
            }
            return menuEl;
          }
        };
      }

      return {
        title:
          t('editor.reuseBlocksGuide.step2Title') ||
          'Right-Click Selected Block',
        desc:
          t('editor.reuseBlocksGuide.step2Desc') ||
          'Right-click on any selected block to open the Block Context Menu and click Export selected blocks.',
        progressText: '',
        getTarget: () => {
          const firstSelected = editor?.selectedEvents?.[0];
          const blockEl =
            firstSelected && editor?.blockDomMap?.get(firstSelected);
          return blockEl || editor?.trackContainer || editor?.tracksArea;
        }
      };
    }

    if (step === REUSE_GUIDE_STEPS.REIMPORT_EMPTY_SPACE) {
      if (menuType === 'empty_space' && menuEl) {
        return {
          title:
            t('editor.reuseBlocksGuide.step3MenuTitle') ||
            'Click Add Drone/Shell JSON',
          desc:
            t('editor.reuseBlocksGuide.step3MenuDesc') ||
            'Click Add Drone/Shell JSON and choose the JSON file you just exported to add the blocks here.',
          progressText: '',
          getTarget: () => {
            if (typeof menuEl.querySelector === 'function') {
              return (
                menuEl.querySelector('[data-action-id="add-drone-json"]') ||
                menuEl
              );
            }
            return menuEl;
          }
        };
      }

      return {
        title:
          t('editor.reuseBlocksGuide.step3Title') ||
          'Right-Click Empty Space',
        desc:
          t('editor.reuseBlocksGuide.step3Desc') ||
          'Click empty space or right-click directly on an empty area of the Tracks Area where there is no block, then choose Add Drone/Shell JSON.',
        progressText: '',
        getTarget: () => editor?.trackContainer || editor?.tracksArea
      };
    }

    return null;
  }

  getStepActions(step) {
    if (step !== REUSE_GUIDE_STEPS.EXPLAIN_SEQUENCE) {
      return [];
    }
    return [
      {
        label: t('editor.timelineTour.nextBtn') || 'Next',
        primary: true,
        onClick: () => {
          this.stateMachine.advanceFromExplainSequence();
        }
      }
    ];
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
      t('editor.reuseBlocksGuide.stepIndicator') ||
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
      actions: this.getStepActions(this.stateMachine.currentStep),
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

