import { t } from '../config/lang/i18n.js';
import { globalEventBus } from '../core/EventBus.js';
import { showToast } from '../utils/Toast.js';
import { InteractiveSpotlight } from './InteractiveSpotlight.js';
import {
  AudioBeatsStateMachine,
  AUDIO_BEATS_STEPS
} from './AudioBeatsStateMachine.js';

export class AudioBeatsGuideFlow {
  constructor(
    timelineEditor,
    eventBus = globalEventBus
  ) {
    this.timelineEditor = timelineEditor;
    this.eventBus = eventBus;
    this.stateMachine = new AudioBeatsStateMachine(eventBus);
    this.spotlight = new InteractiveSpotlight();
    this.lastPreparedSelectEvent = null;

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  start() {
    if (!this.timelineEditor) {
      return;
    }
    if (!this.timelineEditor.visible) {
      this.timelineEditor.toggle();
    }
    if (
      this.timelineEditor.onboardingFlow &&
      this.timelineEditor.onboardingFlow.stateMachine?.isActive
    ) {
      this.timelineEditor.onboardingFlow.stateMachine.dismiss();
    }
    if (
      this.timelineEditor.reuseBlocksGuide &&
      this.timelineEditor.reuseBlocksGuide.stateMachine?.isActive
    ) {
      this.timelineEditor.reuseBlocksGuide.stateMachine.dismiss();
    }
    if (
      this.timelineEditor.createScriptGuide &&
      this.timelineEditor.createScriptGuide.stateMachine?.isActive
    ) {
      this.timelineEditor.createScriptGuide.stateMachine.dismiss();
    }
    if (
      this.timelineEditor.welcomeGuide &&
      this.timelineEditor.welcomeGuide.stateMachine?.isActive
    ) {
      this.timelineEditor.welcomeGuide.stateMachine.dismiss();
    }

    this.lastPreparedSelectEvent = null;
    this.spotlight.initDOM();
    this.stateMachine.start({
      isPlaying: Boolean(this.timelineEditor.showDirector?.isPlaying)
    });
  }

  prepareStepSideEffects(step) {
    const editor = this.timelineEditor;
    if (!editor) {
      return;
    }

    if (
      step === AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK &&
      this.stateMachine.activeAudioEvent &&
      this.lastPreparedSelectEvent !== this.stateMachine.activeAudioEvent
    ) {
      this.lastPreparedSelectEvent = this.stateMachine.activeAudioEvent;
      editor.selectedEvents = [];
      if (editor.inspector) {
        editor.inspector.hide();
      }
      if (typeof editor.renderTracks === 'function') {
        editor.renderTracks();
      }
      return;
    }

    if (
      step === AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS ||
      step === AUDIO_BEATS_STEPS.CLEAR_BEATS
    ) {
      const inspector = editor.inspector;
      if (
        inspector &&
        inspector.collapsedGroups &&
        inspector.collapsedGroups.beatSettings
      ) {
        delete inspector.collapsedGroups.beatSettings;
        if (typeof inspector.render === 'function') {
          inspector.render();
        }
      }
      const actionId =
        step === AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS
          ? 'auto-detect-beats'
          : 'clear-all-beats';
      const targetBtn = this.findInspectorButton(actionId);
      if (targetBtn && typeof targetBtn.scrollIntoView === 'function') {
        targetBtn.scrollIntoView({ block: 'nearest' });
      }
      return;
    }

    if (
      step === AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE &&
      editor.showDirector &&
      editor.showDirector.isPlaying &&
      typeof editor.togglePlay === 'function'
    ) {
      editor.togglePlay();
    }
  }

  findInspectorButton(actionId) {
    const container = this.timelineEditor?.inspector?.container;
    if (container && typeof container.querySelector === 'function') {
      const btn = container.querySelector(
        `[data-inspector-action="${actionId}"]`
      );
      if (btn) {
        return btn;
      }
    }
    if (
      typeof document !== 'undefined' &&
      typeof document.querySelector === 'function'
    ) {
      return document.querySelector(
        `[data-inspector-action="${actionId}"]`
      );
    }
    return null;
  }

  getAudioBlockElement() {
    const editor = this.timelineEditor;
    if (!editor) {
      return null;
    }
    const targetSeq =
      this.stateMachine.activeAudioEvent ||
      (Array.isArray(editor.sequences)
        ? editor.sequences.find((s) => s && s.type === 'audio' && !s._deleted)
        : null);
    if (
      targetSeq &&
      editor.blockDomMap &&
      typeof editor.blockDomMap.get === 'function'
    ) {
      const el = editor.blockDomMap.get(targetSeq);
      if (el) {
        return el;
      }
    }
    return editor.tracksArea || editor.trackContainer;
  }

  handleStepChange(step) {
    if (step === AUDIO_BEATS_STEPS.COMPLETED) {
      this.finish();
      showToast(
        t('editor.audioBeatsGuide.completedToast') ||
          'Imported audio and completed live beat mapping successfully.',
        'success',
        3500
      );
      return;
    }

    if (step === AUDIO_BEATS_STEPS.DISMISSED) {
      this.finish();
      return;
    }

    this.prepareStepSideEffects(step);
    this.renderCurrentStep();
  }

  getStepConfig(step) {
    const editor = this.timelineEditor;

    if (step === AUDIO_BEATS_STEPS.OPEN_ADD_MENU) {
      return {
        title:
          t('editor.audioBeatsGuide.step1Title') ||
          'Open Add Drone and Audio Menu',
        desc:
          t('editor.audioBeatsGuide.step1Desc') ||
          'Click the Add Drone/Audio button on the toolbar to open media import options.',
        progressText: '',
        getTarget: () => editor?.addFileBtn || editor?.toolbar
      };
    }

    if (step === AUDIO_BEATS_STEPS.CLICK_ADD_AUDIO) {
      return {
        title:
          t('editor.audioBeatsGuide.step2Title') ||
          'Choose Add Audio MP3/WAV',
        desc:
          t('editor.audioBeatsGuide.step2Desc') ||
          'Click Add Audio MP3/WAV in the dropdown menu to pick a music file from your computer.',
        progressText: '',
        getTarget: () =>
          editor?.addAudioOpt || editor?.addFileDropdown || editor?.addFileBtn
      };
    }

    if (step === AUDIO_BEATS_STEPS.WAIT_AUDIO_IMPORT) {
      return {
        title:
          t('editor.audioBeatsGuide.step3Title') ||
          'Import Your Audio File',
        desc:
          t('editor.audioBeatsGuide.step3Desc') ||
          'Select an MP3 or WAV audio file in the file dialog and wait for it to load onto the timeline.',
        progressText:
          t('editor.audioBeatsGuide.step3Hint') ||
          'Waiting for MP3 or WAV file import...',
        getTarget: () => editor?.addFileBtn || editor?.tracksArea
      };
    }

    if (step === AUDIO_BEATS_STEPS.SELECT_AUDIO_BLOCK) {
      return {
        title:
          t('editor.audioBeatsGuide.step4Title') ||
          'Select the Added Audio Block',
        desc:
          t('editor.audioBeatsGuide.step4Desc') ||
          'Click on the audio block on the timeline to open its settings in the Property Inspector.',
        progressText: '',
        getTarget: () => this.getAudioBlockElement()
      };
    }

    if (step === AUDIO_BEATS_STEPS.AUTO_DETECT_BEATS) {
      return {
        title:
          t('editor.audioBeatsGuide.step5Title') ||
          'Run Auto Detect Beats',
        desc:
          t('editor.audioBeatsGuide.step5Desc') ||
          'Click Auto Detect Beats in the Beat Settings section to generate beat markers automatically.',
        progressText: '',
        getTarget: () =>
          this.findInspectorButton('auto-detect-beats') ||
          editor?.inspector?.container ||
          editor?.toolbar
      };
    }

    if (step === AUDIO_BEATS_STEPS.EXPLAIN_BEATS) {
      return {
        title:
          t('editor.audioBeatsGuide.explainBeatsTitle') ||
          'What Are Beat Markers',
        desc:
          t('editor.audioBeatsGuide.explainBeatsDesc') ||
          'Those yellow dots on the audio track are Beat markers. When dragging firework blocks on the timeline, Snap-to-beat magnetically aligns them to nearby beats so your show hits exact musical moments.',
        progressText:
          t('editor.audioBeatsGuide.explainBeatsHint') ||
          'Look at the yellow dots on the audio block, then click Next to practice clearing and tapping beats',
        getTarget: () => this.getAudioBlockElement()
      };
    }

    if (step === AUDIO_BEATS_STEPS.CLEAR_BEATS) {
      return {
        title:
          t('editor.audioBeatsGuide.step6Title') ||
          'Clear All Beats',
        desc:
          t('editor.audioBeatsGuide.step6Desc') ||
          'Click Clear All Beats and confirm to remove the auto-detected markers before tapping beats manually.',
        progressText: '',
        getTarget: () =>
          this.findInspectorButton('clear-all-beats') ||
          editor?.inspector?.container ||
          editor?.toolbar
      };
    }

    if (step === AUDIO_BEATS_STEPS.PLAY_AUDIO) {
      const resumeTpl =
        t('editor.audioBeatsGuide.tapProgress') ||
        'Beats tapped: {count} of {total}';
      return {
        title:
          t('editor.audioBeatsGuide.step7Title') ||
          'Play Audio to Mark Beats',
        desc:
          t('editor.audioBeatsGuide.step7Desc') ||
          'Click the Play button or press Space to start the music before tapping beats.',
        progressText:
          this.stateMachine.tappedBeatsCount > 0
            ? resumeTpl
                .replace('{count}', String(this.stateMachine.tappedBeatsCount))
                .replace('{total}', String(this.stateMachine.targetBeatCount))
            : t('editor.audioBeatsGuide.step7Hint') ||
              'Shortcut: Press Space or click Play',
        getTarget: () => editor?.playBtn || editor?.toolbar
      };
    }

    if (step === AUDIO_BEATS_STEPS.TAP_BEATS) {
      const progressTpl =
        t('editor.audioBeatsGuide.tapProgress') ||
        'Beats tapped: {count} of {total}';
      return {
        title:
          t('editor.audioBeatsGuide.step8Title') ||
          'Tap Beats Live with Key B',
        desc:
          t('editor.audioBeatsGuide.step8Desc') ||
          'While the music is playing, press the B key repeatedly along with the rhythm to mark 5 beats.',
        progressText: progressTpl
          .replace('{count}', String(this.stateMachine.tappedBeatsCount))
          .replace('{total}', String(this.stateMachine.targetBeatCount)),
        getTarget: () => this.getAudioBlockElement()
      };
    }

    if (step === AUDIO_BEATS_STEPS.SELECT_BEAT_ON_TIMELINE) {
      return {
        title:
          t('editor.audioBeatsGuide.selectBeatTitle') ||
          'Select an Existing Beat on Timeline',
        desc:
          t('editor.audioBeatsGuide.selectBeatDesc') ||
          'Click directly on one of the yellow beat dots on the audio block to place the Playhead onto that beat.',
        progressText:
          t('editor.audioBeatsGuide.selectBeatHint') ||
          'Action: Click a yellow beat dot on the audio block',
        getTarget: () => this.getAudioBlockElement()
      };
    }

    if (step === AUDIO_BEATS_STEPS.DELETE_ONE_BEAT) {
      return {
        title:
          t('editor.audioBeatsGuide.step9Title') ||
          'Press B Twice to Delete Beat',
        desc:
          t('editor.audioBeatsGuide.step9Desc') ||
          'With Playhead on the selected beat, press the B key twice quickly to delete that beat marker.',
        progressText:
          t('editor.audioBeatsGuide.step9Hint') ||
          'Shortcut: Press B twice quickly',
        getTarget: () => this.getAudioBlockElement()
      };
    }

    return null;
  }

  getStepActions(step) {
    if (step !== AUDIO_BEATS_STEPS.EXPLAIN_BEATS) {
      return [];
    }
    return [
      {
        label: t('editor.timelineTour.nextBtn') || 'Next',
        primary: true,
        onClick: () => {
          this.stateMachine.advanceFromExplainBeats();
        }
      }
    ];
  }

  renderCurrentStep() {
    if (!this.stateMachine.isActive) {
      return;
    }
    const config = this.getStepConfig(this.stateMachine.currentStep);
    if (!config) {
      return;
    }

    const stepNum = Math.max(
      1,
      this.stateMachine.getStepIndex() + 1
    );
    const total = this.stateMachine.getTotalSteps();
    const badgeTpl =
      t('editor.audioBeatsGuide.stepIndicator') ||
      'Practice {current} of {total}';
    const badge = badgeTpl
      .replace('{current}', String(stepNum))
      .replace('{total}', String(total));

    this.spotlight.render({
      badge,
      title: config.title,
      desc: config.desc,
      progressText: config.progressText,
      skipLabel: t('editor.onboarding.skipBtn') || 'Skip',
      actions: this.getStepActions(this.stateMachine.currentStep),
      onDismiss: () => {
        this.stateMachine.dismiss();
      },
      getTarget: config.getTarget
    });
  }

  finish() {
    this.spotlight.destroyDOM();
  }

  destroy() {
    this.finish();
    this.stateMachine.destroy();
  }
}

