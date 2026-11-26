import { t } from '../config/lang/i18n.js';
import { DOCS_CONFIG } from '../config/docs.js';
import { fileStorage } from '../core/FileStorageAdapter.js';
import { globalEventBus } from '../core/EventBus.js';
import { showToast } from '../utils/Toast.js';
import { customConfirm } from './utils/Modal.js';
import {
  getRecentScripts,
  removeRecentScript,
  clearRecentScripts,
  formatRelativeTime,
  MAX_RECENT_SCRIPTS
} from '../utils/recentScripts.js';
import {
  createModalButton,
  createModalShell
} from './ModalShell.js';

export const SCRIPTS_FOLDER_STORAGE_KEY = 'fdshow_scripts_folder';

export class ShowLibraryModal {
  constructor(timelineEditor) {
    this.timelineEditor = timelineEditor;
    this.isVisible = false;
    this.overlay = null;
    this.dialog = null;
    this.activeTab = 'recent';
    this.recentTabBtn = null;
    this.folderTabBtn = null;
    this.recentCountBadge = null;
    this.folderControlsEl = null;
    this.selectFolderBtn = null;
    this.driveBtn = null;
    this.rescanBtn = null;
    this.openSingleFileBtn = null;
    this.folderPathEl = null;
    this.listContainer = null;
    this.currentFolderPath = this.loadSavedFolderPath();
    this.lastScanResult = null;

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onShowLoaded = this.onShowLoaded.bind(this);
  }

  loadSavedFolderPath() {
    if (typeof localStorage === 'undefined') {
      return '';
    }
    return localStorage.getItem(SCRIPTS_FOLDER_STORAGE_KEY) || '';
  }

  saveFolderPath(folderPath) {
    this.currentFolderPath = folderPath || '';
    if (typeof localStorage !== 'undefined') {
      if (folderPath) {
        localStorage.setItem(
          SCRIPTS_FOLDER_STORAGE_KEY,
          folderPath
        );
      } else {
        localStorage.removeItem(SCRIPTS_FOLDER_STORAGE_KEY);
      }
    }
  }

  createButton(label, variant = 'secondary') {
    return createModalButton(
      label,
      variant
    );
  }

