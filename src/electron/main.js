import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  shell,
  protocol,
  net
} from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupAutoUpdater } from './updater.js';
import {
  scanPresetBundles,
  savePresetBundle,
  deletePresetBundle,
  seedDirectoryRecursively
} from './presetStorage.js';
import {
  scanPatterns,
  savePattern,
  deletePattern
} from './patternStorage.js';
import { registerRecordingHandlers } from './recordingHandlers.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
      bypassCSP: true
    }
  }
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;

app.name = 'FDShowStudio';
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
if (isDev) {
  try {
    app.setPath('userData', path.join(app.getPath('appData'), 'FDShowStudio-Dev'));
  } catch {}
}

let mainWindow = null;
let updaterController = null;

// Resolve data and preset directories
export function resolveDataDir() {
  if (isDev) {
    return path.resolve(__dirname, '../../data');
  }
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    return path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'data');
  }
  const exeDir = path.dirname(app.getPath('exe'));
  try {
    fs.accessSync(exeDir, fs.constants.W_OK);
    return path.join(exeDir, 'data');
  } catch {
    return path.join(app.getPath('userData'), 'data');
  }
}

export function getPresetsDir() {
  const dataDir = resolveDataDir();
  const presetsDir = path.join(dataDir, 'presets');
  if (!fs.existsSync(presetsDir)) {
    fs.mkdirSync(presetsDir, { recursive: true });
  }
  return presetsDir;
}

export function getPatternsDir() {
  const dataDir = resolveDataDir();
  const patternsDir = path.join(dataDir, 'patterns');
  if (!fs.existsSync(patternsDir)) {
    fs.mkdirSync(patternsDir, { recursive: true });
  }
  return patternsDir;
}

// Resolve the sequences directory path safely
const sequencesDir = isDev
  ? path.resolve(__dirname, '../../src/config/sequences')
  : path.join(app.getPath('userData'), 'sequences');

// Ensure sequences directory exists
if (!fs.existsSync(sequencesDir)) {
  fs.mkdirSync(sequencesDir, { recursive: true });
}

// Migrate legacy userData sequences and seed default sequences in production
if (!isDev) {
  try {
    const legacySequencesDir = path.join(
      app.getPath('appData'),
      'shell-drone-animation',
      'sequences'
    );
    if (fs.existsSync(legacySequencesDir)) {
      const legacyFiles = fs.readdirSync(legacySequencesDir);
      for (const file of legacyFiles) {
        const destPath = path.join(sequencesDir, file);
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(
            path.join(legacySequencesDir, file),
            destPath
          );
        }
      }
    }

    // In prod, main.js is at src/electron/main.js in ASAR, but resources are in resources/app/
    const defaultSequencesDir = path.resolve(__dirname, '../config/sequences');
    if (fs.existsSync(defaultSequencesDir)) {
      const files = fs.readdirSync(defaultSequencesDir);
      for (const file of files) {
        const destPath = path.join(sequencesDir, file);
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(path.join(defaultSequencesDir, file), destPath);
        }
      }
    }

    seedDataDir();
  } catch (err) {
    console.error('Failed to seed default sequences in production:', err);
  }
}

export { seedDirectoryRecursively };

export function seedDataDir() {
  if (isDev) {
    return;
  }
  try {
    const bundledDataDir = path.join(process.resourcesPath, 'data');
    const targetDataDir = resolveDataDir();
    if (fs.existsSync(bundledDataDir) && path.resolve(bundledDataDir) !== path.resolve(targetDataDir)) {
      seedDirectoryRecursively(bundledDataDir, targetDataDir);
    }

    // Safety backup sync: if targetDataDir is not userData, sync user presets between target and userData backup
    const userDataDataDir = path.join(app.getPath('userData'), 'data');
    if (path.resolve(targetDataDir) !== path.resolve(userDataDataDir)) {
      const userDataPresets = path.join(userDataDataDir, 'presets');
      const targetPresets = path.join(targetDataDir, 'presets');
      // 1. Restore any missing presets from userData backup to target
      if (fs.existsSync(userDataPresets)) {
        seedDirectoryRecursively(userDataPresets, targetPresets);
      }
      // 2. Mirror any presets from target to userData backup
      if (fs.existsSync(targetPresets)) {
        seedDirectoryRecursively(targetPresets, userDataPresets);
      }
    }
  } catch (err) {
    console.error('Failed to seed data directory in production:', err);
  }
}

