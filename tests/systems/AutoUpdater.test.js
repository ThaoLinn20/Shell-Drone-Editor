import {
  describe,
  it,
  expect,
  vi,
  beforeEach
} from 'vitest';
import { EventEmitter } from 'events';

const mockApp = {
  isPackaged: true,
  getVersion: vi.fn(() => '3.3.1')
};

const ipcHandlers = {};
const mockIpcMain = {
  handle: vi.fn((channel, handler) => {
    ipcHandlers[channel] = handler;
  })
};

class MockAutoUpdater extends EventEmitter {
  constructor() {
    super();
    this.autoDownload = false;
    this.autoInstallOnAppQuit = false;
    this.allowPrerelease = true;
    this.checkForUpdates = vi.fn().mockResolvedValue({});
    this.quitAndInstall = vi.fn();
  }
}

const mockAutoUpdater = new MockAutoUpdater();

vi.mock('electron', () => ({
  app: mockApp,
  ipcMain: mockIpcMain
}));

vi.mock('electron-updater', () => ({
  default: {
    autoUpdater: mockAutoUpdater
  }
}));

const {
  formatReleaseNotes,
  setupAutoUpdater
} = await import('../../src/electron/updater.js');

describe('Electron AutoUpdater', () => {
  let mockWebContentsSend;
  let mockWindow;

  beforeEach(() => {
    mockApp.isPackaged = true;
    mockApp.getVersion.mockReturnValue('3.3.1');
    mockAutoUpdater.removeAllListeners();
    mockAutoUpdater.checkForUpdates.mockClear();
    mockAutoUpdater.quitAndInstall.mockClear();
    mockIpcMain.handle.mockClear();
    Object.keys(ipcHandlers).forEach((key) => {
      delete ipcHandlers[key];
    });

    mockWebContentsSend = vi.fn();
    mockWindow = {
      isDestroyed: () => false,
      webContents: {
        send: mockWebContentsSend
      }
    };
  });

  it('formats HTML and array release notes into clean text', () => {
    expect(formatReleaseNotes('<p>Fixed <b>physics</b> bug</p>')).toBe(
      'Fixed physics bug'
    );
    expect(
      formatReleaseNotes([
        { version: '3.4.0', note: '<p>Added auto-updater</p>' },
        { version: '3.3.2', note: 'Improved willow trail' }
      ])
    ).toBe('Added auto-updater Improved willow trail');
    expect(formatReleaseNotes(null)).toBe('');
  });

  it('configures silent background download and install on quit', () => {
    setupAutoUpdater({
      getMainWindow: () => mockWindow
    });

    expect(mockAutoUpdater.autoDownload).toBe(true);
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    expect(mockAutoUpdater.allowPrerelease).toBe(false);
    expect(ipcHandlers['updater:get-state']).toBeTypeOf('function');
    expect(ipcHandlers['updater:check']).toBeTypeOf('function');
    expect(ipcHandlers['updater:quit-and-install']).toBeTypeOf('function');
  });

  it('skips checkForUpdates in dev mode and emits dev-mode on manual check', async () => {
    mockApp.isPackaged = false;
    const controller = setupAutoUpdater({
      getMainWindow: () => mockWindow
    });

    await controller.checkForUpdates({ manual: false });
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(mockWebContentsSend).not.toHaveBeenCalled();

    const manualState = await ipcHandlers['updater:check']();
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
    expect(manualState.status).toBe('dev-mode');
    expect(manualState.manual).toBe(true);
  });

  it('tracks update-available, download-progress, and update-downloaded states', async () => {
    setupAutoUpdater({
      getMainWindow: () => mockWindow
    });

    mockAutoUpdater.emit('checking-for-update');
    mockAutoUpdater.emit('update-available', {
      version: '3.4.0',
      releaseNotes: '<p>Added auto-update support</p>',
      releaseDate: '2026-11-11'
    });
    mockAutoUpdater.emit('download-progress', {
      percent: 48.6,
      bytesPerSecond: 102400,
      transferred: 500000,
      total: 1000000
    });
    mockAutoUpdater.emit('update-downloaded', {
      version: '3.4.0'
    });

    const state = await ipcHandlers['updater:get-state']();
    expect(state.status).toBe('downloaded');
    expect(state.version).toBe('3.4.0');
    expect(state.percent).toBe(100);
    expect(state.releaseNotes).toBe('Added auto-update support');
    expect(mockWebContentsSend).toHaveBeenCalledTimes(4);
  });

  it('calls quitAndInstall when updater:quit-and-install is invoked', async () => {
    setupAutoUpdater({
      getMainWindow: () => mockWindow
    });

    const res = await ipcHandlers['updater:quit-and-install']();
    expect(res).toEqual({ started: true });

    await new Promise((resolve) => setImmediate(resolve));
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledWith(
      false,
      true
    );
  });
});

