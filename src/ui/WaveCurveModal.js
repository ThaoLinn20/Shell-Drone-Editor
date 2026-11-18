/**
 * WaveCurveModal.js
 * Expanded full-screen dialog for visually choreographing firework trajectory curves,
 * launch mortar positions, burst apex heights, and firing angles in detail.
 */

import {
  DEFAULT_WAVE_POINTS,
  evaluateWaveCurve,
  sanitizeWavePoints,
  angleFromTrajectory,
  launchXFromAngle,
  resampleWavePoints,
  generateWavePreset
} from '../utils/SplineMath.js';
import { t } from '../config/lang/i18n.js';
import { createSvgIcon, createIconButton } from './IconHelper.js';

export class WaveCurveModal {
  /**
   * @param {Object} options
   * @param {Array} options.points Control points
   * @param {number} [options.shellCount=12] Number of shells
   * @param {Function} [options.onApply] Callback: (points) => {}
   */
  constructor(options = {}) {
    this.shellCount = Math.max(2, options.shellCount || 12);
    this.wavePreset = options.wavePreset || 'custom';
    this.points = resampleWavePoints(options.points || DEFAULT_WAVE_POINTS, this.shellCount);
    this.onApply = typeof options.onApply === 'function' ? options.onApply : () => {};

    this.selectedApexIndices = new Set([0]);
    this.selectedBaseIndices = new Set();
    this.marqueeBox = null;
    this.dragTarget = null; // { type: 'apex' | 'base', index: number }
    this.hoverTarget = null;
    this.mortarsLocked = true;

    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.width = 720;
    this.height = 440;
    this.padding = 24;

    this.setupModal();
    this.bindEvents();
    this.render();
  }

  get selectedIndex() {
    if (this.selectedApexIndices && this.selectedApexIndices.size > 0) {
      return this.selectedApexIndices.values().next().value;
    }
    if (this.selectedBaseIndices && this.selectedBaseIndices.size > 0) {
      return this.selectedBaseIndices.values().next().value;
    }
    return 0;
  }

  set selectedIndex(idx) {
    this.selectedApexIndices = new Set(idx !== null && idx !== undefined ? [idx] : [0]);
    if (this.selectedBaseIndices) {
      this.selectedBaseIndices.clear();
    }
  }