export function syncUserDataPresetBackup(targetPresetsDir, slug) {
  if (isDev || !slug) {
    return;
  }
  try {
    const userDataPresets = path.join(app.getPath('userData'), 'data', 'presets');
    if (path.resolve(targetPresetsDir) === path.resolve(userDataPresets)) {
      return;
    }
    const safeSlug = path.basename(slug);
    const srcBundle = path.join(targetPresetsDir, safeSlug);
    const dstBundle = path.join(userDataPresets, safeSlug);
    if (fs.existsSync(srcBundle)) {
      seedDirectoryRecursively(srcBundle, dstBundle);
    }
  } catch (err) {
    console.error('Error syncing user preset backup:', err);
  }
}

export function deleteUserDataPresetBackup(targetPresetsDir, slug) {
  if (isDev || !slug) {
    return;
  }
  try {
    const userDataPresets = path.join(app.getPath('userData'), 'data', 'presets');
    if (path.resolve(targetPresetsDir) === path.resolve(userDataPresets)) {
      return;
    }
    const safeSlug = path.basename(slug);
    const dstBundle = path.join(userDataPresets, safeSlug);
    if (fs.existsSync(dstBundle)) {
      fs.rmSync(dstBundle, {
        recursive: true,
        force: true
      });
    }
  } catch (err) {
    console.error('Error deleting user preset backup:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: 'FDShowStudio',
    backgroundColor: '#1a1a1a',
    icon: path.join(__dirname, '../../public/icon2.ico'),
  });

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open / Import...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-action', 'open');
            }
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-action', 'save');
            }
          }
        },
        {
          type: 'separator'
        },
        {
          label: 'Export All Sequences...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-action', 'export-all');
            }
          }
        },
        {
          label: 'Export Selected Sequences...',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-action', 'export-selected');
            }
          }
        },
        {
          type: 'separator'
        },
        {
          role: 'quit',
          label: 'Quit'
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo', label: 'Undo' },
        { role: 'redo', label: 'Redo' },
        { type: 'separator' },
        { role: 'cut', label: 'Cut' },
        { role: 'copy', label: 'Copy' },
        { role: 'paste', label: 'Paste' },
        { role: 'delete', label: 'Delete' },
        { type: 'separator' },
        { role: 'selectAll', label: 'Select All' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload', label: 'Reload' },
        { role: 'forceReload', label: 'Force Reload' },
        { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Actual Size' },
        { role: 'zoomIn', label: 'Zoom In' },
        { role: 'zoomOut', label: 'Zoom Out' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Toggle Full Screen' },
        { type: 'separator' },
        {
          label: 'Language / Ngôn ngữ',
          submenu: [
            {
              label: 'Tiếng Việt',
              type: 'radio',
              click: () => {
                if (mainWindow) mainWindow.webContents.send('change-language', 'vi');
              }
            },
            {
              label: 'English',
              type: 'radio',
              click: () => {
                if (mainWindow) mainWindow.webContents.send('change-language', 'en');
              }
            },
            {
              label: '简体中文 (Chinese)',
              type: 'radio',
              click: () => {
                if (mainWindow) mainWindow.webContents.send('change-language', 'zh');
              }
            },
            {
              label: '日本語 (Japanese)',
              type: 'radio',
              click: () => {
                if (mainWindow) mainWindow.webContents.send('change-language', 'ja');
              }
            }
          ]
        }
      ]
    },
    {
      label: 'Editor Screens',
      submenu: [
        {
          label: '1. Fireworks Display (Timeline Editor)',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            if (mainWindow) {
              const currentUrl = mainWindow.webContents.getURL();
              if (isDev && currentUrl.startsWith('http')) {
                const base = new URL(currentUrl).origin;
                mainWindow.loadURL(`${base}/index.html`);
              } else {
                mainWindow.loadURL(`file://${path.join(__dirname, '../../dist/index.html')}`);
              }
            }
          }
        },
        {
          label: '2. Advanced Drone Editor (Animated)',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            if (mainWindow) {
              const currentUrl = mainWindow.webContents.getURL();
              if (isDev && currentUrl.startsWith('http')) {
                const base = new URL(currentUrl).origin;
                mainWindow.loadURL(`${base}/editor.html`);
              } else {
                mainWindow.loadURL(`file://${path.join(__dirname, '../../dist/editor.html')}`);
              }
            }
          }
        },
        {
          label: '3. Static Formation Designer',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            if (mainWindow) {
              const currentUrl = mainWindow.webContents.getURL();
              if (isDev && currentUrl.startsWith('http')) {
                const base = new URL(currentUrl).origin;
                mainWindow.loadURL(`${base}/formation.html`);
              } else {
                mainWindow.loadURL(`file://${path.join(__dirname, '../../dist/formation.html')}`);
              }
            }
          }
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize', label: 'Minimize' },
        { role: 'zoom', label: 'Zoom' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close', label: 'Close' }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates...',
          click: () => {
            if (updaterController) {
              updaterController.checkForUpdates({
                manual: true
              });
            }
          }
        },
        {
          type: 'separator'
        },
        {
          label: `Version ${app.getVersion()}`,
          enabled: false
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // URL configuration depending on environment
  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Prevent mouse side buttons (back/forward) from triggering navigation and resetting the page
  mainWindow.on('app-command', (e, cmd) => {
    if (cmd === 'browser-backward' || cmd === 'browser-forward') {
      e.preventDefault();
    }
  });

  // Prevent keyboard navigation shortcuts (Alt + Left/Right, CmdOrCtrl + [/]) which some mouse drivers trigger
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      // Prevent Alt + Left Arrow (back) and Alt + Right Arrow (forward)
      if (input.alt && (input.key === 'ArrowLeft' || input.key === 'ArrowRight')) {
        event.preventDefault();
      }
      // Prevent CmdOrCtrl + [ (back) and CmdOrCtrl + ] (forward)
      if (input.control && (input.key === '[' || input.key === ']')) {
        event.preventDefault();
      }
      if (input.meta && (input.key === '[' || input.key === ']')) {
        event.preventDefault();
      }
    }
  });
}


