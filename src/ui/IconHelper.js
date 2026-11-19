/**
 * IconHelper.js
 * Centralized utility for creating lightweight, crisp SVG vector icons
 * and compact icon buttons for UI toolbars and inspector panels.
 */

/**
 * Creates an SVG icon element for standard UI actions.
 * @param {'plus' | 'minus' | 'trash' | 'expand' | 'collapse' | 'lock' | 'unlock' | 'reset' | 'refresh' | 'close' | 'mirror' | 'flip'} type
 * @param {number} [size=14]
 * @returns {SVGElement|HTMLElement}
 */
export function createSvgIcon(type, size = 14) {
  let svg;
  if (typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  } else if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    svg = document.createElement('div');
  } else {
    return { tagName: 'DIV', style: {} };
  }

  if (svg.setAttribute) {
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
  }

  svg.style = svg.style || {};
  svg.style.display = 'block';
  svg.style.pointerEvents = 'none';

  switch (type) {
    case 'plus':
      svg.innerHTML = '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>';
      break;
    case 'minus':
      svg.innerHTML = '<line x1="5" y1="12" x2="19" y2="12"></line>';
      break;
    case 'trash':
      svg.innerHTML = '<polyline points="3 6 5 6 21 6"></polyline>' +
        '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>';
      break;
    case 'expand':
      svg.innerHTML = '<polyline points="15 3 21 3 21 9"></polyline>' +
        '<polyline points="9 21 3 21 3 15"></polyline>' +
        '<line x1="21" y1="3" x2="14" y2="10"></line>' +
        '<line x1="3" y1="21" x2="10" y2="14"></line>';
      break;
    case 'collapse':
      svg.innerHTML = '<polyline points="4 14 10 14 10 20"></polyline>' +
        '<polyline points="20 10 14 10 14 4"></polyline>' +
        '<line x1="14" y1="10" x2="21" y2="3"></line>' +
        '<line x1="3" y1="21" x2="10" y2="14"></line>';
      break;
    case 'lock':
      svg.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
        '<path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
      break;
    case 'unlock':
      svg.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>' +
        '<path d="M7 11V7a5 5 0 0 1 9.9-1"></path>';
      break;
    case 'reset':
    case 'refresh':
      svg.innerHTML = '<path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>';
      break;
    case 'close':
      svg.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
      break;
    case 'mirror':
    case 'flip':
      svg.innerHTML = '<line x1="12" y1="2" x2="12" y2="22" stroke-dasharray="2 2"></line>' +
        '<path d="M8 7 L2 12 L8 17 Z"></path>' +
        '<path d="M16 7 L22 12 L16 17 Z"></path>';
      break;
    default:
      break;
  }

  return svg;
}

/**
 * Creates a standard compact icon button with tooltip and accessible label.
 * @param {Object} options
 * @param {string} options.icon SVG icon type
 * @param {number} [options.iconSize=13]
 * @param {string} [options.title=''] Tooltip text
 * @param {string} [options.ariaLabel=''] Accessibility label
 * @param {string} [options.color] Default icon stroke color
 * @param {string} [options.hoverColor] Color on mouse hover
 * @param {string} [options.hoverBg] Background on mouse hover
 * @param {Function} [options.onClick] Click handler
 * @returns {HTMLButtonElement}
 */
export function createIconButton(options = {}) {
  const {
    icon,
    iconSize = 13,
    title = '',
    ariaLabel = '',
    color = '#c9d1d9',
    hoverColor = '#ffffff',
    hoverBg = '#30363d',
    onClick = () => {}
  } = options;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'inspector-icon-btn';
  btn.title = title;
  if (ariaLabel || title) {
    btn.setAttribute('aria-label', ariaLabel || title);
  }

  btn.style.width = '26px';
  btn.style.height = '26px';
  btn.style.padding = '0';
  btn.style.display = 'inline-flex';
  btn.style.alignItems = 'center';
  btn.style.justifyContent = 'center';
  btn.style.background = '#21262d';
  btn.style.color = color;
  btn.style.border = '1px solid #30363d';
  btn.style.borderRadius = '4px';
  btn.style.cursor = 'pointer';
  btn.style.boxSizing = 'border-box';
  btn.style.transition = 'all 0.15s ease';

  if (icon) {
    btn.appendChild(createSvgIcon(icon, iconSize));
  }

  btn.addEventListener('mouseenter', () => {
    btn.style.background = hoverBg;
    btn.style.color = hoverColor;
    btn.style.borderColor = '#484f58';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.background = '#21262d';
    btn.style.color = color;
    btn.style.borderColor = '#30363d';
  });

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    onClick(e);
  });

  return btn;
}