  setupModal() {
    // Overlay backdrop
    this.overlay = document.createElement('div');
    this.overlay.className = 'wave-curve-modal-overlay';
    this.overlay.style.position = 'fixed';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = '100vw';
    this.overlay.style.height = '100vh';
    this.overlay.style.backgroundColor = 'rgba(10, 15, 25, 0.88)';
    this.overlay.style.backdropFilter = 'blur(6px)';
    this.overlay.style.display = 'flex';
    this.overlay.style.alignItems = 'center';
    this.overlay.style.justifyContent = 'center';
    this.overlay.style.zIndex = '10000';
    this.overlay.style.userSelect = 'none';

    // Modal dialog box
    const modal = document.createElement('div');
    modal.className = 'wave-curve-modal-container';
    modal.style.width = '1080px';
    modal.style.maxWidth = '95vw';
    modal.style.height = '620px';
    modal.style.maxHeight = '92vh';
    modal.style.backgroundColor = '#0d1117';
    modal.style.border = '1px solid #30363d';
    modal.style.borderRadius = '8px';
    modal.style.boxShadow = '0 12px 36px rgba(0, 0, 0, 0.65)';
    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.overflow = 'hidden';

    // Header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '12px 18px';
    header.style.borderBottom = '1px solid #30363d';
    header.style.backgroundColor = '#161b22';

    const title = document.createElement('h3');
    title.textContent = t('editor.inspector.waveCurve.modalTitle') || 'Wave Curve Trajectory Studio';
    title.style.margin = '0';
    title.style.fontSize = '14px';
    title.style.fontWeight = 'bold';
    title.style.color = '#58a6ff';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = '1px solid #30363d';
    closeBtn.style.color = '#8b949e';
    closeBtn.style.padding = '3px 10px';
    closeBtn.style.borderRadius = '4px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '11px';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body: Left Canvas & Right Sidebar
    const body = document.createElement('div');
    body.style.display = 'flex';
    body.style.flex = '1';
    body.style.minHeight = '0';

    // Canvas section
    const canvasWrap = document.createElement('div');
    canvasWrap.style.flex = '1';
    canvasWrap.style.display = 'flex';
    canvasWrap.style.flexDirection = 'column';
    canvasWrap.style.padding = '14px';
    canvasWrap.style.gap = '10px';
    canvasWrap.style.borderRight = '1px solid #30363d';
    canvasWrap.style.backgroundColor = '#090d13';

    this.canvas = document.createElement('canvas');
    this.canvas.tabIndex = 0;
    this.canvas.style.width = '100%';
    this.canvas.style.flex = '1';
    this.canvas.style.backgroundColor = '#0d1117';
    this.canvas.style.borderRadius = '6px';
    this.canvas.style.border = '1px solid #21262d';
    this.canvas.style.cursor = 'crosshair';
    this.canvas.style.touchAction = 'none';
    this.canvas.style.outline = 'none';
    this.ctx = this.canvas.getContext('2d');
    canvasWrap.appendChild(this.canvas);

    // Presets Toolbar below canvas
    const presetBar = document.createElement('div');
    presetBar.style.display = 'flex';
    presetBar.style.alignItems = 'center';
    presetBar.style.gap = '6px';
    presetBar.style.flexWrap = 'wrap';

    // Preset dropdown select
    const presetSelect = document.createElement('select');
    presetSelect.className = 'wave-curve-modal-preset-select';
    presetSelect.style.height = '26px';
    presetSelect.style.padding = '0 8px';
    presetSelect.style.fontSize = '11px';
    presetSelect.style.background = '#21262d';
    presetSelect.style.color = '#c9d1d9';
    presetSelect.style.border = '1px solid #30363d';
    presetSelect.style.borderRadius = '4px';
    presetSelect.style.cursor = 'pointer';
    presetSelect.style.outline = 'none';

    const presetOptions = [
      { key: 'custom', label: t('editor.inspector.waveCurve.custom') || 'Custom' },
      { key: 'arch', label: t('editor.inspector.waveCurve.arch') || 'Arch' },
      { key: 'double_peak', label: t('editor.inspector.waveCurve.doublePeak') || 'Double Peak' },
      { key: 'wave', label: t('editor.inspector.waveCurve.wave') || 'Wave' },
      { key: 'slope', label: t('editor.inspector.waveCurve.slope') || 'Slope' },
      { key: 'v_shape', label: t('editor.inspector.waveCurve.vShape') || 'V-Shape' },
      { key: 'criss_cross', label: t('editor.inspector.waveCurve.crissCross') || 'Criss-Cross' }
    ];

    presetOptions.forEach((p) => {
      const optionEl = document.createElement('option');
      optionEl.value = p.key;
      optionEl.textContent = p.label;
      presetSelect.appendChild(optionEl);
    });

    presetSelect.value = this.wavePreset || 'custom';
    presetSelect.addEventListener('change', (e) => {
      this.applyPreset(e.target.value);
    });
    this.presetSelect = presetSelect;
    presetBar.appendChild(presetSelect);

    const syncShotsBtn = document.createElement('button');
    syncShotsBtn.type = 'button';
    syncShotsBtn.textContent = (t('editor.inspector.waveCurve.syncShots') || 'Sync Shots') + ` (${this.shellCount})`;
    syncShotsBtn.style.padding = '4px 9px';
    syncShotsBtn.style.fontSize = '11px';
    syncShotsBtn.style.fontWeight = 'bold';
    syncShotsBtn.style.background = 'rgba(88, 166, 255, 0.15)';
    syncShotsBtn.style.color = '#58a6ff';
    syncShotsBtn.style.border = '1px solid rgba(88, 166, 255, 0.4)';
    syncShotsBtn.style.borderRadius = '4px';
    syncShotsBtn.style.cursor = 'pointer';
    syncShotsBtn.addEventListener('click', () => this.syncToShellCount());
    presetBar.appendChild(syncShotsBtn);

    const lockBtn = document.createElement('button');
    lockBtn.type = 'button';
    lockBtn.className = 'inspector-icon-btn';
    lockBtn.style.width = '26px';
    lockBtn.style.height = '26px';
    lockBtn.style.padding = '0';
    lockBtn.style.display = 'inline-flex';
    lockBtn.style.alignItems = 'center';
    lockBtn.style.justifyContent = 'center';
    lockBtn.style.borderRadius = '4px';
    lockBtn.style.cursor = 'pointer';
    lockBtn.style.boxSizing = 'border-box';
    lockBtn.style.transition = 'all 0.15s ease';

    const updateLockLabel = () => {
      lockBtn.innerHTML = '';
      const icon = createSvgIcon(this.mortarsLocked ? 'lock' : 'unlock', 13);
      lockBtn.appendChild(icon);
      const title = this.mortarsLocked
        ? (t('editor.inspector.waveCurve.unlockMortars') || 'Unlock Mortars')
        : (t('editor.inspector.waveCurve.lockMortars') || 'Lock Mortars');
      lockBtn.title = title;
      lockBtn.setAttribute('aria-label', title);
      lockBtn.style.background = this.mortarsLocked ? 'rgba(56, 139, 253, 0.2)' : '#21262d';
      lockBtn.style.color = this.mortarsLocked ? '#58a6ff' : '#8b949e';
      lockBtn.style.border = this.mortarsLocked ? '1px solid #388bfd' : '1px solid #30363d';
    };
    updateLockLabel();
    lockBtn.addEventListener('click', () => {
      this.mortarsLocked = !this.mortarsLocked;
      updateLockLabel();
    });
    presetBar.appendChild(lockBtn);

    const resetMortarsBtn = createIconButton({
      icon: 'reset',
      iconSize: 13,
      color: '#c9d1d9',
      hoverColor: '#58a6ff',
      hoverBg: '#30363d',
      title: t('editor.inspector.waveCurve.resetMortars') || 'Reset Mortars',
      onClick: () => this.resetMortars()
    });
    presetBar.appendChild(resetMortarsBtn);

    canvasWrap.appendChild(presetBar);
    body.appendChild(canvasWrap);

    // Sidebar section for numeric controls & point list
    const sidebar = document.createElement('div');
    sidebar.style.width = '320px';
    sidebar.style.display = 'flex';
    sidebar.style.flexDirection = 'column';
    sidebar.style.backgroundColor = '#161b22';
    sidebar.style.padding = '14px';
    sidebar.style.gap = '12px';
    sidebar.style.overflowY = 'auto';

    this.sidebarContent = sidebar;
    body.appendChild(sidebar);
    modal.appendChild(body);

    // Footer actions
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'space-between';
    footer.style.padding = '12px 18px';
    footer.style.borderTop = '1px solid #30363d';
    footer.style.backgroundColor = '#161b22';

    const hint = document.createElement('span');
    hint.textContent = t('editor.inspector.waveCurve.hint') ||
      'Drag burst apex to set height and position, drag ground base to set launch point.';
    hint.style.fontSize = '11px';
    hint.style.color = '#8b949e';

    const btnGroup = document.createElement('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '8px';

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.padding = '5px 14px';
    cancelBtn.style.fontSize = '12px';
    cancelBtn.style.backgroundColor = '#21262d';
    cancelBtn.style.color = '#c9d1d9';
    cancelBtn.style.border = '1px solid #30363d';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', () => this.close());

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.textContent = t('editor.inspector.waveCurve.applyAndClose') || 'Apply & Close';
    applyBtn.style.padding = '5px 16px';
    applyBtn.style.fontSize = '12px';
    applyBtn.style.fontWeight = 'bold';
    applyBtn.style.backgroundColor = '#238636';
    applyBtn.style.color = '#ffffff';
    applyBtn.style.border = '1px solid rgba(240, 246, 252, 0.1)';
    applyBtn.style.borderRadius = '4px';
    applyBtn.style.cursor = 'pointer';
    applyBtn.addEventListener('click', () => {
      this.onApply(this.getCleanPoints(), this.shellCount, this.wavePreset);
      this.close();
    });

    btnGroup.appendChild(cancelBtn);
    btnGroup.appendChild(applyBtn);
    footer.appendChild(hint);
    footer.appendChild(btnGroup);
    modal.appendChild(footer);

    this.overlay.appendChild(modal);
    document.body.appendChild(this.overlay);

    this.updateSidebar();
  }

  updateSidebar() {
    if (!this.sidebarContent) return;
    this.sidebarContent.innerHTML = '';

    if (this.selectedApexIndices.size > 1) {
      const card = document.createElement('div');
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '12px';
      card.style.backgroundColor = '#0d1117';
      card.style.padding = '12px';
      card.style.borderRadius = '6px';
      card.style.border = '1px solid #388bfd';

      const cardTitle = document.createElement('div');
      cardTitle.style.display = 'flex';
      cardTitle.style.justifyContent = 'space-between';
      cardTitle.style.alignItems = 'center';
      cardTitle.style.fontWeight = 'bold';
      cardTitle.style.fontSize = '12px';
      cardTitle.style.color = '#58a6ff';

      const titleText = document.createElement('span');
      titleText.textContent = `${this.selectedApexIndices.size} ${t('editor.inspector.waveCurve.batchSelected') || 'Shells Selected - Batch'}`;
      cardTitle.appendChild(titleText);

      // Select All / Deselect buttons
      const selActions = document.createElement('div');
      selActions.style.display = 'flex';
      selActions.style.gap = '4px';

      const selectAllBtn = document.createElement('button');
      selectAllBtn.type = 'button';
      selectAllBtn.textContent = 'All';
      selectAllBtn.style.padding = '2px 6px';
      selectAllBtn.style.fontSize = '10px';
      selectAllBtn.style.background = '#21262d';
      selectAllBtn.style.color = '#c9d1d9';
      selectAllBtn.style.border = '1px solid #30363d';
      selectAllBtn.style.borderRadius = '3px';
      selectAllBtn.style.cursor = 'pointer';
      selectAllBtn.addEventListener('click', () => {
        this.selectedApexIndices = new Set(this.points.map((_, i) => i));
        this.selectedBaseIndices.clear();
        this.render();
        this.updateSidebar();
      });

      const clearSelBtn = document.createElement('button');
      clearSelBtn.type = 'button';
      clearSelBtn.textContent = '1';
      clearSelBtn.style.padding = '2px 6px';
      clearSelBtn.style.fontSize = '10px';
      clearSelBtn.style.background = '#21262d';
      clearSelBtn.style.color = '#c9d1d9';
      clearSelBtn.style.border = '1px solid #30363d';
      clearSelBtn.style.borderRadius = '3px';
      clearSelBtn.style.cursor = 'pointer';
      clearSelBtn.addEventListener('click', () => {
        this.selectedApexIndices = new Set([0]);
        this.selectedBaseIndices.clear();
        this.render();
        this.updateSidebar();
      });

      selActions.appendChild(selectAllBtn);
      selActions.appendChild(clearSelBtn);
      cardTitle.appendChild(selActions);
      card.appendChild(cardTitle);

      // 1. Batch Burst Altitude Nudges
      const altRow = document.createElement('div');
      altRow.style.display = 'flex';
      altRow.style.flexDirection = 'column';
      altRow.style.gap = '4px';

      const altHeader = document.createElement('div');
      altHeader.style.fontSize = '11px';
      altHeader.style.color = '#8b949e';
      altHeader.textContent = t('editor.inspector.waveCurve.batchAltitude') || 'Batch Altitude Adjust';

      const altNudgeBar = document.createElement('div');
      altNudgeBar.style.display = 'flex';
      altNudgeBar.style.gap = '4px';

      const addAltNudge = (lbl, deltaRatio) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = lbl;
        b.style.flex = '1';
        b.style.padding = '3px 4px';
        b.style.fontSize = '10px';
        b.style.fontFamily = 'monospace';
        b.style.backgroundColor = '#21262d';
        b.style.border = '1px solid #30363d';
        b.style.color = '#c9d1d9';
        b.style.borderRadius = '3px';
        b.style.cursor = 'pointer';
        b.addEventListener('click', () => {
          this.selectedApexIndices.forEach((idx) => {
            const p = this.points[idx];
            p.y = Math.max(0.05, Math.min(1.0, p.y + deltaRatio));
            if (!this.mortarsLocked) {
              p.launchX = p.x;
              p.angle = 0.0;
            } else {
              p.angle = angleFromTrajectory(p.launchX ?? p.x, p.x, p.y);
            }
          });
          this.render();
          this.updateSidebar();
        });
        return b;
      };

      altNudgeBar.appendChild(addAltNudge('-10%', -0.10));
      altNudgeBar.appendChild(addAltNudge('-5%', -0.05));
      altNudgeBar.appendChild(addAltNudge('+5%', 0.05));
      altNudgeBar.appendChild(addAltNudge('+10%', 0.10));
      altRow.appendChild(altHeader);
      altRow.appendChild(altNudgeBar);
      card.appendChild(altRow);

      // 2. Batch Angle Nudges
      const angleRow = document.createElement('div');
      angleRow.style.display = 'flex';
      angleRow.style.flexDirection = 'column';
      angleRow.style.gap = '4px';

      const angleHeader = document.createElement('div');
      angleHeader.style.fontSize = '11px';
      angleHeader.style.color = '#8b949e';
      angleHeader.textContent = t('editor.inspector.waveCurve.batchAngle') || 'Batch Angle Adjust';

      const angleNudgeBar = document.createElement('div');
      angleNudgeBar.style.display = 'flex';
      angleNudgeBar.style.gap = '4px';

      const addAngleNudge = (lbl, deltaDeg) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = lbl;
        b.style.flex = '1';
        b.style.padding = '3px 4px';
        b.style.fontSize = '10px';
        b.style.fontFamily = 'monospace';
        b.style.backgroundColor = '#21262d';
        b.style.border = '1px solid #30363d';
        b.style.color = '#c9d1d9';
        b.style.borderRadius = '3px';
        b.style.cursor = 'pointer';
        b.addEventListener('click', () => {
          this.selectedApexIndices.forEach((idx) => {
            const p = this.points[idx];
            if (deltaDeg === 0) {
              p.angle = 0.0;
            } else {
              const currentDeg = (p.angle * 180) / Math.PI;
              const nextDeg = Math.max(-80, Math.min(80, currentDeg + deltaDeg));
              p.angle = (nextDeg * Math.PI) / 180;
            }
            p.launchX = launchXFromAngle(p.x, p.y, p.angle);
          });
          this.render();
          this.updateSidebar();
        });
        return b;
      };

      angleNudgeBar.appendChild(addAngleNudge('-5°', -5));
      angleNudgeBar.appendChild(addAngleNudge('-1°', -1));
      angleNudgeBar.appendChild(addAngleNudge('0°', 0));
      angleNudgeBar.appendChild(addAngleNudge('+1°', 1));
      angleNudgeBar.appendChild(addAngleNudge('+5°', 5));
      angleRow.appendChild(angleHeader);
      angleRow.appendChild(angleNudgeBar);
      card.appendChild(angleRow);

      // 3. Batch Launch Origin Nudges
      const baseRow = document.createElement('div');
      baseRow.style.display = 'flex';
      baseRow.style.flexDirection = 'column';
      baseRow.style.gap = '4px';

      const baseHeader = document.createElement('div');
      baseHeader.style.fontSize = '11px';
      baseHeader.style.color = '#8b949e';
      baseHeader.textContent = t('editor.inspector.waveCurve.batchLaunch') || 'Batch Launch Origin Adjust';

      const baseNudgeBar = document.createElement('div');
      baseNudgeBar.style.display = 'flex';
      baseNudgeBar.style.gap = '4px';

      const addBaseNudge = (lbl, deltaX) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = lbl;
        b.style.flex = '1';
        b.style.padding = '3px 4px';
        b.style.fontSize = '10px';
        b.style.fontFamily = 'monospace';
        b.style.backgroundColor = '#21262d';
        b.style.border = '1px solid #30363d';
        b.style.color = '#c9d1d9';
        b.style.borderRadius = '3px';
        b.style.cursor = 'pointer';
        b.addEventListener('click', () => {
          this.selectedApexIndices.forEach((idx) => {
            const p = this.points[idx];
            p.launchX = Math.max(0.0, Math.min(1.0, (p.launchX ?? p.x) + deltaX));
            p.angle = angleFromTrajectory(p.launchX, p.x, p.y);
          });
          this.render();
          this.updateSidebar();
        });
        return b;
      };

