import { t } from '../config/lang/i18n.js';
import {
  createModalButton,
  createModalShell
} from './ModalShell.js';

export const GUIDE_TAGS = {
  all: {
    id: 'all',
    label: () => t('editor.guideHub.tagAll') || 'All',
    order: 0
  },
  important: {
    id: 'important',
    label: () => t('editor.guideHub.tagImportant') || 'Important',
    order: 1,
    bg: 'rgba(245, 158, 11, 0.18)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.45)'
  },
  basic: {
    id: 'basic',
    label: () => t('editor.guideHub.tagBasic') || 'Basic',
    order: 2,
    bg: 'rgba(16, 185, 129, 0.16)',
    color: '#34d399',
    border: 'rgba(16, 185, 129, 0.4)'
  },
  intro: {
    id: 'intro',
    label: () => t('editor.guideHub.tagIntro') || 'Overview',
    order: 3,
    bg: 'rgba(148, 163, 184, 0.16)',
    color: '#cbd5e1',
    border: 'rgba(148, 163, 184, 0.35)'
  }
};

export function normalizeSearchText(str) {
  return String(str || '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export class GuideHubModal {
  constructor(timelineEditor) {
    this.timelineEditor = timelineEditor;
    this.isVisible = false;
    this.overlay = null;
    this.dialog = null;
    this.controlsContainer = null;
    this.searchInput = null;
    this.clearSearchBtn = null;
    this.tagsContainer = null;
    this.listContainer = null;
    this.customGuides = [];
    this.activeTag = 'all';
    this.searchQuery = '';

    this.onKeyDown = this.onKeyDown.bind(this);
  }

  getTagMeta(tagId) {
    if (GUIDE_TAGS[tagId]) {
      return GUIDE_TAGS[tagId];
    }
    return {
      id: tagId,
      label: () => tagId,
      order: 99,
      bg: 'rgba(0, 229, 255, 0.12)',
      color: '#38bdf8',
      border: 'rgba(0, 229, 255, 0.3)'
    };
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
        tags: ['important', 'basic'],
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
        id: 'reuse_blocks',
        title: () =>
          t('editor.guideHub.reuseBlocksTitle') ||
          'Export and Reuse Block Clusters',
        desc: () =>
          t('editor.guideHub.reuseBlocksDesc') ||
          'Select multiple blocks, export them via Block Context Menu, and add them back via Empty Space Context Menu.',
        badge: () =>
          t('editor.guideHub.reuseBlocksBadge') || '3 steps',
        tags: ['important', 'basic'],
        actionLabel: () =>
          t('editor.guideHub.startBtn') || 'Start Guide',
        variant: 'primary',
        execute: () => {
          if (this.timelineEditor && this.timelineEditor.reuseBlocksGuide) {
            this.timelineEditor.reuseBlocksGuide.start();
          } else if (this.timelineEditor && this.timelineEditor.tourGuide) {
            this.timelineEditor.tourGuide.startReuseBlocksTour();
          }
        }
      },
      {
        id: 'create_and_export_script',
        title: () =>
          t('editor.guideHub.createScriptTitle') ||
          'Create, Save, and Export a Script',
        desc: () =>
          t('editor.guideHub.createScriptDesc') ||
          'Create a blank script with New, add sequences from toolbar and right-click menu, preview with Space, save with Ctrl+S, and export.',
        badge: () =>
          t('editor.guideHub.createScriptBadge') || '7 steps',
        tags: ['important', 'basic'],
        actionLabel: () =>
          t('editor.guideHub.startBtn') || 'Start Guide',
        variant: 'primary',
        execute: () => {
          if (this.timelineEditor && this.timelineEditor.createScriptGuide) {
            this.timelineEditor.createScriptGuide.start();
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
        tags: ['intro'],
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
        tags: ['intro'],
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
      this.customGuides.push({
        ...guideConfig,
        tags: Array.isArray(guideConfig.tags) ? guideConfig.tags : []
      });
    }
  }

  getGuides() {
    const combined = [
      ...this.getDefaultGuides(),
      ...this.customGuides
    ];
    return combined.sort((a, b) => {
      const aImp = Array.isArray(a.tags) && a.tags.includes('important') ? 0 : 1;
      const bImp = Array.isArray(b.tags) && b.tags.includes('important') ? 0 : 1;
      return aImp - bImp;
    });
  }

  getAvailableTags() {
    const tagSet = new Set(['all']);
    this.getGuides().forEach((guide) => {
      if (Array.isArray(guide.tags)) {
        guide.tags.forEach((tagId) => tagSet.add(tagId));
      }
    });
    return Array.from(tagSet)
      .map((tagId) => this.getTagMeta(tagId))
      .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  }

  resolveText(val) {
    return typeof val === 'function' ? val() : (val || '');
  }

  filterGuides() {
    const normalizedQuery = normalizeSearchText(this.searchQuery);
    return this.getGuides().filter((guide) => {
      const guideTags = Array.isArray(guide.tags) ? guide.tags : [];
      const matchesTag =
        this.activeTag === 'all' || guideTags.includes(this.activeTag);
      if (!matchesTag) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const titleText = this.resolveText(guide.title);
      const descText = this.resolveText(guide.desc);
      const tagsText = guideTags
        .map((tagId) => {
          const meta = this.getTagMeta(tagId);
          return `${tagId} ${this.resolveText(meta.label)}`;
        })
        .join(' ');
      const searchable = normalizeSearchText(
        `${titleText} ${descText} ${tagsText}`
      );
      return searchable.includes(normalizedQuery);
    });
  }

  initDOM() {
    if (this.overlay) {
      return;
    }

    const shell = createModalShell({
      overlayClass: 'guide-hub-modal-overlay',
      dialogClass: 'guide-hub-modal-dialog',
      width: '640px',
      title: t('editor.guideHub.title') || 'Guides and Tutorials',
      subtitle: t('editor.guideHub.subtitle') ||
        'Choose an interactive walkthrough or reference guide.',
      closeTitle: t('editor.guideHub.closeBtn') || 'Close',
      onClose: () => this.close()
    });

    this.overlay = shell.overlay;
    this.dialog = shell.dialog;

    this.controlsContainer = document.createElement('div');
    this.controlsContainer.className = 'guide-hub-controls';
    this.controlsContainer.style.padding = '12px 20px';
    this.controlsContainer.style.background = 'rgba(255, 255, 255, 0.025)';
    this.controlsContainer.style.borderBottom =
      '1px solid rgba(255, 255, 255, 0.08)';
    this.controlsContainer.style.display = 'flex';
    this.controlsContainer.style.flexDirection = 'column';
    this.controlsContainer.style.gap = '10px';

    const searchWrap = document.createElement('div');
    searchWrap.style.position = 'relative';
    searchWrap.style.display = 'flex';
    searchWrap.style.alignItems = 'center';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'guide-hub-search-input';
    this.searchInput.placeholder =
      t('editor.guideHub.searchPlaceholder') ||
      'Search guides by name, topic, or tag...';
    this.searchInput.style.width = '100%';
    this.searchInput.style.boxSizing = 'border-box';
    this.searchInput.style.padding = '8px 32px 8px 12px';
    this.searchInput.style.borderRadius = '6px';
    this.searchInput.style.border = '1px solid rgba(255, 255, 255, 0.16)';
    this.searchInput.style.background = 'rgba(15, 23, 42, 0.85)';
    this.searchInput.style.color = '#f0f4f8';
    this.searchInput.style.fontSize = '13px';
    this.searchInput.style.outline = 'none';
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.updateClearSearchButton();
      this.renderGuides();
    });

    this.clearSearchBtn = document.createElement('button');
    this.clearSearchBtn.type = 'button';
    this.clearSearchBtn.className = 'guide-hub-clear-search-btn';
    this.clearSearchBtn.textContent = '×';
    this.clearSearchBtn.title =
      t('editor.guideHub.clearSearchLabel') || 'Clear search';
    this.clearSearchBtn.style.position = 'absolute';
    this.clearSearchBtn.style.right = '8px';
    this.clearSearchBtn.style.background = 'transparent';
    this.clearSearchBtn.style.border = 'none';
    this.clearSearchBtn.style.color = '#94a3b8';
    this.clearSearchBtn.style.fontSize = '18px';
    this.clearSearchBtn.style.lineHeight = '1';
    this.clearSearchBtn.style.cursor = 'pointer';
    this.clearSearchBtn.style.display = 'none';
    this.clearSearchBtn.addEventListener('click', () => {
      this.searchQuery = '';
      if (this.searchInput) {
        this.searchInput.value = '';
        if (typeof this.searchInput.focus === 'function') {
          this.searchInput.focus();
        }
      }
      this.updateClearSearchButton();
      this.renderGuides();
    });

    searchWrap.appendChild(this.searchInput);
    searchWrap.appendChild(this.clearSearchBtn);

    this.tagsContainer = document.createElement('div');
    this.tagsContainer.className = 'guide-hub-tags-filter';
    this.tagsContainer.style.display = 'flex';
    this.tagsContainer.style.flexWrap = 'wrap';
    this.tagsContainer.style.gap = '8px';

    this.controlsContainer.appendChild(searchWrap);
    this.controlsContainer.appendChild(this.tagsContainer);
    this.dialog.appendChild(this.controlsContainer);

    this.listContainer = document.createElement('div');
    this.listContainer.className = 'guide-hub-list';
    this.listContainer.style.flex = '1 1 auto';
    this.listContainer.style.minHeight = '300px';
    this.listContainer.style.overflowY = 'auto';
    this.listContainer.style.padding = '16px 20px';
    this.listContainer.style.display = 'flex';
    this.listContainer.style.flexDirection = 'column';
    this.listContainer.style.gap = '12px';

    this.dialog.appendChild(this.listContainer);
  }

  updateClearSearchButton() {
    if (!this.clearSearchBtn) {
      return;
    }
    this.clearSearchBtn.style.display =
      this.searchQuery && this.searchQuery.length > 0 ? 'block' : 'none';
  }

  renderTagFilters() {
    if (!this.tagsContainer) {
      return;
    }
    this.tagsContainer.innerHTML = '';

    const tags = this.getAvailableTags();
    tags.forEach((tagMeta) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'guide-hub-filter-chip';
      chip.dataset.tagId = tagMeta.id;
      chip.textContent = this.resolveText(tagMeta.label);
      chip.style.padding = '4px 11px';
      chip.style.borderRadius = '14px';
      chip.style.fontSize = '11px';
      chip.style.fontWeight = '600';
      chip.style.cursor = 'pointer';
      chip.style.transition = 'all 0.15s ease';

      const isActive = this.activeTag === tagMeta.id;
      if (isActive) {
        chip.style.background = tagMeta.bg || 'rgba(0, 229, 255, 0.2)';
        chip.style.color = tagMeta.color || '#00e5ff';
        chip.style.border = `1px solid ${tagMeta.border || '#00e5ff'}`;
      } else {
        chip.style.background = 'rgba(255, 255, 255, 0.05)';
        chip.style.color = '#94a3b8';
        chip.style.border = '1px solid rgba(255, 255, 255, 0.14)';
      }

      chip.addEventListener('click', () => {
        this.activeTag = tagMeta.id;
        this.renderTagFilters();
        this.renderGuides();
      });

      this.tagsContainer.appendChild(chip);
    });
  }

  createTagPill(tagId) {
    const meta = this.getTagMeta(tagId);
    const pill = document.createElement('span');
    pill.className = 'guide-hub-card-tag';
    pill.dataset.tagId = tagId;
    pill.textContent = this.resolveText(meta.label);
    pill.style.fontSize = '10px';
    pill.style.fontWeight = '600';
    pill.style.padding = '2px 7px';
    pill.style.borderRadius = '10px';
    pill.style.background = meta.bg || 'rgba(0, 229, 255, 0.14)';
    pill.style.color = meta.color || '#00e5ff';
    pill.style.border =
      `1px solid ${meta.border || 'rgba(0, 229, 255, 0.3)'}`;
    return pill;
  }

  resetFilters() {
    this.activeTag = 'all';
    this.searchQuery = '';
    if (this.searchInput) {
      this.searchInput.value = '';
    }
    this.updateClearSearchButton();
    this.renderTagFilters();
    this.renderGuides();
  }

  renderEmptyState() {
    const emptyBox = document.createElement('div');
    emptyBox.className = 'guide-hub-empty-state';
    emptyBox.style.padding = '36px 20px';
    emptyBox.style.textAlign = 'center';
    emptyBox.style.border = '1px dashed rgba(255, 255, 255, 0.16)';
    emptyBox.style.borderRadius = '6px';
    emptyBox.style.background = 'rgba(255, 255, 255, 0.02)';

    const titleEl = document.createElement('div');
    titleEl.textContent =
      t('editor.guideHub.emptySearchTitle') || 'No Matching Guides Found';
    titleEl.style.fontSize = '14px';
    titleEl.style.fontWeight = '600';
    titleEl.style.color = '#ffffff';
    titleEl.style.marginBottom = '6px';

    const descEl = document.createElement('div');
    descEl.textContent =
      t('editor.guideHub.emptySearchDesc') ||
      'Try another keyword or clear the active tag filter.';
    descEl.style.fontSize = '12px';
    descEl.style.color = '#94a3b8';
    descEl.style.marginBottom = '14px';

    const resetBtn = createModalButton(
      t('editor.guideHub.clearFiltersBtn') || 'Clear Filters',
      'primary'
    );
    resetBtn.className = 'guide-hub-clear-filters-btn';
    resetBtn.addEventListener('click', () => {
      this.resetFilters();
    });

    emptyBox.appendChild(titleEl);
    emptyBox.appendChild(descEl);
    emptyBox.appendChild(resetBtn);
    this.listContainer.appendChild(emptyBox);
  }

  renderGuides() {
    if (!this.listContainer) {
      return;
    }
    this.listContainer.innerHTML = '';

    const guides = this.filterGuides();
    if (guides.length === 0) {
      this.renderEmptyState();
      return;
    }

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
    topRow.style.gap = '6px';
    topRow.style.flexWrap = 'wrap';
    topRow.style.marginBottom = '5px';

    const titleEl = document.createElement('span');
    titleEl.textContent = this.resolveText(guide.title);
    titleEl.style.fontSize = '14px';
    titleEl.style.fontWeight = '600';
    titleEl.style.color = '#ffffff';
    titleEl.style.marginRight = '4px';
    topRow.appendChild(titleEl);

    if (Array.isArray(guide.tags)) {
      guide.tags.forEach((tagId) => {
        topRow.appendChild(this.createTagPill(tagId));
      });
    }

    const badgeText = this.resolveText(guide.badge);
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
    descEl.textContent = this.resolveText(guide.desc);
    descEl.style.fontSize = '12px';
    descEl.style.color = '#94a3b8';
    descEl.style.lineHeight = '1.45';

    infoCol.appendChild(topRow);
    infoCol.appendChild(descEl);

    const actionLabel = this.resolveText(guide.actionLabel);
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
    if (this.searchInput) {
      this.searchInput.value = this.searchQuery;
    }
    this.updateClearSearchButton();
    this.renderTagFilters();
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
    this.controlsContainer = null;
    this.searchInput = null;
    this.clearSearchBtn = null;
    this.tagsContainer = null;
    this.listContainer = null;
  }
}
