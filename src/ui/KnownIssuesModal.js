import { t } from '../config/lang/i18n.js';
import {
  createModalButton,
  createModalShell
} from './ModalShell.js';

export const KNOWN_ISSUES = [
  {
    id: 'input_focus_lost',
    priority: 'critical',
    titleKey: 'editor.bugList.inputFocusTitle',
    defaultTitle: 'Input Typing Unresponsive After Dialog',
    descKey: 'editor.bugList.inputFocusDesc',
    defaultDesc: 'When returning from the Windows native file dialog, inputs and dropdowns may temporarily fail to receive keyboard focus due to operating system focus diversion.',
    workaroundKey: 'editor.bugList.inputFocusWorkaround',
    defaultWorkaround: 'Press Windows key + Click App',
    statusKey: 'editor.bugList.statusWorkaroundAvailable',
    defaultStatus: 'Workaround Available'
  }
];

export class KnownIssuesModal {
  constructor(timelineEditor = null) {
    this.timelineEditor = timelineEditor;
    this.isVisible = false;
    this.onKeyDown = (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.close();
      }
    };

    const shell = createModalShell({
      overlayClass: 'known-issues-modal-overlay',
      dialogClass: 'known-issues-modal-dialog',
      width: '640px',
      title: t('editor.bugList.title') || 'Known Issues and Workarounds',
      subtitle: t('editor.bugList.subtitle') || 'Current software limitations and recommended actions',
      closeTitle: t('editor.bugList.close') || 'Close',
      onClose: () => this.close()
    });

    this.overlay = shell.overlay;
    this.dialog = shell.dialog;
    this.titleEl = shell.titleEl;
    this.subtitleEl = shell.subtitleEl;

    this.body = document.createElement('div');
    this.body.style.display = 'flex';
    this.body.style.flexDirection = 'column';
    this.body.style.gap = '14px';
    this.body.style.padding = '18px 20px';
    this.body.style.overflowY = 'auto';
    this.body.style.maxHeight = '55vh';
    this.dialog.appendChild(this.body);

    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    footer.style.padding = '14px 20px';
    footer.style.borderTop = '1px solid rgba(255, 255, 255, 0.1)';
    footer.style.background = 'rgba(10, 15, 22, 0.95)';

    const closeBtn = createModalButton(
      t('editor.bugList.close') || 'Close',
      'secondary'
    );
    closeBtn.addEventListener('click', () => this.close());
    footer.appendChild(closeBtn);
    this.dialog.appendChild(footer);