  initDOM() {
    if (this.overlay) {
      return;
    }

    const shell = createModalShell({
      overlayClass: 'show-library-modal-overlay',
      dialogClass: 'show-library-modal-dialog',
      width: '680px',
      title: t('editor.showLibrary.title') || 'Show Script Library',
      subtitle: t('editor.showLibrary.subtitle') ||
        'Download scripts from Google Drive and select your local folder to load shows.',
      closeTitle: t('editor.showLibrary.closeBtn') || 'Close',
      onClose: () => this.close()
    });

    this.overlay = shell.overlay;
    this.dialog = shell.dialog;

    // Tabs Navigation Row
    const tabsRow = document.createElement('div');
    tabsRow.className = 'show-library-tabs';
    tabsRow.style.display = 'flex';
    tabsRow.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
    tabsRow.style.background = 'rgba(0, 0, 0, 0.2)';
    tabsRow.style.padding = '0 20px';
    tabsRow.style.gap = '8px';

    this.recentTabBtn = document.createElement('button');
    this.recentTabBtn.className = 'show-library-tab-btn recent-tab-btn';
    this.recentTabBtn.style.background = 'transparent';
    this.recentTabBtn.style.border = 'none';
    this.recentTabBtn.style.borderBottom = '2px solid transparent';
    this.recentTabBtn.style.color = '#94a3b8';
    this.recentTabBtn.style.padding = '10px 14px';
    this.recentTabBtn.style.fontSize = '13px';
    this.recentTabBtn.style.fontWeight = '600';
    this.recentTabBtn.style.cursor = 'pointer';
    this.recentTabBtn.style.transition = 'all 0.15s ease';
    this.recentTabBtn.style.display = 'inline-flex';
    this.recentTabBtn.style.alignItems = 'center';

    const recentLabel = document.createElement('span');
    recentLabel.textContent =
      t('editor.showLibrary.recentScriptsTab') || 'Recent Scripts';
    this.recentTabBtn.appendChild(recentLabel);

    this.recentCountBadge = document.createElement('span');
    this.recentCountBadge.className = 'recent-count-badge';
    this.recentCountBadge.style.background = 'rgba(0, 229, 255, 0.2)';
    this.recentCountBadge.style.color = '#00e5ff';
    this.recentCountBadge.style.borderRadius = '10px';
    this.recentCountBadge.style.padding = '1px 7px';
    this.recentCountBadge.style.fontSize = '11px';
    this.recentCountBadge.style.marginLeft = '6px';
    this.recentCountBadge.style.fontWeight = 'bold';
    this.recentCountBadge.style.display = 'none';
    this.recentTabBtn.appendChild(this.recentCountBadge);

    this.recentTabBtn.addEventListener('click', () => {
      this.switchTab('recent');
    });

    this.folderTabBtn = document.createElement('button');
    this.folderTabBtn.className = 'show-library-tab-btn folder-tab-btn';
    this.folderTabBtn.style.background = 'transparent';
    this.folderTabBtn.style.border = 'none';
    this.folderTabBtn.style.borderBottom = '2px solid transparent';
    this.folderTabBtn.style.color = '#94a3b8';
    this.folderTabBtn.style.padding = '10px 14px';
    this.folderTabBtn.style.fontSize = '13px';
    this.folderTabBtn.style.fontWeight = '600';
    this.folderTabBtn.style.cursor = 'pointer';
    this.folderTabBtn.style.transition = 'all 0.15s ease';
    this.folderTabBtn.textContent =
      t('editor.showLibrary.folderLibraryTab') || 'Folder Library';
    this.folderTabBtn.addEventListener('click', () => {
      this.switchTab('folder');
    });

    tabsRow.appendChild(this.recentTabBtn);
    tabsRow.appendChild(this.folderTabBtn);
    this.dialog.appendChild(tabsRow);

    // Controls Bar (Folder controls)
    const controls = document.createElement('div');
    this.folderControlsEl = controls;
    controls.className = 'show-library-controls';
    controls.style.padding = '14px 20px';
    controls.style.background = 'rgba(255, 255, 255, 0.03)';
    controls.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = '10px';

    const actionsRow = document.createElement('div');
    actionsRow.style.display = 'flex';
    actionsRow.style.flexWrap = 'wrap';
    actionsRow.style.gap = '10px';
    actionsRow.style.alignItems = 'center';

    this.driveBtn = this.createButton(
      t('editor.showLibrary.driveBtn') || 'Download Scripts from Drive',
      'accent'
    );
    this.driveBtn.addEventListener('click', () => {
      this.openDriveLink();
    });

    this.selectFolderBtn = this.createButton(
      t('editor.showLibrary.selectFolderBtn') || 'Select Folder',
      'primary'
    );
    this.selectFolderBtn.className = 'show-library-select-folder-btn';
    this.selectFolderBtn.addEventListener('click', () => {
      this.handleSelectFolder();
    });

    this.rescanBtn = this.createButton(
      t('editor.showLibrary.rescanBtn') || 'Rescan',
      'secondary'
    );
    this.rescanBtn.addEventListener('click', () => {
      this.rescanCurrentFolder();
    });

    this.openSingleFileBtn = this.createButton(
      t('editor.showLibrary.openSingleFileBtn') || 'Open JSON File',
      'secondary'
    );
    this.openSingleFileBtn.className = 'show-library-open-file-btn';
    this.openSingleFileBtn.addEventListener('click', () => {
      this.handleOpenSingleFile();
    });

    actionsRow.appendChild(this.driveBtn);
    actionsRow.appendChild(this.selectFolderBtn);
    actionsRow.appendChild(this.rescanBtn);
    actionsRow.appendChild(this.openSingleFileBtn);

    this.folderPathEl = document.createElement('div');
    this.folderPathEl.style.fontSize = '12px';
    this.folderPathEl.style.color = '#cbd5e1';
    this.folderPathEl.style.fontFamily = 'monospace';
    this.folderPathEl.style.wordBreak = 'break-all';

    controls.appendChild(actionsRow);
    controls.appendChild(this.folderPathEl);
    this.dialog.appendChild(controls);

    // List Container
    this.listContainer = document.createElement('div');
    this.listContainer.className = 'show-library-list';
    this.listContainer.style.flex = '1 1 auto';
    this.listContainer.style.overflowY = 'auto';
    this.listContainer.style.padding = '16px 20px';
    this.listContainer.style.display = 'flex';
    this.listContainer.style.flexDirection = 'column';
    this.listContainer.style.gap = '10px';

    this.dialog.appendChild(this.listContainer);
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    const isRecent = tabName === 'recent';

    if (this.recentTabBtn) {
      this.recentTabBtn.style.color = isRecent ? '#00e5ff' : '#94a3b8';
      this.recentTabBtn.style.borderBottomColor = isRecent
        ? '#00e5ff'
        : 'transparent';
    }

    if (this.folderTabBtn) {
      this.folderTabBtn.style.color = !isRecent ? '#00e5ff' : '#94a3b8';
      this.folderTabBtn.style.borderBottomColor = !isRecent
        ? '#00e5ff'
        : 'transparent';
    }

    if (this.folderControlsEl) {
      this.folderControlsEl.style.display = isRecent ? 'none' : 'flex';
    }

    if (isRecent) {
      this.renderRecentScriptsView();
    } else {
      if (this.currentFolderPath) {
        this.rescanCurrentFolder();
      } else {
        this.renderEmptyPrompt();
      }
    }
  }

