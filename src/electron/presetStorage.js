import fs from 'fs';
import path from 'path';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm'];

/**
 * Scan a single preset bundle folder to find json, banner, and video files.
 * @param {string} bundleDir
 * @param {string} slug
 * @returns {{ jsonFile: string|null, bannerFile: string|null, videoFile: string|null }}
 */
export function findBundleFiles(bundleDir, slug) {
  if (!fs.existsSync(bundleDir)) {
    return {
      jsonFile: null,
      bannerFile: null,
      videoFile: null
    };
  }

  let entries = [];
  try {
    entries = fs.readdirSync(bundleDir);
  } catch {
    return {
      jsonFile: null,
      bannerFile: null,
      videoFile: null
    };
  }

  let jsonFile = null;
  let bannerFile = null;
  let videoFile = null;

  // 1. First priority: files matching the slug exactly
  for (const file of entries) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext);

    if (base === slug) {
      if (ext === '.json' && !jsonFile) {
        jsonFile = file;
      } else if (IMAGE_EXTENSIONS.includes(ext) && !bannerFile) {
        bannerFile = file;
      } else if (VIDEO_EXTENSIONS.includes(ext) && !videoFile) {
        videoFile = file;
      }
    }
  }

  // 2. Second priority: standard names (preset.json, banner.*, preview.*)
  for (const file of entries) {
    const ext = path.extname(file).toLowerCase();
    const base = path.basename(file, ext).toLowerCase();

    if (!jsonFile && (base === 'preset' || ext === '.json')) {
      jsonFile = file;
    }
    if (!bannerFile && (base === 'banner' || base === 'thumbnail' || IMAGE_EXTENSIONS.includes(ext))) {
      bannerFile = file;
    }
    if (!videoFile && (base === 'preview' || base === 'video' || VIDEO_EXTENSIONS.includes(ext))) {
      videoFile = file;
    }
  }

  return {
    jsonFile,
    bannerFile,
    videoFile
  };
}

/**
 * Scan all preset bundles in the presets directory.
 * @param {string} presetsDir
 * @returns {Array<object>}
 */
export function scanPresetBundles(presetsDir) {
  if (!presetsDir || !fs.existsSync(presetsDir)) {
    return [];
  }

  let dirEntries = [];
  try {
    dirEntries = fs.readdirSync(
      presetsDir,
      {
        withFileTypes: true
      }
    );
  } catch (err) {
    console.error('Error reading presets directory:', err);
    return [];
  }

  const bundles = [];

  for (const entry of dirEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const slug = entry.name;
    // Skip hidden or system folders
    if (slug.startsWith('.')) {
      continue;
    }

    const bundleDir = path.join(presetsDir, slug);
    const {
      jsonFile,
      bannerFile,
      videoFile
    } = findBundleFiles(bundleDir, slug);

    let metadata = {};
    if (jsonFile) {
      try {
        const jsonContent = fs.readFileSync(
          path.join(bundleDir, jsonFile),
          'utf8'
        );
        metadata = JSON.parse(jsonContent);
      } catch (err) {
        console.warn(`Failed to parse preset JSON for bundle "${slug}":`, err);
      }
    }

    const bannerUrl = bannerFile
      ? `app-asset://presets/${encodeURIComponent(slug)}/${encodeURIComponent(bannerFile)}`
      : null;

    const videoUrl = videoFile
      ? `app-asset://presets/${encodeURIComponent(slug)}/${encodeURIComponent(videoFile)}`
      : null;

    bundles.push({
      slug,
      id: metadata.id || slug,
      name: metadata.name || slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      category: metadata.category || 'custom',
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      summary: metadata.summary || metadata.description || '',
      composition: metadata.composition || null,
      overrideBuiltinId: metadata.overrideBuiltinId || null,
      isBuiltin: Boolean(metadata.isBuiltin),
      hasBanner: Boolean(bannerFile),
      hasVideo: Boolean(videoFile),
      bannerUrl,
      videoUrl,
      bannerFile,
      videoFile,
      updatedAt: metadata.updatedAt || null
    });
  }

  bundles.sort((a, b) => a.name.localeCompare(b.name));
  return bundles;
}

/**
 * Save or update a preset bundle in the presets directory.
 * @param {string} presetsDir
 * @param {object} payload
 * @returns {{ success: boolean, slug: string }}
 */
export function savePresetBundle(presetsDir, payload) {
  if (!presetsDir) {
    throw new Error('Presets directory is required');
  }

  const rawSlug = payload.slug || payload.id || payload.name || 'custom_preset';
  const slug = String(rawSlug)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

  const bundleDir = path.join(presetsDir, slug);
  if (!fs.existsSync(bundleDir)) {
    fs.mkdirSync(
      bundleDir,
      {
        recursive: true
      }
    );
  }

  const jsonFilePath = path.join(bundleDir, `${slug}.json`);
  const metadata = {
    id: slug,
    slug,
    name: payload.name || slug,
    category: payload.category || 'custom',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    summary: payload.summary || payload.description || '',
    composition: payload.composition || null,
    overrideBuiltinId: payload.overrideBuiltinId || null,
    isBuiltin: Boolean(payload.isBuiltin),
    updatedAt: new Date().toISOString()
  };

  fs.writeFileSync(
    jsonFilePath,
    JSON.stringify(metadata, null, 2),
    'utf8'
  );

  // If base64 banner is provided (from canvas snapshot or paste)
  if (payload.bannerBase64) {
    const bannerPath = path.join(bundleDir, `${slug}.png`);
    const data = payload.bannerBase64.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(
      bannerPath,
      Buffer.from(data, 'base64')
    );
  }

  // If base64 video is provided
  if (payload.videoBase64) {
    const videoPath = path.join(bundleDir, `${slug}.mp4`);
    const data = payload.videoBase64.replace(/^data:video\/\w+;base64,/, '');
    fs.writeFileSync(
      videoPath,
      Buffer.from(data, 'base64')
    );
  }

  return {
    success: true,
    slug
  };
}

/**
 * Delete a preset bundle directory.
 * @param {string} presetsDir
 * @param {string} slug
 * @returns {{ success: boolean }}
 */
export function deletePresetBundle(presetsDir, slug) {
  if (!presetsDir || !slug) {
    return {
      success: false
    };
  }

  // Prevent path traversal
  const safeSlug = path.basename(slug);
  const bundleDir = path.join(presetsDir, safeSlug);

  if (fs.existsSync(bundleDir)) {
    fs.rmSync(
      bundleDir,
      {
        recursive: true,
        force: true
      }
    );
    return {
      success: true
    };
  }

  return {
    success: false
  };
}
