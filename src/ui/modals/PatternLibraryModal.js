import { t } from '../../config/lang/i18n.js';
import {
  createModalButton,
  createModalShell
} from '../ModalShell.js';
import { patternRegistry } from '../../core/PatternRegistry.js';
import { evaluateWaveCurve } from '../../utils/SplineMath.js';
import { createIconButton } from '../IconHelper.js';
import { showToast } from '../../utils/Toast.js';

export class PatternLibraryModal {
  /**
   * @param {Object} [options]
   * @param {Function} [options.onApply] Callback: (pattern, { matchShellCount }) => {}
   */
  constructor(options = {}) {
    this.onApply = typeof options.onApply === 'function' ? options.onApply : () => {};
    this.isVisible = false;
    this.searchQuery = '';
    this.matchShellCount = false;
    this.editingSlug = null;

    this._createDOM();
    this.unsubscribe = patternRegistry.subscribe(() => {
      if (this.isVisible) {
        this.renderGrid();
      }
    });
  }

  _createDOM() {
    const {
      overlay,
      dialog,
      titleEl,
      subtitleEl
    } = createModalShell({
      overlayClass: 'pattern-library-overlay',
      dialogClass: 'pattern-library-dialog',
      width: '860px',
      title: t('editor.patternLibrary.title') || 'Sweep Pattern Library',
      subtitle: t('editor.patternLibrary.subtitle') || 'Browse, preview, rename, and apply saved custom sweep curves',
      closeTitle: t('common.close') || 'Close',
      onClose: () => this.hide()
    });

    this.overlay = overlay;
    this.dialog = dialog;
    this.titleEl = titleEl;
    this.subtitleEl = subtitleEl;

    this.dialog.style.maxWidth = '95vw';
    this.dialog.style.maxHeight = '86vh';
    this.dialog.style.height = '82vh';
    this.dialog.style.display = 'flex';
    this.dialog.style.flexDirection = 'column';

    // Toolbar: Search input
    const toolbar = document.createElement('div');
    toolbar.className = 'pattern-library-toolbar';
    toolbar.style.display = 'flex';
    toolbar.style.alignItems = 'center';
    toolbar.style.justifyContent = 'space-between';
    toolbar.style.gap = '10px';
    toolbar.style.padding = '12px 20px';
    toolbar.style.background = 'rgba(15, 23, 42, 0.6)';
    toolbar.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';

    this.searchInput = document.createElement('input');
    this.searchInput.type = 'text';
    this.searchInput.className = 'pattern-library-search';
    this.searchInput.placeholder = t('editor.patternLibrary.searchPlaceholder') || 'Search saved patterns...';
    this.searchInput.style.flex = '1';
    this.searchInput.style.maxWidth = '320px';
    this.searchInput.style.height = '32px';
    this.searchInput.style.padding = '0 12px';
    this.searchInput.style.fontSize = '12px';
    this.searchInput.style.background = '#0d1117';
    this.searchInput.style.color = '#e6edf3';
    this.searchInput.style.border = '1px solid #30363d';
    this.searchInput.style.borderRadius = '6px';
    this.searchInput.style.outline = 'none';
    this.searchInput.addEventListener('input', (e) => {
      this.searchQuery = String(e.target.value || '').trim().toLowerCase();
      this.renderGrid();
    });
    toolbar.appendChild(this.searchInput);

    // Count badge
    this.countBadge = document.createElement('span');
    this.countBadge.style.fontSize = '12px';
    this.countBadge.style.color = '#8b949e';
    toolbar.appendChild(this.countBadge);

    this.dialog.appendChild(toolbar);

    // Body grid container
    this.gridContainer = document.createElement('div');
    this.gridContainer.className = 'pattern-library-grid-container';
    this.gridContainer.style.flex = '1';
    this.gridContainer.style.overflowY = 'auto';
    this.gridContainer.style.padding = '18px 20px';
    this.dialog.appendChild(this.gridContainer);

    // Footer: Match shell count toggle + Close
    const footer = document.createElement('div');
    footer.className = 'pattern-library-footer';
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'space-between';
    footer.style.padding = '12px 20px';
    footer.style.borderTop = '1px solid rgba(255, 255, 255, 0.08)';
    footer.style.background = 'rgba(15, 23, 42, 0.6)';

    const matchLabel = document.createElement('label');
    matchLabel.style.display = 'inline-flex';
    matchLabel.style.alignItems = 'center';
    matchLabel.style.gap = '8px';
    matchLabel.style.fontSize = '12px';
    matchLabel.style.color = '#c9d1d9';
    matchLabel.style.cursor = 'pointer';

    this.matchCheckbox = document.createElement('input');
    this.matchCheckbox.type = 'checkbox';
    this.matchCheckbox.checked = this.matchShellCount;
    this.matchCheckbox.addEventListener('change', (e) => {
      this.matchShellCount = Boolean(e.target.checked);
    });

    const matchText = document.createElement('span');
    matchText.textContent = t('editor.patternLibrary.matchShellCount') || 'Match saved shell count';

    matchLabel.appendChild(this.matchCheckbox);
    matchLabel.appendChild(matchText);
    footer.appendChild(matchLabel);

    const closeFooterBtn = createModalButton(
      t('common.close') || 'Close',
      'secondary'
    );
    closeFooterBtn.addEventListener('click', () => this.hide());
    footer.appendChild(closeFooterBtn);

    this.dialog.appendChild(footer);
  }

