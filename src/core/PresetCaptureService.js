import { t } from '../config/lang/i18n.js';
import { computePresetCaptureWindow } from '../utils/presetCaptureTiming.js';
import { deepCloneJson } from '../utils/presetComposition.js';

const CAPTURE_WIDTH = 854;
const CAPTURE_HEIGHT = 480;
const CAPTURE_FPS = 24;
const VIDEO_BITRATE = 650000;
const IMAGE_QUALITY = 0.72;
const MAX_MANUAL_RECORD_SEC = 45;

/**
 * Automated and manual 480p video and low-quality thumbnail capture service
 * for single firework blocks. Isolates the target block on the main renderer
 * and restores all editor, camera, and show state on completion or cancel.
 */
export class PresetCaptureService {
  constructor(deps = {}) {
    this.renderer = deps.renderer || null;
    this.showDirector = deps.showDirector || null;
    this.cameraManager = deps.cameraManager || null;
    this.sceneManager = deps.sceneManager || null;
    this.inputSystem = deps.inputSystem || null;
    this.timelineEditor = deps.timelineEditor || null;

    this.isCapturing = false;
    this._activeState = null;
    this._captureCanvas = null;
    this._captureCtx = null;
    this._progressPill = null;
    this._keydownHandler = null;
  }

  /**
   * Capture a 480p WebM preview video and low-quality JPEG banner automatically
   * from pre-burst to fadeout.
   * @param {Object} event - Target timeline firework or comet block
   * @returns {Promise<{ bannerBase64: string, videoBase64: string, width: number, height: number } | null>}
   */
  async captureBlock(event) {
    return this._runCaptureSession(
      event,
      {
        mode: 'auto',
        lockCamera: true
      }
    );
  }

  /**
   * Replay the isolated block with free camera and wait for the user to press C
   * to manually snap an 854x480 JPEG banner.
   * @param {Object} event - Target timeline firework or comet block
   * @returns {Promise<{ bannerBase64: string, width: number, height: number } | null>}
   */
  async captureManualPhoto(event) {
    return this._runCaptureSession(
      event,
      {
        mode: 'manual-photo',
        lockCamera: false
      }
    );
  }

  /**
   * Replay the isolated block with free camera and wait for the user to press V
   * to start 480p WebM recording and press V again to finish.
   * @param {Object} event - Target timeline firework or comet block
   * @returns {Promise<{ videoBase64: string, width: number, height: number } | null>}
   */
  async captureManualVideo(event) {
    return this._runCaptureSession(
      event,
      {
        mode: 'manual-video',
        lockCamera: false
      }
    );
  }

  /**
   * Cancel an active capture session if one is running.
   */
  cancel() {
    if (this._activeState && typeof this._activeState.onCancel === 'function') {
      this._activeState.onCancel();
    }
  }

  /**
   * Called synchronously right after the main WebGL render pass each frame.
   */
  onAfterRender() {
    if (!this.isCapturing || !this._activeState || this._activeState.finished) {
      return;
    }

    const state = this._activeState;
    const simTime = this.showDirector ? (this.showDirector.elapsedTime || 0) : 0;

    this._drawCenterCroppedFrame();

    if (state.mode === 'auto') {
      this._stepAutoCapture(state, simTime);
    } else if (state.mode === 'manual-photo') {
      this._stepManualPhoto(state, simTime);
    } else if (state.mode === 'manual-video') {
      this._stepManualVideo(state, simTime);
    }
  }

