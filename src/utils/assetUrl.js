/**
 * Resolves an asset path to a valid URL for video/image previews.
 * In Electron, routes relative asset paths (e.g., 'previews/...' or 'presets/...')
 * through the 'app-asset://' protocol to support byte-range streaming from data/.
 * In browser/dev, maintains relative or absolute web URLs.
 *
 * @param {string} url - Raw asset URL or relative path
 * @returns {string} Fully resolved URL
 */
export function resolveAssetUrl(url) {
  if (!url) {
    return '';
  }

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('app-asset://') ||
    url.startsWith('blob:') ||
    url.startsWith('data:')
  ) {
    return url;
  }

  const clean = url.replace(/^\.?\//, '');
  if (typeof window !== 'undefined' && window.electronAPI) {
    return `app-asset://${clean}`;
  }

  return `./${clean}`;
}
