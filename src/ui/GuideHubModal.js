import { t } from '../config/lang/i18n.js';
import {
  createModalButton,
  createModalShell
} from './ModalShell.js';

export class GuideHubModal {
  constructor(timelineEditor) {
    this.timelineEditor = timelineEditor;
    this.isVisible = false;
    this.overlay = null;
    this.dialog = null;
    this.listContainer = null;
    this.customGuides = [];

    this.onKeyDown = this.onKeyDown.bind(this);
  }

  getDefaultGuides() {
    return [
      {
        id: 'quick_start',
        title: () =>
          t('editor.guideHub.quickStartTitle') ||
          'Quick Start Onboarding',
        desc: () =>
          t('editor.guideHub.quickStartDesc') ||
          'Download sample shows from Google Drive, select your folder, import a script, and start playback.',
        badge: () =>
          t('editor.guideHub.quickStartBadge') || '4 steps',
        actionLabel: () =>
          t('editor.guideHub.startBtn') || 'Start Guide',
        variant: 'primary',
        execute: () => {
          if (this.timelineEditor && this.timelineEditor.onboardingFlow) {
            this.timelineEditor.onboardingFlow.restart();
          }
        }
      },
      {
        id: 'timeline_tour',
        title: () =>
          t('editor.guideHub.timelineTourTitle') ||
          'Timeline Editor Tour',
        desc: () =>
          t('editor.guideHub.timelineTourDesc') ||
          'Learn how to use the Toolbar, Tracks Area, Ruler, Anchor Head, Tap Beat, and Event Blocks.',
        badge: () =>
          t('editor.guideHub.timelineTourBadge') || '6 steps',
        actionLabel: () =>
          t('editor.guideHub.startBtn') || 'Start Guide',
        variant: 'primary',
        execute: () => {
          if (this.timelineEditor && this.timelineEditor.tourGuide) {
            this.timelineEditor.tourGuide.startTour('timeline');
          }
        }
      },
      {
        id: 'inspector_tour',
        title: () =>
          t('editor.guideHub.inspectorTourTitle') ||
          'Property Inspector Guide',
        desc: () =>
          t('editor.guideHub.inspectorTourDesc') ||
          'Explore event parameters, firework Shapes, Dynamics, Active Effects, and Pattern Offsets.',
        badge: () =>
          t('editor.guideHub.inspectorTourBadge') || '4 steps',
        actionLabel: () =>
          t('editor.guideHub.startBtn') || 'Start Guide',
        variant: 'primary',
        execute: () => {
          if (this.timelineEditor && this.timelineEditor.tourGuide) {
            this.timelineEditor.tourGuide.startInspectorTour();
          }
        }
      }
    ];
  }

  registerGuide(guideConfig) {
    if (guideConfig && guideConfig.id) {
      this.customGuides.push(guideConfig);
    }
  }

  getGuides() {
    return [
      ...this.getDefaultGuides(),
      ...this.customGuides
    ];
  }

  initDOM() {
    if (this.overlay) {
      return;
    }

    const shell = createModalShell({
      overlayClass: 'guide-hub-modal-overlay',
      dialogClass: 'guide-hub-modal-dialog',
      width: '620px',
      title: t('editor.guideHub.title') || 'Guides and Tutorials',
      subtitle: t('editor.guideHub.subtitle') ||
        'Choose an interactive walkthrough or reference guide.',
      closeTitle: t('editor.guideHub.closeBtn') || 'Close',
      onClose: () => this.close()
    });

    this.overlay = shell.overlay;
    this.dialog = shell.dialog;

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'guide-hub-list';
    this.listContainer.style.flex = '1 1 auto';
    this.listContainer.style.overflowY = 'auto';
    this.listContainer.style.padding = '16px 20px';
    this.listContainer.style.display = 'flex';
    this.listContainer.style.flexDirection = 'column';
    this.listContainer.style.gap = '12px';

    this.dialog.appendChild(this.listContainer);
  }

