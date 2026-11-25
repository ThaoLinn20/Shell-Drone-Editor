const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  listSequences: () => ipcRenderer.invoke('list-sequences'),
  saveSequence: (filename, content) => ipcRenderer.invoke('save-sequence', { filename, content }),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (content, defaultName) => ipcRenderer.invoke('save-file-dialog', { content, defaultName }),
  saveFileAbsolute: (filePath, content) => ipcRenderer.invoke('save-file-absolute', { filePath, content }),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  selectScriptsFolder: () => ipcRenderer.invoke('select-scripts-folder'),
  scanScriptsFolder: (folderPath) => ipcRenderer.invoke('scan-scripts-folder', folderPath),
  readScriptFile: (filePath) => ipcRenderer.invoke('read-script-file', filePath),
  openFolderInExplorer: (folderPath) => ipcRenderer.invoke('open-folder-in-explorer', folderPath),
  getUpdateState: () => ipcRenderer.invoke('updater:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('updater:quit-and-install'),
  onUpdateStatus: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('updater:status', handler);
    return () => {
      ipcRenderer.removeListener('updater:status', handler);
    };
  },
  onChangeLanguage: (callback) => ipcRenderer.on('change-language', (event, lang) => callback(lang)),
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action, data) => callback(action, data)),
  scanPresets: () => ipcRenderer.invoke('presets:scan'),
  savePreset: (payload) => ipcRenderer.invoke('presets:save', payload),
  deletePreset: (slug) => ipcRenderer.invoke('presets:delete', slug),
  importPresetMedia: (slug, mediaType) => ipcRenderer.invoke('presets:import-media', { slug, mediaType }),
  openPresetsFolder: (slug) => ipcRenderer.invoke('presets:open-folder', slug),
  getPresetsPath: () => ipcRenderer.invoke('presets:get-path'),
  scanPatterns: () => ipcRenderer.invoke('patterns:scan'),
  savePattern: (payload) => ipcRenderer.invoke('patterns:save', payload),
  deletePattern: (slug) => ipcRenderer.invoke('patterns:delete', slug),
  getPatternsPath: () => ipcRenderer.invoke('patterns:get-path')
});

// Prevent mouse side buttons (back/forward) from triggering navigation in the browser
window.addEventListener('mouseup', (e) => {
  if (e.button === 3 || e.button === 4) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

window.addEventListener('mousedown', (e) => {
  if (e.button === 3 || e.button === 4) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);
