import {
  app,
  ipcMain
} from 'electron';
import pkg from 'electron-updater';

const { autoUpdater } = pkg;

/**
 * Normalize release notes from electron-updater into a concise plain-text string.
 */
export function formatReleaseNotes(releaseNotes) {
  if (!releaseNotes) {
    return '';
  }

  let rawText = '';
  if (typeof releaseNotes === 'string') {
    rawText = releaseNotes;
  } else if (Array.isArray(releaseNotes)) {
    rawText = releaseNotes
      .map((entry) => {
        if (!entry) {
          return '';
        }
        return typeof entry === 'string'
          ? entry
          : (entry.note || '');
      })
      .filter(Boolean)
      .join(' ');
  }

  const stripped = rawText
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripped.length <= 220) {
    return stripped;
  }

  return `${stripped.slice(0, 217)}...`;
}

/**
 * Initialize Electron auto-updater lifecycle, state tracking, and IPC bridge.
 */
export function setupAutoUpdater({
  getMainWindow,
  autoCheckDelayMs = 3000
}) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  let startupTimer = null;

  const updateState = {
    status: 'idle',
    currentVersion: app.getVersion(),
    version: null,
    releaseNotes: '',
    releaseDate: null,
    percent: 0,
    bytesPerSecond: 0,
    transferred: 0,
    total: 0,
    error: null,
    manual: false
  };

  const getSnapshot = () => {
    return {
      ...updateState
    };
  };

  const broadcastState = () => {
    const win = typeof getMainWindow === 'function'
      ? getMainWindow()
      : null;
    if (win && !win.isDestroyed()) {
      win.webContents.send(
        'updater:status',
        getSnapshot()
      );
    }
  };

  const setState = (patch) => {
    Object.assign(updateState, patch);
    broadcastState();
  };

  autoUpdater.on('checking-for-update', () => {
    setState({
      status: 'checking',
      error: null
    });
  });

  autoUpdater.on('update-available', (info) => {
    setState({
      status: 'available',
      version: info?.version || null,
      releaseNotes: formatReleaseNotes(info?.releaseNotes),
      releaseDate: info?.releaseDate || null,
      percent: 0,
      error: null
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    setState({
      status: 'not-available',
      version: info?.version || updateState.currentVersion,
      error: null
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    setState({
      status: 'downloading',
      percent: Math.max(
        0,
        Math.min(100, Number(progress?.percent || 0))
      ),
      bytesPerSecond: Number(progress?.bytesPerSecond || 0),
      transferred: Number(progress?.transferred || 0),
      total: Number(progress?.total || 0),
      error: null
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    setState({
      status: 'downloaded',
      version: info?.version || updateState.version,
      releaseNotes: formatReleaseNotes(info?.releaseNotes) || updateState.releaseNotes,
      releaseDate: info?.releaseDate || updateState.releaseDate,
      percent: 100,
      error: null
    });
  });

  autoUpdater.on('error', (err) => {
    setState({
      status: 'error',
      error: err?.message || 'Unknown update error'
    });
  });

  const checkForUpdates = async ({ manual = false } = {}) => {
    if (!app.isPackaged) {
      if (manual) {
        setState({
          status: 'dev-mode',
          manual: true,
          error: null
        });
      }
      return getSnapshot();
    }

    if (
      updateState.status === 'checking' ||
      updateState.status === 'downloading'
    ) {
      updateState.manual = manual;
      broadcastState();
      return getSnapshot();
    }

    if (updateState.status === 'downloaded') {
      updateState.manual = manual;
      broadcastState();
      return getSnapshot();
    }

    updateState.manual = manual;
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      setState({
        status: 'error',
        error: err?.message || 'Failed to check for updates'
      });
    }
    return getSnapshot();
  };

  ipcMain.handle('updater:get-state', () => {
    return getSnapshot();
  });

  ipcMain.handle('updater:check', async () => {
    return checkForUpdates({ manual: true });
  });

  ipcMain.handle('updater:quit-and-install', () => {
    setImmediate(() => {
      autoUpdater.quitAndInstall(false, true);
    });
    return { started: true };
  });

  const scheduleStartupCheck = () => {
    if (!app.isPackaged) {
      return;
    }
    if (startupTimer) {
      clearTimeout(startupTimer);
    }
    startupTimer = setTimeout(() => {
      checkForUpdates({ manual: false });
    }, autoCheckDelayMs);
  };

  return {
    checkForUpdates,
    scheduleStartupCheck,
    getSnapshot
  };
}

