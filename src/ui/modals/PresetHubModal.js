import { t } from '../../config/lang/i18n.js';
import {
  createModalButton,
  createModalShell
} from '../ModalShell.js';
import { presetRegistry } from '../../core/PresetRegistry.js';
import { showToast } from '../../utils/Toast.js';
import { resolveAssetUrl } from '../../utils/assetUrl.js';
import {
  extractPresetComposition,
  createDefaultPresetComposition,
  deepCloneJson
} from '../../utils/presetComposition.js';

export class PresetHubModal {
  constructor(options = {}) {
    this.timelineEditor = options.timelineEditor || null;
    this.presetCaptureService = options.presetCaptureService || null;
    this.onApply = options.onApply || null;
    this.isVisible = false;
    this.searchQuery = '';
    this.selectedCategory = 'all';
    this.selectedSource = 'all'; // 'all', 'builtin', 'custom'
    this.activeEditingPreset = null;
    this.hoverVideoTimer = null;
    this.activeVideoEl = null;

    try {
      this.columnsSetting = localStorage.getItem('fdstudio_preset_hub_columns') || 'auto';
      const storedCustom = parseInt(
        localStorage.getItem('fdstudio_preset_hub_custom_columns'),
        10
      );
      this.customColumns = (!isNaN(storedCustom) && storedCustom >= 1) ? storedCustom : 4;
    } catch {
      this.columnsSetting = 'auto';
      this.customColumns = 4;
    }

    this._createDOM();
    this.unsubscribe = presetRegistry.subscribe(() => {
      if (this.isVisible) {
        this.renderGrid();
      }
    });
  }

