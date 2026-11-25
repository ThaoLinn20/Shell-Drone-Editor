import { t } from '../config/lang/i18n.js';
import { showToast } from '../utils/Toast.js';
import {
  computeShowEndTime,
  getFullShowQualityPreset
} from '../utils/fullShowRecordingHelper.js';

/**
 * Full-show high-resolution (1080p / 2K / 4K at 60fps) video recording service
 * with synchronized WebAudio mixing (SFX + timeline music), disk-streamed chunks
 * via Electron IPC, FFmpeg MP4 finalization, V-key pause/resume, and C-key PNG snapshots.
 */
export class FullShowRecordingService {
  constructor(deps = {}) {
    this.renderer = deps.renderer || null;
    this.postProcessing = deps.postProcessing || null;
    this.showDirector = deps.showDirector || null;
    this.cameraManager = deps.cameraManager || null;
    this.audioSystem = deps.audioSystem || null;
    this.inputSystem = deps.inputSystem || null;
    this.timelineEditor = deps.timelineEditor || null;

    this.isRecording = false;
    this.isPaused = false;
    this._state = null;
    this._hud = null;
    this._keydownHandler = null;
  }

  /**
   * Start recording the entire show from t = 0 until show completion or manual Stop.
   * @param {Object} options
   * @param {string} [options.quality='1080p'] - '1080p', '2k', or '4k'
   * @param {boolean} [options.includeAudio=true]
   * @param {boolean} [options.hideUi=true]
   * @param {string} [options.showName='FDShow']
   */
  async start(options = {}) {
    if (this.isRecording || !this.renderer || !this.showDirector) {
      return null;
    }

    const webglCanvas = this.renderer.instance?.domElement;
    if (!webglCanvas || typeof MediaRecorder === 'undefined') {
      showToast(
        t('editor.fullRecord.unsupported') || 'Video recording is not supported in this environment',
        'error'
      );
      return null;
    }

    const preset = getFullShowQualityPreset(options.quality || '1080p');
    const includeAudio = options.includeAudio !== false;
    const hideUi = options.hideUi !== false;
    const showName = options.showName || 'FDShow';
    const showEndTime = computeShowEndTime(this.showDirector.scriptConfig || []);

    const snapshot = this._snapshotState();
    this.isRecording = true;
    this.isPaused = false;

    let sessionId = null;
    let stream = null;
    let recorder = null;
    let pendingWritePromises = [];

    try {
      // 1. Hide editor UI if requested
      if (hideUi && this.timelineEditor?.container) {
        this.timelineEditor.container.style.visibility = 'hidden';
      }

      // 2. Resize WebGL & PostProcessing to exact 16:9 target resolution
      this._applyRenderResolution(preset.width, preset.height);
      this._ensureRecordCanvas(preset.width, preset.height);

      // 3. Prepare Audio Graph (SFX + Timeline Music)
      const captureSourceCanvas = this._recordCanvas || webglCanvas;
      const combinedStream = captureSourceCanvas.captureStream(preset.fps);
      if (includeAudio && this.audioSystem) {
        if (this.audioSystem.ctx?.state === 'suspended') {
          try {
            await this.audioSystem.ctx.resume();
          } catch {}
        }
        this.showDirector.connectAudioPlayersToSystem(this.audioSystem);
        const recDest = this.audioSystem.getOrCreateRecordingDestination();
        if (recDest?.stream) {
          recDest.stream.getAudioTracks().forEach((track) => {
            combinedStream.addTrack(track);
          });
        }
      }
      stream = combinedStream;

      // 4. Open disk-streaming session in Electron (or fallback to in-memory chunks in browser)
      const hasElectronRecording = Boolean(
        typeof window !== 'undefined' &&
        window.electronAPI &&
        typeof window.electronAPI.recordingStart === 'function'
      );

      if (hasElectronRecording) {
        const started = await window.electronAPI.recordingStart();
        sessionId = started?.sessionId || null;
      }

      const memoryChunks = [];
      const mimeTypes = [
        'video/webm;codecs=h264,opus',
        'video/webm;codecs=avc1,opus',
        'video/webm;codecs=h264',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp9',
        'video/webm'
      ];
      const mimeType = mimeTypes.find((m) =>
        typeof MediaRecorder.isTypeSupported === 'function' &&
        MediaRecorder.isTypeSupported(m)
      ) || 'video/webm';

      recorder = new MediaRecorder(
        stream,
        {
          mimeType,
          videoBitsPerSecond: preset.bitrate
        }
      );

      let writeChain = Promise.resolve();
      recorder.ondataavailable = (ev) => {
        if (!ev.data || ev.data.size === 0) return;
        if (hasElectronRecording && sessionId) {
          writeChain = writeChain.then(async () => {
            const buf = await ev.data.arrayBuffer();
            await window.electronAPI.recordingWriteChunk(
              sessionId,
              new Uint8Array(buf)
            );
          });
          pendingWritePromises.push(writeChain);
        } else {
          memoryChunks.push(ev.data);
        }
      };

      const completionPromise = new Promise((resolve) => {
        this._state = {
          preset,
          showName,
          showEndTime,
          mimeType,
          sessionId,
          hasElectronRecording,
          stream,
          recorder,
          memoryChunks,
          pendingWritePromises,
          photoCount: 0,
          pendingPhotoCapture: false,
          finalizing: false,
          canceled: false,
          resolve
        };
      });

      this._createHud(this._state);
      this._attachKeyListener();

      // 5. Seek to t = 0 and start playback + recording synchronously
      this.showDirector.seek(0);
      this.showDirector.play();
      recorder.start(1000);

      const finalResult = await completionPromise;
      return finalResult;
    } catch (err) {
      console.error('Failed to start full-show recording:', err);
      if (sessionId && window.electronAPI?.recordingCancel) {
        try {
          await window.electronAPI.recordingCancel(sessionId);
        } catch {}
      }
      this._cleanup(snapshot);
      return null;
    } finally {
      this._cleanup(snapshot);
    }
  }

