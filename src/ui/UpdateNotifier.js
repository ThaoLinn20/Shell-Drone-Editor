import { t } from '../config/lang/i18n.js';
import { showToast } from '../utils/Toast.js';

function createActionButton(
  label,
  variant = 'primary'
) {
  const button = document.createElement('button');
  button.textContent = label;
  button.style.borderRadius = '5px';
  button.style.cursor = 'pointer';
  button.style.fontSize = '12px';
  button.style.fontWeight = '600';
  button.style.padding = '6px 12px';
  button.style.transition = 'filter 0.15s ease';

  if (variant === 'primary') {
    button.style.background = '#2575fc';
    button.style.border = '1px solid #3b82f6';
    button.style.color = '#ffffff';
  } else if (variant === 'danger') {
    button.style.background = '#b91c1c';
    button.style.border = '1px solid #dc2626';
    button.style.color = '#ffffff';
  } else {
    button.style.background = 'rgba(255, 255, 255, 0.08)';
    button.style.border = '1px solid rgba(255, 255, 255, 0.18)';
    button.style.color = '#e2e8f0';
  }

  return button;
}

function showUnsavedUpdateModal({
  onSaveAndRestart,
  onRestartWithoutSaving
}) {
  const existing = document.getElementById('update-unsaved-modal');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.id = 'update-unsaved-modal';
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0, 0, 0, 0.65)';
  overlay.style.backdropFilter = 'blur(5px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '100001';

  const stopEvent = (event) => {
    event.stopPropagation();
  };
  overlay.addEventListener('pointerdown', stopEvent);
  overlay.addEventListener('mousedown', stopEvent);
  overlay.addEventListener('click', stopEvent);

  const modal = document.createElement('div');
  modal.style.background = '#1e293b';
  modal.style.border = '1px solid rgba(148, 163, 184, 0.3)';
  modal.style.borderRadius = '8px';
  modal.style.boxShadow = '0 16px 40px rgba(0, 0, 0, 0.55)';
  modal.style.padding = '20px';
  modal.style.width = '400px';
  modal.style.maxWidth = '90vw';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.gap = '14px';
  modal.style.fontFamily = 'Inter, Roboto, sans-serif';

  const titleEl = document.createElement('div');
  titleEl.textContent = t('updater.unsavedTitle') || 'Unsaved Changes';
  titleEl.style.color = '#f8fafc';
  titleEl.style.fontSize = '15px';
  titleEl.style.fontWeight = '600';

  const msgEl = document.createElement('div');
  msgEl.textContent = t('updater.unsavedMessage')
    || 'You have unsaved changes. Save your work before restarting to update?';
  msgEl.style.color = '#cbd5e1';
  msgEl.style.fontSize = '13px';
  msgEl.style.lineHeight = '1.5';

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.flexWrap = 'wrap';
  actions.style.justifyContent = 'flex-end';
  actions.style.gap = '8px';

  const cancelBtn = createActionButton(
    t('updater.cancelBtn') || 'Cancel',
    'secondary'
  );
  const skipSaveBtn = createActionButton(
    t('updater.restartWithoutSavingBtn') || 'Restart Without Saving',
    'danger'
  );
  const saveBtn = createActionButton(
    t('updater.saveAndRestartBtn') || 'Save and Restart',
    'primary'
  );

  const close = () => {
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  };

  cancelBtn.addEventListener('click', close);
  skipSaveBtn.addEventListener('click', () => {
    close();
    onRestartWithoutSaving();
  });
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const saved = await onSaveAndRestart();
    if (saved) {
      close();
    } else {
      saveBtn.disabled = false;
    }
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(skipSaveBtn);
  actions.appendChild(saveBtn);

  modal.appendChild(titleEl);
  modal.appendChild(msgEl);
  modal.appendChild(actions);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

/**
 * Initialize non-intrusive auto-update banner and restart safeguard for Electron.
 */
