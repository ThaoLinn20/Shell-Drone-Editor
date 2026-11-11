import { t } from '../config/lang/i18n.js';
import { globalEventBus } from '../core/EventBus.js';
import { showToast } from '../utils/Toast.js';
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

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  ensureSampleBlocks() {
    if (!this.timelineEditor || !Array.isArray(this.timelineEditor.sequences)) {
      return;
    }
    const active = this.timelineEditor.sequences.filter((s) => !s._deleted);
    if (active.length >= 2) {
      return;
    }

    const neededTimes = [1.0, 3.0];
    for (let i = active.length; i < 2; i++) {
      this.timelineEditor.sequences.push({
        time: neededTimes[i] || (i + 1) * 2,
        type: 'sequence',
        pattern: 'sweep-left',
        count: 5,
        duration: 0.1,
        preset: 'crysanthemum'
      });
    }
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

    this.ensureSampleBlocks();
    this.timelineEditor.selectedEvents = [];
    if (this.timelineEditor.inspector) {
      this.timelineEditor.inspector.hide();
    }
    if (typeof this.timelineEditor.renderTracks === 'function') {
      this.timelineEditor.renderTracks();
    }

    this.spotlight.initDOM();
    this.stateMachine.start(0);
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

    this.renderCurrentStep();
  }

  getStepConfig(step) {
    const editor = this.timelineEditor;
    const menuType = this.stateMachine.activeContextMenuType;
    const menuEl = this.stateMachine.activeContextMenuElement;

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
      actions: [],
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

