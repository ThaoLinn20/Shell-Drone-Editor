import { t } from '../../config/lang/i18n.js';
import { createModalShell } from '../ModalShell.js';

export class ShortcutGuideModal {
  constructor() {
    this.isVisible = false;
    this.overlay = null;
    this.dialog = null;
    this.contentContainer = null;
    this.onKeyDown = this.onKeyDown.bind(this);

    this.initDOM();
  }

  initDOM() {
    if (typeof document === 'undefined') return;

    const shell = createModalShell({
      overlayClass: 'shortcut-guide-modal-overlay',
      dialogClass: 'shortcut-guide-modal-dialog',
      width: '1020px',
      title: t('editor.guideHub.shortcuts.modalTitle') || 'System Controls and Shortcut Reference',
      subtitle: t('editor.guideHub.shortcuts.modalSubtitle') || 'Interactive reference guide for timeline controls, block selection, and 3D navigation',
      closeTitle: t('editor.guideHub.closeBtn') || 'Close',
      onClose: () => this.close()
    });

    this.overlay = shell.overlay;
    this.dialog = shell.dialog;
    this.titleEl = shell.titleEl;
    this.subtitleEl = shell.subtitleEl;

    // Body container
    const content = document.createElement('div');
    content.className = 'shortcut-guide-modal-content';
    content.style.padding = '18px 20px';
    content.style.overflowY = 'auto';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '16px';
    content.style.flex = '1';

    this.contentContainer = content;
    this.dialog.appendChild(content);

    // Footer tip bar
    const footer = document.createElement('div');
    footer.className = 'shortcut-guide-modal-footer';
    footer.style.padding = '12px 20px';
    footer.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    footer.style.background = 'rgba(10, 15, 24, 0.9)';
    footer.style.fontSize = '12px';
    footer.style.color = '#38bdf8';
    footer.style.fontFamily = 'monospace';
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'space-between';

    const tipText = document.createElement('span');
    tipText.textContent = t('editor.guideHub.shortcuts.quickTip') ||
      'Quick Tip: Press [ESC] to unlock mouse cursor | Click viewport to lock and turn camera view';
    footer.appendChild(tipText);

    this.dialog.appendChild(footer);
  }

  getSections() {
    return [
      {
        title: t('editor.guideHub.shortcuts.timelineTitle') || 'Timeline and Playback',
        accent: '#00e5ff',
        items: [
          {
            key: 'CTRL + T',
            desc: t('editor.guideHub.shortcuts.toggleTimeline') || 'Toggle Timeline Panel',
            highlightColor: '#ffb703',
            tag: 'CORE TOGGLE'
          },
          {
            key: 'SPACE',
            desc: t('editor.guideHub.shortcuts.playPause') || 'Play or Pause Timeline',
            highlightColor: '#00e5ff',
            tag: 'PLAYBACK'
          },
          {
            key: 'B',
            desc: t('editor.guideHub.shortcuts.tapBeat') || 'Tap Beat / Sync Marker'
          },
          {
            key: 'CTRL + S',
            desc: t('editor.guideHub.shortcuts.saveScript') || 'Direct Save Script'
          },
          {
            key: 'CTRL + Z / Y',
            desc: t('editor.guideHub.shortcuts.undoRedo') || 'Undo / Redo Action'
          },
          {
            key: '[  /  ]',
            desc: t('editor.guideHub.shortcuts.seekBeat') || 'Seek Prev / Next Beat'
          },
          {
            key: 'SHIFT + 0',
            desc: t('editor.guideHub.shortcuts.zoomCycle') || 'Cycle Timeline Zoom'
          },
          {
            key: 'CTRL + ALT + N',
            desc: t('editor.guideHub.shortcuts.newScript') || 'Create New Blank Script'
          }
        ]
      },
      {
        title: t('editor.guideHub.shortcuts.selectionTitle') || 'Selection and Editing',
        accent: '#38ef7d',
        items: [
          {
            key: 'CTRL + DRAG',
            desc: t('editor.guideHub.shortcuts.marqueeSelect') || 'Marquee Multi-Select',
            highlightColor: '#38ef7d',
            tag: 'MULTI-BOX'
          },
          {
            key: 'CLICK + DRAG',
            desc: t('editor.guideHub.shortcuts.moveBlocks') || 'Move Selected Blocks'
          },
          {
            key: 'CTRL + CLICK',
            desc: t('editor.guideHub.shortcuts.toggleSelect') || 'Toggle Select Block'
          },
          {
            key: 'CTRL + G',
            desc: t('editor.guideHub.shortcuts.groupBlocks') || 'Group Selected Blocks'
          },
          {
            key: 'CTRL + G',
            desc: t('editor.guideHub.shortcuts.ungroupBlocks') || 'Ungroup Blocks'
          },
          {
            key: 'CTRL + C / V',
            desc: t('editor.guideHub.shortcuts.copyPaste') || 'Copy / Paste Blocks'
          },
          {
            key: 'DELETE',
            desc: t('editor.guideHub.shortcuts.removeBlocks') || 'Remove Selected Blocks'
          },
          {
            key: 'RIGHT CLICK',
            desc: t('editor.guideHub.shortcuts.contextMenu') || 'Context Menu and Presets'
          }
        ]
      },
      {
        title: t('editor.guideHub.shortcuts.cameraTitle') || '3D Camera and Scene',
        accent: '#ff9f1c',
        items: [
          {
            key: 'ESC',
            desc: t('editor.guideHub.shortcuts.unlockMouse') || 'Unlock Mouse / Exit Menu',
            highlightColor: '#ff3366',
            tag: 'RELEASE MOUSE'
          },
          {
            key: 'SHIFT + Y',
            desc: t('editor.guideHub.shortcuts.diagHud') || 'Toggle Diagnostics HUD',
            highlightColor: '#ff9f1c',
            tag: 'CORE STATS'
          },
          {
            key: 'H',
            desc: t('editor.guideHub.shortcuts.lookAtGuide') || 'Toggle Look At Guide',
            highlightColor: '#00f5d4',
            tag: 'QUICK VIEW'
          },
          {
            key: 'LEFT CLICK',
            desc: t('editor.guideHub.shortcuts.lockMouse') || 'Lock Mouse and Turn View'
          },
          {
            key: 'W A S D',
            desc: t('editor.guideHub.shortcuts.flyCamera') || 'Fly Camera in 3D'
          },
          {
            key: 'SHIFT + W / S',
            desc: t('editor.guideHub.shortcuts.ascendDescend') || 'Ascend / Descend Fly'
          },
          {
            key: 'SHIFT + R',
            desc: t('editor.guideHub.shortcuts.resetCamera') || 'Reset Camera Center'
          },
          {
            key: '1 / 2 / 3',
            desc: t('editor.guideHub.shortcuts.cameraModes') || 'Free / Boat / Aerial Cam'
          }
        ]
      }
    ];
  }