  updateRecentCountBadge() {
    if (!this.recentCountBadge) {
      return;
    }
    const count = getRecentScripts().length;
    if (count > 0) {
      this.recentCountBadge.textContent = String(count);
      this.recentCountBadge.style.display = 'inline-block';
    } else {
      this.recentCountBadge.textContent = '';
      this.recentCountBadge.style.display = 'none';
    }
  }

  renderRecentScriptsView() {
    if (!this.listContainer) {
      return;
    }
    this.listContainer.innerHTML = '';

    const recentItems = getRecentScripts();
    if (recentItems.length === 0) {
      const box = this.createEmptyStateBox(
        t('editor.showLibrary.recentScriptsEmptyTitle') || 'No Recent Scripts',
        t('editor.showLibrary.recentScriptsEmptyDesc') ||
          'Scripts you open or save will appear here for quick access.'
      );
      this.listContainer.appendChild(box);
      return;
    }

    const headerRow = document.createElement('div');
    headerRow.className = 'recent-scripts-header-row';
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.padding = '0 2px 4px 2px';

    const countLabel = document.createElement('span');
    countLabel.textContent = `${recentItems.length} of ${MAX_RECENT_SCRIPTS}`;
    countLabel.style.fontSize = '12px';
    countLabel.style.fontWeight = '600';
    countLabel.style.color = '#94a3b8';

    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-recent-history-btn';
    clearBtn.textContent =
      t('editor.showLibrary.recentScriptsClear') || 'Clear History';
    clearBtn.style.background = 'transparent';
    clearBtn.style.border = 'none';
    clearBtn.style.color = '#ef4444';
    clearBtn.style.fontSize = '12px';
    clearBtn.style.fontWeight = '600';
    clearBtn.style.cursor = 'pointer';
    clearBtn.style.padding = '2px 6px';
    clearBtn.style.borderRadius = '4px';
    clearBtn.addEventListener('click', () => {
      this.handleClearRecentHistory();
    });

    headerRow.appendChild(countLabel);
    headerRow.appendChild(clearBtn);
    this.listContainer.appendChild(headerRow);

    recentItems.forEach((item) => {
      const card = this.createRecentScriptCard(item);
      this.listContainer.appendChild(card);
    });
  }

