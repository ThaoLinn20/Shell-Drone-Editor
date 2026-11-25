const BOOLEAN_EFFECT_KEYS = [
  'pistil',
  'instantBurst',
  'burstSmoke',
  'burst-smoke',
  'apexHang',
  'apex-hang',
  'slowBurst',
  'slow-burst',
  'longBurn',
  'long-burn',
  'noTrail',
  'no-trail',
  'noBurst',
  'no-burst',
  'crackle',
  'strobe',
  'white-strobe',
  'glitter-strobe',
  'ghost',
  'ghostFlare',
  'ghost-flare',
  'flow',
  'crossette',
  'sparkle-apex',
  'tadpoleFlurry',
  'tadpole-flurry',
  'erraticDart',
  'erratic-dart',
  'syncStrobe',
  'sync-strobe',
  'sync_strobe',
  'darkPhase',
  'dark-phase',
  'dark_phase',
  'cascadeWave',
  'cascade-wave',
  'cascade_wave',
  'terminalFlare',
  'terminal-flare',
  'terminal_flare',
  'smokeTrail',
  'smoke-trail',
  'smoke_trail',
  'secondBurstEnabled',
  'launchTrail',
  'thickTrail',
  'thinTrail',
  'detachedTrail',
  'flightSmoke',
  'ascentBursts'
];

const OPTIONAL_SCALAR_KEYS = [
  'secondColor',
  'pistilColor',
  'starSizeMultiplier',
  'ringCount',
  'cascadeRings',
  'cascade-rings',
  'cascade_rings',
  'cascadeDuration',
  'cascadeMode',
  'cascadeAngle',
  'terminalFlareTriggerRatio',
  'terminalFlareDuration',
  'terminalFlareIntensity',
  'terminalFlareSizeMultiplier',
  'terminalFlareColor',
  'tadpoleColor',
  'tadpoleFlurryColor',
  'smokeTrailStartTime',
  'smokeTrailDuration',
  'textWord',
  'textScale',
  'letterSpacing',
  'tiltAngle',
  'nestingMode',
  'cometTrail',
  'ascentSubShellType',
  'ascentBurstCount'
];

const RESETTABLE_KEYS = [
  ...BOOLEAN_EFFECT_KEYS,
  ...OPTIONAL_SCALAR_KEYS,
  'scale',
  'shellSize',
  'particleCountMultiplier',
  'starLifeMultiplier',
  'multiNested',
  'stages',
  'secondBurst',
  'effects',
  'sound',
  'launchSound',
  'burstSound',
  'crackleSound',
  'soundVolume'
];

export function deepCloneJson(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(deepCloneJson);
  }
  const cloned = {};
  for (const key of Object.keys(value)) {
    if (key.startsWith('_')) continue;
    cloned[key] = deepCloneJson(value[key]);
  }
  return cloned;
}

function extractSoundConfig(event) {
  if (event?.sound && typeof event.sound === 'object') {
    return {
      volumeMultiplier: event.sound.volumeMultiplier !== undefined
        ? Number(event.sound.volumeMultiplier)
        : 1.0,
      launch: event.sound.launch || '',
      burst: event.sound.burst || '',
      crackle: event.sound.crackle || '',
      ...(event.sound.pitchMultiplier !== undefined
        ? { pitchMultiplier: Number(event.sound.pitchMultiplier) }
        : {})
    };
  }
  return {
    volumeMultiplier: event?.soundVolume !== undefined
      ? Number(event.soundVolume)
      : 1.0,
    launch: event?.launchSound || '',
    burst: event?.burstSound || '',
    crackle: event?.crackleSound || ''
  };
}

export function createDefaultPresetComposition() {
  return {
    shapeType: 'sphere',
    dynamicsType: 'standard',
    color: '#ffaa00',
    shellSize: 1.0,
    particleCountMultiplier: 1.0,
    starLifeMultiplier: 1.0,
    effects: [],
    multiNested: false,
    stages: [],
    secondBurst: null,
    sound: {
      volumeMultiplier: 1.0,
      launch: 'standard',
      burst: 'standard',
      crackle: 'standard'
    }
  };
}