export function initUpdateNotifier({
  hasUnsavedChanges = () => false,
  saveChanges = async () => true
} = {}) {
  if (
    typeof window === 'undefined' ||
    typeof document === 'undefined' ||
    !window.electronAPI ||
    typeof window.electronAPI.onUpdateStatus !== 'function'
  ) {
    return () => {};
  }

  let dismissedVersion = null;
  let lastManualToast = '';
  let bannerEl = null;

  const removeBanner = () => {
    if (bannerEl && bannerEl.parentElement) {
      bannerEl.parentElement.removeChild(bannerEl);
    }
    bannerEl = null;
  };

  const ensureBanner = () => {
    if (bannerEl && document.body.contains(bannerEl)) {
      return bannerEl;
    }
    bannerEl = document.createElement('div');
    bannerEl.id = 'app-update-banner';
    bannerEl.style.position = 'fixed';
    bannerEl.style.top = '14px';
    bannerEl.style.left = '50%';
    bannerEl.style.transform = 'translateX(-50%)';
    bannerEl.style.width = '400px';
    bannerEl.style.maxWidth = '92vw';
    bannerEl.style.background = 'rgba(15, 23, 42, 0.96)';
    bannerEl.style.border = '1px solid rgba(59, 130, 246, 0.45)';
    bannerEl.style.borderRadius = '8px';
    bannerEl.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.5)';
    bannerEl.style.backdropFilter = 'blur(10px)';
    bannerEl.style.padding = '12px 14px';
    bannerEl.style.zIndex = '99998';
    bannerEl.style.display = 'flex';
    bannerEl.style.flexDirection = 'column';
    bannerEl.style.gap = '8px';
    bannerEl.style.fontFamily = 'Inter, Roboto, sans-serif';
    bannerEl.style.color = '#f8fafc';

    const stopEvent = (event) => {
      event.stopPropagation();
    };
    bannerEl.addEventListener('pointerdown', stopEvent);
    bannerEl.addEventListener('mousedown', stopEvent);

    document.body.appendChild(bannerEl);
    return bannerEl;
  };

  const triggerRestart = () => {
    const installNow = () => {
      if (typeof window.electronAPI.quitAndInstallUpdate === 'function') {
        window.electronAPI.quitAndInstallUpdate();
      }
    };

    if (hasUnsavedChanges()) {
      showUnsavedUpdateModal({
        onSaveAndRestart: async () => {
          const saved = await saveChanges();
          if (saved) {
            installNow();
            return true;
          }
          return false;
        },
        onRestartWithoutSaving: installNow
      });
      return;
    }

    installNow();
  };

  const renderBanner = (state) => {
    const version = state.version || '';
    if (
      state.status !== 'downloaded' &&
      dismissedVersion &&
      dismissedVersion === version
    ) {
      return;
    }

    if (
      state.status === 'downloaded' &&
      dismissedVersion === `ready:${version}`
    ) {
      return;
    }

    const container = ensureBanner();
    container.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'center';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.gap = '10px';

    const title = document.createElement('div');
    title.style.fontSize = '13px';
    title.style.fontWeight = '600';
    title.style.color = '#f8fafc';

    if (state.status === 'available') {
      title.textContent = t('updater.availableTitle', {
        version
      }) || `New version ${version} available`;
    } else if (state.status === 'downloading') {
      title.textContent = t('updater.downloadingTitle', {
        version
      }) || `Downloading update ${version}`;
    } else if (state.status === 'downloaded') {
      title.textContent = t('updater.downloadedTitle', {
        version
      }) || `Update ${version} is ready`;
    }

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'x';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#94a3b8';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '14px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.padding = '2px 4px';
    closeBtn.addEventListener('click', () => {
      dismissedVersion = state.status === 'downloaded'
        ? `ready:${version}`
        : version;
      removeBanner();
    });

    headerRow.appendChild(title);
    headerRow.appendChild(closeBtn);
    container.appendChild(headerRow);

    if (state.releaseNotes) {
      const notes = document.createElement('div');
      notes.textContent = state.releaseNotes;
      notes.style.fontSize = '12px';
      notes.style.color = '#cbd5e1';
      notes.style.lineHeight = '1.4';
      container.appendChild(notes);
    }

    if (state.status === 'available' || state.status === 'downloading') {
      const percent = Math.round(state.percent || 0);
      const progressTrack = document.createElement('div');
      progressTrack.style.width = '100%';
      progressTrack.style.height = '6px';
      progressTrack.style.background = 'rgba(148, 163, 184, 0.25)';
      progressTrack.style.borderRadius = '999px';
      progressTrack.style.overflow = 'hidden';

      const progressFill = document.createElement('div');
      progressFill.style.width = `${percent}%`;
      progressFill.style.height = '100%';
      progressFill.style.background = '#3b82f6';
      progressFill.style.transition = 'width 0.2s ease';
      progressTrack.appendChild(progressFill);

      const progressText = document.createElement('div');
      progressText.textContent = t('updater.downloadingProgress', {
        percent
      }) || `${percent}% complete`;
      progressText.style.fontSize = '11px';
      progressText.style.color = '#94a3b8';

      container.appendChild(progressTrack);
      container.appendChild(progressText);
      return;
    }

    if (state.status === 'downloaded') {
      const desc = document.createElement('div');
      desc.textContent = t('updater.downloadedDesc')
        || 'Restart the application to finish installing the new version.';
      desc.style.fontSize = '12px';
      desc.style.color = '#cbd5e1';
      container.appendChild(desc);

      const btnRow = document.createElement('div');
      btnRow.style.display = 'flex';
      btnRow.style.justifyContent = 'flex-end';
      btnRow.style.gap = '8px';

      const laterBtn = createActionButton(
        t('updater.laterBtn') || 'Later',
        'secondary'
      );
      laterBtn.addEventListener('click', () => {
        dismissedVersion = `ready:${version}`;
        removeBanner();
      });

      const restartBtn = createActionButton(
        t('updater.restartNowBtn') || 'Restart and Update',
        'primary'
      );
      restartBtn.addEventListener('click', triggerRestart);

      btnRow.appendChild(laterBtn);
      btnRow.appendChild(restartBtn);
      container.appendChild(btnRow);
    }
  };

  const handleState = (state) => {
    if (!state || !state.status) {
      return;
    }

    if (state.status === 'checking') {
      if (state.manual && lastManualToast !== 'checking') {
        lastManualToast = 'checking';
        showToast(
          t('updater.checkingToast') || 'Checking for updates...',
          'info',
          2000
        );
      }
      return;
    }

    if (state.status === 'not-available') {
      lastManualToast = '';
      if (state.manual) {
        const version = state.version || state.currentVersion || '';
        showToast(
          t('updater.upToDateToast', {
            version
          }) || `You are on the latest version ${version}`,
          'success',
          3000
        );
      }
      return;
    }

    if (state.status === 'dev-mode') {
      lastManualToast = '';
      if (state.manual) {
        showToast(
          t('updater.devModeToast')
            || 'Auto-update check is only active in packaged builds',
          'info',
          3000
        );
      }
      return;
    }

    if (state.status === 'error') {
      lastManualToast = '';
      if (state.manual) {
        showToast(
          t('updater.errorToast', {
            error: state.error || 'Unknown error'
          }) || `Update check failed: ${state.error || 'Unknown error'}`,
          'error',
          4000
        );
      }
      return;
    }

    if (
      state.status === 'available' ||
      state.status === 'downloading' ||
      state.status === 'downloaded'
    ) {
      lastManualToast = '';
      if (state.status === 'downloaded' && state.manual) {
        dismissedVersion = null;
      }
      renderBanner(state);
    }
  };

  const unsubscribe = window.electronAPI.onUpdateStatus(handleState);

  if (typeof window.electronAPI.getUpdateState === 'function') {
    window.electronAPI.getUpdateState()
      .then((initialState) => {
        if (
          initialState &&
          (
            initialState.status === 'available' ||
            initialState.status === 'downloading' ||
            initialState.status === 'downloaded'
          )
        ) {
          renderBanner(initialState);
        }
      })
      .catch(() => {});
  }

  return () => {
    removeBanner();
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
  };
}