// IPC Handlers for sequences management
ipcMain.handle('list-sequences', async () => {
  try {
    if (!fs.existsSync(sequencesDir)) {
      return [];
    }
    const files = fs.readdirSync(sequencesDir)
      .filter(file => file.endsWith('.json'));
    return files;
  } catch (err) {
    console.error('Error listing sequences:', err);
    throw err;
  }
});

ipcMain.handle('save-sequence', async (event, { filename, content }) => {
  try {
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
    if (!safeFilename.endsWith('.json')) {
      throw new Error('Filename must end with .json');
    }
    const filePath = path.join(sequencesDir, safeFilename);
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true, path: filePath };
  } catch (err) {
    console.error('Error saving sequence:', err);
    throw err;
  }
});

function findCompanionAudios(filePath, jsonContent) {
  try {
    const parsed = JSON.parse(jsonContent);
    if (!Array.isArray(parsed)) {
      return null;
    }
    const dir = path.dirname(filePath);
    const audioFiles = new Set();

    const collectAudioNames = (items) => {
      items.forEach((item) => {
        if (item && item.type === 'audio') {
          if (item.url) {
            audioFiles.add(item.url);
            audioFiles.add(path.basename(item.url));
          }
          if (item.name) {
            audioFiles.add(item.name);
            audioFiles.add(path.basename(item.name));
          }
        }
        if (item && item.type === 'group' && Array.isArray(item.children)) {
          collectAudioNames(item.children);
        }
      });
    };
    collectAudioNames(parsed);

    if (audioFiles.size === 0) {
      return null;
    }

    const filesInDir = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const companions = {};

    for (const name of audioFiles) {
      let resolvedPath = null;
      if (path.isAbsolute(name) && fs.existsSync(name)) {
        resolvedPath = name;
      } else {
        const candidate = path.join(dir, name);
        if (fs.existsSync(candidate)) {
          resolvedPath = candidate;
        } else {
          const baseCandidate = path.join(dir, path.basename(name));
          if (fs.existsSync(baseCandidate)) {
            resolvedPath = baseCandidate;
          } else {
            const baseLower = path.basename(name).toLowerCase();
            const found = filesInDir.find((f) => {
              return f.toLowerCase() === baseLower;
            });
            if (found) {
              resolvedPath = path.join(dir, found);
            }
          }
        }
      }

      if (resolvedPath && fs.existsSync(resolvedPath)) {
        const buffer = fs.readFileSync(resolvedPath);
        const ext = path.extname(resolvedPath).toLowerCase();
        let mimeType = 'audio/mpeg';
        if (ext === '.wav') {
          mimeType = 'audio/wav';
        } else if (ext === '.ogg') {
          mimeType = 'audio/ogg';
        }
        companions[name] = {
          buffer,
          mimeType
        };
        companions[path.basename(name)] = {
          buffer,
          mimeType
        };
      }
    }

    return Object.keys(companions).length > 0
      ? companions
      : null;
  } catch (err) {
    return null;
  }
}

