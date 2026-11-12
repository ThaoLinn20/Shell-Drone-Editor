import { t } from '../config/lang/i18n.js';
import { globalEventBus } from '../core/EventBus.js';
import { showToast } from '../utils/Toast.js';
import { InteractiveSpotlight } from './InteractiveSpotlight.js';
import {
  OnboardingStateMachine,
  ONBOARDING_STEPS
} from './OnboardingStateMachine.js';

export class OnboardingFlow {
  constructor(timelineEditor, eventBus = globalEventBus) {
    this.timelineEditor = timelineEditor;
    this.eventBus = eventBus;
    this.stateMachine = new OnboardingStateMachine(eventBus);
    this.spotlight = new InteractiveSpotlight();

    this.boundWindowFocus = this.onWindowFocus.bind(this);

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  get highlightBox() {
    return this.spotlight.highlightBox;
  }

  get tooltipCard() {
    return this.spotlight.tooltipCard;
  }

  startIfFirstTime() {
    const started = this.stateMachine.startIfNeeded();
    if (!started) {
      return false;
    }
    this.spotlight.initDOM();
    this.bindWindowListeners();
    this.syncModalVisibility(this.stateMachine.currentStep);
    this.renderCurrentStep();
    return true;
  }

  syncModalVisibility(step) {
    const modal = this.timelineEditor?.showLibraryModal;
    if (!modal) {
      return;
    }
    const needsModalOpen =
      step === ONBOARDING_STEPS.DOWNLOAD_SCRIPTS ||
      step === ONBOARDING_STEPS.SELECT_FOLDER ||
      step === ONBOARDING_STEPS.IMPORT_SCRIPT;
    if (needsModalOpen && !modal.isVisible) {
      modal.open();
    } else if (step === ONBOARDING_STEPS.PLAY_SHOW && modal.isVisible) {
      modal.close();
    }
  }

  restart() {
    if (
      this.timelineEditor?.welcomeGuide &&
      this.timelineEditor.welcomeGuide.stateMachine?.isActive
    ) {
      this.timelineEditor.welcomeGuide.stateMachine.dismiss();
    }
    if (
      this.timelineEditor?.audioBeatsGuide &&
      this.timelineEditor.audioBeatsGuide.stateMachine?.isActive
    ) {
      this.timelineEditor.audioBeatsGuide.stateMachine.dismiss();
    }
    this.spotlight.initDOM();
    this.bindWindowListeners();
    this.stateMachine.restart();
  }

  bindWindowListeners() {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener(
      'focus',
      this.boundWindowFocus
    );
    window.addEventListener(
      'focus',
      this.boundWindowFocus
    );
  }

  unbindWindowListeners() {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener(
      'focus',
      this.boundWindowFocus
    );
  }

  onWindowFocus() {
    if (
      this.stateMachine.isActive &&
      this.stateMachine.currentStep === ONBOARDING_STEPS.DOWNLOAD_SCRIPTS &&
      this.stateMachine.waitingForDownload
    ) {
      this.spotlight.pulse();
    }
  }

  handleStepChange(step) {
    if (step === ONBOARDING_STEPS.COMPLETED) {
      this.finish();
      showToast(
        t('editor.onboarding.completedToast') ||
          'Enjoy the show. You can open Import Sequence anytime from the toolbar.',
        'success',
        3500
      );
      return;
    }

    if (step === ONBOARDING_STEPS.DISMISSED) {
      this.finish();
      return;
    }

    this.syncModalVisibility(step);
    this.renderCurrentStep();
  }

  getStepConfig(step) {
    const libraryModal = this.timelineEditor?.showLibraryModal;

    if (step === ONBOARDING_STEPS.DOWNLOAD_SCRIPTS) {
      const waiting = this.stateMachine.waitingForDownload;
      return {
        title: waiting
          ? (t('editor.onboarding.step1WaitingTitle') || 'Waiting for Download')
          : (t('editor.onboarding.step1Title') || 'Download Show Scripts'),
        desc: waiting
          ? (t('editor.onboarding.step1WaitingDesc') ||
            'Download the scripts folder from Google Drive in your browser, extract it if zipped, then click Continue below.')
          : (t('editor.onboarding.step1Desc') ||
            'Click Download Scripts from Drive to open Google Drive and download sample show files to your computer.'),
        getTarget: () => {
          return (
            libraryModal?.driveBtn ||
            this.timelineEditor?.libraryBtn
          );
        }
      };
    }

    if (step === ONBOARDING_STEPS.SELECT_FOLDER) {
      return {
        title: t('editor.onboarding.step2Title') || 'Select Scripts Folder',
        desc: this.stateMachine.zipDetected
          ? (t('editor.onboarding.step2ZipHint') ||
            'Compressed files detected. Please extract the archive in that folder and click Rescan.')
          : (t('editor.onboarding.step2Desc') ||
            'Click Select Folder and choose the folder containing the show scripts you downloaded.'),
        getTarget: () => {
          return (
            libraryModal?.selectFolderBtn ||
            this.timelineEditor?.libraryBtn
          );
        }
      };
    }

    if (step === ONBOARDING_STEPS.IMPORT_SCRIPT) {
      return {
        title: t('editor.onboarding.step3Title') || 'Import a Show Script',
        desc: t('editor.onboarding.step3Desc') ||
          'Click Import on any show in the list to load its fireworks, drones, and music onto the Timeline.',
        getTarget: () => {
          if (libraryModal && libraryModal.listContainer) {
            const firstImport =
              typeof libraryModal.listContainer.querySelector === 'function'
                ? libraryModal.listContainer.querySelector('.show-library-import-btn')
                : null;
            return firstImport || libraryModal.listContainer;
          }
          return this.timelineEditor?.libraryBtn;
        }
      };
    }

    if (step === ONBOARDING_STEPS.PLAY_SHOW) {
      return {
        title: t('editor.onboarding.step4Title') || 'Play Your First Show',
        desc: t('editor.onboarding.step4Desc') ||
          'Everything is loaded. Click the Play button or press Spacebar to start the show.',
        getTarget: () => this.timelineEditor?.playBtn
      };
    }

    return null;
  }

  getStepActions(step) {
    if (step !== ONBOARDING_STEPS.DOWNLOAD_SCRIPTS) {
      return [];
    }

    if (this.stateMachine.waitingForDownload) {
      return [
        {
          label:
            t('editor.onboarding.openDriveAgainBtn') || 'Open Drive again',
          primary: false,
          onClick: () => {
            this.timelineEditor?.openScriptsDrive();
          }
        },
        {
          label:
            t('editor.onboarding.downloadedContinueBtn') ||
            'I have downloaded, choose folder',
          primary: true,
          onClick: () => {
            this.stateMachine.advanceToSelectFolder();
          }
        }
      ];
    }

    return [
      {
        label:
          t('editor.onboarding.alreadyHaveFolderBtn') ||
          'I already have a scripts folder',
        primary: false,
        onClick: () => {
          this.stateMachine.advanceToSelectFolder();
        }
      }
    ];
  }

  renderCurrentStep() {
    if (!this.stateMachine.isActive) {
      return;
    }

    const step = this.stateMachine.currentStep;
    const config = this.getStepConfig(step);
    if (!config) {
      return;
    }

    const stepNum = Math.max(
      1,
      this.stateMachine.getStepIndex() + 1
    );
    const total = this.stateMachine.getTotalSteps();
    const indicatorTpl =
      t('editor.onboarding.stepIndicator') ||
      'Quick Start {current} of {total}';
    const badge = indicatorTpl
      .replace('{current}', String(stepNum))
      .replace('{total}', String(total));

    this.spotlight.render({
      badge,
      title: config.title,
      desc: config.desc,
      skipLabel: t('editor.onboarding.skipBtn') || 'Skip',
      actions: this.getStepActions(step),
      onDismiss: () => {
        this.stateMachine.dismiss();
      },
      getTarget: config.getTarget
    });
  }

  updatePosition() {
    this.spotlight.updatePosition();
  }

  finish() {
    this.unbindWindowListeners();
    this.spotlight.destroyDOM();
  }

  destroy() {
    this.finish();
    this.stateMachine.destroy();
  }
}
