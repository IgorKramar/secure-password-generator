# P1 mobile pilot · observed results and protocol correction

[Русский](pilot-p1.ru.md). Received and analyzed on 2026-10-31. **Exploratory observations, not a controlled format comparison.** One participant completed the full v1 session. All nine measured trials have `composition`; the participant subsequently confirmed that gesture input was enabled and used for meaningful words. Format and input method are therefore confounded. Do not call the numbers below a speedup, a manual-only result, or a population finding.

## Provenance and actual conditions

Source: the owner's uploaded `mobile-input-v1-p1.json`, 6663 bytes, SHA-256 `21d309a639e028f133417972ff49b3274a1785a4c67b5453e44a3fa72b76e163`. Protocol `mobile-input-v1`; build `558f6d14f00c2ef37037d1cbf0071c57e511ed338e588249bda8b7448a4b6bc9`; participant 1. The original file is preserved unchanged outside Git. Only the password-free [measured observation table](pilot-p1-observations.csv) and derived findings are published here; it contains no target or typed strings.

Reported device conditions: Realme GT7, Android 16, Chrome 156.0.8078.75, Yandex Keyboard 109.16, English QWERTY, one thumb in portrait orientation, basic English familiarity. These versions/settings are participant metadata, not independently inspected on the device. After upload the participant reported gesture input enabled and using gestures on meaningful words. Specific assisted trial indices and other assistance settings were not recorded by v1; no per-trial input method is inferred from event counts or flags. The session contains no absolute start/end timestamps, so the receipt date is not proof of its execution time.

Validation passed: expected six-order schedule for participant 1, unique indices 0–11, three practice and nine measured trials, all ratings present, no duplicate/missing trials, valid lengths/entropy/timing/status fields, matching released study fingerprint. Eight measured attempts completed correctly; one was skipped. There were no timeouts. Every measured flag is `composition`, without background, paste/drop, replacement or untrusted-input flags. Their absence does not prove absence of keyboard assistance.

## Original result and descriptive sensitivity

The **original v1 primary result is zero eligible measured trials**: its predeclared rule excludes every flag, including composition. No primary median or error-rate estimate is available. This rule and the input data remain unchanged; the analyzer now makes the empty eligible set explicit and preserves observed skips/counts alongside it.

The following is the separately labeled **post-hoc composition sensitivity**: allow composition as the only flag, retain all three measured attempts per format, and calculate completion-time medians only for correct completions. It describes what occurred with the reported mixed input methods, not performance under the intended taps-only setup.

| Format | Successful / recorded | Median correct-completion time | First-submission errors / attempted | Wrong submissions | Median ease (1–7) |
| --- | --- | --- | --- | --- | --- |
| random62, 22 characters | 2/3; one skip | 34.88 s (n=2) | 1/3 | 3 | 4 |
| lower25, 28 characters | 3/3 | 31.94 s (n=3) | 0/3 | 0 | 5 |
| EFF, 10 words | 3/3 | 55.87 s (n=3) | 1/3 | 3 | 4 |

Ease medians include the skipped attempt; completion-time medians do not. The skipped random62 attempt ended at 94.06 s after three wrong submissions; its first submitted answer had edit distance 2. This is neither a correct completion nor a timeout. One EFF attempt had three wrong submissions and then completed at 61.73 s; its first answer's edit distance was 1. A wrong submission is not the same as one mistyped character.

![Individual trial elapsed times; the skipped control is separate](pilot-p1-times.png)

Block-level observations further limit a simple ranking: lower25 took 29.94 s versus random62's 39.38 s in block 1, but 31.94 s versus 30.38 s in block 2. The control was skipped in block 3. The control median therefore selects two successes while the other medians use three, a survivorship difference. No pooled speedup or significance calculation is justified. EFF trial lengths were 76, 77 and 86 characters; known English familiarity was basic and gesture use on meaningful words adds another confound.

Self-reported switches were 10/15/5 for random62, 0/unknown/unknown for lower25 and unknown for all measured EFF attempts. Missing values are not zeros. Event counts are not key counts: for example one 86-character phrase produced 71 input events; IMEs may batch text, so this cannot determine the number or location of gestures.

## What changes prospectively

The v1 exclusion rule was too broad for a mobile instrument: composition observes an input-method sequence, not specifically autocorrection. [W3C UI Events](https://www.w3.org/TR/uievents/#events-compositionevents) describes composition and [IME behavior](https://www.w3.org/TR/uievents/#keys-IME). This does not establish the mechanism of every event in this file; the participant's report independently establishes gesture use.

Protocol v2 now records separate off/on/unknown answers for autocorrection, suggestions and gesture input and refuses to start unless each is reported off. Every trial records taps/assisted/unknown after the attempt. Composition is retained as informational; primary eligibility requires all settings off, reported taps and no other flags. Settings and method remain self-reports, not proof of OS behavior. v1 exports still use v1 exclusions and an explicitly separate sensitivity output. Mixed versions/builds are rejected in one analysis batch. The generators, entropy targets, trial order and timing are unchanged.

The minimal next evidence is a fresh v2 run on the same phone with assistance disabled and individual taps, retaining participant number 1. It must remain separate from this pilot; repeated trials by the same person do not increase the independent participant count. A study of gesture-assisted passphrases would be a different, worthwhile protocol with explicit method assignment. Stage ③ remains open for its controlled comparison; this pilot has already exposed an instrument limitation and a real usage choice.

## Reproduction and checks

Run `npm run study:build`, then `node scripts/analyze-study.cjs /path/to/mobile-input-v1-p1.json`. The `conditions` array must have zero eligible observations and null completion medians; `compositionSensitivity.conditions` produces the table above. The analyzer reports source SHA-256 and analysis version. It does not modify the file. The artifact `p1-analysis.json` is retained locally, outside Git.

Numbers were independently recomputed from the original JSON using Python `statistics.median`, status filters and sums, not solely the TypeScript helper. The published CSV preserves measured values for reproduction without the full export. `python3 research/mobile-input/results/plot-pilot.py` regenerates the figure with Matplotlib; this optional analysis dependency does not affect the npm package. The original package API and password distributions are unchanged. Automated regression checks cover v1 preservation, composition-only sensitivity, other-flag rejection, v2 settings/method gates, legacy schema rejection and real browser export. Remote CI evidence belongs to the PR/checks and the Notion project card, separately from local checks.

Local verification on Node 24.19.0/npm 11.9.0 passed: `npm test` (273 tests, nine suites), `npm run study:build`, `STUDY_CHROMIUM_PATH=/usr/bin/chromium npm run test:study` (six browser/analyzer checks), `npm run test:package` (clean installed tarball) and `git diff --check`. The plotted PNG was visually inspected. No npm publication or release tag was created.