function restoreWindowFocus(win) {
  if (!win || win.isDestroyed()) return;
  setTimeout(() => {
    if (win.isDestroyed()) return;
    win.blur();
    setTimeout(() => {
      if (win.isDestroyed()) return;
      win.focus();
      win.webContents.focus();
    }, 50);
  }, 50);
}

// IPC Handlers for native OS Dialogs (Notepad-style Direct Save)
ipcMain.handle('open-file-dialog', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    restoreWindowFocus(win);
    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf8');
      const filename = path.basename(filePath);
      const companionAudios = findCompanionAudios(
        filePath,
        content
      );
      return {
        filePath,
        content,
        filename,
        companionAudios
      };
    }
    return null;
  } catch (err) {
    console.error('Error opening file dialog:', err);
    throw err;
  }
});

ipcMain.handle('save-file-dialog', async (event, { content, defaultName }) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName || 'untitled.json',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    restoreWindowFocus(win);
    if (!result.canceled && result.filePath) {
      const filePath = result.filePath;
      fs.writeFileSync(filePath, content, 'utf8');
      const filename = path.basename(filePath);
      return { filePath, filename };
    }
    return null;
  } catch (err) {
    console.error('Error saving file dialog:', err);
    throw err;
  }
});

ipcMain.handle('save-file-absolute', async (event, { filePath, content }) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return { success: true };
  } catch (err) {
    console.error('Error writing absolute file path:', err);
    throw err;
  }
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    if (url && typeof url === 'string') {
      await shell.openExternal(url);
    }
  } catch (err) {
    console.error('Error opening external URL:', err);
  }
});

function inspectShowItems(items) {
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

function scanDirectoryForScripts(rootDir, maxDepth = 2) {
  const scripts = [];
  const archiveFiles = [];
  const archiveExts = new Set(['.zip', '.rar', '.7z']);

  const walkDir = (dirPath, depth) => {
    if (depth > maxDepth) {
      return;
    }
    let entries;
    try {
      entries = fs.readdirSync(
        dirPath,
        {
          withFileTypes: true
        }
      );
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(
        dirPath,
        entry.name
      );
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.')) {
          walkDir(
            fullPath,
            depth + 1
          );
        }
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      const relativePath = path.relative(
        rootDir,
        fullPath
      ).replace(/\\/g, '/');

      if (archiveExts.has(ext)) {
        archiveFiles.push({
          filename: entry.name,
          filePath: fullPath,
          relativePath
        });
        continue;
      }

      if (ext !== '.json') {
        continue;
      }

      try {
        const content = fs.readFileSync(
          fullPath,
          'utf8'
        );
        const parsed = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          continue;
        }
        const meta = inspectShowItems(parsed);
        const companions = meta.hasAudio
          ? findCompanionAudios(
            fullPath,
            content
          )
          : null;
        const folderRel = path.dirname(relativePath);
        scripts.push({
          filename: entry.name,
          filePath: fullPath,
          relativePath,
          folderName: folderRel === '.' ? '' : folderRel,
          eventCount: parsed.length,
          duration: meta.duration,
          hasAudio: meta.hasAudio,
          companionAudioReady: Boolean(companions)
        });
      } catch (err) {
        // Ignore non-show or malformed JSON files in user folder
      }
    }
  };

  walkDir(
    rootDir,
    0
  );
  scripts.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return {
    scripts,
    archiveFiles
  };
}

