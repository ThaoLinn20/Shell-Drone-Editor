import { patternRegistry } from '../core/PatternRegistry.js';
import { PatternLibraryModal } from './modals/PatternLibraryModal.js';
import { resampleWavePoints } from '../utils/SplineMath.js';
import { showToast } from '../utils/Toast.js';
import { t } from '../config/lang/i18n.js';

let sharedLibraryModal = null;

/**
 * Opens the shared PatternLibraryModal to browse and apply saved custom sweep patterns.
 * @param {Object} options
 * @param {number} options.currentShellCount
 * @param {Function} options.onApplyPattern Callback: (resampledPoints, targetShellCount, pattern) => {}
 */
export function openPatternLibrary({ currentShellCount, onApplyPattern }) {
  if (!sharedLibraryModal) {
    sharedLibraryModal = new PatternLibraryModal();
  }
  sharedLibraryModal.show({
    onApply: (pattern, { matchShellCount }) => {
      const targetCount = matchShellCount
        ? Math.max(2, pattern.defaultShellCount || pattern.points.length)
        : Math.max(2, currentShellCount || 12);
      const resampled = resampleWavePoints(pattern.points, targetCount);
      onApplyPattern(resampled, targetCount, pattern);
    }
  });
}

/**
 * Creates a compact inline save popover for naming and saving a custom sweep pattern.
 * @param {Object} options
 * @param {Function} options.getPatternData Returns { points, shellCount, mortarsLocked }
 * @param {Function} [options.onSaved] Optional callback after save
 * @returns {{ element: HTMLElement, toggle: Function, open: Function, close: Function }}
 */
export function createSavePatternPopover({ getPatternData, onSaved }) {
  const row = document.createElement('div');
  row.className = 'wave-curve-save-popover';
  row.style.display = 'none';
  row.style.flexWrap = 'wrap';
  row.style.alignItems = 'center';
  row.style.gap = '4px';
  row.style.padding = '6px';
  row.style.background = '#161b22';
  row.style.border = '1px solid #30363d';
  row.style.borderRadius = '6px';
  row.style.boxSizing = 'border-box';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'wave-curve-save-name-input';
  input.placeholder = t('editor.patternLibrary.namePlaceholder') || 'Pattern name...';
  input.style.flex = '1 1 110px';
  input.style.minWidth = '110px';
  input.style.height = '26px';
  input.style.padding = '0 8px';
  input.style.fontSize = '11px';
  input.style.background = '#0d1117';
  input.style.color = '#e6edf3';
  input.style.border = '1px solid #30363d';
  input.style.borderRadius = '4px';
  input.style.outline = 'none';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'wave-curve-save-confirm-btn';
  saveBtn.textContent = t('common.save') || 'Save';
  saveBtn.style.height = '26px';
  saveBtn.style.padding = '0 10px';
  saveBtn.style.fontSize = '11px';
  saveBtn.style.fontWeight = '600';
  saveBtn.style.background = '#238636';
  saveBtn.style.color = '#ffffff';
  saveBtn.style.border = '1px solid rgba(240, 246, 252, 0.1)';
  saveBtn.style.borderRadius = '4px';
  saveBtn.style.cursor = 'pointer';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = t('common.cancel') || 'Cancel';
  cancelBtn.style.height = '26px';
  cancelBtn.style.padding = '0 8px';
  cancelBtn.style.fontSize = '11px';
  cancelBtn.style.background = '#21262d';
  cancelBtn.style.color = '#c9d1d9';
  cancelBtn.style.border = '1px solid #30363d';
  cancelBtn.style.borderRadius = '4px';
  cancelBtn.style.cursor = 'pointer';

  const close = () => {
    row.style.display = 'none';
    input.value = '';
  };

  const open = () => {
    row.style.display = 'flex';
    setTimeout(() => input.focus(), 0);
  };

  const toggle = () => {
    if (row.style.display === 'none') {
      open();
    } else {
      close();
    }
  };

  const commitSave = async () => {
    const name = input.value.trim();
    if (!name) {
      input.style.borderColor = '#f85149';
      input.focus();
      return;
    }
    input.style.borderColor = '#30363d';
    const data = getPatternData();
    const saved = await patternRegistry.savePattern({
      name,
      points: data.points,
      defaultShellCount: data.shellCount,
      mortarsLocked: data.mortarsLocked
    });
    showToast(
      t('editor.patternLibrary.savedToast') || `Saved pattern "${saved.name}" to library`,
      'success'
    );
    close();
    if (typeof onSaved === 'function') {
      onSaved(saved);
    }
  };

  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    commitSave();
  });

  cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    close();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  row.appendChild(input);
  row.appendChild(saveBtn);
  row.appendChild(cancelBtn);

  return {
    element: row,
    toggle,
    open,
    close
  };
}