  _runCaptureSession(event, options) {
    if (this.isCapturing || !event || !this.renderer || !this.showDirector) {
      return Promise.resolve(null);
    }

    const webglCanvas = this.renderer.instance?.domElement;
    if (!webglCanvas) {
      return Promise.resolve(null);
    }
    if (options.mode !== 'manual-photo' && typeof MediaRecorder === 'undefined') {
      return Promise.resolve(null);
    }

    this._ensureCaptureCanvas();
    const timing = computePresetCaptureWindow(event);
    const snapshot = this._snapshotEditorState();

    this.isCapturing = true;
    let canceled = false;

    return new Promise((resolve) => {
      const cleanupAndResolve = (result) => {
        this._removeKeyListener();
        this._teardownActiveRecorder();
        this._removeProgressPill();
        this._restoreEditorState(snapshot);
        this.isCapturing = false;
        this._activeState = null;
        resolve(result);
      };

      const cancelCapture = () => {
        if (canceled) return;
        canceled = true;
        cleanupAndResolve(null);
      };

      try {
        this._isolateAndFrameBlock(
          event,
          timing,
          options.lockCamera
        );

        const state = {
          mode: options.mode,
          event,
          timing,
          chunks: [],
          recorder: null,
          stream: null,
          recorderStarted: false,
          recordingStartMs: 0,
          snapshotTaken: false,
          pendingManualSnapshot: false,
          manualPaused: false,
          bannerBase64: null,
          finished: false,
          onCancel: cancelCapture,
          onComplete: async () => {
            if (canceled) return;
            const chunks = state.chunks || [];
            const mimeType = state.mimeType || 'video/webm';
            let videoBase64 = null;

            if (chunks.length > 0) {
              const blob = new Blob(
                chunks,
                {
                  type: mimeType
                }
              );
              videoBase64 = await this._blobToDataUrl(blob);
            }

            if (state.mode === 'manual-photo') {
              cleanupAndResolve({
                bannerBase64: state.bannerBase64,
                width: CAPTURE_WIDTH,
                height: CAPTURE_HEIGHT
              });
            } else if (state.mode === 'manual-video') {
              cleanupAndResolve({
                videoBase64,
                width: CAPTURE_WIDTH,
                height: CAPTURE_HEIGHT
              });
            } else {
              cleanupAndResolve({
                bannerBase64: state.bannerBase64,
                videoBase64,
                width: CAPTURE_WIDTH,
                height: CAPTURE_HEIGHT
              });
            }
          }
        };

        this._activeState = state;
        this._showGuidancePill(state);

        if (options.mode !== 'auto') {
          this._attachManualKeyListener(state);
        }
      } catch (err) {
        console.error('Failed to start preset capture session:', err);
        cleanupAndResolve(null);
      }
    });
  }

  _stepAutoCapture(state, simTime) {
    const {
      recordStartTime,
      snapshotTime,
      recordEndTime
    } = state.timing;

    this._updateAutoProgressPill(simTime, recordEndTime);

    if (!state.recorderStarted && simTime >= recordStartTime) {
      this._startMediaRecorder(state);
    }

    if (!state.snapshotTaken && simTime >= snapshotTime) {
      state.bannerBase64 = this._captureJpegDataUrl();
      state.snapshotTaken = true;
    }

    if (simTime >= recordEndTime) {
      state.finished = true;
      if (!state.snapshotTaken) {
        state.bannerBase64 = this._captureJpegDataUrl();
        state.snapshotTaken = true;
      }

      if (state.recorder && state.recorder.state !== 'inactive') {
        state.recorder.stop();
      } else {
        state.onComplete();
      }
    }
  }

  _stepManualPhoto(state, simTime) {
    if (state.pendingManualSnapshot) {
      state.pendingManualSnapshot = false;
      state.finished = true;
      state.bannerBase64 = this._captureJpegDataUrl();
      state.onComplete();
      return;
    }

    const loopEnd = state.timing.recordEndTime + 0.4;
    if (!state.manualPaused && simTime >= loopEnd) {
      this._replayIsolatedBlock();
    }
  }

  _stepManualVideo(state, simTime) {
    if (state.recorderStarted && state.recordingStartMs > 0) {
      const elapsedSec = (Date.now() - state.recordingStartMs) / 1000;
      this._updateRecordingTimerPill(elapsedSec);
      if (elapsedSec >= MAX_MANUAL_RECORD_SEC) {
        this._stopManualVideoRecording(state);
      }
      return;
    }

    const loopEnd = state.timing.recordEndTime + 0.4;
    if (!state.manualPaused && simTime >= loopEnd) {
      this._replayIsolatedBlock();
    }
  }

  _replayIsolatedBlock() {
    if (!this.showDirector) return;
    this.showDirector.seek(0);
    this.showDirector.play();
    if (this._activeState) {
      this._activeState.manualPaused = false;
    }
  }

