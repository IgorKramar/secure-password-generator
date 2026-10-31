# Stage-three instrument verification

Historical verification of the first instrument, before participant data arrived. See the [subsequent P1 pilot and prospective v2 correction](../research/mobile-input/results/pilot-p1.md) for the current research status; the original evidence below is retained.

Date: 2026-10-31. Base: `0034dc23443f69a12ea48b10cf69d59374d20a3b` on clean `main`; working branch `feat/mobile-input-study`. No applicable `AGENTS.md` was present. The owner selected **mobile** for the first real-device experiment. Roadmap: https://app.notion.com/p/40a99aa2eb7b8126aa9ff909d0cea9ae.

## Implemented scope and boundary

This is the **instrument and protocol** part of stage ③. The stage's final criterion requires actual input-time/error observations, which have not been collected. Automated browser input is explicitly synthetic and is not presented as a participant measurement. There is no usability improvement, physical-device compatibility, key-travel model, population effect, cryptographic audit or formal-proof claim.

The separate research tool compares random62 (22 characters, 130.992319 bits), lower25 (28 characters, 130.027973 bits), and EFF (10 words, 129.248125 bits). Each meets the 128-bit target with the existing library. The lowercase candidate's exact count is `25^28`; it is a packaged policy example rather than a new runtime API. No production generator implementation changed.

The EN/RU protocol defines device conditions, six base orders, three practice plus nine measured trials, target-reveal timing, exact comparisons, a five-minute cap, omissions, assistance/background flags, subjective ratings, and incomplete/flagged-data analysis. The local HTML includes its JavaScript, dictionary, styles, MIT notice and EFF attribution/license. Network requests and form submission are restricted by CSP. A minimal server serves only this page; LAN binding requires the explicit `--lan` option. Results stay in browser memory until downloaded and omit generated strings and entered text. The strict offline analyzer accepts at most 100 files of 128 KiB each, rejects duplicate participants/mixed builds and does not pool participants or infer significance.

## Actual local checks

Initial reproduction with Node 24.19.0/npm 11.9.0: `npm ci`, build, 234 tests, and clean installed-tarball checks passed before edits. Final library/instrument checks passed on Linux:

| Node.js | Unit/integration tests | Installed package | Study TypeScript/bundle |
| --- | --- | --- | --- |
| 22.23.4 | 268 / 9 suites | Passed | Passed |
| 24.19.0 | 268 / 9 suites | Passed | Passed |
| 26.13.0 | 268 / 9 suites | Passed | Passed |

Commands: `npm test`, `npm run test:package`, `npm run study:build`, and `git diff --check`. Alternate Node runs used `npm exec --yes --package=node@22 -- sh -c 'node --version && npm test && npm run test:package && npm run study:build'` and the same command for Node 26. The final HTML license-only change was rebuilt and browser-checked on Node 24 afterward.

`STUDY_CHROMIUM_PATH=/usr/bin/chromium npm run test:study` runs five checks under Playwright 1.64.1 / Chromium 154.0.8037.57. Four exercise the browser: all 12 trials, error/correction, clean download without target/typed strings, no application network traffic or local/session storage, layout width, flags, timeout and unavailable crypto. The fifth checks the real analyzer process, valid incomplete exports, the exact file-size boundary, malformed/non-UTF-8/oversized files, duplicate participants, mixed builds, directories and a FIFO without hanging. Tests create disposable synthetic data only.

The setup UI was visually inspected at 390×844. This is a desktop Chromium viewport, not an Android/iOS soft-keyboard test. The environment's Chromium blocks `file://` navigation by policy, so checks use the documented local HTTP server. An early browser-test selector was invalid and corrected; all five checks pass afterward. Build attribution was added during review and rechecked. There were no initial project test failures to hide.

The package checker still verifies clean installation with `--omit=dev`, CommonJS/ESM, declarations, local/global CLI and browser bundling. It now also checks the shipped lowercase-policy JSON and its installed CLI output (28 permitted characters). The research application, participant data and Playwright are excluded from the runtime artifact. Dependency lockfile includes Playwright only as a development dependency. Package version remains 0.0.2, unreleased.

## Remote checks and next evidence

CI now builds the study on Node 22/24/26 and adds a separate Chromium/Playwright job on Node 24. Local success above is distinct from remote success; the PR checks and Notion project card record the actual remote result before authorized merge. No npm publication or release tag is part of this work.

Next: run the documented procedure on the selected phone, record actual hardware/OS/browser/keyboard, English familiarity and typing conditions, complete or explicitly stop the session, and export JSON. Only then can per-person times, errors and ease be compared. No research data or fabricated sample results are committed to the repository.