      baseNudgeBar.appendChild(addBaseNudge('-10%', -0.10));
      baseNudgeBar.appendChild(addBaseNudge('-5%', -0.05));
      baseNudgeBar.appendChild(addBaseNudge('+5%', 0.05));
      baseNudgeBar.appendChild(addBaseNudge('+10%', 0.10));
      baseRow.appendChild(baseHeader);
      baseRow.appendChild(baseNudgeBar);
      card.appendChild(baseRow);

      // 4. Delete selected shells button
      const delSelectedBtn = document.createElement('button');
      delSelectedBtn.type = 'button';
      delSelectedBtn.textContent = `${t('editor.inspector.waveCurve.deleteSelected') || 'Delete Selected'} (${this.selectedApexIndices.size})`;
      delSelectedBtn.style.padding = '5px 8px';
      delSelectedBtn.style.fontSize = '11px';
      delSelectedBtn.style.backgroundColor = 'rgba(248, 81, 73, 0.15)';
      delSelectedBtn.style.color = '#f85149';
      delSelectedBtn.style.border = '1px solid rgba(248, 81, 73, 0.4)';
      delSelectedBtn.style.borderRadius = '4px';
      delSelectedBtn.style.cursor = 'pointer';
      delSelectedBtn.addEventListener('click', () => {
        this.removePoint();
      });
      card.appendChild(delSelectedBtn);

