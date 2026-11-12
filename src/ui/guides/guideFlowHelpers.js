import { t } from '../../config/lang/i18n.js';

const GUIDE_FLOW_KEYS = [
  'onboardingFlow',
  'reuseBlocksGuide',
  'createScriptGuide',
  'welcomeGuide',
  'audioBeatsGuide',
  'timelineControlsGuide'
];

export function dismissOtherActiveGuides(
  timelineEditor,
  currentFlow = null
) {
  if (!timelineEditor) {
    return;
  }

  GUIDE_FLOW_KEYS.forEach((key) => {
    const flow = timelineEditor[key];
    if (
      flow &&
      flow !== currentFlow &&
      flow.stateMachine &&
      flow.stateMachine.isActive &&
      typeof flow.stateMachine.dismiss === 'function'
    ) {
      flow.stateMachine.dismiss();
    }
  });

  if (
    timelineEditor.inspectorGuides &&
    typeof timelineEditor.inspectorGuides === 'object'
  ) {
    Object.values(timelineEditor.inspectorGuides).forEach((flow) => {
      if (
        flow &&
        flow !== currentFlow &&
        flow.stateMachine &&
        flow.stateMachine.isActive &&
        typeof flow.stateMachine.dismiss === 'function'
      ) {
        flow.stateMachine.dismiss();
      }
    });
  }
}

export function prepareGuideFlowStart(
  timelineEditor,
  currentFlow = null
) {
  if (!timelineEditor) {
    return false;
  }

  if (
    !timelineEditor.visible &&
    typeof timelineEditor.toggle === 'function'
  ) {
    timelineEditor.toggle();
  }

  dismissOtherActiveGuides(
    timelineEditor,
    currentFlow
  );
  return true;
}

export function buildStepNavigationActions({
  stepIndex,
  totalSteps,
  onPrev,
  onNext,
  extraActions = []
}) {
  const actions = Array.isArray(extraActions) ? [...extraActions] : [];
  if (stepIndex > 0 && typeof onPrev === 'function') {
    actions.push({
      label: t('editor.timelineTour.prevBtn') || 'Previous',
      primary: false,
      onClick: onPrev
    });
  }
  if (typeof onNext === 'function') {
    actions.push({
      label:
        stepIndex >= totalSteps - 1
          ? (t('editor.timelineTour.finishBtn') || 'Finish')
          : (t('editor.timelineTour.nextBtn') || 'Next'),
      primary: true,
      onClick: onNext
    });
  }
  return actions;
}