  /**
   * Toggle Pause / Resume (hotkey V).
   */
  togglePause() {
    if (!this.isRecording || !this._state || this._state.finalizing) return;

    const { recorder } = this._state;
    if (this.isPaused) {
      this.isPaused = false;
      if (recorder && recorder.state === 'paused') {
        recorder.resume();
      }
      if (this.showDirector) {
        this.showDirector.play();
      }
    } else {
      this.isPaused = true;
      if (this.showDirector) {
        this.showDirector.pause();
      }
      if (recorder && recorder.state === 'recording') {
        recorder.pause();
      }
    }
    this._updateHudStatus();
  }

  /**
   * Trigger synchronous full-resolution PNG capture on the next rendered frame (hotkey C).
   */
  capturePhoto() {
    if (!this.isRecording || !this._state || this._state.finalizing) return;
    this._state.pendingPhotoCapture = true;
  }

  /**
   * Stop recording and finalize MP4 output.
   */
  async stopAndSave() {
    if (!this.isRecording || !this._state || this._state.finalizing) return;
    this._state.finalizing = true;
    this._updateHudStatus(
      t('editor.fullRecord.finalizing') || 'Encoding MP4...'
    );

    if (this.showDirector) {
      this.showDirector.pause();
    }

    const state = this._state;
    await this._stopMediaRecorderAndWait(state.recorder);
    await Promise.allSettled(state.pendingWritePromises);

    let result = null;
    if (state.hasElectronRecording && state.sessionId) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const isH264Input = Boolean(
        state.mimeType && (state.mimeType.includes('h264') || state.mimeType.includes('avc1'))
      );
      const unsubProgress = typeof window.electronAPI.onRecordingProgress === 'function'
        ? window.electronAPI.onRecordingProgress((pct) => {
            this._updateHudStatus(
              `${t('editor.fullRecord.finalizing') || 'Encoding MP4...'} ${pct}%`
            );
          })
        : null;

      try {
        result = await window.electronAPI.recordingFinalize({
          sessionId: state.sessionId,
          filenameBase: `${state.showName}_${state.preset.label.replace(/\s+/g, '_')}_${stamp}`,
          askSavePath: true,
          isH264Input,
          durationSec: this.showDirector ? (this.showDirector.elapsedTime || 0) : 0
        });
      } finally {
        if (typeof unsubProgress === 'function') {
          unsubProgress();
        }
      }
    } else if (state.memoryChunks.length > 0) {
      const blob = new Blob(
        state.memoryChunks,
        {
          type: 'video/webm'
        }
      );
      this._triggerBrowserDownload(blob, `${state.showName}_${Date.now()}.webm`);
      result = {
        success: true,
        browserDownload: true
      };
    }

