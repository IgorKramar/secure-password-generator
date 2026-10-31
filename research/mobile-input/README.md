# Mobile input pilot · protocol v2

[Русский](README.ru.md)

**Status: one v1 pilot received; a controlled v2 repeat is pending.** [Pilot observations and limitations](results/pilot-p1.md): all nine measured trials had `composition`, and the participant reported using gestures for meaningful words. These data do not establish a format-only or taps-only advantage. v2 is a prospective protocol correction; it does not relabel that pilot. Automated browser runs are never participant observations. The first device class is mobile. The interface is in Russian; stimuli use Latin characters and English EFF words.

The [original v1 protocol](https://github.com/IgorKramar/secure-password-generator/blob/b28872163abcd5297da5abfe1282b0f733374b4c/research/mobile-input/README.md) remains the governing definition for v1 exports. In v2, settings are explicitly recorded before starting, each trial has a self-reported input method, and composition alone is informational. Generation, target entropy, schedule, timing and other exclusions are unchanged. Repeated sessions by the same person are not new independent participants; retain the participant number and analyze different protocol/builds separately.

## Run the experiment

From the repository, using a supported Node.js version:

```sh
npm ci
npm run study:build
npm run study:serve
```

Open `http://127.0.0.1:4173/mobile-input.html` to inspect the instrument on the computer. The build produces `.study/mobile-input.html`, a single file containing the built library, dictionary, script and styles. There are no remote fonts, scripts, analytics, uploads or runtime dependencies. A content security policy disables network connections and permits only the hashed bundled script/style. The build fingerprint covers the bundled implementation and HTML; record it with results.

For the **actual phone trial**, put the phone and computer on the same trusted Wi-Fi and run:

```sh
npm run study:serve -- --lan
```

On the phone, open `http://<computer-LAN-IP>:4173/mobile-input.html` in its normal browser. The server serves only the study page, does not accept results or log requests, and stops with Ctrl+C. LAN HTTP is for these disposable stimuli on a trusted network; it is not a deployment for generating account passwords. No firewall or port forwarding is configured automatically. If LAN access is unavailable, serve the same HTML on a trusted HTTPS host, or open the file in a browser that executes local HTML. File preview apps may not execute JavaScript. Actual iOS/Android operation, soft-keyboard behavior and downloads must be checked on the selected phone; a narrow desktop viewport is not a substitute.

After each completed or skipped trial the JSON download is available. At the end, save it in the ignored `study-results/` directory. The page holds results only in memory: refreshing loses them. A partially completed export is valid and remains visibly incomplete.

```sh
npm run study:analyze -- study-results/mobile-input-v2-p1.json
# Pure JSON stdout, without npm's command banner:
node scripts/analyze-study.cjs study-results/mobile-input-v2-p1.json
```

The analyzer accepts both v1 and v2 exports, 1–100 regular UTF-8 JSON files, at most 128 KiB each. It rejects unknown fields, inconsistent trial order/metrics, duplicate participant numbers, mixed protocols and mixed build fingerprints. It outputs descriptive summaries separately per participant and records each input's SHA-256. Build first; it loads `.study/model.cjs`. It does not calculate a pooled speedup, significance test or improvement claim. `conditions` follows the input's protocol. For v1 only, `compositionSensitivity` additionally admits composition-only flags as a **post-hoc diagnostic**, while keeping the original primary exclusions and observed skips visible. It does not establish that assistance was disabled. No input flags, protocol labels or bytes are rewritten.

## Preregistered comparison

Question: on the selected phone, does avoiding case/digit-layer switching offset additional characters? Hypothesis, not result: a longer lowercase-only format may be easier to enter. A passphrase is a third comparator, not assumed to win.

All modes request **128 bits** and use the existing cryptographic library without choosing a preferred result, rejection by appearance, truncation, case conversion or deduplication. Distributions and actual entropy are:

| Condition | Construction | Exact space | Calculated bits |
| --- | --- | --- | --- |
| `random62` · control | 22 independent draws from `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` | `62^22` | 130.992319 |
| `lower25` · mobile candidate | 28 positions over `abcdefghijkmnopqrstuvwxyz` | `25^28` | 130.027973 |
| `eff10` · phrase | 10 independent EFF Long Wordlist draws, with replacement; single spaces | `7776^10` | 129.248125 |

These spaces meet the same target; they do not have identical entropy. The spread is under 1.75 bits. The lowercase candidate omits lowercase `l`; digits and uppercase are absent altogether. Its policy has no required categories or other constraints, so uniform rank selection is equivalent to independent uniform positions. `25^27 < 2^128 <= 25^28`; no user-word entropy formula is involved. EFF's internal hyphens are preserved and can still require a keyboard layer switch. Every new restriction requires recalculating the output space before changing the protocol version. The candidate is not a general site-compatible password recommendation.

The same candidate is available through the existing CLI, including from the installed tarball:

```sh
secure-passgen random --policy examples/mobile-lowercase-policy.json --entropy 128
```

The example path above is relative to the checkout; for an installed package use its `node_modules/ts-secure-password-generator/examples/mobile-lowercase-policy.json` path.

## Device conditions and session procedure

Assign anonymous participant numbers sequentially (1–999); do not search for a favorable order. Record model, OS/version, browser/version, keyboard/version, Latin layout, English familiarity and typing technique. Use portrait mode, the same keyboard and one fixed technique throughout. Disable autocorrect, prediction, swipe input, password-manager insertion and hardware keyboards. v2 requires separate off/on/unknown answers for the first three settings and will not start until all are reported off. Browser input attributes cannot enforce OS settings. If a setting cannot be disabled, this taps-only protocol cannot be used; document an assisted-input experiment separately. Do not record names, serial numbers or account passwords. Participation and sharing the exported file are voluntary.

The participant sees a persistent target and a **visible** text field. This measures same-device transcription, not memorability, masked login entry or transfer from a second screen. One press reveals the target and starts a monotonic timer, including reading and keyboard opening. Exact submit ends the trial; an incorrect submit leaves the same target and timer active. Maximum duration is five minutes per trial; there is a skip button. No regeneration to obtain an easier stimulus. Rest between trials, with no timer running.

There are three practice trials (one per condition), then three measured blocks (three conditions each): **12 total, nine analyzed**. Participant number selects one of six base permutations; subsequent measured blocks rotate that order. Within a participant each condition occupies each position once; across each six sequential participants all base orders occur. This balances position, but does not eliminate all learning, fatigue or carryover. A first personal pilot can identify instrument problems; it cannot establish a population effect. If it changes the protocol, increment the version and keep pilot data separate.

After each trial, report whether input used only taps, assistance (swiping/dictation/suggestions), or is unknown; only reported taps are eligible in v2. Then rate ease from 1 (very difficult) to 7 (very easy). Optionally report remembered case/layout switches; blank is unknown, not zero. These are self-reports, not OS telemetry. The page cannot observe physical touchscreen keys, distances between them, actual layout switches, or every assistance feature. Any future key-travel model must specify keyboard geometry and cannot be relabeled measured speed.

## Outcomes, exclusions and analysis

Primary descriptive outcome: per-participant median time to **correct completion**, separately by condition, after removing practice and ineligible attempts under the recorded protocol. Time starts at target reveal and includes reading, keyboard appearance, corrections and submit. Do not call it pure typing time. Report successful/eligible/recorded/scheduled denominators, observed skips and timeouts alongside it: fast completion of a small subset is not an overall improvement. `flagged` counts any flag, `excluded` counts ineligible trials; they differ in v2 because composition alone need not exclude.

Secondary outcomes: first-submission error count/attempted denominator, edit distance on the first submitted attempt, wrong submissions, deletion input events, first-input/first-submit latency, ease and self-reported switches. Levenshtein distance counts code-unit substitutions, insertions and deletions with no normalization (targets are ASCII); it is not a count of typing errors. Input events are not physical keystrokes; browser/keyboard batching can differ.

Predeclared exclusions in v2: backgrounding, attempted paste/drop, replacement events, untrusted script input, settings not all reported off, or a per-trial input method other than taps. Composition is retained as an informational flag: [W3C UI Events](https://www.w3.org/TR/uievents/#events-compositionevents) describes input-method composition, not an autocorrection detector. v1 continues to exclude **every** flag, including composition. All observations remain in JSON. Paste/drop is prevented where browser events permit. Flags and self-reports do not prove all assistance was detected. Timeout is right-censoring at 300 seconds, not successful completion. Skips stay skips; never silently remove or repeat them. Missing trials remain missing. Do not pool heterogeneous devices or treat nine repeated trials as nine independent people.

The analyzer validates exports, not human provenance; edited data cannot be authenticated. Review the full exported counts before writing findings. Publish actual device conditions, sample size, all exclusions/missing outcomes, per-person comparisons and limitations. No time/error/usability result exists until a participant actually performs the procedure.

## Other profiles and scope

| Profile | Proposed input conditions | Main costs to investigate | Status |
| --- | --- | --- | --- |
| Desktop | Physical Latin keyboard, fixed layout, both hands | Shift/symbol keys, key travel, ambiguity, length | Protocol outline only; no measurements |
| Mobile | Portrait software Latin keyboard, fixed one/two-finger technique | Case/layer switches, key travel, length, ambiguous characters | One v1 pilot received with method confounding; v2 controlled repeat pending |
| TV | Fixed on-screen grid and remote, documented wrap/repeat behavior | Directional moves, confirm presses, layer switches, length | Protocol outline only; no optimized generator or measurements |

This bounded pilot does not implement travel-distance optimization, a TV keyboard simulator, new public generator APIs or a general browser playground. It is separate from the npm runtime package; only the reusable lowercase policy example is packaged. English EFF words are another confound for Russian speakers; report language familiarity before interpreting comparisons.

The motivating [SOUPS 2026 paper by Sadik et al.](https://www.usenix.org/conference/soups2026/presentation/sadik) studies device input costs. Its reported improvements are model predictions for its algorithms, not measurements of this implementation. No audit, formal proof or performance claim follows from this pilot's automated tests.

## Check the instrument

```sh
npm test
npx playwright install chromium
npm run test:study
npm run test:package
```

`STUDY_CHROMIUM_PATH=/path/to/chromium npm run test:study` can use an already installed browser. Browser tests use a local HTTP server and a 390×844 viewport. They check full completion/export with composition notifications, v2 settings and method reporting, blocked on/unknown settings, error correction, assistance/background flags, timeout, absent crypto, no outgoing application requests/storage, and layout overflow. All their inputs are synthetic. Unit tests cover controlled clocks, schedules, entropy, v1/v2 schema validation, immutable v1 exclusions, post-hoc sensitivity and incomplete/flagged summaries. Do not store test downloads as participant data.
