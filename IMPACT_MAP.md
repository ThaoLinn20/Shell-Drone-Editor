# Dependency & Impact Brain (IMPACT_MAP.md)

This document is the architectural dependency and blast-radius map for `shell-drone-animation` (Studio) and its linked core engine `../firework-engine`. Read the relevant pipeline and impact table before modifying any shared file, schema, or cross-module feature.

---

## 1. Cross-Repository Architecture

- **Engine Source of Truth**: `../firework-engine` (`@shell-drone/firework-engine`) owns all firework/comet math, shapes, dynamics, physics, shaders, particle pools, presets, and `LAUNCH_ZONE_CONFIG` / `FIREWORK_CONFIG`.
- **Consumer Re-export Proxies**: Files under `./src/factories/`, `./src/systems/`, `./src/entities/`, `./src/render/`, and `./src/config/fireworks.js` / `./src/config/launchZone.js` in Studio are thin re-export proxies to `@shell-drone/firework-engine`.
- **Propagation Chain**: Any edit in `../firework-engine` requires `npm test` and `npm run build` in `../firework-engine`, followed by `npm test` in Studio (and `npm update @shell-drone/firework-engine` before release so `package-lock.json` stays synchronized for CI).

---

## 2. Core Feature Pipelines & File Coupling

### A. Show Playback & Launch Pipeline (Shell + Comet)
1. **UI Authoring**: [PropertyInspector.js](./src/ui/PropertyInspector.js) edits event properties on timeline blocks.
2. **Timeline & Sequencing**: [FireworkSequencer.js](./src/directors/FireworkSequencer.js) expands patterns into timed launch tasks.
   - **Critical Coupling**: `playPattern` (shells) and `playCometSequence` (comets) are two separate branches inside `FireworkSequencer.js`. Any new effect flag, multiplier, or trail parameter added to one branch MUST be forwarded in the other.
3. **Dispatch & Execution**: [ShowDirector.js](./src/directors/ShowDirector.js) -> [ShowEventDispatcher.js](./src/directors/ShowEventDispatcher.js) -> `FireworkSystem.js` / `CometSystem.js` (in `../firework-engine`).
4. **Star & Particle Routing**:
   - Regular shells -> `FireworkSystem.launchRandom` -> `ShellEntity` -> `BurstParticleFactory.createParticle` -> `FireworkSystem.updateBurstParticles`.
   - `comet_cluster_notrail` (`★ Comet Cluster`) -> `CometSystem.launchRandom` -> `CometSystem.spawnComet` pushes stars directly into `fireworkSystem.burstParticles` (requires `cometSystem.fireworkSystem = fireworkSystem` wired in [src/main.js](./src/main.js)).
   - Other comets -> `CometSystem.spawnComet` -> `CometEntity` -> `CometSystem.update` -> `TrailSystem` / `SmokeSystem` / `fireworkSystem.spawnSecondBurst`.

### B. Custom Preset Save & Apply Pipeline (Round-Trip Contract)
1. **Schema Single Source of Truth**: [presetComposition.js](./src/utils/presetComposition.js) owns `extractPresetComposition(event)` and `applyPresetComposition(event, preset)`.
2. **Automated 480p Capture**: [PresetCaptureService.js](./src/core/PresetCaptureService.js) + [presetCaptureTiming.js](./src/utils/presetCaptureTiming.js) (reusing [fireworkLifespan.js](./src/utils/fireworkLifespan.js)) isolate a single block in [ShowDirector.js](./src/directors/ShowDirector.js), capture 854x480 WebM + JPEG via `onAfterRender()` in [src/main.js](./src/main.js), and pass media to [PresetHubModal.js](./src/ui/modals/PresetHubModal.js) via `preset-hub:auto-capture`.
3. **Save Flow**: [PresetHubModal.js](./src/ui/modals/PresetHubModal.js) -> `extractPresetComposition` -> [PresetRegistry.js](./src/core/PresetRegistry.js) -> Electron IPC (`presets:save`) in [src/electron/main.js](./src/electron/main.js) & [presetStorage.js](./src/electron/presetStorage.js) (supporting `.png`/`.jpg`/`.webp` and `.mp4`/`.webm`).
4. **Apply Flow**: [PresetHubModal.js](./src/ui/modals/PresetHubModal.js) -> [TimelineEditor.js](./src/ui/TimelineEditor.js) (`applyPresetFromHub`) -> `applyPresetComposition(ev, preset)` -> [PropertyInspector.js](./src/ui/PropertyInspector.js).
5. **Blast Radius**: Adding any new firework/comet parameter to `PropertyInspector` or `FireworkSequencer` requires registering it in `presetComposition.js` so saving/applying custom presets never drops it.

