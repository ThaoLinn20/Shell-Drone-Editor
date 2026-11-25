import fs from 'fs';
import path from 'path';

/**
 * Sanitizes a pattern slug to prevent path traversal and enforce lowercase snake_case.
 * @param {string} rawSlug
 * @returns {string}
 */
export function sanitizePatternSlug(rawSlug) {
  const base = path.basename(String(rawSlug || 'pattern'));
  const normalized = base
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || `pattern_${Date.now()}`;
}

/**
 * Scans all saved sweep pattern JSON files inside patternsDir.
 * @param {string} patternsDir
 * @returns {Array<object>}
 */
export function scanPatterns(patternsDir) {
  if (!patternsDir || !fs.existsSync(patternsDir)) {
    return [];
  }

  let entries = [];
  try {
    entries = fs.readdirSync(patternsDir, { withFileTypes: true });
  } catch (err) {
    console.error('Error reading patterns directory:', err);
    return [];
  }

  const patterns = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.startsWith('.')) {
      continue;
    }

    const filePath = path.join(patternsDir, entry.name);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.points) && parsed.points.length > 0) {
        const slug = sanitizePatternSlug(parsed.slug || path.basename(entry.name, '.json'));
        patterns.push({
          ...parsed,
          slug
        });
      }
    } catch (err) {
      console.warn(`Failed to parse pattern JSON ${entry.name}:`, err);
    }
  }

  patterns.sort((a, b) => {
    const timeA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    const timeB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    return timeB - timeA;
  });

  return patterns;
}

/**
 * Saves a pattern JSON file atomically in patternsDir.
 * @param {string} patternsDir
 * @param {object} payload
 * @returns {object}
 */
export function savePattern(patternsDir, payload) {
  if (!patternsDir) {
    throw new Error('Patterns directory is required');
  }
  if (!fs.existsSync(patternsDir)) {
    fs.mkdirSync(patternsDir, { recursive: true });
  }

  const slug = sanitizePatternSlug(payload?.slug || payload?.name);
  const targetPath = path.join(patternsDir, `${slug}.json`);
  const tmpPath = path.join(patternsDir, `.${slug}.${Date.now()}.tmp`);
  const nowIso = new Date().toISOString();

  const data = {
    version: 1,
    id: payload?.id || `pat_${slug}`,
    slug,
    name: String(payload?.name || slug).trim() || slug,
    description: typeof payload?.description === 'string' ? payload.description.trim() : '',
    points: Array.isArray(payload?.points) ? payload.points : [],
    defaultShellCount: Number.isFinite(Number(payload?.defaultShellCount))
      ? Math.max(2, Math.round(Number(payload.defaultShellCount)))
      : (Array.isArray(payload?.points) ? Math.max(2, payload.points.length) : 12),
    mortarsLocked: Boolean(payload?.mortarsLocked),
    createdAt: payload?.createdAt || nowIso,
    updatedAt: nowIso
  };

  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, targetPath);

  return data;
}

/**
 * Deletes a saved pattern JSON file by slug.
 * @param {string} patternsDir
 * @param {string} slug
 * @returns {{ deleted: boolean, slug: string }}
 */
export function deletePattern(patternsDir, slug) {
  const safeSlug = sanitizePatternSlug(slug);
  if (!patternsDir || !fs.existsSync(patternsDir)) {
    return {
      deleted: false,
      slug: safeSlug
    };
  }

  const targetPath = path.join(patternsDir, `${safeSlug}.json`);
  if (!fs.existsSync(targetPath)) {
    return {
      deleted: false,
      slug: safeSlug
    };
  }

  fs.unlinkSync(targetPath);
  return {
    deleted: true,
    slug: safeSlug
  };
}
