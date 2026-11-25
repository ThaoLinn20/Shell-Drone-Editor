import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

function resolveFfmpegPath() {
  const raw = ffmpegInstaller?.path || 'ffmpeg';
  return raw.replace('app.asar', 'app.asar.unpacked');
}

function getDefaultExportsDir(app) {
  const baseDir = app.getPath('videos') || app.getPath('documents') || os.homedir();
  const dir = path.join(baseDir, 'FDShowStudio');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(
      dir,
      {
        recursive: true
      }
    );
  }
  return dir;
}

function runFfmpegTranscode(inputPath, outputPath, options = {}) {
  return new Promise((resolve, reject) => {
    const ffmpegPath = resolveFfmpegPath();
    const isH264Input = Boolean(options.isH264Input);
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const durationSec = Number(options.durationSec) || 0;

    const args = isH264Input
      ? [
          '-y',
          '-i',
          inputPath,
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '320k',
          '-movflags',
          '+faststart',
          outputPath
        ]
      : [
          '-y',
          '-i',
          inputPath,
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '18',
          '-pix_fmt',
          'yuv420p',
          '-c:a',
          'aac',
          '-b:a',
          '320k',
          '-movflags',
          '+faststart',
          outputPath
        ];

    const proc = spawn(
      ffmpegPath,
      args,
      {
        windowsHide: true
      }
    );

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (onProgress && durationSec > 0) {
        const match = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (match) {
          const secs = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
          const pct = Math.min(99, Math.max(0, Math.round((secs / durationSec) * 100)));
          onProgress(pct);
        }
      }
    });

    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      if (code === 0) {
        if (onProgress) onProgress(100);
        resolve();
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-400)}`));
      }
    });
  });
}

function closeStream(stream) {
  return new Promise((resolve) => {
    if (!stream) {
      resolve();
      return;
    }
    stream.end(() => resolve());
  });
}

/**
 * Register IPC handlers for disk-streamed full-show video recording,
 * FFmpeg MP4 muxing/transcoding, and instant PNG photo capture.
 */
export function registerRecordingHandlers({ ipcMain, app, dialog, shell, getMainWindow }) {
  const sessions = new Map();

  ipcMain.handle('recording:start', async () => {
    const sessionId = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tempPath = path.join(os.tmpdir(), `fdshow_${sessionId}.webm`);
    const stream = fs.createWriteStream(tempPath);
    sessions.set(
      sessionId,
      {
        stream,
        tempPath
      }
    );
    return {
      sessionId,
      tempPath
    };
  });

  ipcMain.handle('recording:write-chunk', async (_event, { sessionId, chunk }) => {
    const session = sessions.get(sessionId);
    if (!session || !session.stream || !chunk) {
      return false;
    }
    const buf = Buffer.from(chunk);
    if (!session.stream.write(buf)) {
      await new Promise((resolve) => session.stream.once('drain', resolve));
    }
    return true;
  });

  ipcMain.handle('recording:cancel', async (_event, { sessionId }) => {
    const session = sessions.get(sessionId);
    if (!session) return true;
    sessions.delete(sessionId);
    await closeStream(session.stream);
    if (fs.existsSync(session.tempPath)) {
      try {
        fs.unlinkSync(session.tempPath);
      } catch {}
    }
    return true;
  });

  ipcMain.handle('recording:finalize', async (_event, payload = {}) => {
    const {
      sessionId,
      filenameBase = `FDShow_${Date.now()}`,
      askSavePath = true,
      isH264Input = false,
      durationSec = 0
    } = payload;

    const session = sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        canceled: true
      };
    }
    sessions.delete(sessionId);
    await closeStream(session.stream);

    const exportsDir = getDefaultExportsDir(app);
    const safeName = String(filenameBase).replace(/[<>:"/\\|?*]+/g, '_');
    let outputPath = path.join(exportsDir, `${safeName}.mp4`);

    if (askSavePath && dialog) {
      const win = typeof getMainWindow === 'function' ? getMainWindow() : null;
      const result = await dialog.showSaveDialog(
        win || undefined,
        {
          defaultPath: outputPath,
          filters: [
            {
              name: 'MP4 Video',
              extensions: ['mp4']
            },
            {
              name: 'WebM Video',
              extensions: ['webm']
            }
          ]
        }
      );

      if (result.canceled || !result.filePath) {
        if (fs.existsSync(session.tempPath)) {
          try {
            fs.unlinkSync(session.tempPath);
          } catch {}
        }
        return {
          success: false,
          canceled: true
        };
      }
      outputPath = result.filePath;
    }

    const tempMp4Path = path.join(os.tmpdir(), `fdshow_out_${sessionId}.mp4`);
    const win = typeof getMainWindow === 'function' ? getMainWindow() : null;

    try {
      if (outputPath.toLowerCase().endsWith('.webm')) {
        fs.copyFileSync(session.tempPath, outputPath);
      } else {
        await runFfmpegTranscode(
          session.tempPath,
          tempMp4Path,
          {
            isH264Input,
            durationSec,
            onProgress: (pct) => {
              if (win && !win.isDestroyed()) {
                win.webContents.send('recording:progress', pct);
              }
            }
          }
        );
        fs.copyFileSync(tempMp4Path, outputPath);
        if (fs.existsSync(tempMp4Path)) {
          try {
            fs.unlinkSync(tempMp4Path);
          } catch {}
        }
      }
      if (fs.existsSync(session.tempPath)) {
        try {
          fs.unlinkSync(session.tempPath);
        } catch {}
      }
      return {
        success: true,
        canceled: false,
        filePath: outputPath
      };
    } catch (err) {
      console.error('FFmpeg transcode failed, falling back to WebM:', err);
      if (fs.existsSync(tempMp4Path)) {
        try {
          fs.unlinkSync(tempMp4Path);
        } catch {}
      }
      const fallbackPath = outputPath.replace(/\.mp4$/i, '.webm');
      try {
        fs.copyFileSync(session.tempPath, fallbackPath);
        fs.unlinkSync(session.tempPath);
        return {
          success: true,
          canceled: false,
          filePath: fallbackPath,
          fallbackWebm: true
        };
      } catch (copyErr) {
        return {
          success: false,
          canceled: false,
          error: copyErr.message
        };
      }
    }
  });

  ipcMain.handle('recording:save-photo', async (_event, { pngBase64, filenameBase }) => {
    if (!pngBase64) {
      return {
        success: false
      };
    }
    const exportsDir = getDefaultExportsDir(app);
    const capturesDir = path.join(exportsDir, 'captures');
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(
        capturesDir,
        {
          recursive: true
        }
      );
    }

    const safeName = String(filenameBase || `capture_${Date.now()}`).replace(/[<>:"/\\|?*]+/g, '_');
    const photoPath = path.join(capturesDir, `${safeName}.png`);
    const rawBase64 = pngBase64.replace(/^data:[^,]+,/, '');
    fs.writeFileSync(
      photoPath,
      Buffer.from(rawBase64, 'base64')
    );

    return {
      success: true,
      filePath: photoPath
    };
  });

  ipcMain.handle('recording:open-folder', async (_event, { filePath }) => {
    if (!filePath) return false;
    if (fs.existsSync(filePath)) {
      shell.showItemInFolder(filePath);
      return true;
    }
    return false;
  });
}