ipcMain.handle('select-scripts-folder', async (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showOpenDialog(
      win,
      {
        properties: ['openDirectory']
      }
    );
    restoreWindowFocus(win);
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (err) {
    console.error('Error selecting scripts folder:', err);
    throw err;
  }
});

ipcMain.handle('scan-scripts-folder', async (_event, folderPath) => {
  try {
    if (!folderPath || typeof folderPath !== 'string') {
      return {
        folderPath: '',
        exists: false,
        scripts: [],
        archiveFiles: []
      };
    }
    const exists = fs.existsSync(folderPath) &&
      fs.statSync(folderPath).isDirectory();
    if (!exists) {
      return {
        folderPath,
        exists: false,
        scripts: [],
        archiveFiles: []
      };
    }
    const {
      scripts,
      archiveFiles
    } = scanDirectoryForScripts(folderPath);
    return {
      folderPath,
      exists: true,
      scripts,
      archiveFiles
    };
  } catch (err) {
    console.error('Error scanning scripts folder:', err);
    throw err;
  }
});

ipcMain.handle('read-script-file', async (_event, filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return null;
    }
    const content = fs.readFileSync(
      filePath,
      'utf8'
    );
    const filename = path.basename(filePath);
    const companionAudios = findCompanionAudios(
      filePath,
      content
    );
    return {
      filePath,
      content,
      filename,
      companionAudios
    };
  } catch (err) {
    console.error('Error reading script file:', err);
    throw err;
  }
});

ipcMain.handle('open-folder-in-explorer', async (_event, folderPath) => {
  try {
    if (folderPath && fs.existsSync(folderPath)) {
      await shell.openPath(folderPath);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error opening folder in explorer:', err);
    return false;
  }
});

// Preset Bundle Storage IPC Handlers
ipcMain.handle('presets:scan', async () => {
  try {
    const presetsDir = getPresetsDir();
    return scanPresetBundles(presetsDir);
  } catch (err) {
    console.error('Error scanning presets:', err);
    return [];
  }
});

ipcMain.handle('presets:save', async (_event, payload) => {
  try {
    const presetsDir = getPresetsDir();
    const result = savePresetBundle(presetsDir, payload);
    syncUserDataPresetBackup(presetsDir, payload.slug || result.slug);
    return result;
  } catch (err) {
    console.error('Error saving preset:', err);
    throw err;
  }
});

ipcMain.handle('presets:delete', async (_event, slug) => {
  try {
    const presetsDir = getPresetsDir();
    const result = deletePresetBundle(presetsDir, slug);
    deleteUserDataPresetBackup(presetsDir, slug);
    return result;
  } catch (err) {
    console.error('Error deleting preset:', err);
    throw err;
  }
});

ipcMain.handle('presets:import-media', async (_event, { slug, mediaType }) => {
  try {
    const presetsDir = getPresetsDir();
    const safeSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const bundleDir = path.join(presetsDir, safeSlug);
    if (!fs.existsSync(bundleDir)) {
      fs.mkdirSync(bundleDir, { recursive: true });
    }

    const isVideo = mediaType === 'video';
    const filters = isVideo
      ? [{ name: 'Videos', extensions: ['mp4', 'webm'] }]
      : [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }];

    const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters
    });
    restoreWindowFocus(win);

    if (result.canceled || result.filePaths.length === 0) {
      return { canceled: true };
    }

    const srcPath = result.filePaths[0];
    const ext = path.extname(srcPath).toLowerCase();
    const destName = `${safeSlug}${ext}`;
    const destPath = path.join(bundleDir, destName);

    // Clean up older banners/videos with different extensions
    const oldExts = isVideo ? ['.mp4', '.webm'] : ['.png', '.jpg', '.jpeg', '.webp'];
    for (const oldExt of oldExts) {
      const candidate = path.join(bundleDir, `${safeSlug}${oldExt}`);
      if (candidate !== destPath && fs.existsSync(candidate)) {
        try { fs.unlinkSync(candidate); } catch {}
      }
    }

    fs.copyFileSync(srcPath, destPath);
    syncUserDataPresetBackup(presetsDir, safeSlug);
    const mediaUrl = `app-asset://presets/${encodeURIComponent(safeSlug)}/${encodeURIComponent(destName)}?t=${Date.now()}`;
    return {
      canceled: false,
      filename: destName,
      url: mediaUrl
    };
  } catch (err) {
    console.error('Error importing preset media:', err);
    throw err;
  }
});