  _drawThumbnail(canvas, points) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    const pad = 12;
    const innerW = w - pad * 2;
    const innerH = h - pad * 2;

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.fillStyle = '#090d13';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();

    if (!Array.isArray(points) || points.length === 0) return;

    const toPx = (nx, ny) => ({
      px: pad + nx * innerW,
      py: h - pad - ny * innerH
    });

    // Trajectory lines from mortar launchX to apex (x, y)
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.28)';
    ctx.lineWidth = 1;
    for (const pt of points) {
      const lx = pt.launchX !== undefined ? pt.launchX : pt.x;
      const start = toPx(lx, 0);
      const end = toPx(pt.x, pt.y);
      ctx.beginPath();
      ctx.moveTo(start.px, start.py);
      ctx.lineTo(end.px, end.py);
      ctx.stroke();
    }

    // Smooth spline curve
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const tParam = i / steps;
      const evaluated = evaluateWaveCurve(points, tParam);
      const { px, py } = toPx(evaluated.x, evaluated.y);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();

    // Control apex dots (highlight first point in green to show sweep direction)
    points.forEach((pt, idx) => {
      const { px, py } = toPx(pt.x, pt.y);
      ctx.fillStyle = idx === 0 ? '#3fb950' : '#f0883e';
      ctx.beginPath();
      ctx.arc(px, py, idx === 0 ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  renderGrid() {
    this.gridContainer.innerHTML = '';
    const allPatterns = patternRegistry.getAllPatterns();
    const filtered = this.searchQuery
      ? allPatterns.filter((p) => (
        p.name.toLowerCase().includes(this.searchQuery) ||
        p.slug.toLowerCase().includes(this.searchQuery)
      ))
      : allPatterns;

    const countLabel = t('editor.patternLibrary.countLabel') || 'Saved patterns';
    this.countBadge.textContent = `${countLabel}: ${filtered.length}`;

    if (filtered.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'pattern-library-empty';
      emptyState.style.textAlign = 'center';
      emptyState.style.padding = '48px 20px';
      emptyState.style.color = '#8b949e';
      emptyState.style.fontSize = '13px';
      emptyState.textContent = this.searchQuery
        ? (t('editor.patternLibrary.noMatches') || 'No saved patterns match your search.')
        : (t('editor.patternLibrary.empty') || 'No saved patterns yet. Edit a custom sweep curve and click Save to add one.');
      this.gridContainer.appendChild(emptyState);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'pattern-library-grid';
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
    grid.style.gap = '14px';

    for (const pattern of filtered) {
      const card = document.createElement('div');
      card.className = 'pattern-library-card';
      card.dataset.slug = pattern.slug;
      card.style.background = '#161b22';
      card.style.border = '1px solid #30363d';
      card.style.borderRadius = '8px';
      card.style.overflow = 'hidden';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.transition = 'border-color 0.15s ease';

      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 220;
      thumbCanvas.height = 110;
      thumbCanvas.style.width = '100%';
      thumbCanvas.style.height = '110px';
      thumbCanvas.style.display = 'block';
      thumbCanvas.style.borderBottom = '1px solid #21262d';
      this._drawThumbnail(thumbCanvas, pattern.points);
      card.appendChild(thumbCanvas);

      const info = document.createElement('div');
      info.style.padding = '10px 12px';
      info.style.display = 'flex';
      info.style.flexDirection = 'column';
      info.style.gap = '8px';

      // Title row or inline rename input
      const headerRow = document.createElement('div');
      headerRow.style.display = 'flex';
      headerRow.style.alignItems = 'center';
      headerRow.style.justifyContent = 'space-between';
      headerRow.style.gap = '6px';

      if (this.editingSlug === pattern.slug) {
        const renameInput = document.createElement('input');
        renameInput.type = 'text';
        renameInput.value = pattern.name;
        renameInput.style.flex = '1';
        renameInput.style.height = '24px';
        renameInput.style.padding = '0 6px';
        renameInput.style.fontSize = '12px';
        renameInput.style.background = '#0d1117';
        renameInput.style.color = '#e6edf3';
        renameInput.style.border = '1px solid #58a6ff';
        renameInput.style.borderRadius = '4px';

        const commitRename = async () => {
          const nextName = renameInput.value.trim();
          this.editingSlug = null;
          if (nextName && nextName !== pattern.name) {
            await patternRegistry.renamePattern(pattern.slug, nextName);
          } else {
            this.renderGrid();
          }
        };

        renameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitRename();
          } else if (e.key === 'Escape') {
            this.editingSlug = null;
            this.renderGrid();
          }
        });
        renameInput.addEventListener('blur', commitRename);
        headerRow.appendChild(renameInput);
        setTimeout(() => renameInput.focus(), 0);
      } else {
        const nameEl = document.createElement('div');
        nameEl.className = 'pattern-card-name';
        nameEl.textContent = pattern.name;
        nameEl.title = pattern.name;
        nameEl.style.fontSize = '13px';
        nameEl.style.fontWeight = '600';
        nameEl.style.color = '#e6edf3';
        nameEl.style.whiteSpace = 'nowrap';
        nameEl.style.overflow = 'hidden';
        nameEl.style.textOverflow = 'ellipsis';
        nameEl.style.cursor = 'pointer';
        nameEl.addEventListener('dblclick', () => {
          this.editingSlug = pattern.slug;
          this.renderGrid();
        });
        headerRow.appendChild(nameEl);

        const ptsBadge = document.createElement('span');
        ptsBadge.textContent = `${pattern.defaultShellCount || pattern.points.length} pts`;
        ptsBadge.style.fontSize = '10px';
        ptsBadge.style.padding = '2px 6px';
        ptsBadge.style.borderRadius = '10px';
        ptsBadge.style.background = 'rgba(56, 139, 253, 0.15)';
        ptsBadge.style.color = '#58a6ff';
        ptsBadge.style.flexShrink = '0';
        headerRow.appendChild(ptsBadge);
      }

      info.appendChild(headerRow);

      // Action bar: Apply + Delete
      const actionRow = document.createElement('div');
      actionRow.style.display = 'flex';
      actionRow.style.alignItems = 'center';
      actionRow.style.gap = '6px';

      const applyBtn = createModalButton(
        t('common.apply') || 'Apply',
        'primary'
      );
      applyBtn.addEventListener('click', () => {
        this.onApply(pattern, { matchShellCount: this.matchShellCount });
        showToast(t('editor.patternLibrary.appliedToast') || `Applied pattern "${pattern.name}"`, 'success');
        this.hide();
      });
      applyBtn.style.flex = '1';
      applyBtn.style.height = '26px';
      applyBtn.style.fontSize = '11px';

      const deleteBtn = createIconButton({
        icon: 'trash',
        iconSize: 13,
        color: '#f85149',
        hoverColor: '#ffffff',
        hoverBg: 'rgba(248, 81, 73, 0.35)',
        title: t('common.delete') || 'Delete',
        onClick: async () => {
          await patternRegistry.deletePattern(pattern.slug);
          showToast(t('editor.patternLibrary.deletedToast') || `Deleted pattern "${pattern.name}"`, 'info');
        }
      });

      actionRow.appendChild(applyBtn);
      actionRow.appendChild(deleteBtn);
      info.appendChild(actionRow);

      card.appendChild(info);
      grid.appendChild(card);
    }

    this.gridContainer.appendChild(grid);
  }

  async show(options = {}) {
    if (typeof options.onApply === 'function') {
      this.onApply = options.onApply;
    }
    this.isVisible = true;
    this.editingSlug = null;
    if (!patternRegistry.isLoaded) {
      await patternRegistry.loadPatterns();
    }
    this.renderGrid();
    if (!this.overlay.parentElement && typeof document !== 'undefined' && document.body) {
      document.body.appendChild(this.overlay);
    }
    this.overlay.style.display = 'flex';
    if (this.searchInput) {
      setTimeout(() => this.searchInput.focus(), 50);
    }
  }

  hide() {
    this.isVisible = false;
    this.editingSlug = null;
    if (this.overlay) {
      this.overlay.style.display = 'none';
    }
  }

  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.overlay && this.overlay.parentElement) {
      this.overlay.parentElement.removeChild(this.overlay);
    }
  }
}
