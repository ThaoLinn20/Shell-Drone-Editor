export function createModalButton(
  label,
  variant = 'secondary'
) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.padding = '7px 14px';
  btn.style.borderRadius = '5px';
  btn.style.cursor = 'pointer';
  btn.style.fontSize = '12px';
  btn.style.fontWeight = '600';
  btn.style.transition = 'filter 0.15s ease';

  if (variant === 'primary') {
    btn.style.background = '#00bcd4';
    btn.style.border = 'none';
    btn.style.color = '#000000';
  } else if (variant === 'accent') {
    btn.style.background = '#1976d2';
    btn.style.border = '1px solid #3b82f6';
    btn.style.color = '#ffffff';
  } else {
    btn.style.background = 'rgba(255, 255, 255, 0.08)';
    btn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    btn.style.color = '#e2e8f0';
  }
  return btn;
}

export function createModalShell({
  overlayClass,
  dialogClass,
  width = '680px',
  title = '',
  subtitle = '',
  closeTitle = 'Close',
  onClose
}) {
  const overlay = document.createElement('div');
  overlay.className = overlayClass;
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0, 0, 0, 0.65)';
  overlay.style.backdropFilter = 'blur(6px)';
  overlay.style.display = 'none';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '100010';

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && typeof onClose === 'function') {
      onClose();
    }
  });

  const dialog = document.createElement('div');
  dialog.className = dialogClass;
  dialog.style.width = width;
  dialog.style.maxWidth = '92vw';
  dialog.style.maxHeight = '82vh';
  dialog.style.background = 'rgba(13, 20, 28, 0.98)';
  dialog.style.border = '1px solid rgba(0, 229, 255, 0.35)';
  dialog.style.borderRadius = '8px';
  dialog.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.75)';
  dialog.style.display = 'flex';
  dialog.style.flexDirection = 'column';
  dialog.style.overflow = 'hidden';
  dialog.style.color = '#f0f4f8';
  dialog.style.fontFamily = 'sans-serif';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'flex-start';
  header.style.padding = '16px 20px';
  header.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';

  const titleWrap = document.createElement('div');
  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  titleEl.style.fontSize = '16px';
  titleEl.style.fontWeight = 'bold';
  titleEl.style.color = '#00e5ff';

  const subtitleEl = document.createElement('div');
  subtitleEl.textContent = subtitle;
  subtitleEl.style.fontSize = '12px';
  subtitleEl.style.color = '#94a3b8';
  subtitleEl.style.marginTop = '4px';

  titleWrap.appendChild(titleEl);
  titleWrap.appendChild(subtitleEl);

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.title = closeTitle;
  closeBtn.style.background = 'transparent';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#94a3b8';
  closeBtn.style.fontSize = '22px';
  closeBtn.style.lineHeight = '1';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.padding = '0 4px';
  closeBtn.addEventListener('click', () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  });

  header.appendChild(titleWrap);
  header.appendChild(closeBtn);
  dialog.appendChild(header);

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  return {
    overlay,
    dialog,
    header,
    titleEl,
    subtitleEl,
    closeBtn
  };
}

