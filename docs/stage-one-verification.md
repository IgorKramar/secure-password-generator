# Stage-one implementation and verification

Date: 2026-10-31. Repository: `IgorKramar/secure-password-generator`.

## Baseline

- Base commit: `5175b5df48986f392b176d78b5045857af1c4df6` (`main`).
- Working branch: `feat/stage-one-random-core`.
- The workspace initially had no checkout. A fresh clone had a clean working tree; there were no user changes to move or overwrite. No applicable `AGENTS.md` was present in the workspace ancestry or repository.
- Initial tools: Node.js **24.19.0**, npm **11.9.0**, Git **2.52.0**, TypeScript **5.5.4**, Jest **29.7.0**, ts-jest **29.2.5**.
- `npm ci && npm run build && npm test -- --runInBand` passed: **1 suite, 6 tests**. Initial `npm ci` ran the old `prepare` build. It reported existing development-dependency deprecation notices for `inflight` and `glob`; these were not introduced by the implementation.
- Runtime probes of the original build accepted `NaN`, an empty word and fractional lengths. Requesting 9.5 characters produced 10. An emoji with requested length 6 produced 7 UTF-16 code units. A repeated `ß` input also produced an oversized result. These were baseline defects despite the passing tests. Infinity was identified as an unbounded-loop risk in the source and was not executed in the old generator.
- The supplied Notion project card was readable. Its later-stage research did not expand this implementation's scope.

## Implemented scope and decisions

- A shared Web Crypto sampler uses rejection sampling for characters, case choices and Fisher–Yates indices. It requests 1024 bytes per refill and fails after 128 rejected draws for an index. There is no seed/provider parameter in the public API and no fallback source.
- `generatePassword(word, length)` remains available for nonempty ASCII inputs within the new limits. All ASCII code points remain supported by the library, including control characters; the terminal UI limits input to printable ASCII. Non-ASCII and malformed surrogate strings are deliberately rejected. This avoids ambiguous counting and Unicode case expansion while preserving the supported ASCII transformation.
- `generateRandomPassword(options?)` uses 62 unique letters/digits or 57 after removing `0O1Il`. Positions are independent with no required categories. `getRandomPasswordInfo(options?)` returns the actual alphabet, size, length and calculated entropy without accessing crypto.
- Length and target entropy are mutually exclusive. The default target is 128 bits; for 62 symbols this resolves to **22 characters / 130.99231882851126 bits**. Explicit shorter lengths retain their actual lower estimate. Target bits are positive integers; fractional targets are rejected consistently by the API and CLI.
- Resource limits: 1024 password characters, 1020 input-word characters, 100 CLI results. Maximum integer target: 6097 bits for 62 symbols and 5972 for 57. These limits bound work and memory, rather than prescribing a security target.
- CLI random commands print passwords only to stdout. Help uses stdout; prompts/errors use stderr. Arguments are strict, batch output is withheld on generation failure, and input values/provider diagnostics are not copied into error messages. No-argument and `from-word` interactive entries require TTY stdin/stderr and handle EOF and cancellation.
- Runtime dependencies remain empty. The published entry is CommonJS with declarations and Node ESM named-import compatibility. The core bundles for a browser without importing Node modules. esbuild was added only as a development tool for this verification; Node type definitions now track the oldest supported major.
- Build/test/pack scripts, explicit package contents, CI and both READMEs were updated. `prepack` builds the artifact; `pretest` builds the CLI before process tests. Unlike the previous `prepare`, `npm ci` now only installs dependencies: development must build explicitly, and installation instructions use a tarball or registry package, not a Git dependency.

## Local checks actually run

Final runtime and package checks were executed on Linux:

| Node.js | npm | Build | Final Jest suite | Installed-package checks |
| --- | --- | --- | --- | --- |
| 22.23.4 | 11.9.0 | Passed | 4 suites, 149 tests passed | Passed |
| 24.19.0 | 11.9.0 | Passed | 4 suites, 149 tests passed | Passed |
| 26.13.0 | 11.9.0 | Passed | 4 suites, 149 tests passed | Passed |

