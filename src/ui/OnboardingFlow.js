import { t } from '../config/lang/i18n.js';
import { globalEventBus } from '../core/EventBus.js';
import { showToast } from '../utils/Toast.js';
import {
  OnboardingStateMachine,
  ONBOARDING_STEPS
} from './OnboardingStateMachine.js';

export class OnboardingFlow {
  constructor(timelineEditor, eventBus = globalEventBus) {
    this.timelineEditor = timelineEditor;
    this.eventBus = eventBus;
    this.stateMachine = new OnboardingStateMachine(eventBus);
    this.highlightBox = null;
    this.tooltipCard = null;
    this.positionRafId = null;

    this.boundUpdatePosition = this.updatePosition.bind(this);
    this.boundWindowFocus = this.onWindowFocus.bind(this);

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  startIfFirstTime() {
    const started = this.stateMachine.startIfNeeded();
    if (!started) {
      return false;
    }
    this.initDOM();
    this.bindWindowListeners();
    this.renderCurrentStep();
    return true;
  }

  restart() {
    this.initDOM();
    this.bindWindowListeners();
    this.stateMachine.restart();
  }

  bindWindowListeners() {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener(
      'resize',
      this.boundUpdatePosition
    );
    window.removeEventListener(
      'focus',
      this.boundWindowFocus
    );
    window.addEventListener(
      'resize',
      this.boundUpdatePosition
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
      'resize',
      this.boundUpdatePosition
    );
    window.removeEventListener(
      'focus',
      this.boundWindowFocus
    );
  }

  onWindowFocus() {
    if (
      this.stateMachine.isActive &&
      this.stateMachine.currentStep === ONBOARDING_STEPS.DOWNLOAD_SCRIPTS &&
      this.stateMachine.waitingForDownload &&
      this.tooltipCard
    ) {
      this.tooltipCard.style.boxShadow =
        '0 0 24px rgba(0, 229, 255, 0.75), 0 10px 30px rgba(0, 0, 0, 0.7)';
    }
  }

  initDOM() {
    this.destroyDOM();

    this.highlightBox = document.createElement('div');
    this.highlightBox.className = 'onboarding-highlight-box';
    this.highlightBox.style.position = 'fixed';
    this.highlightBox.style.boxShadow =
      '0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 16px #00e5ff';
    this.highlightBox.style.border = '2px solid #00e5ff';
    this.highlightBox.style.borderRadius = '6px';
    this.highlightBox.style.pointerEvents = 'none';
    this.highlightBox.style.transition = 'all 0.2s ease-out';
    this.highlightBox.style.zIndex = '100015';

    this.tooltipCard = document.createElement('div');
    this.tooltipCard.className = 'onboarding-tooltip-card';
    this.tooltipCard.style.position = 'fixed';
    this.tooltipCard.style.width = '360px';
    this.tooltipCard.style.maxWidth = '90vw';
    this.tooltipCard.style.background = 'rgba(13, 20, 28, 0.98)';
    this.tooltipCard.style.backdropFilter = 'blur(10px)';
    this.tooltipCard.style.border = '1px solid rgba(0, 229, 255, 0.45)';
    this.tooltipCard.style.borderRadius = '8px';
    this.tooltipCard.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.75)';
    this.tooltipCard.style.padding = '16px';
    this.tooltipCard.style.color = '#f0f4f8';
    this.tooltipCard.style.fontFamily = 'sans-serif';
    this.tooltipCard.style.zIndex = '100020';
    this.tooltipCard.style.boxSizing = 'border-box';
    this.tooltipCard.style.transition = 'top 0.2s ease-out, left 0.2s ease-out';

    document.body.appendChild(this.highlightBox);
    document.body.appendChild(this.tooltipCard);
  }

  destroyDOM() {
    if (this.highlightBox) {
      if (typeof this.highlightBox.remove === 'function') {
        this.highlightBox.remove();
      }
      this.highlightBox = null;
    }
    if (this.tooltipCard) {
      if (typeof this.tooltipCard.remove === 'function') {
        this.tooltipCard.remove();
      }
      this.tooltipCard = null;
    }
  }