  _stopManualVideoRecording(state) {
    if (!state || state.finished) return;
    state.finished = true;
    if (state.recorder && state.recorder.state !== 'inactive') {
      state.recorder.stop();
    } else {
      state.onComplete();
    }
  }

  _attachManualKeyListener(state) {
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
      if (key === 'escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        state.onCancel();
        return;
      }

      if (key === 'r' && !state.recorderStarted) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this._replayIsolatedBlock();
        return;
      }

      if (e.code === 'Space' && !state.recorderStarted) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (state.manualPaused) {
          this.showDirector.play();
          state.manualPaused = false;
        } else {
          this.showDirector.pause();
          state.manualPaused = true;
        }
        return;
      }

      if (state.mode === 'manual-photo' && key === 'c') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!state.pendingManualSnapshot && !state.finished) {
          state.pendingManualSnapshot = true;
        }
        return;
      }

      if (state.mode === 'manual-video' && key === 'v') {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!state.recorderStarted) {
          state.manualPaused = false;
          if (this.showDirector && !this.showDirector.isPlaying) {
            this.showDirector.play();
          }
          state.recordingStartMs = Date.now();
          this._startMediaRecorder(state);
          this._refreshGuidancePillForRecording(state);
        } else if (Date.now() - state.recordingStartMs >= 200) {
          this._stopManualVideoRecording(state);
        }
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

  _captureJpegDataUrl() {
    try {
      return this._captureCanvas.toDataURL(
        'image/jpeg',
        IMAGE_QUALITY
      );
    } catch {
      return null;
    }
  }

  _ensureCaptureCanvas() {
    if (!this._captureCanvas) {
      this._captureCanvas = document.createElement('canvas');
      this._captureCanvas.width = CAPTURE_WIDTH;
      this._captureCanvas.height = CAPTURE_HEIGHT;
      this._captureCtx = this._captureCanvas.getContext('2d');
    }
  }

  _drawCenterCroppedFrame() {
    const src = this.renderer?.instance?.domElement;
    if (!src || !this._captureCtx || !src.width || !src.height) {
      return;
    }

    const targetAspect = CAPTURE_WIDTH / CAPTURE_HEIGHT;
    const srcAspect = src.width / src.height;

    let sx = 0;
    let sy = 0;
    let sw = src.width;
    let sh = src.height;

    if (srcAspect > targetAspect) {
      sw = Math.round(src.height * targetAspect);
      sx = Math.round((src.width - sw) * 0.5);
    } else if (srcAspect < targetAspect) {
      sh = Math.round(src.width / targetAspect);
      sy = Math.round((src.height - sh) * 0.5);
    }

    this._captureCtx.drawImage(
      src,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      CAPTURE_WIDTH,
      CAPTURE_HEIGHT
    );
  }

  _startMediaRecorder(state) {
    state.recorderStarted = true;
    try {
      const mimeTypes = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ];
      const supportedMime = mimeTypes.find((m) =>
        typeof MediaRecorder.isTypeSupported === 'function' &&
        MediaRecorder.isTypeSupported(m)
      ) || 'video/webm';

      state.mimeType = supportedMime;
      state.stream = this._captureCanvas.captureStream(CAPTURE_FPS);
      const recorder = new MediaRecorder(
        state.stream,
        {
          mimeType: supportedMime,
          videoBitsPerSecond: VIDEO_BITRATE
        }
      );

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          state.chunks.push(ev.data);
        }
      };

      recorder.onstop = () => {
        state.onComplete();
      };

      recorder.onerror = () => {
        state.onComplete();
      };

      state.recorder = recorder;
      recorder.start(250);
    } catch (err) {
      console.warn('MediaRecorder unavailable during preset capture:', err);
    }
  }

  _teardownActiveRecorder() {
    if (!this._activeState) return;
    const {
      recorder,
      stream
    } = this._activeState;

    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.stop();
      } catch {}
    }

    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    }
  }

  _snapshotEditorState() {
    const cam = this.cameraManager?.instance;
    return {
      scriptConfig: this.showDirector?.scriptConfig
        ? [...this.showDirector.scriptConfig]
        : [],
      elapsedTime: this.showDirector?.elapsedTime || 0,
      wasPlaying: Boolean(this.showDirector?.isPlaying),
      cameraEnabled: this.cameraManager ? this.cameraManager.enabled : true,
      cameraPos: cam ? cam.position.clone() : null,
      cameraQuat: cam ? cam.quaternion.clone() : null,
      timelineDisplay: this.timelineEditor?.container?.style?.display || '',
      timelineVisibility: this.timelineEditor?.container?.style?.visibility || ''
    };
  }

  _isolateAndFrameBlock(event, timing, lockCamera) {
    const isolatedEvent = deepCloneJson(event);
    isolatedEvent.time = 0;

    if (this.timelineEditor?.container) {
      this.timelineEditor.container.style.visibility = 'hidden';
    }

    if (this.cameraManager?.instance) {
      this.cameraManager.enabled = !lockCamera;
      const targetX = Number(isolatedEvent.x) || 0;
      const targetZ = Number(isolatedEvent.z) || 0;
      const targetY = timing.burstAltitude * 0.92;
      const sizeMult = Math.max(
        0.5,
        Number(isolatedEvent.sizeMultiplier ?? isolatedEvent.effectOverrides?.sizeMultiplier ?? 1.0) || 1.0
      );
      const distance = Math.max(200, Math.min(480, 260 * sizeMult));

      this.cameraManager.instance.position.set(
        targetX,
        Math.max(18, targetY * 0.35),
        targetZ + distance
      );
      this.cameraManager.instance.lookAt(
        targetX,
        targetY,
        targetZ
      );
    }

    this.showDirector.loadScript([isolatedEvent]);
    this.showDirector.seek(0);
    this.showDirector.play();
  }

  _restoreEditorState(snapshot) {
    if (!snapshot) return;

    if (
      typeof document !== 'undefined' &&
      document.pointerLockElement &&
      typeof document.exitPointerLock === 'function'
    ) {
      try {
        document.exitPointerLock();
      } catch {}
    }

    if (
      this.inputSystem?.controls?.isLocked &&
      typeof this.inputSystem.controls.unlock === 'function'
    ) {
      try {
        this.inputSystem.controls.unlock();
      } catch {}
    }

    if (this.showDirector) {
      this.showDirector.loadScript(snapshot.scriptConfig);
      this.showDirector.seek(snapshot.elapsedTime);
      if (snapshot.wasPlaying) {
        this.showDirector.play();
      } else {
        this.showDirector.pause();
      }
    }

    if (this.cameraManager?.instance) {
      if (snapshot.cameraPos) {
        this.cameraManager.instance.position.copy(snapshot.cameraPos);
      }
      if (snapshot.cameraQuat) {
        this.cameraManager.instance.quaternion.copy(snapshot.cameraQuat);
      }
      this.cameraManager.enabled = snapshot.cameraEnabled;
    }

    if (this.timelineEditor?.container) {
      this.timelineEditor.container.style.display = snapshot.timelineDisplay;
      this.timelineEditor.container.style.visibility = snapshot.timelineVisibility;
    }
  }

  _showGuidancePill(state) {
    this._removeProgressPill();
    if (typeof document === 'undefined' || !document.body) return;

    const pill = document.createElement('div');
    pill.className = 'preset-capture-pill';
    pill.style.position = 'fixed';
    pill.style.top = '16px';
    pill.style.left = '50%';
    pill.style.transform = 'translateX(-50%)';
    pill.style.zIndex = '10000';
    pill.style.display = 'flex';
    pill.style.flexDirection = 'column';
    pill.style.alignItems = 'center';
    pill.style.gap = '6px';
    pill.style.padding = '10px 16px';
    pill.style.borderRadius = '12px';
    pill.style.background = 'rgba(10, 16, 29, 0.94)';
    pill.style.border = '1px solid rgba(0, 229, 255, 0.45)';
    pill.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.65)';
    pill.style.color = '#f8fafc';
    pill.style.fontSize = '12px';
    pill.style.maxWidth = '90vw';

    const mainRow = document.createElement('div');
    mainRow.style.display = 'flex';
    mainRow.style.alignItems = 'center';
    mainRow.style.gap = '10px';

    const dot = document.createElement('span');
    dot.style.width = '8px';
    dot.style.height = '8px';
    dot.style.borderRadius = '50%';
    dot.style.background = state.mode === 'auto' ? '#ef4444' : '#00e5ff';
    dot.style.flexShrink = '0';

    const label = document.createElement('span');
    label.style.fontWeight = '600';
    if (state.mode === 'manual-photo') {
      label.textContent = t('editor.presetHub.manualPhotoGuide') || 'Press C to capture photo';
    } else if (state.mode === 'manual-video') {
      label.textContent = t('editor.presetHub.manualVideoStandbyGuide') || 'Press V to start 480p recording';
    } else {
      label.textContent = t('editor.presetHub.capturingPreview') || 'Capturing 480p preview...';
    }

    mainRow.appendChild(dot);
    mainRow.appendChild(label);

    if (state.mode !== 'auto') {
      const replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.textContent = t('editor.presetHub.replayButton') || 'Replay';
      replayBtn.style.padding = '2px 8px';
      replayBtn.style.fontSize = '11px';
      replayBtn.style.borderRadius = '4px';
      replayBtn.style.border = '1px solid rgba(0, 229, 255, 0.35)';
      replayBtn.style.background = 'rgba(0, 229, 255, 0.12)';
      replayBtn.style.color = '#7dd3fc';
      replayBtn.style.cursor = 'pointer';
      replayBtn.addEventListener('click', () => {
        if (!state.recorderStarted) {
          this._replayIsolatedBlock();
        }
      });
      mainRow.appendChild(replayBtn);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = t('common.cancel') || 'Cancel';
    cancelBtn.style.padding = '2px 8px';
    cancelBtn.style.fontSize = '11px';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
    cancelBtn.style.background = 'rgba(255, 255, 255, 0.08)';
    cancelBtn.style.color = '#e2e8f0';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.addEventListener('click', state.onCancel);
    mainRow.appendChild(cancelBtn);

    pill.appendChild(mainRow);

    let subLabel = null;
    if (state.mode !== 'auto') {
      subLabel = document.createElement('div');
      subLabel.style.fontSize = '11px';
      subLabel.style.color = '#94a3b8';
      subLabel.textContent = state.mode === 'manual-photo'
        ? (t('editor.presetHub.manualPhotoKeyHint') || 'C: Snap photo | Space: Pause or resume | R: Replay | Drag mouse: Rotate camera | Esc: Cancel')
        : (t('editor.presetHub.manualVideoKeyHint') || 'V: Start or stop recording | Space: Pause or resume | R: Replay | Drag mouse: Rotate camera | Esc: Cancel');
      pill.appendChild(subLabel);
    }

    document.body.appendChild(pill);

    this._progressPill = {
      el: pill,
      dot,
      label,
      subLabel
    };
  }

  _refreshGuidancePillForRecording(state) {
    if (!this._progressPill) return;
    this._progressPill.el.style.borderColor = 'rgba(239, 68, 68, 0.7)';
    this._progressPill.dot.style.background = '#ef4444';
    this._updateRecordingTimerPill(0);
    if (this._progressPill.subLabel) {
      this._progressPill.subLabel.textContent =
        t('editor.presetHub.manualRecordingSubHint') || 'Recording in progress. Press V again to finish or Esc to cancel.';
    }
  }

  _updateRecordingTimerPill(elapsedSec) {
    if (!this._progressPill) return;
    const secs = Math.floor(elapsedSec);
    const baseText = t('editor.presetHub.manualVideoRecordingGuide') || 'Recording... Press V to stop';
    this._progressPill.label.textContent = `${baseText} - ${secs}s`;
  }

  _updateAutoProgressPill(simTime, recordEndTime) {
    if (!this._progressPill || !recordEndTime) return;
    const pct = Math.min(100, Math.max(0, Math.round((simTime / recordEndTime) * 100)));
    const baseText = t('editor.presetHub.capturingPreview') || 'Capturing 480p preview...';
    this._progressPill.label.textContent = `${baseText} ${pct}%`;
  }

  _removeProgressPill() {
    if (this._progressPill?.el) {
      try {
        this._progressPill.el.remove();
      } catch {}
    }
    this._progressPill = null;
  }

  _blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }
}