ipcMain.handle('presets:open-folder', async (_event, slug) => {
  try {
    const presetsDir = getPresetsDir();
    let targetDir = presetsDir;
    if (slug) {
      const safeSlug = path.basename(slug);
      const sub = path.join(presetsDir, safeSlug);
      if (fs.existsSync(sub)) {
        targetDir = sub;
      }
    }
    await shell.openPath(targetDir);
    return true;
  } catch (err) {
    console.error('Error opening presets folder:', err);
    return false;
  }
});

ipcMain.handle('presets:get-path', async () => {
  return getPresetsDir();
});

// Sweep Pattern Library IPC Handlers
ipcMain.handle('patterns:scan', async () => {
  try {
    const patternsDir = getPatternsDir();
    return scanPatterns(patternsDir);
  } catch (err) {
    console.error('Error scanning patterns:', err);
    return [];
  }
});

ipcMain.handle('patterns:save', async (_event, payload) => {
  try {
    const patternsDir = getPatternsDir();
    return savePattern(patternsDir, payload);
  } catch (err) {
    console.error('Error saving pattern:', err);
    throw err;
  }
});

ipcMain.handle('patterns:delete', async (_event, slug) => {
  try {
    const patternsDir = getPatternsDir();
    return deletePattern(patternsDir, slug);
  } catch (err) {
    console.error('Error deleting pattern:', err);
    throw err;
  }
});

ipcMain.handle('patterns:get-path', async () => {
  return getPatternsDir();
});

registerRecordingHandlers({
  ipcMain,
  app,
  dialog,
  shell,
  getMainWindow: () => mainWindow
});


app.whenReady().then(() => {
  protocol.handle('app-asset', async (request) => {
    try {
      const url = new URL(request.url);
      const host = url.host;
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/')) {
        pathname = pathname.slice(1);
      }
      const fullRelativePath = host
        ? (pathname ? path.join(host, pathname) : host)
        : pathname;
      const dataRoot = path.resolve(resolveDataDir());
      let targetPath = path.resolve(dataRoot, fullRelativePath);
      if (!targetPath.startsWith(dataRoot)) {
        return new Response('Access Denied', {
          status: 403
        });
      }
      if (!fs.existsSync(targetPath)) {
        const fallbackDevPath = path.resolve(__dirname, '../../data', fullRelativePath);
        if (fs.existsSync(fallbackDevPath)) {
          targetPath = fallbackDevPath;
        } else {
          return new Response('Not Found', {
            status: 404
          });
        }
      }
      return net.fetch(`file:///${targetPath.replace(/\\/g, '/')}`);
    } catch {
      return new Response('Internal Error', {
        status: 500
      });
    }
  });

  updaterController = setupAutoUpdater({
    getMainWindow: () => mainWindow
  });

  createWindow();
  updaterController.scheduleStartupCheck();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