The full install/build/test/package sequence was run with the workspace's Node 24 and with Node 26. Node 22 used the same lockfile-installed development dependencies and ran its own build, tests and package consumer installations. After the last additional failure-path test, Jest was rerun on all three versions.

Commands included:

```sh
npm ci
npm run build
npm test
npm run test:package
npm exec --yes --package=node@22 -- sh -c 'node --version && npm --version && npm run build && npm test && npm run test:package'
npm exec --yes --package=node@26 -- sh -c 'node --version && npm --version && npm ci && npm run build && npm test && npm run test:package'
npm exec --yes --package=node@22 -- npm test
npm exec --yes --package=node@26 -- npm test
git diff --check
```

`npm run test:package` executes `npm pack --json` and installs that tarball with `npm install --omit=dev` into a newly created temporary project. It verifies:

- Required JavaScript and TypeScript declarations are packed; repository source/tests and development tools are not installed in the consumer.
- CommonJS and ESM imports generate passwords and validate JavaScript inputs.
- The npm-installed executable runs `random --entropy 128`, `random --length 20 --count 5`, and `--help`, with the expected stdout/stderr behavior.
- A separate global installation into a temporary prefix runs `secure-passgen random --entropy 128` successfully.
- A TypeScript consumer type-checks against the installed declarations using the development compiler, without installing that compiler in the consumer.
- esbuild bundles the installed library for `platform: browser`. Execution in a VM exposing Web Crypto but no Node globals succeeds; removing crypto fails clearly. This does not constitute real-browser end-to-end testing.

The tests cover runtime types/ranges, invalid Unicode, exact length/category/multiplicity properties, all **12,069** supported integer entropy targets across both alphabets, alphabet membership/exclusions, controlled rejection and acceptance (including shuffle indices), bounded retries/refills, unavailable/failing crypto, strict CLI arguments, output streams, result counts, exit codes, terminal EOF and cancellation. A provider failure on the second password of a batch is checked for zero stdout and no diagnostic leakage. There is no probabilistic requirement that two passwords differ and no small-sample statistical acceptance test.

Additional process checks used Python's real PTY support, with stdout captured separately: default interactive random (22 characters), interactive from-word (16 characters), Ctrl+C (exit 130), Ctrl+D (exit 1), and EOF after the word (exit 1). All passed without hanging or printing passwords on cancellation/EOF. Both workflow files parsed successfully as YAML; this is syntax validation, not an executed GitHub Actions run.

A final tarball is retained at `/workspace/artifacts/secure-password-generator-stage-one/ts-secure-password-generator-0.0.2.tgz`, with the `npm pack --json` manifest alongside it. It contains 26 files and is 19,822 bytes. That exact file was separately installed into another clean temporary project; the installed CLI returned 22 characters for `--entropy 128`, the imported metadata reported 130.99231882851126 bits, and the legacy import returned the requested length. The consumer was then removed. Artifact integrity: `sha512-w29utajRUSwz7rV6rolDPeCSajQLRfThfkTyot+2oeVLt1//Cpg42p3uioA5KuppeK+W6rFfrlDc+ttOWoClrA==`.

## Remote CI and release boundary

The GitHub Actions runs endpoint was read at the beginning and near completion of the work. Both observations returned **`total_count: 0`** for this repository. The implementation branch has not been pushed, so there is no observed remote CI run for these changes. Local success must not be represented as remote CI success.

The new CI workflow is configured for pull requests, pushes to `main` and manual dispatch, with Node 22/24/26. The publish workflow runs build, tests and package checks before publishing. Actions are pinned to the inspected release commits. Supported Node lines were checked against the [official release page](https://nodejs.org/en/about/previous-releases) on the date above.

No npm publication, release tag or merge was performed. Version `0.0.2` is unchanged; the next release needs its own version decision. No blocking local failures remain. The runtime has not received a cryptographic audit or formal verification, and native browser/Windows/macOS end-to-end execution was not performed. Site policies, passphrases, device profiles, LLM/top-q, formal proofs, browser UI, Argon2id and storage remain outside this stage.