  async handleClearRecentHistory() {
    const confirmMsg =
      t('editor.showLibrary.recentScriptsClearConfirm') ||
      'Are you sure you want to clear your recent scripts history?';
    const confirmed = await customConfirm(confirmMsg);

    if (!confirmed) {
      return;
    }
    clearRecentScripts();
    this.updateRecentCountBadge();
    this.renderRecentScriptsView();
  }

  createRecentScriptCard(item) {
    const card = document.createElement('div');
    card.className = 'show-library-recent-card';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    card.style.gap = '12px';
    card.style.padding = '12px 14px';
    card.style.background = 'rgba(255, 255, 255, 0.04)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    card.style.borderRadius = '6px';

    const infoCol = document.createElement('div');
    infoCol.style.flex = '1 1 auto';
    infoCol.style.minWidth = '0';

    const nameRow = document.createElement('div');
    nameRow.textContent = item.filename || item.filePath;
    nameRow.style.fontSize = '14px';
    nameRow.style.fontWeight = '600';
    nameRow.style.color = '#ffffff';
    nameRow.style.overflow = 'hidden';
    nameRow.style.textOverflow = 'ellipsis';
    nameRow.style.whiteSpace = 'nowrap';

    const metaRow = document.createElement('div');
    metaRow.style.display = 'flex';
    metaRow.style.flexWrap = 'wrap';
    metaRow.style.gap = '10px';
    metaRow.style.marginTop = '4px';
    metaRow.style.fontSize = '11px';
    metaRow.style.color = '#94a3b8';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = formatRelativeTime(
      item.lastOpenedAt,
      t
    );
    timeSpan.style.color = '#00e5ff';
    metaRow.appendChild(timeSpan);

    if (item.eventCount) {
      const eventsSpan = document.createElement('span');
      eventsSpan.textContent =
        t(
          'editor.showLibrary.eventsCount',
          { count: item.eventCount }
        ) || `${item.eventCount} events`;
      metaRow.appendChild(eventsSpan);
    }

    if (item.duration) {
      const durSpan = document.createElement('span');
      durSpan.textContent =
        t(
          'editor.showLibrary.durationLabel',
          { seconds: Math.round(item.duration) }
        ) || `${Math.round(item.duration)}s`;
      metaRow.appendChild(durSpan);
    }

    const pathRow = document.createElement('div');
    pathRow.textContent = item.filePath;
    pathRow.title = item.filePath;
    pathRow.style.fontSize = '11px';
    pathRow.style.color = '#64748b';
    pathRow.style.fontFamily = 'monospace';
    pathRow.style.marginTop = '4px';
    pathRow.style.overflow = 'hidden';
    pathRow.style.textOverflow = 'ellipsis';
    pathRow.style.whiteSpace = 'nowrap';
    pathRow.style.maxWidth = '460px';

    infoCol.appendChild(nameRow);
    infoCol.appendChild(metaRow);
    infoCol.appendChild(pathRow);

    const actionsCol = document.createElement('div');
    actionsCol.style.display = 'flex';
    actionsCol.style.gap = '8px';
    actionsCol.style.alignItems = 'center';
    actionsCol.style.flexShrink = '0';

    const openBtn = this.createButton(
      t('editor.showLibrary.recentScriptsOpen') || 'Open',
      'primary'
    );
    openBtn.className = 'recent-script-open-btn';
    openBtn.addEventListener('click', () => {
      this.handleOpenRecentScript(item);
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'recent-script-remove-btn';
    removeBtn.textContent = '×';
    removeBtn.title =
      t('editor.showLibrary.recentScriptsRemove') || 'Remove from recent';
    removeBtn.style.background = 'transparent';
    removeBtn.style.border = '1px solid rgba(255, 255, 255, 0.15)';
    removeBtn.style.color = '#94a3b8';
    removeBtn.style.borderRadius = '4px';
    removeBtn.style.width = '28px';
    removeBtn.style.height = '28px';
    removeBtn.style.cursor = 'pointer';
    removeBtn.style.display = 'inline-flex';
    removeBtn.style.alignItems = 'center';
    removeBtn.style.justifyContent = 'center';
    removeBtn.style.fontSize = '16px';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleRemoveRecentScript(item);
    });

    actionsCol.appendChild(openBtn);
    actionsCol.appendChild(removeBtn);

    card.appendChild(infoCol);
    card.appendChild(actionsCol);
    return card;
  }

