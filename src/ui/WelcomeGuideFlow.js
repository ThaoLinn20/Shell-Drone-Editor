import { t } from '../config/lang/i18n.js';
import { globalEventBus } from '../core/EventBus.js';
import { InteractiveSpotlight } from './InteractiveSpotlight.js';
import {
  WelcomeGuideStateMachine,
  WELCOME_GUIDE_STEPS
} from './WelcomeGuideStateMachine.js';

export class WelcomeGuideFlow {
  constructor(
    timelineEditor,
    eventBus = globalEventBus
  ) {
    this.timelineEditor = timelineEditor;
    this.eventBus = eventBus;
    this.stateMachine = new WelcomeGuideStateMachine(eventBus);
    this.spotlight = new InteractiveSpotlight();

    this.stateMachine.onChange = (step) => {
      this.handleStepChange(step);
    };
  }

  startIfFirstTime() {
    const started = this.stateMachine.startIfNeeded();
    if (!started) {
      return false;
    }
    this.spotlight.initDOM();
    this.renderCurrentStep();
    return true;
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

    this.spotlight.initDOM();
    this.stateMachine.start();
  }

  handleStepChange(step) {
    if (
      step === WELCOME_GUIDE_STEPS.COMPLETED ||
      step === WELCOME_GUIDE_STEPS.DISMISSED
    ) {
      this.finish();
      return;
    }

    this.renderCurrentStep();
  }

  getStepConfig(step) {
    const editor = this.timelineEditor;

    if (step === WELCOME_GUIDE_STEPS.OPEN_GUIDE_HUB) {
      return {
        title:
          t('editor.welcomeGuide.step1Title') ||
          'Open the Guide Hub',
        desc:
          t('editor.welcomeGuide.step1Desc') ||
          'Welcome to FDShowStudio. Click the Guide button on the toolbar to explore step-by-step interactive tutorials.',
        progressText: '',
        getTarget: () => editor?.helpBtn || editor?.toolbar
      };
    }

    if (step === WELCOME_GUIDE_STEPS.PICK_GUIDE) {
      return {
        title:
          t('editor.welcomeGuide.step2Title') ||
          'Pick a Guide and Follow Steps',
        desc:
          t('editor.welcomeGuide.step2Desc') ||
          'Choose any walkthrough that matches your goal and click Start Guide to learn hands-on inside the editor.',
        progressText:
          t('editor.welcomeGuide.step2Hint') ||
          'Tip: Use search or tag filters above to find a tutorial',
        getTarget: () =>
          editor?.guideHubModal?.listContainer ||
          editor?.guideHubModal?.dialog ||
          editor?.helpBtn
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
      t('editor.welcomeGuide.stepIndicator') ||
      'Overview {current} of {total}';
    const badge = badgeTpl
      .replace('{current}', String(stepNum))
      .replace('{total}', String(total));

    this.spotlight.render({
      badge,
      title: config.title,
      desc: config.desc,
      progressText: config.progressText,
      skipLabel: t('editor.onboarding.skipBtn') || 'Skip',
      actions: [],
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