    this.renderIssues();
  }

  renderIssues() {
    this.body.innerHTML = '';

    const issues = [...KNOWN_ISSUES];
    issues.sort((a, b) => {
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (pOrder[a.priority] ?? 99) - (pOrder[b.priority] ?? 99);
    });

    issues.forEach((issue) => {
      const card = document.createElement('div');
      card.className = `known-issue-card known-issue-${issue.id}`;
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.gap = '10px';
      card.style.padding = '14px 16px';
      card.style.borderRadius = '6px';

      const isCritical = issue.priority === 'critical' || issue.priority === 'high';
      if (isCritical) {
        card.style.background = 'rgba(239, 68, 68, 0.08)';
        card.style.border = '1px solid rgba(239, 68, 68, 0.45)';
      } else {
        card.style.background = 'rgba(255, 255, 255, 0.03)';
        card.style.border = '1px solid rgba(255, 255, 255, 0.12)';
      }

      const headerRow = document.createElement('div');
      headerRow.style.display = 'flex';
      headerRow.style.alignItems = 'center';
      headerRow.style.justifyContent = 'space-between';
      headerRow.style.gap = '10px';

      const titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';
      titleWrap.style.gap = '8px';
      titleWrap.style.flexWrap = 'wrap';

      const titleEl = document.createElement('span');
      titleEl.textContent = t(issue.titleKey) || issue.defaultTitle;
      titleEl.style.fontSize = '14px';
      titleEl.style.fontWeight = 'bold';
      titleEl.style.color = isCritical ? '#fca5a5' : '#e2e8f0';
      titleWrap.appendChild(titleEl);

      const priorityBadge = document.createElement('span');
      priorityBadge.className = 'issue-priority-badge';
      priorityBadge.style.fontSize = '11px';
      priorityBadge.style.fontWeight = 'bold';
      priorityBadge.style.padding = '2px 7px';
      priorityBadge.style.borderRadius = '3px';

      if (isCritical) {
        priorityBadge.textContent = t('editor.bugList.priorityCritical') || 'Critical Priority';
        priorityBadge.style.background = '#dc2626';
        priorityBadge.style.color = '#ffffff';
      } else {
        priorityBadge.textContent = t('editor.bugList.priorityNormal') || 'Normal Priority';
        priorityBadge.style.background = 'rgba(148, 163, 184, 0.2)';
        priorityBadge.style.color = '#cbd5e1';
      }
      titleWrap.appendChild(priorityBadge);

      const statusBadge = document.createElement('span');
      statusBadge.textContent = t(issue.statusKey) || issue.defaultStatus;
      statusBadge.style.fontSize = '11px';
      statusBadge.style.padding = '2px 7px';
      statusBadge.style.borderRadius = '3px';
      statusBadge.style.background = 'rgba(34, 197, 94, 0.15)';
      statusBadge.style.border = '1px solid rgba(34, 197, 94, 0.35)';
      statusBadge.style.color = '#4ade80';

      headerRow.appendChild(titleWrap);
      headerRow.appendChild(statusBadge);
      card.appendChild(headerRow);

      const descEl = document.createElement('div');
      descEl.textContent = t(issue.descKey) || issue.defaultDesc;
      descEl.style.fontSize = '12px';
      descEl.style.lineHeight = '1.5';
      descEl.style.color = '#94a3b8';
      card.appendChild(descEl);

      const workaroundBox = document.createElement('div');
      workaroundBox.className = 'issue-workaround-box';
      workaroundBox.style.display = 'flex';
      workaroundBox.style.flexDirection = 'column';
      workaroundBox.style.gap = '4px';
      workaroundBox.style.padding = '10px 12px';
      workaroundBox.style.borderRadius = '5px';
      workaroundBox.style.background = 'rgba(15, 23, 42, 0.7)';
      workaroundBox.style.border = isCritical
        ? '1px solid rgba(239, 68, 68, 0.35)'
        : '1px solid rgba(0, 229, 255, 0.25)';

      const workaroundLabel = document.createElement('span');
      workaroundLabel.textContent = t('editor.bugList.workaroundHeader') || 'Workaround';
      workaroundLabel.style.fontSize = '11px';
      workaroundLabel.style.fontWeight = 'bold';
      workaroundLabel.style.textTransform = 'uppercase';
      workaroundLabel.style.letterSpacing = '0.5px';
      workaroundLabel.style.color = isCritical ? '#f87171' : '#38bdf8';

      const workaroundText = document.createElement('span');
      workaroundText.textContent = t(issue.workaroundKey) || issue.defaultWorkaround;
      workaroundText.style.fontSize = '13px';
      workaroundText.style.fontWeight = 'bold';
      workaroundText.style.lineHeight = '1.45';
      workaroundText.style.color = '#ffffff';

      workaroundBox.appendChild(workaroundLabel);
      workaroundBox.appendChild(workaroundText);
      card.appendChild(workaroundBox);

      this.body.appendChild(card);
    });
  }

  open() {
    this.renderIssues();
    this.overlay.style.display = 'flex';
    this.isVisible = true;
    window.addEventListener('keydown', this.onKeyDown);
  }

  close() {
    this.overlay.style.display = 'none';
    this.isVisible = false;
    window.removeEventListener('keydown', this.onKeyDown);
  }

  destroy() {
    this.close();
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
  }
}