export function extractPresetComposition(event) {
  if (!event || typeof event !== 'object') {
    return createDefaultPresetComposition();
  }

  const resolvedShellSize = event.shellSize !== undefined && event.shellSize !== null
    ? Number(event.shellSize)
    : (event.scale !== undefined && event.scale !== null ? Number(event.scale) : 1.0);

  const composition = {
    ...(event.type === 'sequence' || event.type === 'cometsequence'
      ? { eventType: event.type }
      : {}),
    shapeType: event.shapeType || event.shape || 'sphere',
    dynamicsType: event.dynamicsType || event.dynamics || 'standard',
    color: event.color || '#ffaa00',
    shellSize: Number.isFinite(resolvedShellSize) ? resolvedShellSize : 1.0,
    particleCountMultiplier: event.particleCountMultiplier !== undefined
      ? Number(event.particleCountMultiplier)
      : 1.0,
    starLifeMultiplier: event.starLifeMultiplier !== undefined
      ? Number(event.starLifeMultiplier)
      : 1.0,
    effects: Array.isArray(event.effects) ? deepCloneJson(event.effects) : [],
    multiNested: Boolean(event.multiNested),
    stages: Array.isArray(event.stages) ? deepCloneJson(event.stages) : [],
    secondBurst: event.secondBurst ? deepCloneJson(event.secondBurst) : null,
    sound: extractSoundConfig(event)
  };

  for (const key of BOOLEAN_EFFECT_KEYS) {
    if (event[key] !== undefined) {
      composition[key] = Boolean(event[key]);
    }
  }

  for (const key of OPTIONAL_SCALAR_KEYS) {
    if (event[key] !== undefined && event[key] !== null) {
      composition[key] = deepCloneJson(event[key]);
    }
  }

  return composition;
}

export function applyPresetComposition(event, preset) {
  if (!event || typeof event !== 'object' || !preset) return;
  if (event.type !== 'sequence' && event.type !== 'cometsequence') return;

  event.preset = preset.id || preset.slug;
  if (!preset.composition || typeof preset.composition !== 'object') return;

  const comp = preset.composition;

  for (const key of RESETTABLE_KEYS) {
    delete event[key];
  }

  if (comp.eventType === 'sequence' || comp.eventType === 'cometsequence') {
    event.type = comp.eventType;
  }

  if (comp.shapeType || comp.shape) {
    event.shapeType = comp.shapeType || comp.shape;
  }
  if (comp.dynamicsType || comp.dynamics) {
    event.dynamicsType = comp.dynamicsType || comp.dynamics;
  }
  if (comp.color) {
    event.color = comp.color;
  }

  const rawEffects = comp.effects || comp.activeEffects;
  if (Array.isArray(rawEffects)) {
    event.effects = deepCloneJson(rawEffects);
  }

  const resolvedShellSize = comp.shellSize !== undefined && comp.shellSize !== null
    ? Number(comp.shellSize)
    : (comp.scale !== undefined && comp.scale !== null ? Number(comp.scale) : undefined);
  if (resolvedShellSize !== undefined && Number.isFinite(resolvedShellSize)) {
    event.shellSize = resolvedShellSize;
  }

  if (typeof comp.particleCountMultiplier === 'number') {
    event.particleCountMultiplier = comp.particleCountMultiplier;
  }
  if (typeof comp.starLifeMultiplier === 'number') {
    event.starLifeMultiplier = comp.starLifeMultiplier;
  }
  if (typeof comp.multiNested === 'boolean') {
    event.multiNested = comp.multiNested;
  }
  if (Array.isArray(comp.stages)) {
    event.stages = deepCloneJson(comp.stages);
  }
  if (comp.secondBurst) {
    event.secondBurst = deepCloneJson(comp.secondBurst);
  }

  for (const key of BOOLEAN_EFFECT_KEYS) {
    if (comp[key] !== undefined) {
      event[key] = Boolean(comp[key]);
    }
  }

  for (const key of OPTIONAL_SCALAR_KEYS) {
    if (comp[key] !== undefined && comp[key] !== null) {
      event[key] = deepCloneJson(comp[key]);
    }
  }

  if (comp.sound && typeof comp.sound === 'object') {
    event.sound = deepCloneJson(comp.sound);
    if (comp.sound.launch !== undefined) {
      event.launchSound = comp.sound.launch;
    }
    if (comp.sound.burst !== undefined) {
      event.burstSound = comp.sound.burst;
    }
    if (comp.sound.crackle !== undefined) {
      event.crackleSound = comp.sound.crackle;
    }
    if (comp.sound.volumeMultiplier !== undefined) {
      event.soundVolume = comp.sound.volumeMultiplier;
    }
  }
}