  async handleOpenRecentScript(item) {
    try {
      const fileData = await fileStorage.readScriptFile(item.filePath);
      if (!fileData) {
        this.handleMissingRecentScript(item);
        return;
      }
      const loaded = await this.timelineEditor.loadShowFromFileData(
        fileData,
        {
          silentSuccess: true,
          resetPlaybackPosition: true
        }
      );
      if (loaded) {
        showToast(
          t(
            'editor.showLibrary.loadedToast',
            { filename: fileData.filename || item.filename }
          ) || `Loaded script: ${fileData.filename || item.filename}`,
          'success'
        );
        this.close();
      }
    } catch (err) {
      await this.handleMissingRecentScript(item, err);
    }
  }

  async handleMissingRecentScript(item, err = null) {
    const promptMsg =
      t(
        'editor.showLibrary.recentFileNotFoundPrompt',
        { filename: item.filename || item.filePath }
      ) ||
      `Cannot open ${item.filename || item.filePath}. The file may have been moved or deleted. Do you want to remove it from recent scripts?`;

    const shouldRemove = await customConfirm(promptMsg);

    if (shouldRemove) {
      removeRecentScript(item.filePath);
      this.updateRecentCountBadge();
      this.renderRecentScriptsView();
    }

    showToast(
      err
        ? err.message
        : (t('editor.showLibrary.loadError', { error: 'File not found' }) ||
          'File not found'),
      'error'
    );
  }

  handleRemoveRecentScript(item) {
    removeRecentScript(item.filePath);
    this.updateRecentCountBadge();
    this.renderRecentScriptsView();
  }

  openDriveLink() {
    if (
      this.timelineEditor &&
      typeof this.timelineEditor.openScriptsDrive === 'function'
    ) {
      this.timelineEditor.openScriptsDrive();
      return;
    }
    fileStorage.openExternal(DOCS_CONFIG.scriptsDriveUrl);
    globalEventBus.emit('onboarding:drive-opened');
  }

  handleOpenSingleFile() {
    if (
      this.timelineEditor &&
      typeof this.timelineEditor.openSingleScriptFile === 'function'
    ) {
      this.timelineEditor.openSingleScriptFile();
    }
  }

  onShowLoaded() {
    if (this.isVisible) {
      this.close();
    }
  }

  async open(preferredTab = null) {
    this.initDOM();
    this.isVisible = true;
    this.overlay.style.display = 'flex';
    window.addEventListener(
      'keydown',
      this.onKeyDown
    );
    globalEventBus.on(
      'timeline:show-loaded',
      this.onShowLoaded
    );
    this.updateFolderLabel();
    this.updateRecentCountBadge();

    const recentScripts = getRecentScripts();
    const defaultTab = preferredTab ||
      (recentScripts.length > 0 ? 'recent' : 'folder');
    this.switchTab(defaultTab);
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
    globalEventBus.off(
      'timeline:show-loaded',
      this.onShowLoaded
    );
    globalEventBus.emit('show-library:closed');
  }

  onKeyDown(e) {
    if (this.isVisible && e.key === 'Escape') {
      this.close();
    }
  }

  updateFolderLabel() {
    if (!this.folderPathEl) {
      return;
    }
    if (this.currentFolderPath) {
      this.folderPathEl.textContent =
        t(
          'editor.showLibrary.currentFolderLabel',
          { path: this.currentFolderPath }
        ) || `Current folder: ${this.currentFolderPath}`;
    } else {
      this.folderPathEl.textContent =
        t('editor.showLibrary.noFolderSelected') ||
        'No folder selected yet';
    }
  }

