/**
 * WaveCurveEditor.js
 * Interactive canvas widget for visually editing 2D wave trajectories,
 * ground launch mortar positions, apex heights, and firing angles
 * for sweep firework patterns where each control point is an individual shell.
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
import { WaveCurveModal } from './WaveCurveModal.js';
import { createSvgIcon, createIconButton } from './IconHelper.js';
import { t } from '../config/lang/i18n.js';

export class WaveCurveEditor {
  /**
   * @param {Object} options
   * @param {Array} [options.points] Initial control points
   * @param {number} [options.shellCount=12] Number of shells (1-to-1 with curve peaks)
   * @param {Function} [options.onChange] Callback on curve change: (points, shellCount) => {}
   */
  constructor(options = {}) {
    this.shellCount = Math.max(2, options.shellCount || 12);
    this.wavePreset = options.wavePreset || 'custom';
    // Guarantees 1-to-1 correspondence: number of peaks is exactly the number of shells
    this.points = resampleWavePoints(options.points || DEFAULT_WAVE_POINTS, this.shellCount);
    this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};

    this.dragTarget = null; // { type: 'apex' | 'base' | 'angle', index: number }
    this.hoverTarget = null;
    this.selectedApexIndices = new Set([0]);
    this.selectedBaseIndices = new Set();
    this.marqueeBox = null;
    this.mortarsLocked = true;

    this.container = document.createElement('div');
    this.container.className = 'wave-curve-editor-container';

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wave-curve-canvas';
    this.ctx = this.canvas.getContext('2d');

    this.padding = 16;
    this.width = 280;
    this.height = 160;

    this.setupUI();
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

  setupUI() {
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '8px';
    this.container.style.width = '100%';
    this.container.style.boxSizing = 'border-box';

    // Canvas styling
    this.canvas.tabIndex = 0;
    this.canvas.style.width = '100%';
    this.canvas.style.height = `${this.height}px`;
    this.canvas.style.background = '#0d1117';
    this.canvas.style.borderRadius = '6px';
    this.canvas.style.border = '1px solid #30363d';
    this.canvas.style.cursor = 'crosshair';
    this.canvas.style.touchAction = 'none';
    this.canvas.style.outline = 'none';

    this.container.appendChild(this.canvas);

    // Unified control row: Preset Dropdown (left) & compact icon buttons (right)
    const controlRow = document.createElement('div');
    controlRow.className = 'wave-curve-control-row';
    controlRow.style.display = 'flex';
    controlRow.style.alignItems = 'center';
    controlRow.style.justifyContent = 'space-between';
    controlRow.style.gap = '6px';
    controlRow.style.width = '100%';

    // Preset dropdown select
    const presetSelect = document.createElement('select');
    presetSelect.className = 'wave-curve-preset-select';
    presetSelect.style.flex = '1';
    presetSelect.style.minWidth = '0';
    presetSelect.style.height = '26px';
    presetSelect.style.padding = '0 6px';
    presetSelect.style.fontSize = '11px';
    presetSelect.style.background = '#21262d';
    presetSelect.style.color = '#c9d1d9';
    presetSelect.style.border = '1px solid #30363d';
    presetSelect.style.borderRadius = '4px';
    presetSelect.style.cursor = 'pointer';
    presetSelect.style.outline = 'none';
    presetSelect.style.boxSizing = 'border-box';

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
      e.preventDefault();
      this.applyPreset(e.target.value);
    });
    this.presetSelect = presetSelect;
    controlRow.appendChild(presetSelect);

    // Right icon buttons group
    const iconGroup = document.createElement('div');
    iconGroup.style.display = 'flex';
    iconGroup.style.alignItems = 'center';
    iconGroup.style.gap = '4px';
    iconGroup.style.flexShrink = '0';

    const addBtn = createIconButton({
      icon: 'plus',
      iconSize: 13,
      color: '#3fb950',
      hoverColor: '#ffffff',
      hoverBg: '#238636',
      title: t('editor.inspector.waveCurve.addPoint') || 'Add Shell',
      onClick: () => this.addPoint()
    });

    const removeBtn = createIconButton({
      icon: 'minus',
      iconSize: 13,
      color: '#f85149',
      hoverColor: '#ffffff',
      hoverBg: 'rgba(248, 81, 73, 0.3)',
      title: t('editor.inspector.waveCurve.deletePoint') || 'Delete Shell',
      onClick: () => this.removePoint()
    });

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

    const updateLockState = () => {
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
    updateLockState();

    lockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.mortarsLocked = !this.mortarsLocked;
      updateLockState();
    });

    const resetMortarsBtn = createIconButton({
      icon: 'reset',
      iconSize: 13,
      color: '#c9d1d9',
      hoverColor: '#58a6ff',
      hoverBg: '#30363d',
      title: t('editor.inspector.waveCurve.resetMortars') || 'Reset Mortars',
      onClick: () => this.resetMortars()
    });

    const mirrorBtn = createIconButton({
      icon: 'mirror',
      iconSize: 13,
      color: '#c9d1d9',
      hoverColor: '#58a6ff',
      hoverBg: '#30363d',
      title: t('editor.inspector.waveCurve.mirror') || 'Mirror Horizontal',
      onClick: () => this.mirrorCurve()
    });

    const expandBtn = createIconButton({
      icon: 'expand',
      iconSize: 13,
      color: '#58a6ff',
      hoverColor: '#ffffff',
      hoverBg: 'rgba(56, 139, 253, 0.3)',
      title: t('editor.inspector.waveCurve.expandStudio') || 'Expand Studio',
      onClick: () => this.openModal()
    });

    iconGroup.appendChild(addBtn);
    iconGroup.appendChild(removeBtn);
    iconGroup.appendChild(lockBtn);
    iconGroup.appendChild(resetMortarsBtn);
    iconGroup.appendChild(mirrorBtn);
    iconGroup.appendChild(expandBtn);
    controlRow.appendChild(iconGroup);

    this.container.appendChild(controlRow);

    // Hint label
    const hint = document.createElement('div');
    hint.style.fontSize = '10px';
    hint.style.color = '#8b949e';
    hint.style.lineHeight = '1.4';
    hint.textContent = t('editor.inspector.waveCurve.hint') ||
      'Each peak is a shell. Drag star to set burst apex, drag ground square to set mortar launch origin.';
    this.container.appendChild(hint);
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
    this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
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
    this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
  }

  mirrorCurve() {
    if (!Array.isArray(this.points) || this.points.length < 2) return;

    const hasSubset = this.selectedApexIndices &&
      this.selectedApexIndices.size > 1 &&
      this.selectedApexIndices.size < this.points.length;

    if (hasSubset) {
      const indices = Array.from(this.selectedApexIndices).sort((a, b) => a - b);
      const k = indices.length;

      const minX = Math.min(...indices.map((idx) => this.points[idx].x));
      const maxX = Math.max(...indices.map((idx) => this.points[idx].x));
      const minLaunchX = Math.min(...indices.map((idx) => this.points[idx].launchX ?? this.points[idx].x));
      const maxLaunchX = Math.max(...indices.map((idx) => this.points[idx].launchX ?? this.points[idx].x));

      const snapshot = indices.map((idx) => ({ ...this.points[idx] }));

      for (let i = 0; i < k; i++) {
        const targetIdx = indices[i];
        const sourcePt = snapshot[k - 1 - i];

        this.points[targetIdx].y = sourcePt.y;
        this.points[targetIdx].x = Number(Math.max(0.0, Math.min(1.0, minX + maxX - sourcePt.x)).toFixed(3));
        const srcLaunch = sourcePt.launchX !== undefined ? sourcePt.launchX : sourcePt.x;
        this.points[targetIdx].launchX = Number(Math.max(0.0, Math.min(1.0, minLaunchX + maxLaunchX - srcLaunch)).toFixed(3));
        this.points[targetIdx].angle = Number((-sourcePt.angle).toFixed(3));
      }
    } else {
      const n = this.points.length;
      const snapshot = this.points.map((p) => ({ ...p }));

      for (let i = 0; i < n; i++) {
        const sourcePt = snapshot[n - 1 - i];
        this.points[i].y = sourcePt.y;
        this.points[i].x = Number(Math.max(0.0, Math.min(1.0, 1.0 - sourcePt.x)).toFixed(3));
        const srcLaunch = sourcePt.launchX !== undefined ? sourcePt.launchX : sourcePt.x;
        this.points[i].launchX = Number(Math.max(0.0, Math.min(1.0, 1.0 - srcLaunch)).toFixed(3));
        this.points[i].angle = Number((-sourcePt.angle).toFixed(3));
      }
    }

    this.wavePreset = 'custom';
    if (this.presetSelect) this.presetSelect.value = 'custom';
    this.render();
    this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
  }

  openModal() {
    const modal = new WaveCurveModal({
      points: this.points,
      shellCount: this.shellCount,
      wavePreset: this.wavePreset,
      onApply: (newPoints, newCount, newPreset) => {
        if (newCount && newCount !== this.shellCount) {
          this.shellCount = newCount;
        }
        if (newPreset) {
          this.wavePreset = newPreset;
          if (this.presetSelect) this.presetSelect.value = newPreset;
        }
        this.setPoints(newPoints);
      }
    });
    if (modal.overlay && !modal.overlay.parentElement && typeof document !== 'undefined' && document.body) {
      document.body.appendChild(modal.overlay);
    }
    return modal;
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
    this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
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
      const idxToRemove = this.selectedIndex;
      if (idxToRemove >= 0 && idxToRemove < this.points.length) {
        this.points.splice(idxToRemove, 1);
        this.selectedIndex = Math.max(0, Math.min(idxToRemove, this.points.length - 1));
        this.wavePreset = 'custom';
        if (this.presetSelect) this.presetSelect.value = 'custom';
      } else if (this.wavePreset && this.wavePreset !== 'custom') {
        this.points = generateWavePreset(this.wavePreset, this.shellCount);
      } else {
        this.points = resampleWavePoints(this.points, this.shellCount);
      }
    }
    this.render();
    this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
  }

  setPoints(newPoints) {
    this.shellCount = Math.max(2, newPoints?.length || this.shellCount);
    this.points = resampleWavePoints(newPoints, this.shellCount);
    this.selectedIndex = Math.min(this.selectedIndex, this.points.length - 1);
    this.render();
    this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
  }

  setShellCount(count) {
    const newCount = Math.max(2, count || 12);
    if (newCount !== this.shellCount || newCount !== this.points.length) {
      this.shellCount = newCount;
      if (this.wavePreset && this.wavePreset !== 'custom') {
        this.points = generateWavePreset(this.wavePreset, this.shellCount);
      } else {
        this.points = resampleWavePoints(this.points, this.shellCount);
      }
      this.selectedIndex = Math.min(this.selectedIndex, this.points.length - 1);
      this.render();
      this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
    }
  }

  getCleanPoints() {
    return this.points.map((p) => ({
      x: Number(p.x.toFixed(3)),
      y: Number(p.y.toFixed(3)),
      launchX: Number((p.launchX ?? p.x).toFixed(3)),
      angle: Number(p.angle.toFixed(3))
    }));
  }

  toPixel(normX, normY) {
    const drawW = this.canvas.width - this.padding * 2;
    const drawH = this.canvas.height - this.padding * 2;
    const px = this.padding + normX * drawW;
    const py = this.canvas.height - this.padding - normY * drawH;
    return { px, py };
  }

  toNormalized(pixelX, pixelY) {
    const drawW = this.canvas.width - this.padding * 2;
    const drawH = this.canvas.height - this.padding * 2;
    const normX = Math.max(0.0, Math.min(1.0, (pixelX - this.padding) / drawW));
    const normY = Math.max(0.05, Math.min(1.0, (this.canvas.height - this.padding - pixelY) / drawH));
    return { normX, normY };
  }

  bindEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const findHit = (pos) => {
      const handleLen = 22;
      const groundY = this.canvas.height - this.padding;

      for (let i = 0; i < this.points.length; i++) {
        const pt = this.points[i];
        const { px, py } = this.toPixel(pt.x, pt.y);

        // 1. Check Angle lever handle knob
        const handleX = px + Math.sin(pt.angle) * handleLen;
        const handleY = py - Math.cos(pt.angle) * handleLen;
        const distAngle = Math.hypot(pos.x - handleX, pos.y - handleY);
        if (distAngle <= 8) {
          return { type: 'angle', index: i };
        }

        // 2. Check Burst Apex Star handle
        const distApex = Math.hypot(pos.x - px, pos.y - py);
        if (distApex <= 10) {
          return { type: 'apex', index: i };
        }

        // 3. Check Ground Mortar Base handle
        const launchX = pt.launchX !== undefined ? pt.launchX : pt.x;
        const basePx = this.padding + launchX * (this.canvas.width - this.padding * 2);
        const distBase = Math.hypot(pos.x - basePx, pos.y - groundY);
        if (distBase <= 11) {
          return { type: 'base', index: i };
        }
      }
      return null;
    };

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) return;
      const pos = getPos(e);
      const hit = findHit(pos);
      if (hit) {
        if (e.shiftKey) {
          if (hit.type === 'apex' || hit.type === 'angle') {
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
          const isSelected = (hit.type === 'apex' || hit.type === 'angle')
            ? this.selectedApexIndices.has(hit.index)
            : this.selectedBaseIndices.has(hit.index);

          if (!isSelected) {
            if (hit.type === 'apex' || hit.type === 'angle') {
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
        this.render();
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
        this.render();
      }
    });

    window.addEventListener('mousemove', (e) => {
      const pos = getPos(e);

      if (this.marqueeBox) {
        this.marqueeBox.currentX = pos.x;
        this.marqueeBox.currentY = pos.y;

        const minX = Math.min(this.marqueeBox.startX, pos.x);
        const maxX = Math.max(this.marqueeBox.startX, pos.x);
        const minY = Math.min(this.marqueeBox.startY, pos.y);
        const maxY = Math.max(this.marqueeBox.startY, pos.y);

        const pad = this.padding;
        const drawW = this.canvas.width - pad * 2;
        const drawH = this.canvas.height - pad * 2;
        const groundY = this.canvas.height - pad;

        const nextApex = new Set(this.marqueeBox.initialApexSelection);
        const nextBase = new Set(this.marqueeBox.initialBaseSelection);

        for (let i = 0; i < this.points.length; i++) {
          const pt = this.points[i];
          const px = pad + pt.x * drawW;
          const py = this.canvas.height - pad - pt.y * drawH;
          if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
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
        return;
      }

      if (!this.dragTarget) {
        const hit = findHit(pos);
        if (hit) {
          this.canvas.style.cursor =
            hit.type === 'angle' ? 'grab' : hit.type === 'base' ? 'ew-resize' : 'move';
        } else {
          this.canvas.style.cursor = 'crosshair';
        }
        return;
      }

      if (!this.dragTarget.startPos) {
        const pt = this.points[this.dragTarget.index];
        const { px, py } = this.toPixel(pt.x, pt.y);
        this.dragTarget.startPos = { x: px, y: py };
      }
      if (!this.dragTarget.initialPoints) {
        this.dragTarget.initialPoints = this.points.map((p) => ({ ...p }));
      }

      const drawW = this.canvas.width - this.padding * 2;
      const drawH = this.canvas.height - this.padding * 2;
      const deltaNormX = (pos.x - this.dragTarget.startPos.x) / drawW;
      const deltaNormY = -(pos.y - this.dragTarget.startPos.y) / drawH;

      if (this.dragTarget.type === 'apex') {
        const apexIndices = (this.selectedApexIndices && this.selectedApexIndices.has(this.dragTarget.index))
          ? Array.from(this.selectedApexIndices)
          : [this.dragTarget.index];

        if (apexIndices.length === 1) {
          const idx = apexIndices[0];
          const pt = this.points[idx];
          const { normX, normY } = this.toNormalized(pos.x, pos.y);
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
          const { normX } = this.toNormalized(pos.x, pos.y);
          pt.launchX = Math.max(0.0, Math.min(1.0, normX));
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
      } else if (this.dragTarget.type === 'angle') {
        const pivotIdx = this.dragTarget.index;
        const pivotInit = this.dragTarget.initialPoints[pivotIdx];
        const { px, py } = this.toPixel(pivotInit.x, pivotInit.y);
        const dx = pos.x - px;
        const dy = -(pos.y - py);
        let computedAngle = Math.atan2(dx, dy);
        if (dy < 0) {
          computedAngle = dx >= 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          computedAngle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, computedAngle));
        }
        const deltaAngle = computedAngle - pivotInit.angle;

        const apexIndices = this.selectedApexIndices.has(pivotIdx)
          ? Array.from(this.selectedApexIndices)
          : [pivotIdx];

        apexIndices.forEach((idx) => {
          const initPt = this.dragTarget.initialPoints[idx];
          const pt = this.points[idx];
          let newAngle = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, initPt.angle + deltaAngle));
          pt.angle = newAngle;
          pt.launchX = launchXFromAngle(pt.x, pt.y, newAngle);
        });
      }

      if (this.wavePreset !== 'custom') {
        this.wavePreset = 'custom';
        if (this.presetSelect) this.presetSelect.value = 'custom';
      }

      this.render();
      this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
    });

    window.addEventListener('mouseup', () => {
      if (this.marqueeBox) {
        if (this.selectedApexIndices.size === 0 && this.selectedBaseIndices.size === 0) {
          this.selectedApexIndices = new Set([0]);
        }
        this.marqueeBox = null;
        this.render();
      }
      if (this.dragTarget) {
        this.dragTarget = null;
        this.onChange(this.getCleanPoints(), this.shellCount, this.wavePreset);
      }
    });

    this.canvas.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        this.removePoint();
      }
    });
  }

  render() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const rect = this.canvas.getBoundingClientRect
      ? this.canvas.getBoundingClientRect()
      : { width: this.width, height: this.height };
    const w = rect.width || this.width;
    const h = rect.height || this.height;

    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);

    const canvasW = w;
    const canvasH = h;
    const pad = this.padding;
    const drawW = canvasW - pad * 2;
    const drawH = canvasH - pad * 2;

    // Background
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Horizontal Grid Lines
    const gridSteps = [0.25, 0.5, 0.75, 1.0];
    ctx.strokeStyle = '#21262d';
    ctx.lineWidth = 1;
    gridSteps.forEach((ratio) => {
      const y = canvasH - pad - ratio * drawH;
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(canvasW - pad, y);
      ctx.stroke();

      ctx.fillStyle = '#484f58';
      ctx.font = '9px sans-serif';
      ctx.fillText(`${Math.round(ratio * 100)}%`, pad + 2, y - 2);
    });

    // Ground line (0%)
    const groundY = canvasH - pad;
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pad, groundY);
    ctx.lineTo(canvasW - pad, groundY);
    ctx.stroke();

    // 1. Draw Connecting Trajectory Cords (Ground Mortar -> Burst Apex)
    for (let i = 0; i < this.points.length; i++) {
      const pt = this.points[i];
      const isSelected = this.selectedApexIndices.has(i) || this.selectedBaseIndices.has(i);
      const launchX = pt.launchX !== undefined ? pt.launchX : pt.x;
      const basePx = pad + launchX * drawW;
      const apexPx = pad + pt.x * drawW;
      const apexPy = canvasH - pad - pt.y * drawH;

      ctx.save();
      ctx.strokeStyle = isSelected ? '#58a6ff' : 'rgba(139, 148, 158, 0.45)';
      ctx.lineWidth = isSelected ? 1.8 : 1.0;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(basePx, groundY);
      const ctrlX = basePx + (apexPx - basePx) * 0.35;
      const ctrlY = groundY - (groundY - apexPy) * 0.75;
      ctx.quadraticCurveTo(ctrlX, ctrlY, apexPx, apexPy);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Draw Smooth Apex Envelope Wave Curve across all shells
    const steps = 70;
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const tVal = s / steps;
      const res = evaluateWaveCurve(this.points, tVal);
      const px = pad + res.x * drawW;
      const py = canvasH - pad - res.y * drawH;
      if (s === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }

    const grad = ctx.createLinearGradient(pad, 0, canvasW - pad, 0);
    grad.addColorStop(0, '#58a6ff');
    grad.addColorStop(0.5, '#79c0ff');
    grad.addColorStop(1, '#a5d6ff');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.0;
    ctx.shadowColor = '#58a6ff';
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 3. Draw Selected Shell Info HUD at top-right
    if (this.selectedApexIndices.size > 1) {
      ctx.fillStyle = '#79c0ff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${this.selectedApexIndices.size} Shells Selected`,
        canvasW - pad,
        pad - 4
      );
      ctx.textAlign = 'left';
    } else if (this.selectedBaseIndices.size > 1) {
      ctx.fillStyle = '#79c0ff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `${this.selectedBaseIndices.size} Mortars Selected`,
        canvasW - pad,
        pad - 4
      );
      ctx.textAlign = 'left';
    } else if (this.selectedIndex !== null && this.points[this.selectedIndex]) {
      const selPt = this.points[this.selectedIndex];
      const deg = Math.round((selPt.angle * 180) / Math.PI);
      const lX = Math.round((selPt.launchX ?? selPt.x) * 100);
      const aX = Math.round(selPt.x * 100);
      const aY = Math.round(selPt.y * 100);

      ctx.fillStyle = '#79c0ff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(
        `#${this.selectedIndex + 1}/${this.points.length} Base:${lX}% Apex:${aX}%,${aY}% ${deg}°`,
        canvasW - pad,
        pad - 4
      );
      ctx.textAlign = 'left';
    }

    // 4. Draw Ground Mortar Base Markers for each shell
    for (let i = 0; i < this.points.length; i++) {
      const pt = this.points[i];
      const launchX = pt.launchX !== undefined ? pt.launchX : pt.x;
      const basePx = pad + launchX * drawW;
      const isSelected = this.selectedBaseIndices.has(i) ||
        (this.selectedBaseIndices.size === 0 && this.selectedApexIndices.has(i));

      // Mortar barrel tube angled towards pt.angle
      const barrelLen = 10;
      const barrelTipX = basePx + Math.sin(pt.angle) * barrelLen;
      const barrelTipY = groundY - Math.cos(pt.angle) * barrelLen;

      ctx.save();
      ctx.strokeStyle = isSelected ? '#38bdf8' : '#3fb950';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(basePx, groundY);
      ctx.lineTo(barrelTipX, barrelTipY);
      ctx.stroke();
      ctx.restore();

      // Base platform
      ctx.fillStyle = isSelected ? '#38bdf8' : '#238636';
      ctx.strokeStyle = isSelected ? '#ffffff' : '#2ea043';
      ctx.lineWidth = 1.2;
      ctx.fillRect(basePx - 4, groundY - 3, 8, 5);
      ctx.strokeRect(basePx - 4, groundY - 3, 8, 5);

      ctx.beginPath();
      ctx.arc(basePx, groundY - 3, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffffff' : '#3fb950';
      ctx.fill();

      // Shell index number below ground
      ctx.fillStyle = isSelected ? '#38bdf8' : '#6e7681';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, basePx, groundY + 11);
      ctx.textAlign = 'left';
    }

    // 5. Draw Shell Apex Nodes & Angle Handles (Each node IS a shell)
    const handleLen = 20;
    for (let i = 0; i < this.points.length; i++) {
      const pt = this.points[i];
      const px = pad + pt.x * drawW;
      const py = canvasH - pad - pt.y * drawH;
      const isSelected = this.selectedApexIndices.has(i);

      // Shell apex index number above star node
      ctx.fillStyle = isSelected ? '#ffffff' : '#8b949e';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${i + 1}`, px, py - 11);
      ctx.textAlign = 'left';

      // Angle vector lever
      const handleX = px + Math.sin(pt.angle) * handleLen;
      const handleY = py - Math.cos(pt.angle) * handleLen;

      ctx.strokeStyle = isSelected ? '#fbbf24' : '#e3b341';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(handleX, handleY);
      ctx.stroke();

      ctx.fillStyle = isSelected ? '#fde68a' : '#f2cc60';
      ctx.beginPath();
      ctx.arc(handleX, handleY, isSelected ? 4.0 : 3.0, 0, Math.PI * 2);
      ctx.fill();

      // Vertex point halo / selection ring
      if (isSelected) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 9.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(88, 166, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(px, py, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shell apex node core
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = isSelected ? '#0284c7' : '#1f6feb';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(px, py, 4.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // 6. Draw Marquee Selection Box
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

  getElement() {
    return this.container;
  }

  destroy() {
    this.container.remove();
  }
}