### C. Sweep Curve & Pattern Library Pipeline
1. **Curve Editors**: [WaveCurveEditor.js](./src/ui/WaveCurveEditor.js) and [WaveCurveModal.js](./src/ui/WaveCurveModal.js) share curve math from [SplineMath.js](./src/utils/SplineMath.js) and save/load helpers from [waveCurveLibraryHelper.js](./src/ui/waveCurveLibraryHelper.js).
2. **Persistence**: [PatternRegistry.js](./src/core/PatternRegistry.js) -> Electron IPC (`patterns:scan/save/delete/get-path`) in [src/electron/main.js](./src/electron/main.js), [preload.cjs](./src/electron/preload.cjs), and [patternStorage.js](./src/electron/patternStorage.js) (with browser `localStorage` fallback).
3. **Library UI**: [PatternLibraryModal.js](./src/ui/modals/PatternLibraryModal.js) applies saved patterns back to `WaveCurveEditor` / `WaveCurveModal`.
4. **Playback Consumption**: `FireworkSequencer.js` evaluates `wavePoints` along the curve during show playback.

### D. Burst Height, Ballistics & Timeline Lifespan
1. **Height Bounds**: `../firework-engine/src/config/launchZone.js` defines `minBurstY` (`0.5m` water level), `randomMinBurstY` (`75m` aerial floor for random launches), and `maxBurstY` (`300m`).
2. **Consumers**:
   - `FireworkSystem.js` & `CometSystem.js` (`resolveBurstHeight`, `resolveLaunchVelocity`).
   - [fireworkLifespan.js](./src/utils/fireworkLifespan.js) (computes timeline 3-phase `liftTime`, `burstDuration`, `fadeoutDuration` from `LAUNCH_ZONE_CONFIG`).
   - [WaveCurveEditor.js](./src/ui/WaveCurveEditor.js) & [WaveCurveModal.js](./src/ui/WaveCurveModal.js) (Y clamping `[0.0, 1.0]` and meter altitude labels).
   - [SceneManager.js](./src/core/SceneManager.js) (3D `minBurstY` / `maxBurstY` guide arcs).
   - [AudioSystem.js](./src/systems/AudioSystem.js) (altitude pitch scaling).

### E. Triggered Effects, Active Effects & Parameter Contracts
- **Terminology**: See [GLOSSARY.md](./GLOSSARY.md). Triggered Effects are `true`/`false` toggle modifiers (`TOGGLE_MODIFIER_TAGS`); Active Effects are time-windowed effects (`TIMED_EFFECT_TAGS`, `effectWindows`).
- **Parameter Limits**: `../firework-engine/src/config/parameterDescriptors.js` (`normalizePresetParameters`) defines `hardMin` / `hardMax`. UI sliders in `PropertyInspector.js` define soft UX ranges only; engine subsystems must never add scattered silent clamps.
- **Timing Windows**: [ActiveEffectsTimeline.js](./src/ui/ActiveEffectsTimeline.js) edits `{ type, startRatio, endRatio, start, end }` -> `FireworkSequencer.js` -> `BurstParticleFactory.createParticle` -> `BurstEffectProcessor.js`.