  async handleSelectFolder() {
    try {
      const folderPath = await fileStorage.selectScriptsFolder();
      if (!folderPath) {
        return;
      }
      this.saveFolderPath(folderPath);
      this.updateFolderLabel();
      await this.rescanCurrentFolder();
    } catch (err) {
      showToast(
        t(
          'editor.showLibrary.loadError',
          { error: err.message }
        ) || `Failed to load script: ${err.message}`,
        'error'
      );
    }
  }

  async rescanCurrentFolder() {
    if (!this.currentFolderPath) {
      if (!fileStorage.isElectron) {
        await this.handleSelectFolder();
        return;
      }
      this.renderEmptyPrompt();
      return;
    }

    const result = await fileStorage.scanScriptsFolder(this.currentFolderPath);
    this.lastScanResult = result;

    if (!result || !result.exists) {
      this.renderEmptyPrompt();
      globalEventBus.emit(
        'scripts:folder-scanned',
        {
          folderPath: this.currentFolderPath,
          count: 0,
          archiveCount: 0
        }
      );
      return;
    }

    this.renderScanResult(result);
    globalEventBus.emit(
      'scripts:folder-scanned',
      {
        folderPath: result.folderPath,
        count: result.scripts.length,
        archiveCount: result.archiveFiles.length
      }
    );
  }

  renderEmptyPrompt() {
    if (!this.listContainer) {
      return;
    }
    this.listContainer.innerHTML = '';

    const box = this.createEmptyStateBox(
      t('editor.showLibrary.emptyPromptTitle') || 'Load Your Scripts Folder',
      t('editor.showLibrary.emptyPromptDesc') ||
        'Download show packages from Google Drive, extract them if needed, and select the folder here.'
    );
    this.listContainer.appendChild(box);
  }

  createEmptyStateBox(title, desc) {
    const box = document.createElement('div');
    box.style.padding = '28px 20px';
    box.style.textAlign = 'center';
    box.style.border = '1px dashed rgba(255, 255, 255, 0.18)';
    box.style.borderRadius = '6px';
    box.style.background = 'rgba(255, 255, 255, 0.02)';

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.fontSize = '14px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = '#ffffff';
    titleEl.style.marginBottom = '8px';

    const descEl = document.createElement('div');
    descEl.textContent = desc;
    descEl.style.fontSize = '13px';
    descEl.style.color = '#94a3b8';
    descEl.style.lineHeight = '1.5';

    box.appendChild(titleEl);
    box.appendChild(descEl);
    return box;
  }

  renderScanResult(result) {
    if (!this.listContainer) {
      return;
    }
    this.listContainer.innerHTML = '';

    const {
      scripts,
      archiveFiles,
      folderPath
    } = result;

    if (scripts.length === 0 && archiveFiles.length > 0) {
      const box = this.createEmptyStateBox(
        t('editor.showLibrary.archiveDetectedTitle') ||
          'Archive File Detected',
        t('editor.showLibrary.archiveDetectedDesc') ||
          'Found compressed archives in this folder without extracted scripts. Please extract the archive first, then click Rescan.'
      );
      if (fileStorage.isElectron && folderPath) {
        const openBtn = this.createButton(
          t('editor.showLibrary.openFolderBtn') || 'Open Folder',
          'primary'
        );
        openBtn.style.marginTop = '14px';
        openBtn.addEventListener('click', () => {
          fileStorage.openFolderInExplorer(folderPath);
        });
        box.appendChild(openBtn);
      }
      this.listContainer.appendChild(box);
      return;
    }

    if (scripts.length === 0) {
      const box = this.createEmptyStateBox(
        t('editor.showLibrary.noScriptsTitle') || 'No Show Scripts Found',
        t('editor.showLibrary.noScriptsDesc') ||
          'No valid show script JSON files were found in this folder. Download scripts from Drive or choose another folder.'
      );
      this.listContainer.appendChild(box);
      return;
    }

    scripts.forEach((script) => {
      const card = this.createScriptCard(script);
      this.listContainer.appendChild(card);
    });
  }

