import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import ffmpegPkg from '@ffmpeg-installer/ffmpeg';

const ffmpegPath = ffmpegPkg.path;
const rootDir = process.cwd();
const previewsDir = path.join(rootDir, 'data', 'previews');
const presetsDir = path.join(previewsDir, 'presets');

if (!fs.existsSync(presetsDir)) {
  fs.mkdirSync(presetsDir, { recursive: true });
}

const PRESET_MAPPINGS = [
  {
    targetBase: 'strobe-breathing-pulse',
    sourceMp4: path.join(previewsDir, 'effects', 'strobe.mp4'),
    timestamp: '0.6'
  },
  {
    targetBase: 'glitter-diamond-scintillation',
    sourceMp4: path.join(previewsDir, 'effects', 'glitter-strobe.mp4'),
    timestamp: '0.6'
  },
  {
    targetBase: 'sparkling-comet-branches',
    sourceMp4: path.join(previewsDir, 'dynamics', 'bouquet-comet.mp4'),
    timestamp: '0.5'
  },
  {
    targetBase: 'comet-tadpole-burst',
    sourceMp4: path.join(previewsDir, 'dynamics', 'swimming-star.mp4'),
    timestamp: '0.6'
  },
  {
    targetBase: 'sphere-erratic-dart',
    sourceMp4: path.join(previewsDir, 'dynamics', 'standard.mp4'),
    timestamp: '0.5'
  },
  {
    targetBase: 'crysanthemum_uniform_sphere',
    sourceMp4: path.join(previewsDir, 'dynamics', 'crysanthemum-trail.mp4'),
    timestamp: '0.6'
  },
  {
    targetBase: 'egg_crysanthemum',
    sourceMp4: path.join(previewsDir, 'dynamics', 'crysanthemum-trail.mp4'),
    timestamp: '0.6'
  },
  {
    targetBase: 'crysanthemum_sphere_rings',
    sourceMp4: path.join(previewsDir, 'dynamics', 'crysanthemum-trail.mp4'),
    timestamp: '0.6'
  },
  {
    targetBase: 'sphere_rings_cascade',
    sourceMp4: path.join(previewsDir, 'dynamics', 'wave.mp4'),
    timestamp: '0.6'
  },
  {
    targetBase: 'sphere_rings_strobe',
    sourceMp4: path.join(previewsDir, 'effects', 'strobe.mp4'),
    timestamp: '0.6'
  },
  {
    targetBase: 'horsetail_waterfall',
    sourceMp4: path.join(previewsDir, 'dynamics', 'falling-leaves.mp4'),
    timestamp: '0.7'
  }
];

console.log('Generating built-in preset preview assets in data/previews/presets/...');

for (const item of PRESET_MAPPINGS) {
  const destMp4 = path.join(presetsDir, `${item.targetBase}.mp4`);
  const destJpg = path.join(presetsDir, `${item.targetBase}.jpg`);

  if (fs.existsSync(item.sourceMp4)) {
    // 1. Copy video
    fs.copyFileSync(item.sourceMp4, destMp4);

    // 2. Extract banner frame
    try {
      execFileSync(
        ffmpegPath,
        [
          '-y',
          '-ss',
          item.timestamp,
          '-i',
          destMp4,
          '-vframes',
          '1',
          '-q:v',
          '2',
          destJpg
        ],
        { stdio: 'ignore' }
      );
      console.log(`[OK] Generated: ${item.targetBase}.mp4 & .jpg`);
    } catch (err) {
      console.error(`[Error] Failed to extract jpg for ${item.targetBase}:`, err.message);
    }
  } else {
    console.warn(`[Warning] Source video not found: ${item.sourceMp4}`);
  }
}

console.log('Done generating preset previews.');
