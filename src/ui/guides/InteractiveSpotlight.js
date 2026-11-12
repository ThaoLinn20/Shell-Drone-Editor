export class InteractiveSpotlight {
  constructor() {
    this.highlightBox = null;
    this.tooltipCard = null;
    this.positionRafId = null;
    this.currentGetTarget = null;
    this.currentGetTooltipAnchor = null;
    this.currentPlacement = 'auto';
    this.isVisible = false;

    this.boundUpdatePosition = this.updatePosition.bind(this);
  }

  initDOM() {
    this.destroyDOM();

    this.highlightBox = document.createElement('div');
    this.highlightBox.className = 'interactive-spotlight-highlight';
    this.highlightBox.style.position = 'fixed';
    this.highlightBox.style.boxShadow =
      '0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 16px #00e5ff';
    this.highlightBox.style.border = '2px solid #00e5ff';
    this.highlightBox.style.borderRadius = '6px';
    this.highlightBox.style.pointerEvents = 'none';
    this.highlightBox.style.transition =
      'top 0.2s ease-out, left 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out';
    this.highlightBox.style.zIndex = '100015';

    this.tooltipCard = document.createElement('div');
    this.tooltipCard.className = 'interactive-spotlight-tooltip';
    this.tooltipCard.style.position = 'fixed';
    this.tooltipCard.style.width = '360px';
    this.tooltipCard.style.maxWidth = '90vw';
    this.tooltipCard.style.background = 'rgba(13, 20, 28, 0.98)';
    this.tooltipCard.style.backdropFilter = 'blur(10px)';
    this.tooltipCard.style.border = '1px solid rgba(0, 229, 255, 0.45)';
    this.tooltipCard.style.borderRadius = '8px';
    this.tooltipCard.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.75)';
    this.tooltipCard.style.padding = '16px';
    this.tooltipCard.style.color = '#f0f4f8';
    this.tooltipCard.style.fontFamily = 'sans-serif';
    this.tooltipCard.style.zIndex = '100020';
    this.tooltipCard.style.boxSizing = 'border-box';
    this.tooltipCard.style.transition = 'top 0.2s ease-out, left 0.2s ease-out';

    document.body.appendChild(this.highlightBox);
    document.body.appendChild(this.tooltipCard);
    this.isVisible = true;
    this.bindResize();
  }

  bindResize() {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener(
      'resize',
      this.boundUpdatePosition
    );
    window.addEventListener(
      'resize',
      this.boundUpdatePosition
    );
  }

  unbindResize() {
    if (typeof window === 'undefined') {
      return;
    }
    window.removeEventListener(
      'resize',
      this.boundUpdatePosition
    );
  }

  render({
    badge = '',
    title = '',
    desc = '',
    progressText = '',
    skipLabel = 'Skip',
    actions = [],
    onDismiss,
    getTarget,
    getTooltipAnchor = null,
    placement = 'auto',
    dimBackdrop = true
  }) {
    if (!this.tooltipCard || !this.highlightBox) {
      this.initDOM();
    }

    this.highlightBox.style.boxShadow = dimBackdrop
      ? '0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 16px #00e5ff'
      : '0 0 0 9999px rgba(0, 0, 0, 0), 0 0 16px #00e5ff';

    this.currentGetTarget = getTarget || null;
    this.currentGetTooltipAnchor = getTooltipAnchor || null;
    this.currentPlacement = placement || 'auto';
    this.tooltipCard.innerHTML = '';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '8px';

    const badgeEl = document.createElement('span');
    badgeEl.textContent = badge;
    badgeEl.style.fontSize = '11px';
    badgeEl.style.color = '#00e5ff';
    badgeEl.style.fontWeight = 'bold';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'transparent';
    closeBtn.style.border = 'none';
    closeBtn.style.color = '#94a3b8';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0';
    closeBtn.addEventListener('click', () => {
      if (typeof onDismiss === 'function') {
        onDismiss();
      }
    });

    headerRow.appendChild(badgeEl);
    headerRow.appendChild(closeBtn);
    this.tooltipCard.appendChild(headerRow);

    const titleEl = document.createElement('div');
    titleEl.textContent = title;
    titleEl.style.fontSize = '15px';
    titleEl.style.fontWeight = 'bold';
    titleEl.style.color = '#ffffff';
    titleEl.style.marginBottom = '8px';
    this.tooltipCard.appendChild(titleEl);

    const descEl = document.createElement('div');
    descEl.textContent = desc;
    descEl.style.fontSize = '13px';
    descEl.style.lineHeight = '1.5';
    descEl.style.color = '#cbd5e1';
    descEl.style.marginBottom = progressText ? '10px' : '14px';
    this.tooltipCard.appendChild(descEl);

    if (progressText) {
      const progressBox = document.createElement('div');
      progressBox.className = 'interactive-spotlight-progress';
      progressBox.textContent = progressText;
      progressBox.style.fontSize = '12px';
      progressBox.style.fontWeight = '600';
      progressBox.style.background = 'rgba(0, 229, 255, 0.1)';
      progressBox.style.borderLeft = '3px solid #00e5ff';
      progressBox.style.padding = '6px 10px';
      progressBox.style.marginBottom = '14px';
      progressBox.style.color = '#00e5ff';
      progressBox.style.borderRadius = '0 4px 4px 0';
      this.tooltipCard.appendChild(progressBox);
    }

    const footerRow = document.createElement('div');
    footerRow.style.display = 'flex';
    footerRow.style.justifyContent = 'space-between';
    footerRow.style.alignItems = 'center';
    footerRow.style.flexWrap = 'wrap';
    footerRow.style.gap = '8px';

    const skipBtn = document.createElement('button');
    skipBtn.textContent = skipLabel;
    skipBtn.style.background = 'transparent';
    skipBtn.style.border = 'none';
    skipBtn.style.color = '#94a3b8';
    skipBtn.style.fontSize = '12px';
    skipBtn.style.cursor = 'pointer';
    skipBtn.style.padding = '4px 0';
    skipBtn.addEventListener('click', () => {
      if (typeof onDismiss === 'function') {
        onDismiss();
      }
    });
    footerRow.appendChild(skipBtn);

    if (Array.isArray(actions) && actions.length > 0) {
      const actionWrap = document.createElement('div');
      actionWrap.style.display = 'flex';
      actionWrap.style.gap = '8px';
      actionWrap.style.flexWrap = 'wrap';

      actions.forEach((act) => {
        const btn = document.createElement('button');
        btn.textContent = act.label;
        btn.style.fontSize = '12px';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        if (act.variant === 'accent') {
          btn.style.background = '#10b981';
          btn.style.border = '1px solid #34d399';
          btn.style.color = '#000000';
          btn.style.fontWeight = 'bold';
          btn.style.padding = '6px 12px';
          btn.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.45)';
        } else if (act.primary) {
          btn.style.background = '#00bcd4';
          btn.style.border = 'none';
          btn.style.color = '#000000';
          btn.style.fontWeight = 'bold';
          btn.style.padding = '6px 12px';
        } else {
          btn.style.background = '#273544';
          btn.style.border = '1px solid #486581';
          btn.style.color = '#f0f4f8';
          btn.style.padding = '6px 10px';
        }
        btn.addEventListener('click', () => {
          if (typeof act.onClick === 'function') {
            act.onClick();
          }
        });
        actionWrap.appendChild(btn);
      });

      footerRow.appendChild(actionWrap);
    }

    this.tooltipCard.appendChild(footerRow);
    this.schedulePositionUpdate();
  }

  pulse() {
    if (this.tooltipCard) {
      this.tooltipCard.style.boxShadow =
        '0 0 24px rgba(0, 229, 255, 0.75), 0 10px 30px rgba(0, 0, 0, 0.7)';
    }
  }

  schedulePositionUpdate() {
    this.updatePosition();
    if (typeof requestAnimationFrame === 'function') {
      if (this.positionRafId) {
        cancelAnimationFrame(this.positionRafId);
      }
      this.positionRafId = requestAnimationFrame(() => {
        this.updatePosition();
      });
    }
  }

  updatePosition() {
    if (
      !this.isVisible ||
      !this.highlightBox ||
      !this.tooltipCard ||
      typeof this.currentGetTarget !== 'function'
    ) {
      return;
    }

    const targetEl = this.currentGetTarget();
    if (!targetEl || typeof targetEl.getBoundingClientRect !== 'function') {
      return;
    }

    const baseRect = targetEl.getBoundingClientRect();
    let rect = {
      top: baseRect.top,
      left: baseRect.left,
      bottom: baseRect.bottom !== undefined ? baseRect.bottom : baseRect.top + baseRect.height,
      right: baseRect.right !== undefined ? baseRect.right : baseRect.left + baseRect.width,
      width: baseRect.width,
      height: baseRect.height
    };

    if (
      targetEl.dataset?.fieldName &&
      typeof document !== 'undefined' &&
      typeof document.querySelector === 'function'
    ) {
      const openMenu = document.querySelector(
        `.custom-select-menu[data-field-name="${targetEl.dataset.fieldName}"]`
      );
      if (
        openMenu &&
        openMenu.style?.display !== 'none' &&
        typeof openMenu.getBoundingClientRect === 'function'
      ) {
        const menuRect = openMenu.getBoundingClientRect();
        if (menuRect && menuRect.width > 0 && menuRect.height > 0) {
          const top = Math.min(rect.top, menuRect.top);
          const left = Math.min(rect.left, menuRect.left);
          const bottom = Math.max(
            rect.bottom,
            menuRect.bottom !== undefined ? menuRect.bottom : menuRect.top + menuRect.height
          );
          const right = Math.max(
            rect.right,
            menuRect.right !== undefined ? menuRect.right : menuRect.left + menuRect.width
          );
          rect = {
            top,
            left,
            bottom,
            right,
            width: right - left,
            height: bottom - top
          };
        }
      }
    }

    const margin = 4;

    this.highlightBox.style.top =
      Math.max(0, rect.top - margin) + 'px';
    this.highlightBox.style.left =
      Math.max(0, rect.left - margin) + 'px';
    this.highlightBox.style.width = (rect.width + margin * 2) + 'px';
    this.highlightBox.style.height = (rect.height + margin * 2) + 'px';

    const cardWidth = 360;
    const cardHeight = this.tooltipCard.offsetHeight || 190;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;

    const anchorEl =
      typeof this.currentGetTooltipAnchor === 'function'
        ? this.currentGetTooltipAnchor()
        : null;
    const anchorRect =
      anchorEl && typeof anchorEl.getBoundingClientRect === 'function'
        ? anchorEl.getBoundingClientRect()
        : rect;

    let top;
    let left;

    if (
      this.currentPlacement === 'left' &&
      anchorRect.left >= cardWidth + 24
    ) {
      left = Math.max(
        10,
        anchorRect.left - cardWidth - 16
      );
      top = Math.max(
        10,
        Math.min(
          viewportH - cardHeight - 10,
          anchorRect.top
        )
      );
    } else {
      top = rect.top - cardHeight - 16;
      if (top < 10) {
        top = Math.min(
          viewportH - cardHeight - 10,
          rect.bottom + 16
        );
      }
      left = rect.left;
      if (left + cardWidth > viewportW - 10) {
        left = Math.max(
          10,
          viewportW - cardWidth - 10
        );
      }
      if (left < 10) {
        left = 10;
      }
    }

    this.tooltipCard.style.top = top + 'px';
    this.tooltipCard.style.left = left + 'px';
  }

  destroyDOM() {
    this.isVisible = false;
    this.unbindResize();
    if (this.positionRafId && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.positionRafId);
      this.positionRafId = null;
    }
    if (this.highlightBox) {
      if (typeof this.highlightBox.remove === 'function') {
        this.highlightBox.remove();
      }
      this.highlightBox = null;
    }
    if (this.tooltipCard) {
      if (typeof this.tooltipCard.remove === 'function') {
        this.tooltipCard.remove();
      }
      this.tooltipCard = null;
    }
  }
}