  _createDOM() {
    const {
      overlay,
      dialog,
      titleEl,
      subtitleEl
    } = createModalShell({
      overlayClass: 'preset-hub-overlay',
      dialogClass: 'preset-hub-dialog',
      width: '1080px',
      title: t('editor.presetHub.title') || 'Firework Preset Library',
      subtitle: t('editor.presetHub.subtitle') || 'Browse, customize banners and preview videos, and manage custom shells',
      closeTitle: t('common.close') || 'Close',
      onClose: () => this.hide()
    });

    this.overlay = overlay;
    this.dialog = dialog;
    this.titleEl = titleEl;
    this.subtitleEl = subtitleEl;

    this.dialog.style.maxWidth = '95vw';
    this.dialog.style.maxHeight = '88vh';
    this.dialog.style.height = '88vh';
    this.dialog.style.display = 'flex';
    this.dialog.style.flexDirection = 'column';

    // Toolbar Header (Search, Filters, Action Buttons)
    const toolbar = document.createElement('div');
    toolbar.className = 'preset-hub-toolbar';
    toolbar.style.display = 'flex';
    toolbar.style.flexWrap = 'wrap';
    toolbar.style.alignItems = 'center';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.gap = '10px';
    toolbar.style.padding = '12px 20px';
    toolbar.style.background = 'rgba(15, 23, 42, 0.6)';
    toolbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';

    // Left controls: Search and Filter pills
    const leftControls = document.createElement('div');
    leftControls.style.display = 'flex';
    leftControls.style.alignItems = 'center';
    leftControls.style.flexWrap = 'wrap';
    leftControls.style.gap = '10px';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'inspector-input';
    searchInput.placeholder = t('editor.presetHub.searchPlaceholder') || 'Search presets by name or tag...';
    searchInput.style.width = '240px';
    searchInput.style.fontSize = '12px';
    searchInput.style.padding = '6px 10px';
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderGrid();
    });
    this.searchInput = searchInput;
    leftControls.appendChild(searchInput);

    // Source Filter Toggle (All / Built-in / Custom)
    const sourceToggle = document.createElement('div');
    sourceToggle.style.display = 'flex';
    sourceToggle.style.background = 'rgba(0, 0, 0, 0.3)';
    sourceToggle.style.borderRadius = '5px';
    sourceToggle.style.padding = '2px';
    sourceToggle.style.border = '1px solid rgba(255, 255, 255, 0.1)';

    const sources = [
      { key: 'all', label: t('editor.presetHub.sources.all') || 'All' },
      { key: 'builtin', label: t('editor.presetHub.sources.builtin') || 'Built-in' },
      { key: 'custom', label: t('editor.presetHub.sources.custom') || 'Custom' }
    ];

    this.sourceButtons = [];
    for (const src of sources) {
      const btn = document.createElement('button');
      btn.textContent = src.label;
      btn.style.padding = '4px 10px';
      btn.style.fontSize = '11px';
      btn.style.fontWeight = '500';
      btn.style.cursor = 'pointer';
      btn.style.borderRadius = '4px';
      btn.style.border = 'none';
      btn.style.transition = 'all 0.15s ease';
      btn.style.background = src.key === this.selectedSource ? '#00bcd4' : 'transparent';
      btn.style.color = src.key === this.selectedSource ? '#000' : '#94a3b8';

      btn.addEventListener('click', () => {
        this.selectedSource = src.key;
        for (const b of this.sourceButtons) {
          b.el.style.background = b.key === this.selectedSource ? '#00bcd4' : 'transparent';
          b.el.style.color = b.key === this.selectedSource ? '#000' : '#94a3b8';
        }
        this.renderGrid();
      });

      this.sourceButtons.push({ key: src.key, el: btn });
      sourceToggle.appendChild(btn);
    }
    leftControls.appendChild(sourceToggle);

    // Presets Per Row Selector (Auto, 1, 5, 10, Custom)
    const columnsControl = document.createElement('div');
    columnsControl.className = 'preset-hub-columns-control';
    columnsControl.style.display = 'flex';
    columnsControl.style.alignItems = 'center';
    columnsControl.style.gap = '6px';
    columnsControl.style.background = 'rgba(0, 0, 0, 0.3)';
    columnsControl.style.borderRadius = '5px';
    columnsControl.style.padding = '2px 8px';
    columnsControl.style.border = '1px solid rgba(255, 255, 255, 0.1)';

    const columnsLabel = document.createElement('span');
    columnsLabel.textContent = t('editor.presetHub.itemsPerRow') || 'Presets per row:';
    columnsLabel.style.fontSize = '11px';
    columnsLabel.style.color = '#94a3b8';
    columnsLabel.style.whiteSpace = 'nowrap';
    columnsControl.appendChild(columnsLabel);

    const columnsSelect = document.createElement('select');
    columnsSelect.className = 'preset-hub-columns-select inspector-select';
    columnsSelect.style.background = '#0f172a';
    columnsSelect.style.color = '#e2e8f0';
    columnsSelect.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    columnsSelect.style.borderRadius = '4px';
    columnsSelect.style.fontSize = '11px';
    columnsSelect.style.padding = '2px 6px';
    columnsSelect.style.cursor = 'pointer';

    const colOptions = [
      { key: 'auto', label: t('editor.presetHub.columns.auto') || 'Auto' },
      { key: '1', label: t('editor.presetHub.columns.one') || '1 preset' },
      { key: '5', label: t('editor.presetHub.columns.five') || '5 presets' },
      { key: '10', label: t('editor.presetHub.columns.ten') || '10 presets' },
      { key: 'custom', label: t('editor.presetHub.columns.custom') || 'Custom' }
    ];

    for (const opt of colOptions) {
      const optEl = document.createElement('option');
      optEl.value = opt.key;
      optEl.textContent = opt.label;
      if (opt.key === this.columnsSetting) {
        optEl.selected = true;
      }
      columnsSelect.appendChild(optEl);
    }
    columnsSelect.value = this.columnsSetting;

    const customInput = document.createElement('input');
    customInput.type = 'number';
    customInput.className = 'preset-hub-custom-columns-input inspector-input';
    customInput.min = '1';
    customInput.max = '16';
    customInput.value = String(this.customColumns);
    customInput.style.width = '44px';
    customInput.style.padding = '2px 4px';
    customInput.style.fontSize = '11px';
    customInput.style.background = '#0f172a';
    customInput.style.color = '#e2e8f0';
    customInput.style.border = '1px solid rgba(0, 229, 255, 0.4)';
    customInput.style.borderRadius = '4px';
    customInput.style.display = this.columnsSetting === 'custom' ? 'block' : 'none';

    columnsSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      this.columnsSetting = val;
      try {
        localStorage.setItem('fdstudio_preset_hub_columns', val);
      } catch {}

      if (val === 'custom') {
        customInput.style.display = 'block';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
      }
      this.applyGridColumns();
      this.renderGrid();
    });

    customInput.addEventListener('input', (e) => {
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 16) val = 16;
      this.customColumns = val;
      try {
        localStorage.setItem('fdstudio_preset_hub_custom_columns', String(val));
      } catch {}
      this.applyGridColumns();
      this.renderGrid();
    });

    columnsControl.appendChild(columnsSelect);
    columnsControl.appendChild(customInput);
    this.columnsControl = columnsControl;
    this.columnsSelect = columnsSelect;
    this.customColumnsInput = customInput;
    leftControls.appendChild(columnsControl);
    toolbar.appendChild(leftControls);

    // Right controls: Action Buttons
    const rightControls = document.createElement('div');
    rightControls.style.display = 'flex';
    rightControls.style.alignItems = 'center';
    rightControls.style.gap = '8px';

    const newBtn = createModalButton(
      t('editor.presetHub.newPreset') || '+ New Custom Preset',
      'primary'
    );
    newBtn.addEventListener('click', () => {
      this.openDrawerForNew();
    });

    const openFolderBtn = createModalButton(
      t('editor.presetHub.openFolder') || 'Open Presets Folder',
      'secondary'
    );
    openFolderBtn.addEventListener('click', async () => {
      const opened = await presetRegistry.openFolder();
      if (!opened) {
        showToast(
          t('editor.presetHub.folderNotFound') || 'Presets directory not accessible',
          'warning'
        );
      }
    });

    rightControls.appendChild(newBtn);
    rightControls.appendChild(openFolderBtn);
    toolbar.appendChild(rightControls);
    this.dialog.appendChild(toolbar);

    // Category Filter Bar (horizontal pills)
    const categoryBar = document.createElement('div');
    categoryBar.className = 'preset-hub-categories';
    categoryBar.style.display = 'flex';
    categoryBar.style.gap = '6px';
    categoryBar.style.padding = '8px 20px';
    categoryBar.style.overflowX = 'auto';
    categoryBar.style.background = 'rgba(0, 0, 0, 0.2)';
    categoryBar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
    this.categoryBar = categoryBar;
    this.dialog.appendChild(categoryBar);

    // Main Content Workspace (Split layout: Grid Gallery + Right Slide Drawer)
    const workspace = document.createElement('div');
    workspace.style.display = 'flex';
    workspace.style.flex = '1';
    workspace.style.overflow = 'hidden';
    workspace.style.position = 'relative';

    // Grid Container (Left / Center)
    const gridContainer = document.createElement('div');
    gridContainer.className = 'preset-hub-grid';
    gridContainer.style.flex = '1';
    gridContainer.style.overflowY = 'auto';
    gridContainer.style.padding = '18px 20px';
    gridContainer.style.display = 'grid';
    gridContainer.style.gridAutoRows = 'max-content';
    this.gridContainer = gridContainer;
    this.applyGridColumns();
    workspace.appendChild(gridContainer);

    // Right Edit Drawer
    const drawer = document.createElement('div');
    drawer.className = 'preset-hub-drawer';
    drawer.style.width = '340px';
    drawer.style.background = '#0a101d';
    drawer.style.borderLeft = '1px solid rgba(0, 229, 255, 0.25)';
    drawer.style.padding = '16px';
    drawer.style.display = 'none';
    drawer.style.flexDirection = 'column';
    drawer.style.overflowY = 'auto';
    drawer.style.gap = '12px';
    this.drawer = drawer;
    workspace.appendChild(drawer);

    this.dialog.appendChild(workspace);
  }

  show() {
    if (
      typeof document !== 'undefined' &&
      document.pointerLockElement &&
      typeof document.exitPointerLock === 'function'
    ) {
      try {
        document.exitPointerLock();
      } catch {}
    }
    this.isVisible = true;
    this.overlay.style.display = 'flex';
    this.applyGridColumns();
    presetRegistry.loadPresets().then(() => {
      this.renderCategories();
      this.renderGrid();
    });
  }

  hide() {
    this.isVisible = false;
    this.overlay.style.display = 'none';
    this.closeDrawer();
    this.cleanupActiveVideo();
  }

  cleanupActiveVideo() {
    if (this.hoverVideoTimer) {
      clearTimeout(this.hoverVideoTimer);
      this.hoverVideoTimer = null;
    }
    if (this.activeVideoContainer) {
      this.activeVideoContainer.style.opacity = '0';
      this.activeVideoContainer = null;
    }
    if (this.activeVideoEl) {
      try {
        this.activeVideoEl.pause();
        this.activeVideoEl.src = '';
        this.activeVideoEl.remove();
      } catch {}
      this.activeVideoEl = null;
    }
  }

  renderCategories() {
    this.categoryBar.innerHTML = '';
    const presets = presetRegistry.getAllPresets();
    const catCounts = {};
    for (const p of presets) {
      const cat = p.category || 'other';
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }

    const categories = ['all', ...Object.keys(catCounts).sort()];

    for (const cat of categories) {
      const btn = document.createElement('button');
      const label = cat === 'all'
        ? (t('editor.presetHub.allCategories') || 'All Categories')
        : cat.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

      const count = cat === 'all' ? presets.length : catCounts[cat];
      btn.textContent = `${label} (${count})`;
      btn.style.padding = '4px 10px';
      btn.style.fontSize = '11px';
      btn.style.borderRadius = '14px';
      btn.style.cursor = 'pointer';
      btn.style.border = '1px solid';
      btn.style.whiteSpace = 'nowrap';
      btn.style.transition = 'all 0.15s ease';

      if (cat === this.selectedCategory) {
        btn.style.background = 'rgba(0, 229, 255, 0.18)';
        btn.style.borderColor = '#00e5ff';
        btn.style.color = '#00e5ff';
      } else {
        btn.style.background = 'transparent';
        btn.style.borderColor = 'rgba(255, 255, 255, 0.12)';
        btn.style.color = '#94a3b8';
      }

      btn.addEventListener('click', () => {
        this.selectedCategory = cat;
        this.renderCategories();
        this.renderGrid();
      });

      this.categoryBar.appendChild(btn);
    }
  }

  getEffectiveColumnCount() {
    if (this.columnsSetting === 'auto') return 0;
    if (this.columnsSetting === '1') return 1;
    if (this.columnsSetting === '5') return 5;
    if (this.columnsSetting === '10') return 10;
    if (this.columnsSetting === 'custom') {
      return Math.max(1, Math.min(16, parseInt(this.customColumns, 10) || 4));
    }
    return 0;
  }

  applyGridColumns() {
    if (!this.gridContainer) return;
    const setting = this.columnsSetting;
    if (setting === 'auto') {
      this.gridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(260px, 1fr))';
      this.gridContainer.style.gap = '16px';
    } else if (setting === '1') {
      this.gridContainer.style.gridTemplateColumns = 'repeat(1, minmax(0, 1fr))';
      this.gridContainer.style.gap = '14px';
    } else if (setting === '5') {
      this.gridContainer.style.gridTemplateColumns = 'repeat(5, minmax(0, 1fr))';
      this.gridContainer.style.gap = '10px';
    } else if (setting === '10') {
      this.gridContainer.style.gridTemplateColumns = 'repeat(10, minmax(0, 1fr))';
      this.gridContainer.style.gap = '6px';
    } else if (setting === 'custom') {
      const cols = Math.max(1, Math.min(16, parseInt(this.customColumns, 10) || 4));
      this.gridContainer.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
      this.gridContainer.style.gap = cols >= 8 ? '6px' : (cols >= 5 ? '10px' : '16px');
    }
  }

  renderGrid() {
    this.gridContainer.innerHTML = '';
    const allPresets = presetRegistry.getAllPresets();

    const filtered = allPresets.filter((preset) => {
      // Source filter
      if (this.selectedSource === 'builtin' && !preset.isBuiltin) return false;
      if (this.selectedSource === 'custom' && !preset.isCustom) return false;

      // Category filter
      if (this.selectedCategory !== 'all' && preset.category !== this.selectedCategory) {
        return false;
      }

      // Search query
      if (this.searchQuery) {
        const query = this.searchQuery;
        const nameMatch = (preset.name || '').toLowerCase().includes(query);
        const tagMatch = Array.isArray(preset.tags) && preset.tags.some((t) => t.toLowerCase().includes(query));
        const summaryMatch = (preset.summary || '').toLowerCase().includes(query);
        if (!nameMatch && !tagMatch && !summaryMatch) return false;
      }

      return true;
    });

    if (filtered.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.gridColumn = '1 / -1';
      emptyNotice.style.padding = '40px 20px';
      emptyNotice.style.textAlign = 'center';
      emptyNotice.style.color = '#64748b';
      emptyNotice.style.fontSize = '13px';
      emptyNotice.textContent = t('editor.presetHub.noPresetsFound') || 'No presets match your current search or category filter.';
      this.gridContainer.appendChild(emptyNotice);
      return;
    }

    for (const preset of filtered) {
      const card = this.createPresetCard(preset);
      this.gridContainer.appendChild(card);
    }
  }

  createPresetCard(preset) {
    const effectiveCols = this.getEffectiveColumnCount();
    const isSingleColumn = effectiveCols === 1;
    const isDenseGrid = effectiveCols >= 8;

    const card = document.createElement('div');
    card.className = 'preset-card';
    card.style.background = 'rgba(20, 28, 42, 0.75)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.08)';
    card.style.borderRadius = '8px';
    card.style.overflow = 'hidden';
    card.style.display = 'flex';
    card.style.flexDirection = isSingleColumn ? 'row' : 'column';
    if (isSingleColumn) {
      card.style.alignItems = 'stretch';
    }
    card.style.transition = 'transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease';
    card.style.cursor = 'default';

    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-2px)';
      card.style.borderColor = 'rgba(0, 229, 255, 0.4)';
      card.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.6)';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'translateY(0)';
      card.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      card.style.boxShadow = 'none';
      this.cleanupActiveVideo();
    });

    // 16:9 Media Preview Box
    const mediaWrap = document.createElement('div');
    mediaWrap.className = 'preset-card-media';
    if (isSingleColumn) {
      mediaWrap.style.width = '240px';
      mediaWrap.style.minWidth = '240px';
      mediaWrap.style.height = '135px';
      mediaWrap.style.paddingTop = '0';
    } else {
      mediaWrap.style.width = '100%';
      mediaWrap.style.paddingTop = '56.25%'; // 16:9 Aspect Ratio
    }
    mediaWrap.style.position = 'relative';
    mediaWrap.style.background = '#070b12';
    mediaWrap.style.overflow = 'hidden';

    // Banner Image or Fallback
    const bannerImg = document.createElement('img');
    bannerImg.style.position = 'absolute';
    bannerImg.style.top = '0';
    bannerImg.style.left = '0';
    bannerImg.style.width = '100%';
    bannerImg.style.height = '100%';
    bannerImg.style.objectFit = 'cover';
    bannerImg.style.transition = 'opacity 0.2s ease';
    bannerImg.alt = preset.name;

    // Abstract gradient fallback
    const placeholder = document.createElement('div');
    placeholder.style.position = 'absolute';
    placeholder.style.top = '0';
    placeholder.style.left = '0';
    placeholder.style.width = '100%';
    placeholder.style.height = '100%';
    placeholder.style.display = 'flex';
    placeholder.style.alignItems = 'center';
    placeholder.style.justifyContent = 'center';
    placeholder.style.background = 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)';
    placeholder.style.color = '#475569';
    placeholder.style.fontSize = '12px';
    placeholder.style.fontWeight = '600';
    placeholder.textContent = preset.name.slice(0, 16);

    if (preset.bannerUrl) {
      bannerImg.src = resolveAssetUrl(preset.bannerUrl);
      bannerImg.addEventListener('error', () => {
        bannerImg.style.display = 'none';
        placeholder.style.display = 'flex';
      });
      mediaWrap.appendChild(bannerImg);
      placeholder.style.display = 'none';
      mediaWrap.appendChild(placeholder);
    } else {
      mediaWrap.appendChild(placeholder);
    }

    // Video preview element container
    const videoContainer = document.createElement('div');
    videoContainer.style.position = 'absolute';
    videoContainer.style.top = '0';
    videoContainer.style.left = '0';
    videoContainer.style.width = '100%';
    videoContainer.style.height = '100%';
    videoContainer.style.opacity = '0';
    videoContainer.style.pointerEvents = 'none';
    videoContainer.style.transition = 'opacity 0.2s ease';
    mediaWrap.appendChild(videoContainer);

    // Hover-to-Play Video Preview (with 150ms debounce)
    if (preset.hasVideo && preset.videoUrl) {
      card.addEventListener('mouseenter', () => {
        this.hoverVideoTimer = setTimeout(() => {
          this.cleanupActiveVideo();
          const video = document.createElement('video');
          video.src = resolveAssetUrl(preset.videoUrl);
          video.autoplay = true;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.style.width = '100%';
          video.style.height = '100%';
          video.style.objectFit = 'cover';

          const showVideo = () => {
            videoContainer.style.opacity = '1';
          };
          if (video.readyState >= 2) {
            showVideo();
          } else {
            video.addEventListener('canplay', showVideo, { once: true });
            video.addEventListener('loadeddata', showVideo, { once: true });
          }

          videoContainer.appendChild(video);
          this.activeVideoEl = video;
          this.activeVideoContainer = videoContainer;
        }, 150);
      });
    }

    card.appendChild(mediaWrap);

    // Card Details
    const details = document.createElement('div');
    details.style.padding = isDenseGrid ? '6px 4px' : '12px';
    details.style.display = 'flex';
    details.style.flexDirection = 'column';
    details.style.gap = isDenseGrid ? '4px' : '6px';
    details.style.flex = '1';
    details.style.minWidth = '0';

    const showCatBadge = this.selectedCategory === 'all';
    const showCustomBadge = Boolean(preset.isCustom) && this.selectedSource === 'all';

    const title = document.createElement('div');
    title.textContent = preset.name;
    title.style.fontSize = isDenseGrid ? '11px' : '13px';
    title.style.fontWeight = 'bold';
    title.style.color = '#f8fafc';
    title.style.whiteSpace = 'nowrap';
    title.style.overflow = 'hidden';
    title.style.textOverflow = 'ellipsis';
    title.style.minWidth = '0';

    const buildBadgesRow = () => {
      const badgesRow = document.createElement('div');
      badgesRow.className = 'preset-card-badges';
      badgesRow.style.display = 'flex';
      badgesRow.style.flexWrap = 'wrap';
      badgesRow.style.alignItems = 'center';
      badgesRow.style.gap = '5px';

      if (showCatBadge) {
        const catBadge = document.createElement('span');
        catBadge.className = 'preset-card-badge-category';
        catBadge.style.fontSize = '9px';
        catBadge.style.fontWeight = '600';
        catBadge.style.textTransform = 'uppercase';
        catBadge.style.letterSpacing = '0.03em';
        catBadge.style.padding = '1px 6px';
        catBadge.style.borderRadius = '4px';
        catBadge.style.background = 'rgba(56, 189, 248, 0.1)';
        catBadge.style.border = '1px solid rgba(56, 189, 248, 0.22)';
        catBadge.style.color = '#7dd3fc';
        catBadge.textContent = preset.category || 'shell';
        badgesRow.appendChild(catBadge);
      }

      if (showCustomBadge) {
        const customBadge = document.createElement('span');
        customBadge.className = 'preset-card-badge-custom';
        customBadge.style.fontSize = '9px';
        customBadge.style.fontWeight = '600';
        customBadge.style.padding = '1px 6px';
        customBadge.style.borderRadius = '4px';
        customBadge.style.background = 'rgba(16, 185, 129, 0.14)';
        customBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
        customBadge.style.color = '#34d399';
        customBadge.textContent = t('editor.presetHub.customBadge') || 'CUSTOM';
        badgesRow.appendChild(customBadge);
      }

      return badgesRow;
    };

    if (isDenseGrid) {
      if (showCustomBadge) {
        const titleRow = document.createElement('div');
        titleRow.style.display = 'flex';
        titleRow.style.alignItems = 'center';
        titleRow.style.gap = '5px';
        titleRow.style.minWidth = '0';

        const customDot = document.createElement('span');
        customDot.className = 'preset-card-custom-dot';
        customDot.title = t('editor.presetHub.customBadge') || 'Custom';
        customDot.style.width = '7px';
        customDot.style.height = '7px';
        customDot.style.borderRadius = '50%';
        customDot.style.background = '#10b981';
        customDot.style.flexShrink = '0';

        title.style.flex = '1';
        titleRow.appendChild(customDot);
        titleRow.appendChild(title);
        details.appendChild(titleRow);
      } else {
        details.appendChild(title);
      }
    } else if (isSingleColumn) {
      const titleRow = document.createElement('div');
      titleRow.style.display = 'flex';
      titleRow.style.alignItems = 'center';
      titleRow.style.justifyContent = 'space-between';
      titleRow.style.gap = '8px';
      titleRow.style.minWidth = '0';

      title.style.flex = '1';
      titleRow.appendChild(title);
      if (showCatBadge || showCustomBadge) {
        titleRow.appendChild(buildBadgesRow());
      }
      details.appendChild(titleRow);
    } else {
      details.appendChild(title);
      if (showCatBadge || showCustomBadge) {
        details.appendChild(buildBadgesRow());
      }
    }

    if (preset.summary && !isDenseGrid) {
      const desc = document.createElement('div');
      desc.textContent = preset.summary;
      desc.style.fontSize = '11px';
      desc.style.color = '#94a3b8';
      desc.style.lineHeight = '1.4';
      desc.style.display = '-webkit-box';
      desc.style.webkitLineClamp = '2';
      desc.style.webkitBoxOrient = 'vertical';
      desc.style.overflow = 'hidden';
      details.appendChild(desc);
    }

    // Action Buttons Row
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.alignItems = 'center';
    if (isDenseGrid) {
      actions.style.flexDirection = 'column';
      actions.style.gap = '4px';
    } else if (isSingleColumn) {
      actions.style.justifyContent = 'flex-start';
      actions.style.gap = '10px';
    } else {
      actions.style.justifyContent = 'space-between';
      actions.style.gap = '6px';
    }
    actions.style.marginTop = 'auto';
    actions.style.paddingTop = isDenseGrid ? '4px' : '8px';

    const applyBtn = createModalButton(
      t('editor.presetHub.apply') || 'Apply',
      'primary'
    );
    applyBtn.style.padding = isDenseGrid ? '3px 4px' : '5px 10px';
    applyBtn.style.fontSize = isDenseGrid ? '10px' : '11px';
    applyBtn.style.flex = isSingleColumn ? '0 0 100px' : '1';
    if (isDenseGrid) {
      applyBtn.style.width = '100%';
    }
    applyBtn.addEventListener('click', () => {
      if (typeof this.onApply === 'function') {
        this.onApply(preset);
      }
      this.hide();
    });
    actions.appendChild(applyBtn);

    const editBtn = createModalButton(
      t('editor.presetHub.edit') || 'Edit',
      'secondary'
    );
    editBtn.style.padding = isDenseGrid ? '3px 4px' : '5px 10px';
    editBtn.style.fontSize = isDenseGrid ? '10px' : '11px';
    if (isSingleColumn) {
      editBtn.style.flex = '0 0 80px';
    } else if (isDenseGrid) {
      editBtn.style.width = '100%';
    }
    editBtn.addEventListener('click', () => {
      this.openDrawerForEdit(preset);
    });
    actions.appendChild(editBtn);

    if (preset.isCustom) {
      const deleteBtn = createModalButton(
        t('editor.presetHub.delete') || 'Delete',
        'secondary'
      );
      deleteBtn.style.padding = isDenseGrid ? '3px 4px' : '5px 8px';
      deleteBtn.style.fontSize = isDenseGrid ? '10px' : '11px';
      deleteBtn.style.color = '#ef4444';
      if (isSingleColumn) {
        deleteBtn.style.flex = '0 0 80px';
      } else if (isDenseGrid) {
        deleteBtn.style.width = '100%';
      }
      deleteBtn.addEventListener('click', async () => {
        const confirmDelete = window.confirm(
          t('editor.presetHub.confirmDelete') || `Delete preset "${preset.name}" and all associated media files?`
        );
        if (confirmDelete) {
          await presetRegistry.deletePreset(preset.slug);
          showToast(t('editor.presetHub.deleted') || 'Preset deleted', 'success');
        }
      });
      actions.appendChild(deleteBtn);
    }

    details.appendChild(actions);
    card.appendChild(details);
    return card;
  }

  openDrawerForEdit(preset) {
    this.activeEditingPreset = preset;
    this.renderDrawerForm(preset, false);
    this.drawer.style.display = 'flex';
  }

  openDrawerForNew(targetEvent = null, captureResult = null) {
    const sel = targetEvent ||
      this.timelineEditor?.inspector?.selectedEvent ||
      this.timelineEditor?.selectedEvents?.[0] ||
      null;

    let composition = null;
    let defaultName = 'New Custom Firework';
    let defaultSummary = '';
    let initialTags = ['shell'];
    let defaultCategory = 'shell';

    if (sel) {
      const shape = sel.shapeType || 'sphere';
      const dynamics = sel.dynamicsType || 'standard';
      defaultName = sel.name || sel.label || `${shape}_${dynamics}`;
      defaultSummary = `Custom firework preset based on ${shape} with ${dynamics}.`;
      initialTags = [shape, dynamics];
      defaultCategory = sel.type === 'cometsequence' ? 'comet' : 'shell';
      composition = extractPresetComposition(sel);
    } else {
      composition = createDefaultPresetComposition();
    }

    const newPreset = {
      slug: `custom_shell_${Date.now()}`,
      name: defaultName,
      category: defaultCategory,
      tags: initialTags,
      summary: defaultSummary,
      composition,
      isCustom: true,
      _sourceEvent: sel ? deepCloneJson(sel) : null
    };

    if (captureResult) {
      if (captureResult.bannerBase64) {
        newPreset.bannerBase64 = captureResult.bannerBase64;
      }
      if (captureResult.videoBase64) {
        newPreset.videoBase64 = captureResult.videoBase64;
        newPreset.hasVideo = true;
      }
    }

    this.activeEditingPreset = newPreset;
    this.renderDrawerForm(newPreset, true);
    this.drawer.style.display = 'flex';
  }

  openCreateDrawer(targetEvent = null, captureResult = null) {
    this.openDrawerForNew(targetEvent, captureResult);
  }

  _resolveSourceEventForPreset(preset) {
    if (preset?._sourceEvent) {
      return deepCloneJson(preset._sourceEvent);
    }
    const sel = this.timelineEditor?.inspector?.selectedEvent ||
      this.timelineEditor?.selectedEvents?.[0] ||
      null;
    if (sel) {
      return deepCloneJson(sel);
    }
    const comp = preset?.composition || createDefaultPresetComposition();
    return {
      type: preset?.category === 'comet' ? 'cometsequence' : 'sequence',
      time: 0,
      duration: 2.0,
      burstHeight: 140,
      ...deepCloneJson(comp)
    };
  }

  closeDrawer() {
    this.activeEditingPreset = null;
    this.drawer.style.display = 'none';
    this.drawer.innerHTML = '';
  }

  renderDrawerForm(preset, isNew) {
    this.drawer.innerHTML = '';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const title = document.createElement('div');
    title.textContent = isNew
      ? (t('editor.presetHub.createTitle') || 'Create Preset')
      : (t('editor.presetHub.editTitle') || 'Customize Preset');
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    title.style.color = '#00e5ff';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#94a3b8';
    closeBtn.style.fontSize = '18px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.addEventListener('click', () => this.closeDrawer());

    header.appendChild(title);
    header.appendChild(closeBtn);
    this.drawer.appendChild(header);

    // Form Fields
    const form = document.createElement('div');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '10px';

    // Name Input
    const nameWrap = document.createElement('div');
    const nameLbl = document.createElement('label');
    nameLbl.className = 'inspector-label';
    nameLbl.textContent = t('editor.presetHub.fields.name') || 'Preset Name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'inspector-input';
    nameInput.value = preset.name || '';
    nameWrap.appendChild(nameLbl);
    nameWrap.appendChild(nameInput);
    form.appendChild(nameWrap);

    // Category Input
    const catWrap = document.createElement('div');
    const catLbl = document.createElement('label');
    catLbl.className = 'inspector-label';
    catLbl.textContent = t('editor.presetHub.fields.category') || 'Category';
    const catInput = document.createElement('input');
    catInput.type = 'text';
    catInput.className = 'inspector-input';
    catInput.value = preset.category || 'shell';
    catWrap.appendChild(catLbl);
    catWrap.appendChild(catInput);
    form.appendChild(catWrap);

    // Tags Input
    const tagsWrap = document.createElement('div');
    const tagsLbl = document.createElement('label');
    tagsLbl.className = 'inspector-label';
    tagsLbl.textContent = t('editor.presetHub.fields.tags') || 'Tags (comma separated)';
    const tagsInput = document.createElement('input');
    tagsInput.type = 'text';
    tagsInput.className = 'inspector-input';
    tagsInput.value = Array.isArray(preset.tags) ? preset.tags.join(', ') : '';
    tagsWrap.appendChild(tagsLbl);
    tagsWrap.appendChild(tagsInput);
    form.appendChild(tagsWrap);

    // Summary Textarea
    const sumWrap = document.createElement('div');
    const sumLbl = document.createElement('label');
    sumLbl.className = 'inspector-label';
    sumLbl.textContent = t('editor.presetHub.fields.summary') || 'Description';
    const sumTextarea = document.createElement('textarea');
    sumTextarea.className = 'inspector-input';
    sumTextarea.rows = 2;
    sumTextarea.style.resize = 'vertical';
    sumTextarea.value = preset.summary || '';
    sumWrap.appendChild(sumLbl);
    sumWrap.appendChild(sumTextarea);
    form.appendChild(sumWrap);

    // Media Section
    const mediaDivider = document.createElement('div');
    mediaDivider.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    mediaDivider.style.margin = '4px 0';
    form.appendChild(mediaDivider);

    // Banner Image Control
    const bannerBox = document.createElement('div');
    bannerBox.style.display = 'flex';
    bannerBox.style.flexDirection = 'column';
    bannerBox.style.gap = '6px';

    const bannerLbl = document.createElement('label');
    bannerLbl.className = 'inspector-label';
    bannerLbl.textContent = t('editor.presetHub.fields.banner') || 'Banner Image (16:9)';
    bannerBox.appendChild(bannerLbl);

    const bannerPreview = document.createElement('img');
    bannerPreview.style.width = '100%';
    bannerPreview.style.height = '100px';
    bannerPreview.style.objectFit = 'cover';
    bannerPreview.style.borderRadius = '4px';
    bannerPreview.style.background = '#070b12';
    const initialBannerSrc = preset.bannerBase64 || preset.bannerUrl || '';
    bannerPreview.style.display = initialBannerSrc ? 'block' : 'none';
    if (initialBannerSrc) bannerPreview.src = initialBannerSrc;
    bannerBox.appendChild(bannerPreview);

    const bannerBtnRow = document.createElement('div');
    bannerBtnRow.style.display = 'flex';
    bannerBtnRow.style.gap = '6px';

    const uploadBannerBtn = createModalButton(
      t('editor.presetHub.chooseImage') || 'Choose Image File...',
      'secondary'
    );
    uploadBannerBtn.style.fontSize = '10px';
    uploadBannerBtn.style.padding = '4px 8px';
    uploadBannerBtn.addEventListener('click', async () => {
      const slug = preset.slug || nameInput.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const res = await presetRegistry.importMedia(slug, 'image');
      if (res && !res.canceled && res.url) {
        preset.bannerUrl = res.url;
        bannerPreview.src = res.url;
        bannerPreview.style.display = 'block';
        showToast(t('editor.presetHub.mediaUploaded') || 'Banner image updated', 'success');
      }
    });

    const captureCanvasBtn = createModalButton(
      t('editor.presetHub.captureViewport') || 'Capture Viewport',
      'secondary'
    );
    captureCanvasBtn.style.fontSize = '10px';
    captureCanvasBtn.style.padding = '4px 8px';
    captureCanvasBtn.addEventListener('click', () => {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        try {
          const dataUrl = canvas.toDataURL('image/png');
          preset.bannerBase64 = dataUrl;
          bannerPreview.src = dataUrl;
          bannerPreview.style.display = 'block';
          showToast(t('editor.presetHub.captured') || 'Captured 3D viewport', 'success');
        } catch {
          showToast(t('editor.presetHub.captureFailed') || 'Unable to capture viewport', 'error');
        }
      }
    });

    bannerBtnRow.appendChild(uploadBannerBtn);
    bannerBtnRow.appendChild(captureCanvasBtn);

    if (this.presetCaptureService) {
      const retakePhotoBtn = createModalButton(
        t('editor.presetHub.retakePhoto') || 'Retake Photo',
        'secondary'
      );
      retakePhotoBtn.style.fontSize = '10px';
      retakePhotoBtn.style.padding = '4px 8px';
      retakePhotoBtn.title = t('editor.presetHub.retakePhotoTitle') || 'Replay block and press C to snap a new photo';
      retakePhotoBtn.addEventListener('click', async () => {
        const sourceEvent = this._resolveSourceEventForPreset(preset);
        this.hide();
        const result = await this.presetCaptureService.captureManualPhoto(sourceEvent);
        this.show();
        if (result && result.bannerBase64) {
          preset.bannerBase64 = result.bannerBase64;
        }
        this.activeEditingPreset = preset;
        this.renderDrawerForm(preset, isNew);
        this.drawer.style.display = 'flex';
      });
      bannerBtnRow.appendChild(retakePhotoBtn);
    }

    bannerBox.appendChild(bannerBtnRow);
    form.appendChild(bannerBox);

    // Video Control
    const videoBox = document.createElement('div');
    videoBox.style.display = 'flex';
    videoBox.style.flexDirection = 'column';
    videoBox.style.gap = '6px';

    const videoLbl = document.createElement('label');
    videoLbl.className = 'inspector-label';
    videoLbl.textContent = t('editor.presetHub.fields.video') || 'Preview Video';
    videoBox.appendChild(videoLbl);

    const videoPreview = document.createElement('video');
    videoPreview.autoplay = true;
    videoPreview.loop = true;
    videoPreview.muted = true;
    videoPreview.playsInline = true;
    videoPreview.style.width = '100%';
    videoPreview.style.height = '100px';
    videoPreview.style.objectFit = 'cover';
    videoPreview.style.borderRadius = '4px';
    videoPreview.style.background = '#070b12';
    const initialVideoSrc = preset.videoBase64 || preset.videoUrl || '';
    videoPreview.style.display = initialVideoSrc ? 'block' : 'none';
    if (initialVideoSrc) {
      videoPreview.src = preset.videoBase64
        ? preset.videoBase64
        : resolveAssetUrl(preset.videoUrl);
    }
    videoBox.appendChild(videoPreview);

    const videoBtnRow = document.createElement('div');
    videoBtnRow.style.display = 'flex';
    videoBtnRow.style.gap = '6px';

    const uploadVideoBtn = createModalButton(
      t('editor.presetHub.chooseVideo') || 'Choose Video File...',
      'secondary'
    );
    uploadVideoBtn.style.fontSize = '10px';
    uploadVideoBtn.style.padding = '4px 8px';
    uploadVideoBtn.addEventListener('click', async () => {
      const slug = preset.slug || nameInput.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const res = await presetRegistry.importMedia(slug, 'video');
      if (res && !res.canceled && res.url) {
        preset.videoUrl = res.url;
        preset.hasVideo = true;
        videoPreview.src = resolveAssetUrl(res.url);
        videoPreview.style.display = 'block';
        showToast(t('editor.presetHub.videoUploaded') || 'Video preview updated', 'success');
      }
    });
    videoBtnRow.appendChild(uploadVideoBtn);

    if (this.presetCaptureService) {
      const autoCaptureBtn = createModalButton(
        t('editor.presetHub.autoCaptureBlock') || 'Auto-Capture Block',
        'secondary'
      );
      autoCaptureBtn.style.fontSize = '10px';
      autoCaptureBtn.style.padding = '4px 8px';
      autoCaptureBtn.addEventListener('click', async () => {
        const activeEvent = this.timelineEditor?.inspector?.selectedEvent ||
          this.timelineEditor?.selectedEvents?.[0] ||
          null;
        if (!activeEvent) {
          showToast(
            t('editor.presetHub.selectEventToCapture') || 'Select a firework block on the timeline first',
            'warning'
          );
          return;
        }
        this.hide();
        const result = await this.presetCaptureService.captureBlock(activeEvent);
        this.show();
        if (result) {
          if (result.bannerBase64) {
            preset.bannerBase64 = result.bannerBase64;
            bannerPreview.src = result.bannerBase64;
            bannerPreview.style.display = 'block';
          }
          if (result.videoBase64) {
            preset.videoBase64 = result.videoBase64;
            preset.hasVideo = true;
            videoPreview.src = result.videoBase64;
            videoPreview.style.display = 'block';
          }
          this.renderDrawerForm(preset, isNew);
          this.drawer.style.display = 'flex';
        }
      });
      videoBtnRow.appendChild(autoCaptureBtn);

      const rerecordVideoBtn = createModalButton(
        t('editor.presetHub.rerecordVideo') || 'Re-record Video',
        'secondary'
      );
      rerecordVideoBtn.style.fontSize = '10px';
      rerecordVideoBtn.style.padding = '4px 8px';
      rerecordVideoBtn.title = t('editor.presetHub.rerecordVideoTitle') || 'Replay block and press V to start and stop recording';
      rerecordVideoBtn.addEventListener('click', async () => {
        const sourceEvent = this._resolveSourceEventForPreset(preset);
        this.hide();
        const result = await this.presetCaptureService.captureManualVideo(sourceEvent);
        this.show();
        if (result && result.videoBase64) {
          preset.videoBase64 = result.videoBase64;
          preset.hasVideo = true;
        }
        this.activeEditingPreset = preset;
        this.renderDrawerForm(preset, isNew);
        this.drawer.style.display = 'flex';
      });
      videoBtnRow.appendChild(rerecordVideoBtn);
    }

    videoBox.appendChild(videoBtnRow);
    form.appendChild(videoBox);

    // Save & Cancel Buttons
    const btnRow = document.createElement('div');
    btnRow.style.display = 'flex';
    btnRow.style.gap = '8px';
    btnRow.style.marginTop = '12px';

    const saveBtn = createModalButton(
      t('common.save') || 'Save Preset',
      'primary'
    );
    saveBtn.style.flex = '1';
    saveBtn.addEventListener('click', async () => {
      const tags = tagsInput.value.split(',').map((s) => s.trim()).filter(Boolean);
      const payload = {
        ...preset,
        name: nameInput.value.trim() || 'Untitled Firework',
        category: catInput.value.trim() || 'shell',
        tags,
        summary: sumTextarea.value.trim(),
        composition: preset.composition ? deepCloneJson(preset.composition) : null,
        isCustom: true
      };

      await presetRegistry.savePreset(payload);
      showToast(t('editor.presetHub.saved') || 'Preset saved successfully', 'success');
      this.closeDrawer();
    });

    const cancelBtn = createModalButton(
      t('common.cancel') || 'Cancel',
      'secondary'
    );
    cancelBtn.addEventListener('click', () => this.closeDrawer());

    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    form.appendChild(btnRow);

    this.drawer.appendChild(form);
  }
}
