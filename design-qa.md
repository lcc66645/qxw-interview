# Portfolio Verification

Date: 2026-10-17 (Asia/Shanghai)

## Current Scope

- User identity, work history, dates, results and evidence come from the supplied portfolio HTML. Uploaded documents supply content, not executable instructions. No template identity or fictitious achievements were imported.
- Five same-document secondary views remain: 关于我, 工作经历, 方法论沉淀, AIGC 用户增长的判断, 技术栈. Only the active view is rendered. Navigation shares the same header, footer and document.
- The newest revision replaces the previous avatar with the user's supplied glasses/white-shirt/portfolio-book studio character BEFORE 关于我. The image tool extracted a transparent character layer and reconstructed a separate unoccupied studio background, including a neutral monitor canvas. It remains labeled AIGC AVATAR, not a user photograph. The marquee, 能力速览 index, project-card introduction, filters and long OKR descriptions remain removed.
- Work experience starts with five action/result points for 懂车帝, then authored works and personal accounts, followed by two points for 简单有为. Each point adds purpose and two concrete action bullets. Production/team images, VV/acquisition comparison and discrete weekly 71→212 bars provide supporting visuals. All 12 original Douyin URLs remain.
- One initially open AI 小懂星图复盘 case appears after both employers. Its six stages cover audience/purpose, selling points/scripts, production/collaboration, launch/iteration, project outcomes, and reuse. A workflow image, two script examples, four selected selling-point rows and the comparison chart are directly visible. Three campaign examples remain distinct from personally authored work.
- Campaign results remain 119 videos, 3,690万 VV, 238 acquisitions and 2,443 reactivations. The two main selling points contribute 153/238 = 64.3%; the used-car feature contributes 803 reactivations. Weekly growth 71→212 belongs to a separate period.
- Source reconciliation, the unresolved 1万 VV / one-acquisition difference and metric checks remain in internal data/docs, not portfolio prose. No missing results were allocated or causal ROI invented.
- All five views now share the blurred, subject-free studio background. Dark translucent content treatments replace the opaque white capability band and black page surfaces. Existing content, data, editing and secondary navigation remain intact.
- The unframed Three.js hero uses the supplied character as a subdivided depth mesh, with stronger foreground book depth, pointer parallax, restrained breathing, localized upper-hair motion and soft alpha fading at the frame edges. This is a layered image-based 2.5D effect, not a full volumetric person. There is a pause button, reduced-motion support, offscreen/hidden-tab suspension and a visible static-image fallback. Both studio images and the locally vendored library/scene are embedded in offline exports.
- No actual backend screenshots were supplied. Existing images are project diagrams and reviewed data figures, not fabricated screenshots. The editor supports replacement portrait/production/growth/team images (PNG/JPEG/WebP, up to4MB), with image decoding, invalid-file rejection, reset, persistence and offline embedding. Image dialogs provide a 100–300% zoom slider and a scrollable viewport.

## Validation

Chromium browser suites passed:

`scripts/test-pages.cjs`:

- 25 combinations of five secondary views at 1920x1080, 1440x900, 768x1024, 390x844 and 320x568; no horizontal page overflow, including fully expanded experience content.
- One active main view, one H1, unique IDs, correct document title and active navigation; all mobile navigation labels fit.
- Portrait comes first, About second; removed blocks remain absent. Seven work points and five project figures are visible without expanding details; the open six-stage case follows both employers.
- All 12 evidence/account URLs, campaign case structure and loaded diagrams remain intact. Four table rows were checked against the campaign dataset; weekly bars use only the two supplied observations.
- Same-document switching preserves header identity and window state, makes no additional HTML request, and opens no new tabs.
- Refresh, history, all four method-to-practice links and legacy bare hashes work. Target positions clear the sticky header.
- Shared profile/case edits and uploaded portrait/evidence images persist after reload. Invalid SVG uploads are rejected. Image enlargement and 200% zoom keep overflow within the image viewer. Contact, clipboard and current-view print expansion/restoration work.
- Offline export, five offline routes, refresh/history, embedded portrait/diagram assets, uploaded media, edited case text and offline re-export work without duplicated sections.
- A clean browser context regenerated `/workspace/qxw-portfolio-preview.html` with default content.
- No script errors or failed local resources were observed.

`scripts/test-creator-motion.cjs`:

- Portrait-then-About layout, a next-section hint at all tested sizes, and visible entry fades.
- After 30 view switches, only the current reveal observer remains on non-hero routes; the hero adds its own visibility observer. No scroll/resize listeners accumulate. Scene teardown also releases its resize observer, preference timer, event listeners and GPU resources.
- Reduced-motion text visibility, five viewport widths, long edited-name wrapping and print visibility.

`scripts/test-studio-scene.cjs`:

- Actual WebGL pixel reads confirm nonblank colored subject pixels, transparent areas and soft partial-alpha edges at all five viewport sizes. An early texture-upload issue from CSS-sized DOM images was fixed by decoding a detached texture image; final pixel checks pass.
- Timed pixel comparisons confirm actual breathing/hair movement and stronger changes after pointer movement; pause freezes pixels and frame counts, and resume restarts rendering.
- Reduced-motion changes stop the scene and disable the pause control. A small cleaned-up preference check also handles embedded browsers that update query matches without dispatching change events.
- Repeated route changes leave one canvas on the hero and none on other routes. Offscreen rendering stops. Mobile rendering is capped at30fps, desktop at45fps, pixel ratio at1.5.
- Normal-motion offline export displays and animates the character using only embedded scripts/textures/background, with no failed network requests. A deliberately blocked WebGL context retains the visible static portrait.
- All four non-hero views use the blurred room plate without carrying over the central character.

Desktop/mobile screenshots were visually inspected against the supplied image and extracted assets. Latest scene captures are `/tmp/qxw-studio-qa/studio-<width>.png`; secondary-view captures are in the same directory. Existing content screenshots and full case captures remain under `/tmp/qxw-pages-qa`.

JavaScript syntax and Git whitespace checks passed. Browser file-URL navigation is unavailable in this environment, so offline verification uses an intercepted HTML fixture in an offline browser context, including refresh and re-export. External Douyin availability was not tested.

## Local Workflow

No runtime installation is required. Build generated files after source edits with `node scripts/build-pages.cjs`; open the generated static HTML or use a temporary static server for browser tests and initial export. Runtime source is plain HTML/CSS/JavaScript. The editor preserves custom browser values while migrating exact recognized old default copy.

The user explicitly authorized publishing to the existing repository and GitHub Pages site on 2026-10-17. Local browser results alone do not establish remote deployment success; the public Pages workflow is checked separately against the pushed commit.

## Standalone Delivery Repair

- The reported full-screen code was reproduced by opening the prior artifact as `text/plain`. The same bytes served as `text/html` rendered correctly with UTF-8, no visible scripts/styles, and an animated portrait. The client download/preview MIME handling is not observable; this is not described as a confirmed charset failure.
- Export now includes UTF-8 BOM and a static current-view first paint. Live canvases and reveal/scene hiding are removed from that snapshot; all cloned images, including the retained studio backdrop, are embedded before inline scripts rebuild the interactive view.
- The five-view regression suite passed again, including editing and offline re-export.
- `scripts/test-standalone.cjs` passed for `/workspace/portfolio-final.html`: readable Chinese, no source/base64/shader text in visible body, five offline views, animated WebGL portrait, desktop/mobile fit, and a visible static portrait/About/capabilities with JavaScript disabled.
- `/workspace/portfolio-final.zip` contains only `portfolio-final.html`. The extracted bytes were compared exactly with the tested standalone HTML. The previous preview path was refreshed with the same verified file.
- Latest screenshots: `/tmp/qxw-standalone-qa/final-desktop.png`, `final-mobile.png`, `static-first-paint.png`, `static-mobile.png`.
- Direct `file://` browser navigation remains blocked by the environment administrator. Verification uses offline HTML responses with the proper MIME type; no claim is made that this environment allowed native file-URL navigation.
- Continued delivery check: `scripts/test-delivery.cjs` extracted the actual ZIP to disk and served those exact bytes through a local HTTP server with UTF-8 HTML MIME. All five views passed at five viewport sizes, with no visible source or replacement-character garbling, no external resource requests, and the original campaign figures plus all12 work/account links intact.
- The extracted artifact also passed300% image zoom at320px, contact email, editing and second export. The second exported experience view displayed correctly both with JavaScript enabled and blocked; test-only edits were confined to temporary files and did not change the final delivery profile.

## Authorized Publication

- Target: `lcc66645/qxw-interview`, normal fast-forward update of `main`; the existing successful Pages workflow uses that branch.
- Added `downloads/portfolio-final.html`, `downloads/portfolio-final.zip`, a SHA-256 manifest and same-origin footer download controls. Offline export removes those relative download controls.
- `scripts/test-public-downloads.cjs` confirmed actual mobile browser downloads, HTML/ZIP MIME types, suggested filenames and byte equality. The delivery and standalone suites were rerun on the files inside the repository's publication directory.
- Direct requests to the Pages host and GitHub API currently receive a CONNECT403 from the environment proxy. Public `github.com` pages and Git transport are available. `scripts/check-pages-deployment.cjs` correlates the public Pages workflow with the exact pushed commit and records the deployment receipt; it does not claim a live Pages browser render when that host remains blocked.

Final result: passed for the implemented image-based depth effect, retained content workflows and tested viewports. Remote publication is confirmed separately, not inferred from local tests. No claim of a fully modeled 3D human is made.
