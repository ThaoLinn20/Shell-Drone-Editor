import { t } from '../../config/lang/i18n.js';
import { globalEventBus } from '../../core/EventBus.js';
import { showToast } from '../../utils/Toast.js';
import { InteractiveSpotlight } from './InteractiveSpotlight.js';
import {
  buildStepNavigationActions,
  prepareGuideFlowStart
} from './guideFlowHelpers.js';
import {
  TimelineControlsStateMachine,
  TIMELINE_CONTROLS_STEPS
} from './TimelineControlsStateMachine.js';

export class TimelineControlsGuideFlow {
  constructor(
    timelineEditor,
    eventBus = globalEventBus
  ) {
    this.timelineEditor = timelineEditor;
    this.eventBus = eventBus;
    this.stateMachine = new TimelineControlsStateMachine(eventBus);
    this.spotlight = new InteractiveSpotlight();

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  ensureSampleBlock() {
    const editor = this.timelineEditor;
    if (!editor || !Array.isArray(editor.sequences)) {
      return null;
    }

    let targetBlock = editor.sequences.find((seq) => {
      return seq && !seq._deleted && seq.type !== 'audio';
    });

    if (!targetBlock) {
      targetBlock = {
        time: 1.0,
        type: 'sequence',
        pattern: 'sweep-left',
        count: 5,
        duration: 0.1,
        uiDuration: 1.5,
        preset: 'crysanthemum'
      };
      editor.sequences.push(targetBlock);
    }

    editor.selectedEvents = [targetBlock];
    if (
      editor.inspector &&
      typeof editor.inspector.show === 'function'
    ) {
      editor.inspector.show(
        targetBlock,
        editor.selectedEvents
      );
    }
    if (typeof editor.renderTracks === 'function') {
      editor.renderTracks();
    }
    if (
      editor.trackContainer &&
      typeof editor.pixelsPerSecond === 'number'
    ) {
      const targetX = (targetBlock.time || 0) * editor.pixelsPerSecond;
      editor.trackContainer.scrollLeft = Math.max(
        0,
        targetX - 100
      );
    }

    return targetBlock;
  }

  start() {
    if (!prepareGuideFlowStart(this.timelineEditor, this)) {
      return;
    }

    const targetBlock = this.ensureSampleBlock();
    this.spotlight.initDOM();
    this.stateMachine.start({
      selectedCount: this.timelineEditor.selectedEvents?.length || 0,
      targetEvent: targetBlock
    });
  }

  getTargetBlockElement() {
    const editor = this.timelineEditor;
    if (!editor) {
      return null;
    }

    const candidates = [
      this.stateMachine.targetEvent,
      editor.selectedEvents?.[0],
      Array.isArray(editor.sequences)
        ? editor.sequences.find((s) => s && !s._deleted && s.type !== 'audio')
        : null
    ];

    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (candidate && editor.blockDomMap instanceof Map) {
        const el = editor.blockDomMap.get(candidate);
        if (el) {
          return el;
        }
      }
    }

    return editor.trackContainer || editor.tracksArea;
  }

  getTargetResizeHandleElement() {
    const blockEl = this.getTargetBlockElement();
    if (blockEl && typeof blockEl.querySelector === 'function') {
      return (
        blockEl.querySelector('[data-role="resize-handle"]') ||
        blockEl
      );
    }
    return blockEl;
  }

  handleStepChange(step) {
    if (step === TIMELINE_CONTROLS_STEPS.COMPLETED) {
      this.finish();
      showToast(
        t('editor.timelineControlsGuide.completedToast') ||
          'Timeline editing controls guide completed.',
        'success',
        3500
      );
      return;
    }

    if (step === TIMELINE_CONTROLS_STEPS.DISMISSED) {
      this.finish();
      return;
    }

    this.renderCurrentStep();
  }

