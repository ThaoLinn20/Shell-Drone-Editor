---
name: ds-generate-release-notes
description: Full end-to-end release workflow that verifies tests, bumps semantic version, builds and packages the Electron application (including auto-update metadata), generates release notes and Facebook announcement post, creates a git tag, and pushes/publishes the release. Use when the user asks to generate release notes or create a new release.
---

# Generate Release Notes, Build, Tag & Publish Release

When the user asks you to generate release notes or create a new release, execute the full release pipeline below instead of only updating Markdown files. Follow these STRICT rules:

**CRITICAL RULES:**
1. **NO ICONS OR EMOJIS**: Do not use any emojis (like rocket, bug, fire, etc.) anywhere in the output, release notes, commit messages, or Facebook post. Keep everything strictly text-only and professional.
2. **ENGLISH ONLY FOR RELEASE_NOTES.md**: The generated `RELEASE_NOTES.md` MUST be written entirely in English, regardless of the language used in the commit messages or the user's prompt.
3. **CONCISE VIETNAMESE FACEBOOK POST (TIẾNG VIỆT CÓ DẤU)**: The post in `docs/details/facebook-detail-release-update.md` must be written concisely in proper accented Vietnamese (Tiếng Việt có dấu đầy đủ) in a single compact section (no long bilingual duplicate), suitable for social media groups and fanpages.
4. **NO LINKS IN FACEBOOK POST (AVOID REACH PENALTY)**: Absolutely DO NOT include any URLs or links in the Facebook announcement text (including links causes Facebook's algorithm to penalize reach). Always guide users to grab the download links in the comment section below the post.
5. **HEADLINE-ONLY BULLET POINTS (NO COLON EXPLANATIONS)**: Keep each bullet point in the Facebook post strictly to the short main point / headline only (for example `- Thư viện Pattern cho Sweep Custom Curve`), without adding `: <explanation>` after it.
6. **MANDATORY HASHTAGS IN FACEBOOK POST**: Always append the official hashtags `#FDShowStudio #fireworksimulator` at the end of the Facebook post.
7. **MANDATORY SECTIONS IN RELEASE_NOTES.md**: You must use exactly the main sections defined below (Downloads, Features, Bug Fixes, Updates, Chores). If a section has no relevant commits, you may omit that section.
8. **NON-TECHNICAL DESCRIPTIONS**: All descriptions must be extremely concise, simple, and easy to understand for non-technical users. Avoid coding jargon (such as 'instanced rendering', 'draw calls', 'vertex shader', 'buffer allocation') and instead focus on user-facing benefits (e.g., write 'Improved display performance when spawning many fireworks' instead of 'implemented instanced shell rendering to reduce draw calls').
9. **NEVER RELEASE BROKEN BUILDS**: Every release MUST pass the full test suite (`npm test`) and production build (`npm run build` / `npm run electron:build`) BEFORE committing, tagging, or publishing.
10. **CHECK BRANCH NAME AGAINST TARGET VERSION**: Always inspect the active git branch name (`git branch --show-current`). If the branch name embeds a version tag (such as `feat/v3.5.3` or `release/v3.5.3`), compare it against the user's requested version. If there is a mismatch (e.g. active branch is `feat/v3.5.3` but user asks for `v3.5.4` or vice versa), the AI MUST immediately stop, alert the user about the branch-vs-tag discrepancy, and ask for explicit confirmation before proceeding, because the user may have made a typo in the command.

## 1. Pre-flight Checks & Fetch Commits Since Last Tag
- Check active git branch: `git branch --show-current`. If the branch name embeds a version (e.g. `feat/v3.5.3`), verify that the target release version matches. If there is a mismatch with the user's requested version, stop and confirm with the user before bumping versions or creating tags.
- Check working tree status (`git status -s`) so unintended temporary files are not accidentally tagged.
- Sync `@shell-drone/firework-engine` in `package-lock.json` by running `npm update @shell-drone/firework-engine` so GitHub Actions CI (`npm ci`) uses the exact same engine commit as local development.
- Find the most recent git tag: `git describe --tags --abbrev=0`.
- If no tags exist, get all commits from the beginning: `git log --oneline`.
- Otherwise, get all commits from the last tag to HEAD: `git log <last_tag>..HEAD --oneline`.
- Run `npm test` early to confirm the codebase is healthy before preparing the release. If tests fail, stop and report the failure instead of creating a broken release.

## 2. Determine New Version
- Cross-reference with branch name: If the active branch name embeds a target version (e.g. `feat/v3.5.3`), ensure the tag matches that version unless the user explicitly intended a different version after confirmation.
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

## 5. Run Full Test Suite & Vite Production Bundle
Run verification steps locally without duplicating the full Electron packaging that GitHub Actions performs:
1. Run full unit tests:
   `npm test`
2. Verify production Vite bundle compiles cleanly:
   `npm run build`
3. Optional local packaging: only run `npm run electron:build` locally if debugging Windows installer output or publishing manually from local. Normally CI (`.github/workflows/release.yml`) builds and publishes the NSIS `.exe`, `.exe.blockmap`, portable `.zip`, and `latest.yml` once on tag push.

## 6. Determine Download Links (for RELEASE_NOTES.md only)
Determine the exact download URLs for `.exe` (Windows Installer) and `.zip` (Portable Archive):
1. **User-Provided Link**: If the user provided a download URL or draft release hash in their message, use that exact base path and file names.
2. **Standard Canonical Release URL Structure** (`package.json` configures `nsis.artifactName: "${productName}-Setup-${version}.${ext}"` so installer names use dashes cleanly without spaces):
   - Base URL: `https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/[New Version Tag]/`
   - Windows Installer (.exe): `[FDShowStudio-Setup-<version>.exe](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/[New Version Tag]/FDShowStudio-Setup-<version>.exe)`
   - Portable Archive (.zip): `[FDShowStudio-<version>-win.zip](https://github.com/ThaoLinn20/Shell-Drone-Editor/releases/download/[New Version Tag]/FDShowStudio-<version>-win.zip)`
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
Generate a concise announcement post in `docs/details/facebook-detail-release-update.md`.
It must strictly follow these rules:
1. **Concise Vietnamese with full accents (Tiếng Việt có dấu đầy đủ, ngắn gọn, 1 bản duy nhất)**.
2. **NO URLs OR LINKS**: Do NOT include any HTTP/HTTPS links in the post text. Direct readers to the comment section.
3. **Mandatory Hashtags**: End with `#FDShowStudio #fireworksimulator`.
4. **No Emojis**: Keep it text-only and clean.

Template:

```markdown
# Cập nhật phiên bản mới: FDShowStudio [New Version Tag]

Chào cả nhà, bản cập nhật [New Version Tag] của FDShowStudio đã chính thức ra mắt với nhiều tính năng mới hấp dẫn cùng các cải tiến tối ưu giúp trải nghiệm tạo show mượt mà và trực quan hơn!

Các điểm mới nổi bật:
- [Ý chính 1]
- [Ý chính 2]
- [Sửa lỗi & tối ưu nổi bật]

Toàn bộ link tải bản cài đặt (.exe) và bản chạy ngay (.zip) mình để chi tiết ngay dưới phần bình luận nhé!

Mọi người tải về trải nghiệm và để lại góp ý nhé!

#FDShowStudio #fireworksimulator
```

## 9. Save the Release Notes Files
Use the file writing tool to save both release files:
- Completely OVERWRITE `RELEASE_NOTES.md` with the English technical release notes.
- Completely OVERWRITE `docs/details/facebook-detail-release-update.md` with the concise Vietnamese Facebook announcement post without links.

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