  handleStepChange(step) {
    if (step === ONBOARDING_STEPS.COMPLETED) {
      this.finish();
      showToast(
        t('editor.onboarding.completedToast') ||
          'Enjoy the show. You can open Script Library anytime from the toolbar.',
        'success',
        3500
      );
      return;
    }

    if (step === ONBOARDING_STEPS.DISMISSED) {
      this.finish();
      return;
    }

    if (
      step === ONBOARDING_STEPS.SELECT_FOLDER &&
      this.timelineEditor &&
      this.timelineEditor.showLibraryModal &&
      !this.timelineEditor.showLibraryModal.isVisible
    ) {
      this.timelineEditor.showLibraryModal.open();
    }

    if (
      step === ONBOARDING_STEPS.PLAY_SHOW &&
      this.timelineEditor &&
      this.timelineEditor.showLibraryModal &&
      this.timelineEditor.showLibraryModal.isVisible
    ) {
      this.timelineEditor.showLibraryModal.close();
    }

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
            'Click Get Scripts to open Google Drive and download sample show files to your computer.'),
        getTarget: () => this.timelineEditor?.downloadScriptsBtn
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

  renderCurrentStep() {
    if (!this.stateMachine.isActive) {
      return;
    }
    if (!this.tooltipCard || !this.highlightBox) {
      this.initDOM();
    }

    const step = this.stateMachine.currentStep;
    const config = this.getStepConfig(step);
    if (!config) {
      return;
    }

    this.tooltipCard.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '8px';

    const badge = document.createElement('span');
    const stepNum = Math.max(
      1,
      this.stateMachine.getStepIndex() + 1
    );
    const total = this.stateMachine.getTotalSteps();
    const indicatorTpl =
      t('editor.onboarding.stepIndicator') ||
      'Quick Start {current} of {total}';
    badge.textContent = indicatorTpl
      .replace('{current}', String(stepNum))
      .replace('{total}', String(total));
    badge.style.fontSize = '11px';
    badge.style.color = '#00e5ff';
    badge.style.fontWeight = 'bold';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#94a3b8';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.addEventListener('click', () => {
      this.stateMachine.dismiss();
    });

    headerRow.appendChild(badge);
    headerRow.appendChild(closeBtn);
    this.tooltipCard.appendChild(headerRow);

    const titleEl = document.createElement('div');
    titleEl.textContent = config.title;
    titleEl.style.fontSize = '15px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = '#ffffff';
    titleEl.style.marginBottom = '8px';
    this.tooltipCard.appendChild(titleEl);

    const descEl = document.createElement('div');
    descEl.textContent = config.desc;
    descEl.style.fontSize = '13px';
    descEl.style.lineHeight = '1.5';
    descEl.style.color = '#cbd5e1';
    descEl.style.marginBottom = '14px';
    this.tooltipCard.appendChild(descEl);

    const footerRow = document.createElement('div');
    footerRow.style.display = 'flex';
    footerRow.style.justifyContent = 'space-between';
    footerRow.style.alignItems = 'center';
    footerRow.style.flexWrap = 'wrap';
    footerRow.style.gap = '8px';

    const skipBtn = document.createElement('button');
    skipBtn.textContent = t('editor.onboarding.skipBtn') || 'Skip';
    skipBtn.style.background = 'transparent';
    skipBtn.style.border = 'none';
    skipBtn.style.color = '#94a3b8';
    skipBtn.style.fontSize = '12px';
    skipBtn.style.cursor = 'pointer';
    skipBtn.style.padding = '4px 0';
    skipBtn.addEventListener('click', () => {
      this.stateMachine.dismiss();
    });
    footerRow.appendChild(skipBtn);

    if (step === ONBOARDING_STEPS.DOWNLOAD_SCRIPTS) {
      const actionWrap = document.createElement('div');
      actionWrap.style.display = 'flex';
      actionWrap.style.gap = '8px';
      actionWrap.style.flexWrap = 'wrap';

      if (this.stateMachine.waitingForDownload) {
        const reopenBtn = document.createElement('button');
        reopenBtn.textContent =
          t('editor.onboarding.openDriveAgainBtn') || 'Open Drive again';
        reopenBtn.style.background = '#273544';
        reopenBtn.style.border = '1px solid #486581';
        reopenBtn.style.color = '#f0f4f8';
        reopenBtn.style.fontSize = '12px';
        reopenBtn.style.padding = '6px 10px';
        reopenBtn.style.borderRadius = '4px';
        reopenBtn.style.cursor = 'pointer';
        reopenBtn.addEventListener('click', () => {
          this.timelineEditor?.openScriptsDrive();
        });

        const continueBtn = document.createElement('button');
        continueBtn.textContent =
          t('editor.onboarding.downloadedContinueBtn') ||
          'I have downloaded, choose folder';
        continueBtn.style.background = '#00bcd4';
        continueBtn.style.border = 'none';
        continueBtn.style.color = '#000000';
        continueBtn.style.fontWeight = 'bold';
        continueBtn.style.fontSize = '12px';
        continueBtn.style.padding = '6px 12px';
        continueBtn.style.borderRadius = '4px';
        continueBtn.style.cursor = 'pointer';
        continueBtn.addEventListener('click', () => {
          this.stateMachine.advanceToSelectFolder();
        });

        actionWrap.appendChild(reopenBtn);
        actionWrap.appendChild(continueBtn);
      } else {
        const alreadyBtn = document.createElement('button');
        alreadyBtn.textContent =
          t('editor.onboarding.alreadyHaveFolderBtn') ||
          'I already have a scripts folder';
        alreadyBtn.style.background = '#273544';
        alreadyBtn.style.border = '1px solid #486581';
        alreadyBtn.style.color = '#f0f4f8';
        alreadyBtn.style.fontSize = '12px';
        alreadyBtn.style.padding = '6px 10px';
        alreadyBtn.style.borderRadius = '4px';
        alreadyBtn.style.cursor = 'pointer';
        alreadyBtn.addEventListener('click', () => {
          this.stateMachine.advanceToSelectFolder();
        });
        actionWrap.appendChild(alreadyBtn);
      }
      footerRow.appendChild(actionWrap);
    }

    this.tooltipCard.appendChild(footerRow);
    this.schedulePositionUpdate();
  }

  schedulePositionUpdate() {
    this.updatePosition();
    if (typeof requestAnimationFrame === 'function') {
      if (this.positionRafId) {
        cancelAnimationFrame(this.positionRafId);
      }
      this.positionRafId = requestAnimationFrame(() => {
        this.updatePosition();
      });
    }
  }

  updatePosition() {
    if (
      !this.stateMachine.isActive ||
      !this.highlightBox ||
      !this.tooltipCard
    ) {
      return;
    }

    const config = this.getStepConfig(this.stateMachine.currentStep);
    if (!config) {
      return;
    }

    const targetEl = config.getTarget();
    if (!targetEl || typeof targetEl.getBoundingClientRect !== 'function') {
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const margin = 4;

    this.highlightBox.style.top =
      Math.max(0, rect.top - margin) + 'px';
    this.highlightBox.style.left =
      Math.max(0, rect.left - margin) + 'px';
    this.highlightBox.style.width = (rect.width + margin * 2) + 'px';
    this.highlightBox.style.height = (rect.height + margin * 2) + 'px';

    const cardWidth = 360;
    const cardHeight = this.tooltipCard.offsetHeight || 190;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;

    let top = rect.top - cardHeight - 16;
    if (top < 10) {
      top = Math.min(
        viewportH - cardHeight - 10,
        rect.bottom + 16
      );
    }
    let left = rect.left;
    if (left + cardWidth > viewportW - 10) {
      left = Math.max(
        10,
        viewportW - cardWidth - 10
      );
    }
    if (left < 10) {
      left = 10;
    }

    this.tooltipCard.style.top = top + 'px';
    this.tooltipCard.style.left = left + 'px';
  }

  finish() {
    this.unbindWindowListeners();
    if (this.positionRafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.positionRafId);
      this.positionRafId = null;
    }
    this.destroyDOM();
  }

  destroy() {
    this.finish();
    this.stateMachine.destroy();
  }
}
