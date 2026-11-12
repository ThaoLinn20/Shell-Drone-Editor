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

