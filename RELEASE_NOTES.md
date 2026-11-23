# Release Notes - v3.5.5

## Downloads
- Windows Installer (.exe): [FDShowStudio-Setup-3.5.5.exe](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/v3.5.5/FDShowStudio-Setup-3.5.5.exe)
- Portable Archive (.zip): [FDShowStudio-3.5.5-win.zip](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/v3.5.5/FDShowStudio-3.5.5-win.zip)
- All Release Assets: [GitHub Releases v3.5.5](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/tag/v3.5.5)

## Bug Fixes
- Bundled Preset Media: Added complete visual preview videos and 16:9 banner images for all 11 built-in firework presets, resolving dark fallback boxes in the preset library.
- Library Deduplication: Filtered out duplicate preset cards caused by hyphenated aliases in metadata, presenting a clean catalog of unique presets.
- Windows GPU Cache Lock: Disabled disk-based GPU shader caching and isolated development user data, eliminating startup access-denied cache errors on Windows.
- Hover Video Responsiveness: Improved video preview fade-in and smooth playback when hovering over cards in the library.

## Updates
- Enhanced preview streaming middleware with proper MIME type support for JPEG, PNG, and WebP images.
- Added automated preset preview generation tooling for future shell additions.

## Chores
- Updated release automation workflow with branch-to-tag cross-validation checks.
