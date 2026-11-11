import { t } from '../config/lang/i18n.js';
import { DOCS_CONFIG } from '../config/docs.js';
import { fileStorage } from '../core/FileStorageAdapter.js';
import { globalEventBus } from '../core/EventBus.js';
import { showToast } from '../utils/Toast.js';
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

    // Controls Bar
    const controls = document.createElement('div');
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

  async open() {
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

    if (this.currentFolderPath) {
      await this.rescanCurrentFolder();
    } else {
      this.renderEmptyPrompt();
    }
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
