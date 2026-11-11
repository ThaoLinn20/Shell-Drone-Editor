export class FileStorageAdapter {
  constructor() {
    this.isElectron = typeof window !== 'undefined' && !!window.electronAPI;
    this._webFolderFiles = new Map();
    this._webFolderScanResult = null;
  }

  async listSequences() {
    if (this.isElectron) {
      return await window.electronAPI.listSequences();
    }
    
    try {
      const res = await fetch('./api/list-sequences');
      if (res.ok) {
        const data = await res.json();
        return data.files || [];
      }
    } catch (err) {
      console.warn(
        'Failed to fetch from list-sequences dev API:',
        err
      );
    }

    const files = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('seq:')) {
        files.push(key.replace(
          'seq:',
          ''
        ) + '.json');
      }
    }
    return files;
  }

  async saveSequence(
    filename,
    content
  ) {
    if (this.isElectron) {
      return await window.electronAPI.saveSequence(
        filename,
        content
      );
    }

    try {
      const res = await fetch(
        './api/save-sequence',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename,
            content
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        return data.success;
      }
    } catch (err) {
      console.warn(
        'Failed to save sequence to dev API:',
        err
      );
    }

    localStorage.setItem(
      `seq:${filename.replace(
        '.json',
        ''
      )}`,
      content
    );
    return true;
  }

  async openFileDialog() {
    if (this.isElectron) {
      return await window.electronAPI.openFileDialog();
    }

    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          resolve({
            content: event.target.result,
            filename: file.name,
            filePath: null
          });
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  async saveFileDialog(
    content,
    defaultName
  ) {
    if (this.isElectron) {
      return await window.electronAPI.saveFileDialog(
        content,
        defaultName
      );
    }

    try {
      const blob = new Blob(
        [content],
        {
          type: 'application/json'
        }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return {
        success: true,
        filePath: defaultName
      };
    } catch (err) {
      console.error(
        'Failed to trigger web file download:',
        err
      );
      return {
        success: false
      };
    }
  }

  async saveFileAbsolute(
    filePath,
    content
  ) {
    if (this.isElectron) {
      return await window.electronAPI.saveFileAbsolute(
        filePath,
        content
      );
    }

    if (filePath) {
      localStorage.setItem(
        `seq:${filePath}`,
        content
      );
      return true;
    }
    return false;
  }

  openExternal(url) {
    if (!url || typeof url !== 'string') {
      return;
    }
    if (
      this.isElectron &&
      typeof window.electronAPI.openExternal === 'function'
    ) {
      window.electronAPI.openExternal(url);
      return;
    }
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );
    }
  }

  async selectScriptsFolder() {
    if (
      this.isElectron &&
      typeof window.electronAPI.selectScriptsFolder === 'function'
    ) {
      return await window.electronAPI.selectScriptsFolder();
    }
    const scanResult = await this._pickWebDirectory();
    return scanResult ? scanResult.folderPath : null;
  }

  async scanScriptsFolder(folderPath) {
    if (
      this.isElectron &&
      typeof window.electronAPI.scanScriptsFolder === 'function'
    ) {
      return await window.electronAPI.scanScriptsFolder(folderPath);
    }
    if (
      this._webFolderScanResult &&
      this._webFolderScanResult.folderPath === folderPath
    ) {
      return this._webFolderScanResult;
    }
    return {
      folderPath: folderPath || '',
      exists: false,
      scripts: [],
      archiveFiles: []
    };
  }

  async readScriptFile(filePath) {
    if (
      this.isElectron &&
      typeof window.electronAPI.readScriptFile === 'function'
    ) {
      return await window.electronAPI.readScriptFile(filePath);
    }
    const file = this._webFolderFiles.get(filePath);
    if (!file) {
      return null;
    }
    const content = await file.text();
    const companionAudios = await this._collectWebCompanionAudios(
      filePath,
      content
    );
    return {
      filePath: null,
      content,
      filename: file.name,
      companionAudios
    };
  }

  async openFolderInExplorer(folderPath) {
    if (
      this.isElectron &&
      typeof window.electronAPI.openFolderInExplorer === 'function'
    ) {
      return await window.electronAPI.openFolderInExplorer(folderPath);
    }
    return false;
  }

  async _pickWebDirectory() {
    if (typeof document === 'undefined') {
      return null;
    }
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.setAttribute(
        'webkitdirectory',
        ''
      );
      input.multiple = true;
      input.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) {
          resolve(null);
          return;
        }
        this._webFolderFiles.clear();
        const firstRel = files[0].webkitRelativePath || files[0].name;
        const rootName = firstRel.includes('/')
          ? firstRel.split('/')[0]
          : 'Selected Folder';
        const scripts = [];
        const archiveFiles = [];
        const archiveExts = new Set(['.zip', '.rar', '.7z']);

        for (const file of files) {
          const relPath = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
          this._webFolderFiles.set(
            relPath,
            file
          );
          const lower = file.name.toLowerCase();
          const dotIdx = lower.lastIndexOf('.');
          const ext = dotIdx >= 0 ? lower.slice(dotIdx) : '';
          if (archiveExts.has(ext)) {
            archiveFiles.push({
              filename: file.name,
              filePath: relPath,
              relativePath: relPath
            });
            continue;
          }
          if (ext !== '.json') {
            continue;
          }
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
              continue;
            }
            const meta = this._inspectShowItems(parsed);
            const hasAudioMatch = meta.hasAudio
              ? this._hasWebCompanionAudio(
                relPath,
                text
              )
              : false;
            const strippedRel = relPath.startsWith(`${rootName}/`)
              ? relPath.slice(rootName.length + 1)
              : relPath;
            const slashIdx = strippedRel.lastIndexOf('/');
            scripts.push({
              filename: file.name,
              filePath: relPath,
              relativePath: strippedRel,
              folderName: slashIdx > 0 ? strippedRel.slice(0, slashIdx) : '',
              eventCount: parsed.length,
              duration: meta.duration,
              hasAudio: meta.hasAudio,
              companionAudioReady: hasAudioMatch
            });
          } catch (err) {
            // Ignore unrelated or malformed JSON
          }
        }

        scripts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
        const scanResult = {
          folderPath: rootName,
          exists: true,
          scripts,
          archiveFiles
        };
        this._webFolderScanResult = scanResult;
        resolve(scanResult);
      };
      input.click();
    });
  }

  _inspectShowItems(items) {
    let maxEnd = 0;
    let hasAudio = false;
    const walk = (list, baseOffset = 0) => {
      list.forEach((item) => {
        if (!item || typeof item !== 'object') {
          return;
        }
        const start = baseOffset + (Number(item.time) || Number(item.timeOffset) || 0);
        const dur = Number(item.duration) || 0;
        if (start + dur > maxEnd) {
          maxEnd = start + dur;
        }
        if (item.type === 'audio') {
          hasAudio = true;
        }
        if (item.type === 'group' && Array.isArray(item.children)) {
          walk(
            item.children,
            start
          );
        }
      });
    };
    walk(items);
    return {
      duration: maxEnd,
      hasAudio
    };
  }

  _extractAudioNames(jsonContent) {
    const names = new Set();
    try {
      const parsed = JSON.parse(jsonContent);
      if (!Array.isArray(parsed)) {
        return names;
      }
      const collect = (items) => {
        items.forEach((item) => {
          if (item && item.type === 'audio') {
            if (item.url) {
              names.add(item.url);
              names.add(item.url.split(/[\\/]/).pop());
            }
            if (item.name) {
              names.add(item.name);
              names.add(item.name.split(/[\\/]/).pop());
            }
          }
          if (item && item.type === 'group' && Array.isArray(item.children)) {
            collect(item.children);
          }
        });
      };
      collect(parsed);
    } catch (err) {
      return names;
    }
    return names;
  }

  _resolveWebAudioFile(scriptRelPath, audioName) {
    const lastSlash = scriptRelPath.lastIndexOf('/');
    const dirPrefix = lastSlash >= 0 ? scriptRelPath.slice(0, lastSlash + 1) : '';
    const baseName = audioName.split(/[\\/]/).pop().toLowerCase();
    const direct = this._webFolderFiles.get(`${dirPrefix}${audioName}`);
    if (direct) {
      return direct;
    }
    for (const [relPath, file] of this._webFolderFiles.entries()) {
      if (relPath.startsWith(dirPrefix) && file.name.toLowerCase() === baseName) {
        return file;
      }
    }
    return null;
  }

  _hasWebCompanionAudio(scriptRelPath, jsonContent) {
    const names = this._extractAudioNames(jsonContent);
    for (const name of names) {
      if (this._resolveWebAudioFile(scriptRelPath, name)) {
        return true;
      }
    }
    return false;
  }

  async _collectWebCompanionAudios(scriptRelPath, jsonContent) {
    const names = this._extractAudioNames(jsonContent);
    const companions = {};
    for (const name of names) {
      const file = this._resolveWebAudioFile(
        scriptRelPath,
        name
      );
      if (file) {
        const buffer = await file.arrayBuffer();
        const mimeType = file.type || 'audio/mpeg';
        companions[name] = {
          buffer,
          mimeType
        };
        companions[file.name] = {
          buffer,
          mimeType
        };
      }
    }
    return Object.keys(companions).length > 0 ? companions : null;
  }

  onChangeLanguage(callback) {
    if (this.isElectron && window.electronAPI && window.electronAPI.onChangeLanguage) {
      window.electronAPI.onChangeLanguage(callback);
    }
  }

  onMenuAction(callback) {
    if (this.isElectron && window.electronAPI && window.electronAPI.onMenuAction) {
      window.electronAPI.onMenuAction(callback);
    }
  }
}

export const fileStorage = new FileStorageAdapter();
