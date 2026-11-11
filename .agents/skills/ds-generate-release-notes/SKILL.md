---
name: ds-generate-release-notes
description: Full end-to-end release workflow that verifies tests, bumps semantic version, builds and packages the Electron application (including auto-update metadata), generates release notes and Facebook announcement post, creates a git tag, and pushes/publishes the release. Use when the user asks to generate release notes or create a new release.
---

# Generate Release Notes, Build, Tag & Publish Release

When the user asks you to generate release notes or create a new release, execute the full release pipeline below instead of only updating Markdown files. Follow these STRICT rules:

**CRITICAL RULES:**
1. **NO ICONS OR EMOJIS**: Do not use any emojis (like rocket, bug, fire, etc.) anywhere in the output, release notes, commit messages, or Facebook post. Keep everything strictly text-only and professional.
2. **ENGLISH ONLY FOR RELEASE_NOTES.md**: The generated `RELEASE_NOTES.md` MUST be written entirely in English, regardless of the language used in the commit messages or the user's prompt.
3. **BILINGUAL FACEBOOK POST (VIETNAMESE WITH ACCENTS + ENGLISH)**: The post in `docs/details/facebook-detail-release-update.md` must be written in proper accented Vietnamese (Tiếng Việt có dấu đầy đủ) followed by a matching English version, suitable for social media groups, fanpages, and international audiences.
4. **NO LINKS IN FACEBOOK POST (AVOID REACH PENALTY)**: Absolutely DO NOT include any URLs or links in the Facebook announcement text (including links causes Facebook's algorithm to penalize reach). Always guide users to grab the download links in the comment section below the post.
5. **SHORT & PUNCHY BULLET POINTS**: Keep each bullet point in the Facebook post very concise (1 short punchy sentence or phrase per bullet), avoiding long paragraphs or walls of text for maximum readability.
6. **MANDATORY HASHTAGS IN FACEBOOK POST**: Always append the official hashtags `#FDShowStudio #firework` at the end of the Facebook post.
7. **MANDATORY SECTIONS IN RELEASE_NOTES.md**: You must use exactly the main sections defined below (Downloads, Features, Bug Fixes, Updates, Chores). If a section has no relevant commits, you may omit that section.
8. **NON-TECHNICAL DESCRIPTIONS**: All descriptions must be extremely concise, simple, and easy to understand for non-technical users. Avoid coding jargon (such as 'instanced rendering', 'draw calls', 'vertex shader', 'buffer allocation') and instead focus on user-facing benefits (e.g., write 'Improved display performance when spawning many fireworks' instead of 'implemented instanced shell rendering to reduce draw calls').
9. **NEVER RELEASE BROKEN BUILDS**: Every release MUST pass the full test suite (`npm test`) and production build (`npm run build` / `npm run electron:build`) BEFORE committing, tagging, or publishing.

## 1. Pre-flight Checks & Fetch Commits Since Last Tag
- Check working tree status (`git status -s`) so unintended temporary files are not accidentally tagged.
- Sync `@shell-drone/firework-engine` in `package-lock.json` by running `npm update @shell-drone/firework-engine` so GitHub Actions CI (`npm ci`) uses the exact same engine commit as local development.
- Find the most recent git tag: `git describe --tags --abbrev=0`.
- If no tags exist, get all commits from the beginning: `git log --oneline`.
- Otherwise, get all commits from the last tag to HEAD: `git log <last_tag>..HEAD --oneline`.
- Run `npm test` early to confirm the codebase is healthy before preparing the release. If tests fail, stop and report the failure instead of creating a broken release.

## 2. Determine New Version
- Analyze the fetched commits (and any staged/ready changes) to determine the next version based on Semantic Versioning (SemVer):
  - **Major**: If there are breaking changes.
  - **Minor**: If there are new features (`feat`).
  - **Patch**: If there are only bug fixes (`fix`) and chores/updates.
- Determine the new tag name (e.g., if the previous was `v3.3.1` and there is a new feature, the new tag becomes `v3.4.0`).

## 3. Analyze and Categorize
Categorize the fetched commits into the following standard groups:
- **Features** (`feat`, `add`, new functionalities)
- **Bug Fixes** (`fix`, `bug`, resolved issues)
- **Updates** (`refactor`, `perf`, `update`, optimizations)
- **Chores** (`docs`, `chore`, `test`, maintenance)

## 4. Update Version in package.json and package-lock.json
- Bump the version cleanly without creating a tag yet:
  `npm version <new_version_without_v> --no-git-tag-version`
  (For example, `npm version 3.4.0 --no-git-tag-version`). This keeps both `package.json` and `package-lock.json` synchronized so `npm ci` in CI/CD works cleanly.

## 5. Run Full Test Suite & Electron Production Build
Run all verification and build steps in order:
1. Run full unit tests:
   `npm test`
2. Run Vite production bundle & Electron Windows packaging:
   `npm run electron:build`
   (Which executes `npm run build && electron-builder` to output artifacts into `dist-electron/`).
3. Inspect `dist-electron/` and `dist-electron/latest.yml` to verify that ALL required auto-update and installer artifacts were generated without errors:
   - Windows NSIS installer `.exe` (required for `electron-updater` auto-updates)
   - Differential blockmap `.exe.blockmap`
   - Update metadata `latest.yml` (critical for auto-update version discovery)
   - Portable `.zip` archive (if configured in `package.json`)
4. If `npm run electron:build` fails (e.g. missing network cache on first run or missing build tool), diagnose and resolve or report the exact blocker before tagging/releasing.

## 6. Determine Download Links (for RELEASE_NOTES.md only)
Determine the exact download URLs for `.exe` (Windows Installer) and `.zip` (Portable Archive):
1. **User-Provided Link**: If the user provided a download URL or draft release hash in their message, use that exact base path and file names.
2. **Inspect `dist-electron` & `dist-electron/latest.yml`**: Read `dist-electron/latest.yml` and list `dist-electron/` to verify the exact artifact filenames produced by `electron-builder`. Note that when `electron-builder` or GitHub Releases uploads filenames containing spaces, spaces are converted to dashes or dots depending on upload method (`electron-builder --publish always` preserves its generated upload naming, typically replacing spaces with dashes `-`, while manual browser upload replaces spaces with dots `.`). Match the exact asset names used by the release workflow.
3. **Standard Canonical Release URL Structure**:
   - Base URL: `https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/[New Version Tag]/`
   - Windows Installer (.exe): `[fdshowstudio-setup-<version>.exe](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/[New Version Tag]/<exact-exe-filename>)`
   - Portable Archive (.zip): `[fdshowstudio-<version>-win.zip](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/[New Version Tag]/<exact-zip-filename>)`
   - All Release Assets: `[GitHub Releases [New Version Tag]](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/tag/[New Version Tag])`

## 7. Format the Canonical Release Notes (RELEASE_NOTES.md)
Structure the output using Markdown IN ENGLISH. Use exactly this structure:

```markdown
# Release Notes - [New Version Tag]

## Downloads
- Windows Installer (.exe): [<exact-exe-filename>](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/[New Version Tag]/<exact-exe-filename>)
- Portable Archive (.zip): [<exact-zip-filename>](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/[New Version Tag]/<exact-zip-filename>)
- All Release Assets: [GitHub Releases [New Version Tag]](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/tag/[New Version Tag])

## Features
- [Short description of the new feature in English]
- ...

## Bug Fixes
- [Short description of the fix in English]
- ...

## Updates
- [Short description of the update in English]
- ...

## Chores
- [Short description of the chore in English]
- ...
```

## 8. Format the Facebook Announcement Post (facebook-detail-release-update.md)
Generate a bilingual promotional announcement post in `docs/details/facebook-detail-release-update.md`.
It must strictly follow these rules:
1. **Vietnamese version with full accents (Tiếng Việt có dấu đầy đủ)**.
2. **English version**.
3. **NO URLs OR LINKS**: Do NOT include any HTTP/HTTPS links in the post text. Direct readers to the comment section.
4. **Mandatory Hashtags**: End with `#FDShowStudio #firework`.
5. **No Emojis**: Keep it text-only and clean.

Template:

```markdown
# Cập nhật phiên bản mới: FDShowStudio [New Version Tag]

Chào cả nhà, bản cập nhật [New Version Tag] của FDShowStudio đã chính thức ra mắt với nhiều tính năng mới hấp dẫn cùng các cải tiến tối ưu giúp trải nghiệm tạo show mượt mà và trực quan hơn!

Các điểm mới nổi bật:
- [Tính năng 1: Mô tả ngắn gọn, lợi ích nổi bật]
- [Tính năng 2: Mô tả ngắn gọn, lợi ích nổi bật]
- [Sửa lỗi & Tối ưu: Khắc phục các lỗi đã biết, tối ưu hiển thị và độ ổn định]

Toàn bộ link tải bản cài đặt (.exe) và bản chạy ngay (.zip) mình để chi tiết ngay dưới phần bình luận nhé!

Mọi người tải về trải nghiệm và để lại góp ý nhé!

#FDShowStudio #firework

---

# New Release Announcement: FDShowStudio [New Version Tag]

Hello creators! The latest update [New Version Tag] of FDShowStudio is officially available, bringing exciting new capabilities and optimizations for designing spectacular light shows!

Key Highlights:
- [Feature 1: Clear benefit and user value]
- [Feature 2: Clear benefit and user value]
- [Fixes & Performance: Smoother performance and bug fixes]

All download links (Installer .exe and Portable .zip) are available in the first comment below!

Download now and bring your creative firework and drone choreographies to life!

#FDShowStudio #firework
```

## 9. Save the Release Notes Files
Use the file writing tool to save both release files:
- Completely OVERWRITE `RELEASE_NOTES.md` with the English technical release notes.
- Completely OVERWRITE `docs/details/facebook-detail-release-update.md` with the bilingual Facebook announcement post without links.

## 10. Stage, Commit, Tag, Push, and Publish Release Assets
After tests pass, the local Electron build is verified, and release files are saved:
1. Stage release files:
   `git add package.json package-lock.json RELEASE_NOTES.md docs/details/facebook-detail-release-update.md`
2. Commit:
   `git commit -m "docs: release <new_version>"`
3. Create git tag:
   `git tag <new_version>`
4. Push commit and tag to remote:
   `git push origin HEAD`
   `git push origin <new_version>`
5. Publish release assets to GitHub Releases so `electron-updater` can detect and auto-update existing installations:
   - **Primary (CI/CD via `.github/workflows/release.yml`)**: Pushing tag `v*` automatically triggers the GitHub Actions workflow `Build and Release Windows App` to run `npm ci`, `npm test`, `npm run electron:publish` (`electron-builder --publish always`), and `gh release edit` to populate the GitHub Release title and body directly from `RELEASE_NOTES.md`.
   - **Local fallback (when `GH_TOKEN` is set in environment and user prefers local publishing)**: Run `npm run electron:publish` (or verify release assets via `gh release view <new_version>` if `gh` CLI is available).
   - **Final Verification**: Confirm to the user that tests passed, `dist-electron/` artifacts (`latest.yml`, `.blockmap`, `.exe`) were verified, tag `<new_version>` was pushed, and either GitHub Actions workflow was triggered or local publish completed. Remind the user never to delete `latest.yml` or `.blockmap` from GitHub Release assets, as `electron-updater` depends on them for auto-updates.