  renderGuides() {
    if (!this.listContainer) {
      return;
    }
    this.listContainer.innerHTML = '';

    const guides = this.getGuides();
    guides.forEach((guide) => {
      const card = this.createGuideCard(guide);
      this.listContainer.appendChild(card);
    });
  }

  createGuideCard(guide) {
    const card = document.createElement('div');
    card.className = 'guide-hub-card';
    card.dataset.guideId = guide.id;
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    card.style.gap = '16px';
    card.style.padding = '14px 16px';
    card.style.background = 'rgba(255, 255, 255, 0.04)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    card.style.borderRadius = '6px';
    card.style.transition = 'border-color 0.15s ease, background 0.15s ease';

    card.addEventListener('mouseenter', () => {
      card.style.borderColor = 'rgba(0, 229, 255, 0.45)';
      card.style.background = 'rgba(0, 229, 255, 0.05)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      card.style.background = 'rgba(255, 255, 255, 0.04)';
    });

    const infoCol = document.createElement('div');
    infoCol.style.flex = '1 1 auto';
    infoCol.style.minWidth = '0';

    const topRow = document.createElement('div');
    topRow.style.display = 'flex';
    topRow.style.alignItems = 'center';
    topRow.style.gap = '8px';
    topRow.style.flexWrap = 'wrap';
    topRow.style.marginBottom = '4px';

    const titleEl = document.createElement('span');
    titleEl.textContent = typeof guide.title === 'function'
      ? guide.title()
      : guide.title;
    titleEl.style.fontSize = '14px';
    titleEl.style.fontWeight = '600';
    titleEl.style.color = '#ffffff';
    topRow.appendChild(titleEl);

    const badgeText = typeof guide.badge === 'function'
      ? guide.badge()
      : guide.badge;
    if (badgeText) {
      const badgeEl = document.createElement('span');
      badgeEl.textContent = badgeText;
      badgeEl.style.fontSize = '10px';
      badgeEl.style.fontWeight = '600';
      badgeEl.style.padding = '2px 7px';
      badgeEl.style.borderRadius = '10px';
      badgeEl.style.background = 'rgba(0, 229, 255, 0.14)';
      badgeEl.style.color = '#00e5ff';
      badgeEl.style.border = '1px solid rgba(0, 229, 255, 0.3)';
      topRow.appendChild(badgeEl);
    }

    const descEl = document.createElement('div');
    descEl.textContent = typeof guide.desc === 'function'
      ? guide.desc()
      : guide.desc;
    descEl.style.fontSize = '12px';
    descEl.style.color = '#94a3b8';
    descEl.style.lineHeight = '1.45';

    infoCol.appendChild(topRow);
    infoCol.appendChild(descEl);

    const actionLabel = typeof guide.actionLabel === 'function'
      ? guide.actionLabel()
      : guide.actionLabel;
    const actionBtn = createModalButton(
      actionLabel || 'Start Guide',
      guide.variant || 'primary'
    );
    actionBtn.className = 'guide-hub-action-btn';
    actionBtn.style.flexShrink = '0';
    actionBtn.addEventListener('click', () => {
      this.close();
      if (typeof guide.execute === 'function') {
        guide.execute();
      }
    });

    card.appendChild(infoCol);
    card.appendChild(actionBtn);
    return card;
  }

  open() {
    this.initDOM();
    this.renderGuides();
    this.isVisible = true;
    this.overlay.style.display = 'flex';
    window.addEventListener(
      'keydown',
      this.onKeyDown
    );
  }

  close() {
    if (!this.isVisible) {
      return;
    }
    this.isVisible = false;
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
    window.removeEventListener(
      'keydown',
      this.onKeyDown
    );
  }

  onKeyDown(e) {
    if (this.isVisible && e.key === 'Escape') {
      this.close();
    }
  }

  destroy() {
    this.close();
    if (this.overlay && typeof this.overlay.remove === 'function') {
      this.overlay.remove();
    }
    this.overlay = null;
    this.dialog = null;
    this.listContainer = null;
  }
}