  getStepConfig(step) {
    const editor = this.timelineEditor;
    const selectedCount = this.stateMachine.selectedCount;

    if (step === TIMELINE_CONTROLS_STEPS.MOVE_BLOCK) {
      return {
        title:
          t('editor.timelineControlsGuide.moveTitle') ||
          'Left-Click and Drag Block',
        desc:
          t('editor.timelineControlsGuide.moveDesc') ||
          'Left-click the highlighted block body and drag it left or right to retime it. Dragging across empty Tracks Area draws a marquee box, and double-clicking empty space adds a new block.',
        progressText:
          t('editor.timelineControlsGuide.moveHint') ||
          'Drag the block to a new time position and release to continue',
        getTarget: () => this.getTargetBlockElement()
      };
    }

    if (step === TIMELINE_CONTROLS_STEPS.RESIZE_BLOCK) {
      return {
        title:
          t('editor.timelineControlsGuide.resizeTitle') ||
          'Drag Right Edge to Resize Duration',
        desc:
          t('editor.timelineControlsGuide.resizeDesc') ||
          'Move your cursor over the bright strip on the right edge of the block until the resize cursor appears, then hold left-click and drag horizontally to adjust duration.',
        progressText:
          t('editor.timelineControlsGuide.resizeHint') ||
          'Drag the right-edge handle to change the block length',
        getTarget: () => this.getTargetResizeHandleElement()
      };
    }

    if (step === TIMELINE_CONTROLS_STEPS.SELECT_ANCHOR) {
      return {
        title:
          t('editor.timelineControlsGuide.anchorTitle') ||
          'Pick Anchor Head on the Ruler',
        desc:
          t('editor.timelineControlsGuide.anchorDesc') ||
          'Anchor Head is the cyan vertical line marking where new or pasted blocks land, while Playhead marks playback time. Left-click anywhere along the top Ruler to move Anchor Head.',
        progressText:
          t('editor.timelineControlsGuide.anchorHint') ||
          'Left-click any timestamp on the Ruler to place Anchor Head',
        getTarget: () => editor?.ruler || editor?.trackContainer
      };
    }

    if (step === TIMELINE_CONTROLS_STEPS.COPY_BLOCK) {
      return {
        title:
          t('editor.timelineControlsGuide.copyTitle') ||
          'Copy Selected Block',
        desc:
          t('editor.timelineControlsGuide.copyDesc') ||
          'Press Ctrl+C to copy the selected block while keeping its relative timing.',
        progressText:
          selectedCount > 0
            ? (
              t('editor.timelineControlsGuide.copyReadyHint') ||
              'Block is selected. Press Ctrl+C to copy'
            )
            : (
              t('editor.timelineControlsGuide.copyNeedSelectHint') ||
              'Left-click a block to select it first, then press Ctrl+C'
            ),
        getTarget: () => this.getTargetBlockElement()
      };
    }

    if (step === TIMELINE_CONTROLS_STEPS.PASTE_BLOCK) {
      return {
        title:
          t('editor.timelineControlsGuide.pasteTitle') ||
          'Paste at Anchor Head',
        desc:
          t('editor.timelineControlsGuide.pasteDesc') ||
          'Press Ctrl+V to paste the copied block cleanly at the cyan Anchor Head timestamp.',
        progressText:
          t('editor.timelineControlsGuide.pasteHint') ||
          'Press Ctrl+V to paste at Anchor Head',
        getTarget: () => editor?.anchorHead || editor?.trackContainer
      };
    }

    if (step === TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_BLOCK) {
      return {
        title:
          t('editor.timelineControlsGuide.rightClickBlockTitle') ||
          'Right-Click a Selected Block',
        desc:
          t('editor.timelineControlsGuide.rightClickBlockDesc') ||
          'Right-clicking a selected block opens the Block Context Menu for Group, Ungroup, or Export without moving Anchor Head.',
        progressText:
          selectedCount > 0
            ? (
              t('editor.timelineControlsGuide.rightClickBlockReadyHint') ||
              'Right-click directly on the highlighted block'
            )
            : (
              t('editor.timelineControlsGuide.rightClickBlockSelectHint') ||
              'Left-click a block first so it is selected, then right-click it'
            ),
        getTarget: () => this.getTargetBlockElement()
      };
    }

    if (step === TIMELINE_CONTROLS_STEPS.RIGHT_CLICK_EMPTY) {
      return {
        title:
          t('editor.timelineControlsGuide.rightClickEmptyTitle') ||
          'Right-Click Empty Tracks Area',
        desc:
          t('editor.timelineControlsGuide.rightClickEmptyDesc') ||
          'Right-clicking an empty spot jumps both Anchor Head and Playhead to your cursor and opens the Empty Space Context Menu for Paste or Add Sequence.',
        progressText:
          t('editor.timelineControlsGuide.rightClickEmptyHint') ||
          'Right-click any empty area in Tracks Area outside blocks',
        getTarget: () => editor?.trackContainer || editor?.tracksArea
      };
    }

    return null;
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
      t('editor.timelineControlsGuide.stepIndicator') ||
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
      actions: buildStepNavigationActions({
        stepIndex: this.stateMachine.getStepIndex(),
        totalSteps: this.stateMachine.getTotalSteps(),
        onPrev: () => {
          this.stateMachine.previousStep();
        },
        onNext: () => {
          this.stateMachine.nextStep();
        }
      }),
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