    if (result?.success && result.filePath) {
      showToast(
        `${t('editor.fullRecord.saved') || 'Show video saved'}: ${result.filePath}`,
        'success'
      );
      if (window.electronAPI?.recordingOpenFolder) {
        window.electronAPI.recordingOpenFolder(result.filePath);
      }
    }

    state.resolve(result);
  }

  /**
   * Cancel recording, discard temp file, and restore editor state.
   */
  async cancel() {
    if (!this.isRecording || !this._state || this._state.finalizing) return;
    const state = this._state;
    state.finalizing = true;
    state.canceled = true;

    if (this.showDirector) {
      this.showDirector.pause();
    }

    await this._stopMediaRecorderAndWait(state.recorder);
    await Promise.allSettled(state.pendingWritePromises);

    if (state.hasElectronRecording && state.sessionId && window.electronAPI?.recordingCancel) {
      try {
        await window.electronAPI.recordingCancel(state.sessionId);
      } catch {}
    }

    showToast(
      t('editor.fullRecord.canceled') || 'Show recording canceled',
      'info'
    );
    state.resolve(null);
  }

  /**
   * Called synchronously right after each WebGL render frame.
   */
  onAfterRender() {
    if (!this.isRecording || !this._state || this._state.finalizing) {
      return;
    }

    const state = this._state;
    const simTime = this.showDirector ? (this.showDirector.elapsedTime || 0) : 0;

    this._drawWatermarkedFrame(state.preset);

    if (state.pendingPhotoCapture) {
      state.pendingPhotoCapture = false;
      this._executeSyncPhotoCapture(state);
    }

    this._updateHudTimer(simTime, state.showEndTime);

    if (!this.isPaused && simTime >= state.showEndTime) {
      this.stopAndSave();
    }
  }

  _executeSyncPhotoCapture(state) {
    const canvas = this._recordCanvas || this.renderer?.instance?.domElement;
    if (!canvas) return;

    try {
      const pngBase64 = canvas.toDataURL('image/png');
      state.photoCount += 1;
      this._flashShutterBorder();
      this._updateHudPhotoCount();

      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filenameBase = `${state.showName}_photo_${state.photoCount}_${stamp}`;

      if (window.electronAPI?.recordingSavePhoto) {
        window.electronAPI.recordingSavePhoto(pngBase64, filenameBase);
      } else {
        fetch(pngBase64)
          .then((r) => r.blob())
          .then((blob) => this._triggerBrowserDownload(blob, `${filenameBase}.png`))
          .catch(() => {});
      }
    } catch (err) {
      console.error('Failed to capture high-res photo:', err);
    }
  }

  _ensureRecordCanvas(width, height) {
    if (typeof document === 'undefined') return;
    if (!this._recordCanvas) {
      this._recordCanvas = document.createElement('canvas');
      this._recordCtx = this._recordCanvas.getContext('2d');
    }
    this._recordCanvas.width = width;
    this._recordCanvas.height = height;
  }

  _drawWatermarkedFrame(preset) {
    const src = this.renderer?.instance?.domElement;
    if (!src || !this._recordCtx || !this._recordCanvas) {
      return;
    }

    const w = this._recordCanvas.width;
    const h = this._recordCanvas.height;
    const ctx = this._recordCtx;

    ctx.drawImage(src, 0, 0, w, h);

    const fontSize = Math.max(18, Math.round(h * 0.026));
    const padX = Math.round(w * 0.024);
    const padY = Math.round(h * 0.026);

    ctx.save();
    ctx.font = `600 ${fontSize}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
    ctx.shadowBlur = Math.max(4, Math.round(fontSize * 0.28));
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(
      'FDShowStudio',
      w - padX,
      padY
    );
    ctx.restore();
  }

  _stopMediaRecorderAndWait(recorder) {
    return new Promise((resolve) => {
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }
      recorder.addEventListener('stop', () => resolve(), { once: true });
      try {
        recorder.stop();
      } catch {
        resolve();
      }
    });
  }

  _applyRenderResolution(width, height) {
    if (!this.renderer?.instance) return;
    this.renderer.resizeLocked = true;
    this.renderer.instance.setPixelRatio(1);
    this.renderer.instance.setSize(width, height, false);

    if (this.postProcessing && typeof this.postProcessing.setSize === 'function') {
      this.postProcessing.setSize(width, height, 1);
    }

    if (this.cameraManager?.instance) {
      this.cameraManager.instance.aspect = width / height;
      this.cameraManager.instance.updateProjectionMatrix();
    }
  }

  _snapshotState() {
    const rendererInst = this.renderer?.instance;
    const cam = this.cameraManager?.instance;
    return {
      elapsedTime: this.showDirector?.elapsedTime || 0,
      wasPlaying: Boolean(this.showDirector?.isPlaying),
      width: typeof window !== 'undefined' ? window.innerWidth : 1280,
      height: typeof window !== 'undefined' ? window.innerHeight : 720,
      pixelRatio: rendererInst ? rendererInst.getPixelRatio() : 1,
      cameraAspect: cam ? cam.aspect : 16 / 9,
      timelineVisibility: this.timelineEditor?.container?.style?.visibility || ''
    };
  }

  _cleanup(snapshot) {
    this._removeKeyListener();
    this._removeHud();

    if (this._state?.stream && typeof this._state.stream.getTracks === 'function') {
      this._state.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    }

    if (this.audioSystem && typeof this.audioSystem.disconnectRecordingDestination === 'function') {
      this.audioSystem.disconnectRecordingDestination();
    }

    if (snapshot) {
      if (this.renderer?.instance) {
        this.renderer.resizeLocked = false;
        this.renderer.instance.setPixelRatio(snapshot.pixelRatio);
        this.renderer.instance.setSize(snapshot.width, snapshot.height);
      }
      if (this.postProcessing && typeof this.postProcessing.setSize === 'function') {
        this.postProcessing.setSize(snapshot.width, snapshot.height, snapshot.pixelRatio);
      }
      if (this.cameraManager?.instance) {
        this.cameraManager.instance.aspect = snapshot.cameraAspect;
        this.cameraManager.instance.updateProjectionMatrix();
      }
      if (this.timelineEditor?.container) {
        this.timelineEditor.container.style.visibility = snapshot.timelineVisibility;
      }
      if (this.showDirector) {
        this.showDirector.pause();
        this.showDirector.seek(snapshot.elapsedTime);
      }
    }

    this.isRecording = false;
    this.isPaused = false;
    this._state = null;
    this._recordCanvas = null;
    this._recordCtx = null;
  }

  _attachKeyListener() {
    this._removeKeyListener();
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return;
    }

    this._keydownHandler = (e) => {
      if (e.repeat) return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        return;
      }

      const key = (e.key || '').toLowerCase();
      if (key === 'v') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.togglePause();
      } else if (key === 'c') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.capturePhoto();
      } else if (key === 'escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.cancel();
      }
    };

    window.addEventListener(
      'keydown',
      this._keydownHandler,
      {
        capture: true
      }
    );
  }

  _removeKeyListener() {
    if (
      this._keydownHandler &&
      typeof window !== 'undefined' &&
      typeof window.removeEventListener === 'function'
    ) {
      window.removeEventListener(
        'keydown',
        this._keydownHandler,
        {
          capture: true
        }
      );
    }
    this._keydownHandler = null;
  }

  _createHud(state) {
    this._removeHud();
    if (typeof document === 'undefined' || !document.body) return;

    const hud = document.createElement('div');
    hud.className = 'full-show-recording-hud';
    hud.style.position = 'fixed';
    hud.style.top = '16px';
    hud.style.left = '50%';
    hud.style.transform = 'translateX(-50%)';
    hud.style.zIndex = '10001';
    hud.style.display = 'flex';
    hud.style.alignItems = 'center';
    hud.style.gap = '10px';
    hud.style.padding = '8px 14px';
    hud.style.borderRadius = '999px';
    hud.style.background = 'rgba(10, 16, 29, 0.92)';
    hud.style.border = '1px solid rgba(239, 68, 68, 0.65)';
    hud.style.boxShadow = '0 8px 28px rgba(0, 0, 0, 0.7)';
    hud.style.color = '#f8fafc';
    hud.style.fontSize = '12px';

    const dot = document.createElement('span');
    dot.style.width = '9px';
    dot.style.height = '9px';
    dot.style.borderRadius = '50%';
    dot.style.background = '#ef4444';

    const statusText = document.createElement('span');
    statusText.style.fontWeight = '700';
    statusText.style.fontFamily = 'monospace';
    statusText.textContent = `REC ${state.preset.label}`;

    const timerText = document.createElement('span');
    timerText.style.fontFamily = 'monospace';
    timerText.style.color = '#cbd5e1';
    timerText.textContent = `00:00 / ${this._formatTime(state.showEndTime)}`;

    const makeBtn = (label, onClick, variant = 'default') => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.style.padding = '4px 10px';
      btn.style.fontSize = '11px';
      btn.style.fontWeight = '600';
      btn.style.borderRadius = '6px';
      btn.style.cursor = 'pointer';
      btn.style.border = '1px solid rgba(255, 255, 255, 0.18)';
      if (variant === 'primary') {
        btn.style.background = '#00bcd4';
        btn.style.color = '#000000';
        btn.style.borderColor = '#00e5ff';
      } else if (variant === 'danger') {
        btn.style.background = 'rgba(239, 68, 68, 0.2)';
        btn.style.color = '#fca5a5';
        btn.style.borderColor = 'rgba(239, 68, 68, 0.45)';
      } else {
        btn.style.background = 'rgba(255, 255, 255, 0.08)';
        btn.style.color = '#f8fafc';
      }
      btn.addEventListener('click', onClick);
      return btn;
    };

    const pauseBtn = makeBtn(
      `${t('editor.fullRecord.pause') || 'Pause'} [V]`,
      () => this.togglePause()
    );

    const photoBtn = makeBtn(
      `${t('editor.fullRecord.photo') || 'Photo'} [C]`,
      () => this.capturePhoto()
    );

    const stopBtn = makeBtn(
      t('editor.fullRecord.stopAndSave') || 'Stop & Save',
      () => this.stopAndSave(),
      'primary'
    );

    const cancelBtn = makeBtn(
      t('common.cancel') || 'Cancel',
      () => this.cancel(),
      'danger'
    );

    hud.appendChild(dot);
    hud.appendChild(statusText);
    hud.appendChild(timerText);
    hud.appendChild(pauseBtn);
    hud.appendChild(photoBtn);
    hud.appendChild(stopBtn);
    hud.appendChild(cancelBtn);

    document.body.appendChild(hud);
    this._hud = {
      el: hud,
      dot,
      statusText,
      timerText,
      pauseBtn,
      photoBtn
    };
  }

  _updateHudStatus(customText = null) {
    if (!this._hud || !this._state) return;
    if (customText) {
      this._hud.statusText.textContent = customText;
      this._hud.dot.style.background = '#f59e0b';
      return;
    }
    if (this.isPaused) {
      this._hud.dot.style.background = '#f59e0b';
      this._hud.statusText.textContent = `PAUSED ${this._state.preset.label}`;
      this._hud.pauseBtn.textContent = `${t('editor.fullRecord.resume') || 'Resume'} [V]`;
    } else {
      this._hud.dot.style.background = '#ef4444';
      this._hud.statusText.textContent = `REC ${this._state.preset.label}`;
      this._hud.pauseBtn.textContent = `${t('editor.fullRecord.pause') || 'Pause'} [V]`;
    }
  }

  _updateHudTimer(currentSec, totalSec) {
    if (!this._hud) return;
    this._hud.timerText.textContent = `${this._formatTime(currentSec)} / ${this._formatTime(totalSec)}`;
  }

  _updateHudPhotoCount() {
    if (!this._hud || !this._state) return;
    const base = t('editor.fullRecord.photo') || 'Photo';
    this._hud.photoBtn.textContent = `${base} [C] (${this._state.photoCount})`;
  }

  _flashShutterBorder() {
    if (typeof document === 'undefined' || !document.body) return;
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.inset = '0';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '10002';
    flash.style.border = '4px solid rgba(255, 255, 255, 0.85)';
    flash.style.transition = 'opacity 0.15s ease';
    document.body.appendChild(flash);
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => {
        try {
          flash.remove();
        } catch {}
      }, 160);
    }, 60);
  }

  _removeHud() {
    if (this._hud?.el) {
      try {
        this._hud.el.remove();
      } catch {}
    }
    this._hud = null;
  }

  _formatTime(sec) {
    const total = Math.max(0, Math.floor(sec || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  _triggerBrowserDownload(blob, filename) {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