### F. Smoke, Trails & Rendering Parity
- **Smoke**: `../firework-engine/src/config/fireworks.js` (`SMOKE`) -> `SmokeSystem.js` (CPU puffs and GPU vertex shader must stay mathematically aligned). Launch smoke uses dedicated `launch*` keys separate from `trail*` and `burst*`.
- **Trails**: `TrailSystem.js` maintains dual CPU/GPU closed-form damped kinematic parity.
- **Star Heads**: `../firework-engine/src/render/StarHeadMaterial.js` is shared between `FireworkSystem.js` (`globalBurstPoints`) and `CometEntity.js`.

### G. Electron IPC & Persistence Bridge
- Adding any new `electronAPI.<method>` requires updating ALL THREE:
  1. Handler in [src/electron/main.js](./src/electron/main.js)
  2. Bridge exposure in [src/electron/preload.cjs](./src/electron/preload.cjs)
  3. Storage module (e.g. [presetStorage.js](./src/electron/presetStorage.js), [patternStorage.js](./src/electron/patternStorage.js)) and renderer registry/adapter with web fallback.

### H. Localization (i18n)
- All 4 language files MUST stay synchronized on every UI key or preset label change:
  - [en.js](./src/config/lang/en.js) (canonical)
  - [vi.js](./src/config/lang/vi.js)
  - [zh.js](./src/config/lang/zh.js)
  - [ja.js](./src/config/lang/ja.js)

---

## 3. Change Impact Matrix (Before Editing X, Always Check Y)

| If you modify... | You MUST also check / update... |
|---|---|
| `../firework-engine/src/config/launchZone.js` | `FireworkSystem.js`, `CometSystem.js`, `fireworkLifespan.js`, `WaveCurveModal.js`, `SceneManager.js`, `AudioSystem.js` |
| `../firework-engine/src/config/fireworks.js` | `SmokeSystem.js`, `TrailSystem.js`, `FireworkSystem.js`, `CometSystem.js`, `ShellPresetFactory.js` |
| `../firework-engine/src/factories/ShellPresetFactory.js` / `FireworkCompositionHelper.js` | `src/config/lang/{en,vi,zh,ja}.js`, `PropertyInspector.js`, `FireworkSequencer.js`, `presetComposition.js` |
| `../firework-engine/src/systems/CometSystem.js` / `CometEntity.js` | `src/main.js` (`cometSystem.fireworkSystem` wiring), `FireworkSequencer.js` (comet branch), `FireworkSystem.js` |
| [src/ui/PropertyInspector.js](./src/ui/PropertyInspector.js) (new event field/effect) | [FireworkSequencer.js](./src/directors/FireworkSequencer.js) (both shell and comet branches), [presetComposition.js](./src/utils/presetComposition.js), `src/config/lang/{en,vi,zh,ja}.js` |
| [src/utils/presetComposition.js](./src/utils/presetComposition.js) | [PresetHubModal.js](./src/ui/modals/PresetHubModal.js), [TimelineEditor.js](./src/ui/TimelineEditor.js), [presetComposition.test.js](./tests/utils/presetComposition.test.js) |
| [src/ui/WaveCurveEditor.js](./src/ui/WaveCurveEditor.js) / [WaveCurveModal.js](./src/ui/WaveCurveModal.js) | [SplineMath.js](./src/utils/SplineMath.js), [waveCurveLibraryHelper.js](./src/ui/waveCurveLibraryHelper.js), [PatternLibraryModal.js](./src/ui/modals/PatternLibraryModal.js), [fireworkLifespan.js](./src/utils/fireworkLifespan.js) |
| [src/electron/main.js](./src/electron/main.js) (IPC handlers) | [src/electron/preload.cjs](./src/electron/preload.cjs), renderer registries (`PresetRegistry.js`, `PatternRegistry.js`, `FileStorageAdapter.js`) |