  createScriptCard(script) {
    const card = document.createElement('div');
    card.className = 'show-library-script-card';
    card.style.display = 'flex';
    card.style.justifyContent = 'space-between';
    card.style.alignItems = 'center';
    card.style.gap = '12px';
    card.style.padding = '12px 14px';
    card.style.background = 'rgba(255, 255, 255, 0.04)';
    card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    card.style.borderRadius = '6px';

    const infoCol = document.createElement('div');
    infoCol.style.flex = '1 1 auto';
    infoCol.style.minWidth = '0';

    const nameRow = document.createElement('div');
    nameRow.textContent = script.filename;
    nameRow.style.fontSize = '14px';
    nameRow.style.fontWeight = '600';
    nameRow.style.color = '#ffffff';
    nameRow.style.overflow = 'hidden';
    nameRow.style.textOverflow = 'ellipsis';
    nameRow.style.whiteSpace = 'nowrap';

    const metaRow = document.createElement('div');
    metaRow.style.display = 'flex';
    metaRow.style.flexWrap = 'wrap';
    metaRow.style.gap = '10px';
    metaRow.style.marginTop = '4px';
    metaRow.style.fontSize = '11px';
    metaRow.style.color = '#94a3b8';

    if (script.folderName) {
      const folderBadge = document.createElement('span');
      folderBadge.textContent = script.folderName;
      folderBadge.style.color = '#00e5ff';
      metaRow.appendChild(folderBadge);
    }

    const eventsSpan = document.createElement('span');
    eventsSpan.textContent =
      t(
        'editor.showLibrary.eventsCount',
        { count: script.eventCount }
      ) || `${script.eventCount} events`;
    metaRow.appendChild(eventsSpan);

    const durSpan = document.createElement('span');
    durSpan.textContent =
      t(
        'editor.showLibrary.durationLabel',
        { seconds: Math.round(script.duration || 0) }
      ) || `${Math.round(script.duration || 0)}s`;
    metaRow.appendChild(durSpan);

    const audioSpan = document.createElement('span');
    if (script.hasAudio) {
      audioSpan.textContent = script.companionAudioReady
        ? (t('editor.showLibrary.audioReady') || 'Audio ready')
        : (t('editor.showLibrary.audioMissing') || 'Audio missing');
      audioSpan.style.color = script.companionAudioReady
        ? '#4ade80'
        : '#fbbf24';
    } else {
      audioSpan.textContent =
        t('editor.showLibrary.noAudioTrack') || 'No audio track';
    }
    metaRow.appendChild(audioSpan);

    infoCol.appendChild(nameRow);
    infoCol.appendChild(metaRow);

    const importBtn = this.createButton(
      t('editor.showLibrary.importBtn') || 'Import',
      'primary'
    );
    importBtn.className = 'show-library-import-btn';
    importBtn.addEventListener('click', () => {
      this.handleImportScript(script);
    });

    card.appendChild(infoCol);
    card.appendChild(importBtn);
    return card;
  }

  async handleImportScript(script) {
    try {
      const fileData = await fileStorage.readScriptFile(script.filePath);
      if (!fileData) {
        return;
      }
      const loaded = await this.timelineEditor.loadShowFromFileData(
        fileData,
        {
          silentSuccess: true,
          resetPlaybackPosition: true
        }
      );
      if (loaded) {
        showToast(
          t(
            'editor.showLibrary.loadedToast',
            { filename: fileData.filename }
          ) || `Loaded script: ${fileData.filename}`,
          'success'
        );
        this.close();
      }
    } catch (err) {
      showToast(
        t(
          'editor.showLibrary.loadError',
          { error: err.message }
        ) || `Failed to load script: ${err.message}`,
        'error'
      );
    }
  }
}
