# Release Notes - v3.5.6

## Downloads
- Windows Installer (.exe): [FDShowStudio-Setup-3.5.6.exe](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/v3.5.6/FDShowStudio-Setup-3.5.6.exe)
- Portable Archive (.zip): [FDShowStudio-3.5.6-win.zip](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/v3.5.6/FDShowStudio-3.5.6-win.zip)
- All Release Assets: [GitHub Releases v3.5.6](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/tag/v3.5.6)

## Features
- Sweep Curve Pattern Library: Save custom Sweep Curve trajectories to a dedicated Pattern Library, preview curve thumbnails, rename or remove saved patterns, and reuse them across shows with optional shell count matching.
- Starred Comet Cluster Preset: Promoted the new expanding 3D cone Comet Cluster to the top of the Comet presets list with natural spark trails and support for timed no-trail windows.
- Visual Effects & Second Burst for Comets: Size, Particle Density, Star Life Time, all Launch Trail modes (including ascent bursts), and Second Burst now apply consistently across all comet presets.
- Water-Level Firework Bursts: Lowered the minimum burst height down to water level (0.5m) in both the engine and curve editors, enabling low-altitude and surface-level firework effects while keeping random launches in the sky.
- Full Effect Compatibility on Comets: Enabled all Triggered Effects and timed Active Effects to work seamlessly on Comet Cluster stars.

## Bug Fixes
- Natural Rising Launch Smoke: Reworked mortar launch smoke so plumes rise organically with varied heights, natural dissipation, and neutral smoke tones instead of lingering as a flat horizontal band near the water.
- Comet Star Visibility & Consistency: Fixed missing star heads on comet clusters and unified their brightness, softness, and gravity behavior with standard firework burst stars.

## Updates
- Clarified Triggered Effects (on/off toggles) and Active Effects (timed windows) terminology in project documentation.

## Chores
- Updated and expanded automated tests for pattern library persistence, water-level burst calculations, comet visual effect multipliers, and launch smoke behavior.
