import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach
} from 'vitest';
import { initUpdateNotifier } from '../../src/ui/UpdateNotifier.js';

function createMockElement(tagName) {
  const el = {
    tagName: tagName.toUpperCase(),
    id: '',
    className: '',
    textContent: '',
    _innerHTML: '',
    style: {},
    children: [],
    parentElement: null,
    disabled: false,
    listeners: {},
    appendChild(child) {
      this.children.push(child);
      child.parentElement = this;
      return child;
    },
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentElement = null;
      }
      return child;
    },
    remove() {
      if (this.parentElement) {
        this.parentElement.removeChild(this);
      }
    },
    addEventListener(event, handler) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(handler);
    },
    click() {
      const handlers = this.listeners.click || [];
      handlers.forEach((h) => h({ stopPropagation: () => {} }));
    }
  };
  Object.defineProperty(el, 'innerHTML', {
    get() {
      return this._innerHTML;
    },
    set(value) {
      this._innerHTML = value;
      if (value === '') {
        this.children = [];
      }
    }
  });
  return el;
}

function findElementByText(root, text) {
  if (!root) {
    return null;
  }
  if (root.textContent === text) {
    return root;
  }
  for (const child of root.children || []) {
    const match = findElementByText(child, text);
    if (match) {
      return match;
    }
  }
  return null;
}

describe('UpdateNotifier UI', () => {
  let mockBody;
  let statusHandler;
  let quitAndInstallMock;

  beforeEach(() => {
    mockBody = createMockElement('body');
    statusHandler = null;
    quitAndInstallMock = vi.fn();

    const findById = (node, id) => {
      if (node.id === id) {
        return node;
      }
      for (const child of node.children || []) {
        const match = findById(child, id);
        if (match) {
          return match;
        }
      }
      return null;
    };

    vi.stubGlobal('navigator', { language: 'en-US' });
    vi.stubGlobal('requestAnimationFrame', (cb) => cb());
    vi.stubGlobal('document', {
      body: {
        appendChild: (el) => mockBody.appendChild(el),
        removeChild: (el) => mockBody.removeChild(el),
        contains: (el) => mockBody.children.includes(el)
      },
      createElement: (tag) => createMockElement(tag),
      getElementById: (id) => findById(mockBody, id)
    });
    vi.stubGlobal('window', {
      electronAPI: {
        onUpdateStatus: (cb) => {
          statusHandler = cb;
          return () => {};
        },
        getUpdateState: vi.fn().mockResolvedValue({
          status: 'idle'
        }),
        quitAndInstallUpdate: quitAndInstallMock
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restarts immediately when there are no unsaved changes', () => {
    initUpdateNotifier({
      hasUnsavedChanges: () => false
    });

    statusHandler({
      status: 'downloaded',
      version: '3.4.0',
      percent: 100
    });

    const banner = document.getElementById('app-update-banner');
    expect(banner).not.toBeNull();
    const restartBtn = findElementByText(banner, 'Restart and Update');
    expect(restartBtn).not.toBeNull();

    restartBtn.click();
    expect(quitAndInstallMock).toHaveBeenCalledTimes(1);
    expect(document.getElementById('update-unsaved-modal')).toBeNull();
  });

  it('prompts to save before restarting when unsaved changes exist', async () => {
    const saveChangesMock = vi.fn().mockResolvedValue(true);

    initUpdateNotifier({
      hasUnsavedChanges: () => true,
      saveChanges: saveChangesMock
    });

    statusHandler({
      status: 'downloaded',
      version: '3.4.0',
      percent: 100
    });

    const banner = document.getElementById('app-update-banner');
    const restartBtn = findElementByText(banner, 'Restart and Update');
    restartBtn.click();

    expect(quitAndInstallMock).not.toHaveBeenCalled();

    const modal = document.getElementById('update-unsaved-modal');
    expect(modal).not.toBeNull();

    const saveAndRestartBtn = findElementByText(modal, 'Save and Restart');
    expect(saveAndRestartBtn).not.toBeNull();
    saveAndRestartBtn.click();

    await Promise.resolve();
    await Promise.resolve();

    expect(saveChangesMock).toHaveBeenCalledTimes(1);
    expect(quitAndInstallMock).toHaveBeenCalledTimes(1);
  });

  it('does not restart if saveChanges returns false', async () => {
    const saveChangesMock = vi.fn().mockResolvedValue(false);

    initUpdateNotifier({
      hasUnsavedChanges: () => true,
      saveChanges: saveChangesMock
    });

    statusHandler({
      status: 'downloaded',
      version: '3.4.0',
      percent: 100
    });

    const banner = document.getElementById('app-update-banner');
    const restartBtn = findElementByText(banner, 'Restart and Update');
    restartBtn.click();

    const modal = document.getElementById('update-unsaved-modal');
    const saveAndRestartBtn = findElementByText(modal, 'Save and Restart');
    saveAndRestartBtn.click();

    await Promise.resolve();
    await Promise.resolve();

    expect(saveChangesMock).toHaveBeenCalledTimes(1);
    expect(quitAndInstallMock).not.toHaveBeenCalled();
  });
});