      this.sidebarContent.appendChild(card);
      return;
    }

    const selIndex = this.selectedIndex ?? 0;
    const pt = this.points[selIndex] || this.points[0];
    if (!pt) return;

    const deg = Math.round(pt.angle * 180 / Math.PI);
    const heightMeters = Math.round(75 + pt.y * (300 - 75));

    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '10px';
    card.style.backgroundColor = '#0d1117';
    card.style.padding = '12px';
    card.style.borderRadius = '6px';
    card.style.border = '1px solid #30363d';

    const cardTitle = document.createElement('div');
    cardTitle.style.display = 'flex';
    cardTitle.style.justifyContent = 'space-between';
    cardTitle.style.alignItems = 'center';
    cardTitle.style.fontWeight = 'bold';
    cardTitle.style.fontSize = '12px';
    cardTitle.style.color = '#58a6ff';

    const titleText = document.createElement('span');
    titleText.textContent = `${t('editor.inspector.waveCurve.shot') || 'Shot'} #${selIndex + 1} of ${this.points.length}`;
    cardTitle.appendChild(titleText);

    const titleActions = document.createElement('div');
    titleActions.style.display = 'flex';
    titleActions.style.alignItems = 'center';
    titleActions.style.gap = '4px';

    const addBtn = createIconButton({
      icon: 'plus',
      iconSize: 12,
      color: '#3fb950',
      hoverColor: '#ffffff',
      hoverBg: '#238636',
      title: t('editor.inspector.waveCurve.addPoint') || 'Add Shell',
      onClick: () => this.addPoint()
    });
    addBtn.style.width = '22px';
    addBtn.style.height = '22px';

    const delBtn = createIconButton({
      icon: 'minus',
      iconSize: 12,
      color: '#f85149',
      hoverColor: '#ffffff',
      hoverBg: 'rgba(248, 81, 73, 0.3)',
      title: t('editor.inspector.waveCurve.deletePoint') || 'Delete Shell',
      onClick: () => this.removePoint()
    });
    delBtn.style.width = '22px';
    delBtn.style.height = '22px';

    titleActions.appendChild(addBtn);
    titleActions.appendChild(delBtn);
    cardTitle.appendChild(titleActions);
    card.appendChild(cardTitle);

    // 1. Launch Origin X
    const launchRow = this.createSliderRow(
      t('editor.inspector.waveCurve.launchBase') || 'Launch Origin',
      `${Math.round(pt.launchX * 100)}%`,
      pt.launchX,
      0,
      1,
      0.01,
      (val) => {
        pt.launchX = val;
        pt.angle = angleFromTrajectory(pt.launchX, pt.x, pt.y);
        this.render();
        this.updateSidebar();
      }
    );
    card.appendChild(launchRow);

    // 2. Burst Apex X
    const apexXRow = this.createSliderRow(
      (t('editor.inspector.waveCurve.burstApex') || 'Burst Apex') + ' X',
      `${Math.round(pt.x * 100)}%`,
      pt.x,
      0,
      1,
      0.01,
      (val) => {
        if (selIndex === 0) {
          const maxX = this.points.length > 1 ? this.points[1].x - 0.01 : 1.0;
          pt.x = Math.max(0.0, Math.min(maxX, val));
        } else if (selIndex === this.points.length - 1) {
          const minX = this.points.length > 1 ? this.points[selIndex - 1].x + 0.01 : 0.0;
          pt.x = Math.max(minX, Math.min(1.0, val));
        } else {
          const minX = this.points[selIndex - 1].x + 0.01;
          const maxX = this.points[selIndex + 1].x - 0.01;
          pt.x = Math.max(minX, Math.min(maxX, val));
        }
        pt.angle = angleFromTrajectory(pt.launchX, pt.x, pt.y);
        this.render();
        this.updateSidebar();
      }
    );
    card.appendChild(apexXRow);

    // 3. Burst Altitude Y
    const apexYRow = this.createSliderRow(
      (t('editor.inspector.waveCurve.burstApex') || 'Burst Apex') + ` (${heightMeters}m)`,
      `${Math.round(pt.y * 100)}%`,
      pt.y,
      0.05,
      1,
      0.01,
      (val) => {
        pt.y = val;
        pt.angle = angleFromTrajectory(pt.launchX, pt.x, pt.y);
        this.render();
        this.updateSidebar();
      }
    );
    card.appendChild(apexYRow);

    // 4. Launch Angle (with nudge buttons)
    const angleRow = document.createElement('div');
    angleRow.style.display = 'flex';
    angleRow.style.flexDirection = 'column';
    angleRow.style.gap = '4px';

    const angleHeader = document.createElement('div');
    angleHeader.style.display = 'flex';
    angleHeader.style.justifyContent = 'space-between';
    angleHeader.style.fontSize = '11px';
    angleHeader.style.color = '#c9d1d9';
    angleHeader.innerHTML = `<span>${t('editor.inspector.waveCurve.angle') || 'Launch Angle'}</span><span style="font-family: monospace; color: #ff7b72;">${deg > 0 ? '+' : ''}${deg}°</span>`;

    const nudgeBar = document.createElement('div');
    nudgeBar.style.display = 'flex';
    nudgeBar.style.gap = '4px';

    const addNudge = (lbl, delta) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = lbl;
      b.style.flex = '1';
      b.style.padding = '2px 4px';
      b.style.fontSize = '10px';
      b.style.fontFamily = 'monospace';
      b.style.backgroundColor = '#21262d';
      b.style.border = '1px solid #30363d';
      b.style.color = '#c9d1d9';
      b.style.borderRadius = '3px';
      b.style.cursor = 'pointer';
      b.addEventListener('click', () => {
        let newDeg = (delta === 0) ? 0 : deg + delta;
        newDeg = Math.max(-80, Math.min(80, newDeg));
        pt.angle = (newDeg * Math.PI) / 180;
        pt.launchX = launchXFromAngle(pt.x, pt.y, pt.angle);
        this.render();
        this.updateSidebar();
      });
      return b;
    };

    nudgeBar.appendChild(addNudge('-5°', -5));
    nudgeBar.appendChild(addNudge('-1°', -1));
    nudgeBar.appendChild(addNudge('0°', 0));
    nudgeBar.appendChild(addNudge('+1°', 1));
    nudgeBar.appendChild(addNudge('+5°', 5));

    angleRow.appendChild(angleHeader);
    angleRow.appendChild(nudgeBar);
    card.appendChild(angleRow);

    this.sidebarContent.appendChild(card);
  }

  createSliderRow(label, displayVal, val, min, max, step, onChange) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.flexDirection = 'column';
    row.style.gap = '3px';

    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.fontSize = '11px';
    header.style.color = '#8b949e';
    header.innerHTML = `<span>${label}</span><span style="font-family: monospace; color: #58a6ff;">${displayVal}</span>`;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(val);
    slider.style.width = '100%';
    slider.style.accentColor = '#58a6ff';
    slider.addEventListener('input', (e) => {
      onChange(parseFloat(e.target.value));
    });

    row.appendChild(header);
    row.appendChild(slider);
    return row;
  }

  bindEvents() {
    if (!this.canvas) return;

    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const findHit = (pos) => {
      const pad = this.padding;
      const canvasW = this.canvas.clientWidth || this.width;
      const canvasH = this.canvas.clientHeight || this.height;
      const drawW = canvasW - pad * 2;
      const drawH = canvasH - pad * 2;
      const groundY = canvasH - pad;

      for (let i = 0; i < this.points.length; i++) {
        const pt = this.points[i];
        // 1. Apex hit test
        const apexPx = pad + pt.x * drawW;
        const apexPy = groundY - pt.y * drawH;
        if (Math.hypot(pos.x - apexPx, pos.y - apexPy) < 12) {
          return { type: 'apex', index: i };
        }

        // 2. Base hit test
        const launchX = pt.launchX !== undefined ? pt.launchX : pt.x;
        const basePx = pad + launchX * drawW;
        const basePy = groundY;
        if (Math.hypot(pos.x - basePx, pos.y - basePy) < 12) {
          return { type: 'base', index: i };
        }
      }
      return null;
    };

    this.canvas.addEventListener('pointerdown', (e) => {
      const pos = getPos(e);
      const hit = findHit(pos);
      if (hit) {
        if (e.shiftKey) {
          if (hit.type === 'apex') {
            if (this.selectedApexIndices.has(hit.index)) {
              this.selectedApexIndices.delete(hit.index);
              if (this.selectedApexIndices.size === 0 && this.selectedBaseIndices.size === 0) {
                this.selectedApexIndices.add(hit.index);
              }
            } else {
              this.selectedApexIndices.add(hit.index);
            }
          } else if (hit.type === 'base') {
            if (this.selectedBaseIndices.has(hit.index)) {
              this.selectedBaseIndices.delete(hit.index);
              if (this.selectedApexIndices.size === 0 && this.selectedBaseIndices.size === 0) {
                this.selectedBaseIndices.add(hit.index);
              }
            } else {
              this.selectedBaseIndices.add(hit.index);
            }
          }
        } else {
          const isSelected = hit.type === 'apex'
            ? this.selectedApexIndices.has(hit.index)
            : this.selectedBaseIndices.has(hit.index);

          if (!isSelected) {
            if (hit.type === 'apex') {
              this.selectedApexIndices = new Set([hit.index]);
              this.selectedBaseIndices.clear();
            } else {
              this.selectedBaseIndices = new Set([hit.index]);
              this.selectedApexIndices.clear();
            }
          }
        }

        this.dragTarget = {
          type: hit.type,
          index: hit.index,
          startPos: { ...pos },
          initialPoints: this.points.map((p) => ({ ...p }))
        };
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {}
        this.render();
        this.updateSidebar();
      } else {
        if (!e.shiftKey) {
          this.selectedApexIndices.clear();
          this.selectedBaseIndices.clear();
        }
        this.marqueeBox = {
          startX: pos.x,
          startY: pos.y,
          currentX: pos.x,
          currentY: pos.y,
          isShift: Boolean(e.shiftKey),
          initialApexSelection: new Set(this.selectedApexIndices),
          initialBaseSelection: new Set(this.selectedBaseIndices)
        };
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {}
        this.render();
      }
    });

    this.canvas.addEventListener('pointermove', (e) => {
      const pos = getPos(e);
      const pad = this.padding;
      const canvasW = this.canvas.clientWidth || this.width;
      const canvasH = this.canvas.clientHeight || this.height;
      const drawW = canvasW - pad * 2;
      const drawH = canvasH - pad * 2;
      const groundY = canvasH - pad;

      if (this.marqueeBox) {
        this.marqueeBox.currentX = pos.x;
        this.marqueeBox.currentY = pos.y;

        const minX = Math.min(this.marqueeBox.startX, pos.x);
        const maxX = Math.max(this.marqueeBox.startX, pos.x);
        const minY = Math.min(this.marqueeBox.startY, pos.y);
        const maxY = Math.max(this.marqueeBox.startY, pos.y);

        const nextApex = new Set(this.marqueeBox.initialApexSelection);
        const nextBase = new Set(this.marqueeBox.initialBaseSelection);

        for (let i = 0; i < this.points.length; i++) {
          const pt = this.points[i];
          const apexPx = pad + pt.x * drawW;
          const apexPy = groundY - pt.y * drawH;
          if (apexPx >= minX && apexPx <= maxX && apexPy >= minY && apexPy <= maxY) {
            nextApex.add(i);
          }

          const launchX = pt.launchX !== undefined ? pt.launchX : pt.x;
          const basePx = pad + launchX * drawW;
          if (basePx >= minX && basePx <= maxX && groundY >= minY && groundY <= maxY) {
            nextBase.add(i);
          }
        }

        this.selectedApexIndices = nextApex;
        this.selectedBaseIndices = nextBase;
        this.render();
        this.updateSidebar();
        return;
      }

      if (!this.dragTarget) {
        const hover = findHit(pos);
        if (hover !== this.hoverTarget) {
          this.hoverTarget = hover;
          this.canvas.style.cursor = hover ? 'grab' : 'crosshair';
          this.render();
        }
        return;
      }

      this.canvas.style.cursor = 'grabbing';
      if (this.wavePreset !== 'custom') {
        this.wavePreset = 'custom';
        if (this.presetSelect) this.presetSelect.value = 'custom';
      }
      if (!this.dragTarget.startPos) {
        const pt = this.points[this.dragTarget.index];
        const px = pad + pt.x * drawW;
        const py = groundY - pt.y * drawH;
        this.dragTarget.startPos = { x: px, y: py };
      }
      if (!this.dragTarget.initialPoints) {
        this.dragTarget.initialPoints = this.points.map((p) => ({ ...p }));
      }

      const deltaNormX = (pos.x - this.dragTarget.startPos.x) / drawW;
      const deltaNormY = -(pos.y - this.dragTarget.startPos.y) / drawH;

      if (this.dragTarget.type === 'apex') {
        const apexIndices = (this.selectedApexIndices && this.selectedApexIndices.has(this.dragTarget.index))
          ? Array.from(this.selectedApexIndices)
          : [this.dragTarget.index];

        if (apexIndices.length === 1) {
          const idx = apexIndices[0];
          const pt = this.points[idx];
          const normX = Math.max(0.0, Math.min(1.0, (pos.x - pad) / drawW));
          const normY = Math.max(0.05, Math.min(1.0, (groundY - pos.y) / drawH));

          if (idx === 0) {
            const maxX = this.points.length > 1 ? this.points[1].x - 0.01 : 1.0;
            pt.x = Math.max(0.0, Math.min(maxX, normX));
          } else if (idx === this.points.length - 1) {
            const minX = this.points.length > 1 ? this.points[idx - 1].x + 0.01 : 0.0;
            pt.x = Math.max(minX, Math.min(1.0, normX));
          } else {
            const minX = this.points[idx - 1].x + 0.01;
            const maxX = this.points[idx + 1].x - 0.01;
            pt.x = Math.max(minX, Math.min(maxX, normX));
          }
          pt.y = normY;
          if (!this.mortarsLocked) {
            pt.launchX = pt.x;
            pt.angle = 0.0;
          } else {
            pt.angle = angleFromTrajectory(pt.launchX ?? pt.x, pt.x, pt.y);
          }
        } else {
          apexIndices.forEach((idx) => {
            const initPt = this.dragTarget.initialPoints[idx];
            const pt = this.points[idx];

            pt.y = Math.max(0.05, Math.min(1.0, initPt.y + deltaNormY));

            if (idx === 0) {
              const maxX = this.points.length > 1 ? this.points[1].x - 0.01 : 1.0;
              pt.x = Math.max(0.0, Math.min(maxX, initPt.x + deltaNormX));
            } else if (idx === this.points.length - 1) {
              const minX = this.points.length > 1 ? this.points[idx - 1].x + 0.01 : 0.0;
              pt.x = Math.max(minX, Math.min(1.0, initPt.x + deltaNormX));
            } else {
              const minX = this.points[idx - 1].x + 0.01;
              const maxX = this.points[idx + 1].x - 0.01;
              pt.x = Math.max(minX, Math.min(maxX, initPt.x + deltaNormX));
            }

            if (!this.mortarsLocked) {
              pt.launchX = pt.x;
              pt.angle = 0.0;
            } else {
              pt.angle = angleFromTrajectory(pt.launchX ?? pt.x, pt.x, pt.y);
            }
          });
        }
      } else if (this.dragTarget.type === 'base') {
        const baseIndices = (this.selectedBaseIndices && this.selectedBaseIndices.has(this.dragTarget.index))
          ? Array.from(this.selectedBaseIndices)
          : [this.dragTarget.index];

        if (baseIndices.length === 1) {
          const idx = baseIndices[0];
          const pt = this.points[idx];
          const normX = Math.max(0.0, Math.min(1.0, (pos.x - pad) / drawW));
          pt.launchX = normX;
          pt.angle = angleFromTrajectory(pt.launchX, pt.x, pt.y);
        } else {
          baseIndices.forEach((idx) => {
            const initPt = this.dragTarget.initialPoints[idx];
            const pt = this.points[idx];
            const initLaunchX = initPt.launchX !== undefined ? initPt.launchX : initPt.x;
            pt.launchX = Math.max(0.0, Math.min(1.0, initLaunchX + deltaNormX));
            pt.angle = angleFromTrajectory(pt.launchX, pt.x, pt.y);
          });
        }
      }

      this.render();
      this.updateSidebar();
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (this.marqueeBox) {
        if (this.selectedApexIndices.size === 0 && this.selectedBaseIndices.size === 0) {
          this.selectedApexIndices = new Set([0]);
        }
        this.marqueeBox = null;
      }
      if (this.dragTarget) {
        this.dragTarget = null;
      }
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {}
      this.render();
      this.updateSidebar();
    });

    this.onKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  render() {
    if (!this.canvas || !this.ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || this.width;
    const h = this.canvas.clientHeight || this.height;

    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);

    const pad = this.padding;
    const drawW = w - pad * 2;
    const drawH = h - pad * 2;
    const groundY = h - pad;

    // Background
    ctx.fillStyle = '#090d13';
    ctx.fillRect(0, 0, w, h);

    // Altitude Grid Lines
    const gridAltitudes = [0.25, 0.50, 0.75, 1.0];
    ctx.strokeStyle = '#1b232f';
    ctx.lineWidth = 1;
    gridAltitudes.forEach((ratio) => {
      const y = groundY - ratio * drawH;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(w - pad, y);
      ctx.stroke();

      const meters = Math.round(75 + ratio * (300 - 75));
      ctx.fillStyle = '#38444d';
      ctx.font = '9px monospace';
      ctx.fillText(`${meters}m (${Math.round(ratio * 100)}%)`, pad + 4, y - 3);
    });

    // Ground Platform
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pad, groundY);
    ctx.lineTo(w - pad, groundY);
    ctx.stroke();

    ctx.fillStyle = '#484f58';
    ctx.font = '10px monospace';
    ctx.fillText('Ground / Mortar Rack', pad + 4, groundY + 14);

    // 1. Draw Trajectory Cords connecting Base to Apex
    this.points.forEach((pt, i) => {
      const launchX = pt.launchX !== undefined ? pt.launchX : pt.x;
      const basePx = pad + launchX * drawW;
      const basePy = groundY;
      const apexPx = pad + pt.x * drawW;
      const apexPy = groundY - pt.y * drawH;

      const isSelected = this.selectedApexIndices.has(i) || this.selectedBaseIndices.has(i);

      // Trajectory parabolic flight cord
      ctx.beginPath();
      ctx.moveTo(basePx, basePy);
      // Quadratic bezier control point simulating ballistic loft
      const ctrlX = (basePx + apexPx) * 0.5;
      const ctrlY = apexPy - 10;
      ctx.quadraticCurveTo(ctrlX, ctrlY, apexPx, apexPy);

      ctx.strokeStyle = isSelected ? '#58a6ff' : 'rgba(88, 166, 255, 0.35)';
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      if (isSelected) {
        ctx.shadowColor = '#58a6ff';
        ctx.shadowBlur = 8;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Angle indicator label near mid-flight
      const deg = Math.round(pt.angle * 180 / Math.PI);
      ctx.fillStyle = isSelected ? '#79c0ff' : '#484f58';
      ctx.font = '9px monospace';
      ctx.fillText(`${deg > 0 ? '+' : ''}${deg}°`, (basePx + apexPx) * 0.5 + 4, (basePy + apexPy) * 0.5);
    });

    // 2. Draw Wave Envelope Line through all apexes
    ctx.beginPath();
    const steps = 80;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const res = evaluateWaveCurve(this.points, t);
      const px = pad + res.x * drawW;
      const py = groundY - res.y * drawH;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#ff7b72';
    ctx.lineWidth = 2.0;
    ctx.stroke();

    // 3. Draw Nodes (Base Launch Mortar & Apex Burst Star)
    this.points.forEach((pt, i) => {
      const launchX = pt.launchX !== undefined ? pt.launchX : pt.x;
      const basePx = pad + launchX * drawW;
      const basePy = groundY;
      const apexPx = pad + pt.x * drawW;
      const apexPy = groundY - pt.y * drawH;

      const isBaseSelected = this.selectedBaseIndices.has(i) ||
        (this.selectedBaseIndices.size === 0 && this.selectedApexIndices.has(i));
      const isApexSelected = this.selectedApexIndices.has(i);

      // Mortar barrel tube aiming at pt.angle
      const barrelLen = 14;
      const barrelTipX = basePx + Math.sin(pt.angle) * barrelLen;
      const barrelTipY = groundY - Math.cos(pt.angle) * barrelLen;

      ctx.save();
      ctx.strokeStyle = isBaseSelected ? '#58a6ff' : '#3fb950';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(basePx, groundY);
      ctx.lineTo(barrelTipX, barrelTipY);
      ctx.stroke();
      ctx.restore();

      // Base Launch Marker (Mortar disc)
      ctx.fillStyle = isBaseSelected ? '#58a6ff' : '#161b22';
      ctx.strokeStyle = isBaseSelected ? '#ffffff' : '#2ea043';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(basePx, basePy, isBaseSelected ? 6.5 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mortar number below ground
      ctx.fillStyle = isBaseSelected ? '#58a6ff' : '#6e7681';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, basePx, groundY + 14);
      ctx.textAlign = 'left';

      // Apex Burst Star Marker
      ctx.fillStyle = isApexSelected ? '#ffffff' : '#ff7b72';
      ctx.strokeStyle = isApexSelected ? '#ff7b72' : '#f85149';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(apexPx, apexPy, isApexSelected ? 7.5 : 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Index label
      ctx.fillStyle = isApexSelected ? '#ffffff' : '#8b949e';
      ctx.font = '10px monospace';
      ctx.fillText(`#${i + 1}`, apexPx - 6, apexPy - 10);
    });

    // 4. Draw Marquee Selection Box
    if (this.marqueeBox) {
      const bx = Math.min(this.marqueeBox.startX, this.marqueeBox.currentX);
      const by = Math.min(this.marqueeBox.startY, this.marqueeBox.currentY);
      const bw = Math.abs(this.marqueeBox.currentX - this.marqueeBox.startX);
      const bh = Math.abs(this.marqueeBox.currentY - this.marqueeBox.startY);
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
    }

    ctx.restore();
  }

  syncShots() {
    this.syncToShellCount();
  }

  syncToShellCount() {
    const count = this.shellCount;
    const newPoints = [];
    for (let i = 0; i < count; i++) {
      const progress = count > 1 ? i / (count - 1) : 0.5;
      const evalPt = evaluateWaveCurve(this.points, progress);
      newPoints.push({
        x: Number(progress.toFixed(3)),
        y: Number(evalPt.y.toFixed(3)),
        launchX: Number((evalPt.launchX ?? progress).toFixed(3)),
        angle: Number(evalPt.angle.toFixed(3))
      });
    }
    this.points = newPoints;
    this.selectedIndex = 0;
    this.render();
    this.updateSidebar();
  }

  applyPreset(presetKey) {
    if (presetKey === 'custom') {
      this.wavePreset = 'custom';
      if (this.presetSelect) this.presetSelect.value = 'custom';
      return;
    }
    this.points = generateWavePreset(presetKey, this.shellCount);
    this.wavePreset = presetKey;
    if (this.presetSelect) this.presetSelect.value = presetKey;
    this.selectedIndex = 0;
    this.render();
    this.updateSidebar();
  }

  applyArchPreset() {
    this.applyPreset('arch');
  }

  applyDoublePeakPreset() {
    this.applyPreset('double_peak');
  }

  applyWavePreset() {
    this.applyPreset('wave');
  }

  applySlopePreset() {
    this.applyPreset('slope');
  }

  applyVShapePreset() {
    this.applyPreset('v_shape');
  }

  applyCrissCrossPreset() {
    this.applyPreset('criss_cross');
  }

  resetMortars() {
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      this.points[i].launchX = n > 1 ? Number((i / (n - 1)).toFixed(3)) : 0.5;
      this.points[i].angle = angleFromTrajectory(this.points[i].launchX, this.points[i].x, this.points[i].y);
    }
    this.wavePreset = 'custom';
    if (this.presetSelect) this.presetSelect.value = 'custom';
    this.render();
    this.updateSidebar();
  }

  addPoint() {
    if (this.points.length >= 24) return;
    this.shellCount = this.points.length + 1;
    if (this.wavePreset && this.wavePreset !== 'custom') {
      this.points = generateWavePreset(this.wavePreset, this.shellCount);
    } else {
      this.points = resampleWavePoints(this.points, this.shellCount);
    }
    this.selectedIndex = Math.min(this.selectedIndex + 1, this.points.length - 1);
    this.render();
    this.updateSidebar();
  }

  removePoint() {
    if (this.points.length <= 2) return;
    const toRemove = Array.from(this.selectedApexIndices || []).filter(
      (idx) => idx >= 0 && idx < this.points.length
    ).sort((a, b) => b - a);

    if (toRemove.length > 0 && this.points.length - toRemove.length >= 2) {
      toRemove.forEach((idx) => {
        this.points.splice(idx, 1);
      });
      this.shellCount = this.points.length;
      this.selectedApexIndices = new Set([0]);
      this.selectedBaseIndices.clear();
      this.wavePreset = 'custom';
      if (this.presetSelect) this.presetSelect.value = 'custom';
    } else {
      this.shellCount = this.points.length - 1;
      const idx = this.selectedIndex ?? (this.points.length - 1);
      if (idx >= 0 && idx < this.points.length) {
        this.points.splice(idx, 1);
        this.selectedIndex = Math.max(0, Math.min(idx, this.points.length - 1));
        this.wavePreset = 'custom';
        if (this.presetSelect) this.presetSelect.value = 'custom';
      } else if (this.wavePreset && this.wavePreset !== 'custom') {
        this.points = generateWavePreset(this.wavePreset, this.shellCount);
      } else {
        this.points = resampleWavePoints(this.points, this.shellCount);
      }
    }
    this.render();
    this.updateSidebar();
  }

  getCleanPoints() {
    return this.points.map((p) => ({
      x: Number(p.x.toFixed(3)),
      y: Number(p.y.toFixed(3)),
      launchX: Number((p.launchX ?? p.x).toFixed(3)),
      angle: Number(p.angle.toFixed(3))
    }));
  }

  close() {
    if (typeof window !== 'undefined' && this.onKeyDown) {
      window.removeEventListener('keydown', this.onKeyDown);
    }
    if (this.overlay) {
      if (typeof this.overlay.remove === 'function') {
        this.overlay.remove();
      } else if (this.overlay.parentElement) {
        this.overlay.parentElement.removeChild(this.overlay);
      }
    }
  }
}