  renderSections() {
    if (!this.contentContainer) return;
    this.contentContainer.innerHTML = '';

    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(290px, 1fr))';
    grid.style.gap = '14px';
    grid.style.width = '100%';

    const sections = this.getSections();

    for (const sec of sections) {
      const card = document.createElement('div');
      card.style.background = 'rgba(16, 24, 38, 0.95)';
      card.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      card.style.borderRadius = '6px';
      card.style.overflow = 'hidden';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';

      // Card Header
      const header = document.createElement('div');
      header.style.padding = '10px 14px';
      header.style.background = 'rgba(255, 255, 255, 0.05)';
      header.style.borderTop = `3px solid ${sec.accent}`;
      header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.08)';
      header.style.display = 'flex';
      header.style.alignItems = 'center';
      header.style.justifyContent = 'space-between';

      const title = document.createElement('span');
      title.textContent = sec.title;
      title.style.fontSize = '13px';
      title.style.fontWeight = '700';
      title.style.color = sec.accent;
      title.style.letterSpacing = '0.5px';

      header.appendChild(title);
      card.appendChild(header);

      // Card List
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.padding = '8px 10px';
      list.style.gap = '6px';

      for (const item of sec.items) {
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.padding = '5px 8px';
        row.style.borderRadius = '4px';
        row.style.background = 'rgba(255, 255, 255, 0.02)';
        row.style.gap = '8px';

        const leftCol = document.createElement('div');
        leftCol.style.display = 'flex';
        leftCol.style.alignItems = 'center';
        leftCol.style.gap = '6px';
        leftCol.style.flexShrink = '0';

        const keycap = document.createElement('kbd');
        keycap.textContent = item.key;
        keycap.style.display = 'inline-block';
        keycap.style.padding = '3px 7px';
        keycap.style.fontSize = '11px';
        keycap.style.fontWeight = '600';
        keycap.style.fontFamily = 'monospace';
        keycap.style.color = '#f8fafc';
        keycap.style.background = '#1e293b';
        keycap.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        keycap.style.borderBottom = '2px solid rgba(255, 255, 255, 0.35)';
        keycap.style.borderRadius = '4px';
        keycap.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.4)';
        leftCol.appendChild(keycap);

        if (item.tag) {
          const tagBadge = document.createElement('span');
          tagBadge.textContent = item.tag;
          tagBadge.style.fontSize = '9px';
          tagBadge.style.fontWeight = '700';
          tagBadge.style.padding = '1px 5px';
          tagBadge.style.borderRadius = '3px';
          tagBadge.style.color = item.highlightColor || sec.accent;
          tagBadge.style.background = 'rgba(255, 255, 255, 0.06)';
          tagBadge.style.border = `1px solid ${item.highlightColor || sec.accent}55`;
          tagBadge.style.letterSpacing = '0.5px';
          leftCol.appendChild(tagBadge);
        }

        const desc = document.createElement('span');
        desc.textContent = item.desc;
        desc.style.fontSize = '11.5px';
        desc.style.color = '#cbd5e1';
        desc.style.textAlign = 'right';
        desc.style.lineHeight = '1.3';

        row.appendChild(leftCol);
        row.appendChild(desc);
        list.appendChild(row);
      }

      card.appendChild(list);
      grid.appendChild(card);
    }

    this.contentContainer.appendChild(grid);
  }

  onKeyDown(e) {
    if (e.key === 'Escape' && this.isVisible) {
      this.close();
    }
  }

  open() {
    if (!this.overlay) {
      this.initDOM();
    }
    if (!this.overlay) return;

    if (this.titleEl) {
      this.titleEl.textContent = t('editor.guideHub.shortcuts.modalTitle') || 'System Controls and Shortcut Reference';
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = t('editor.guideHub.shortcuts.modalSubtitle') ||
        'Interactive reference guide for timeline controls, block selection, and 3D navigation';
    }

    this.renderSections();
    this.overlay.style.display = 'flex';
    this.isVisible = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
    }
  }

  close() {
    if (!this.overlay) return;
    if (this.overlay.style) {
      this.overlay.style.display = 'none';
    }
    this.isVisible = false;

    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
    }
  }

  destroy() {
    this.close();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    this.dialog = null;
    this.contentContainer = null;
  }
}
