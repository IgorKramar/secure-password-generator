# Stage-two implementation and verification

Date: 2026-10-31. Project map: https://app.notion.com/p/40a99aa2eb7b8126aa9ff909d0cea9ae.

## Starting point and scope

Stage one was merged through [PR #2](https://github.com/IgorKramar/secure-password-generator/pull/2) after [remote CI](https://github.com/IgorKramar/secure-password-generator/actions/runs/41194925103) passed install, build, 149 tests and package checks on Node 22/24/26. The base for this work is `6fa3bea768f4f7a391256dd2b905d65849060f18`; the working branch is `feat/passphrases-and-policies`. The checkout was clean and no applicable `AGENTS.md` was present.

This implements roadmap stage ②: passphrases, a checked dictionary, site-policy generation, exact combination counts, CLI access, documentation and package verification. Device usability studies and research modes remain later work. Merging these changes is authorized; npm publication and release-version selection remain separate.

## Dictionary provenance and contract

The EFF Long Wordlist was retrieved from its [official source](https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt). The original bytes have SHA-256 `addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e`. The checked source has all 7776 five-dice codes in order, 7776 unique ASCII words and word lengths 3–9.

Inspection found four internal hyphens: `drop-down`, `felt-tip`, `t-shirt`, `yo-yo`. No spelling changes or removals were made. The generated JSON only removes the dice-code column. Allowed separators are space, underscore and period; each is absent from every dictionary entry, so splitting recovers exactly one sequence. Generation samples independently with replacement and retains repeated words. The frozen word array cannot be modified through the supported API.

`generatePassphrase` and `getPassphraseInfo` accept word count or integer target entropy, with a default target of 128 bits. Exact counts are `7776^W`; the default selects 10 words, about 129.248125 bits. Limits are 32 words / 413 target bits / 319 output characters. Every build checks the original SHA-256 and the JSON's exact correspondence to it, offline.

Attribution, source and transformation details are packaged in `THIRD_PARTY_NOTICES.md`. [EFF's copyright policy](https://www.eff.org/copyright) licenses its original material under CC BY 4.0; the code remains MIT, and package metadata lists both licenses. This records the inspected source's stated licensing, not EFF endorsement.

## Policy algorithm and boundaries

A policy supplies a unique printable ASCII alphabet, optional exclusions, at most eight required character sets, and minimum/maximum lengths. Each required set must occur at least once; sets may overlap. Maximum length is 256 rather than random mode's 1024, bounding the completion table to 65,792 entries. Unknown fields, duplicate characters, unsupported Unicode, impossible requirements and invalid numeric inputs are rejected.

The table stores the number of completions for a remaining length and a mask of missing required sets. Characters with the same requirement mask are grouped when counting. The generator draws a uniform integer rank below the exact `BigInt` count, then decodes it by partitioning ranks into blocks sized by the possible next characters' completion counts. The CLI constructs the table once per batch. No candidate repair, category insertion, floating-point sampling or unbounded retry loop is used.

Target selection compares the integer count directly with `2^targetBits`. The regression case `alphabet: 'ab', requiredSets: ['a']` has `2^L - 1` valid strings: at a 128-bit target it requires length 129, even when a floating-point logarithm of the length-128 count rounds to 128. Returned `entropyBits` is explicitly approximate; returned `combinations` is exact.

The bundled example has 70 characters and four required categories. At target 128 it selects length 21, with exactly `493957420278351331015146882126053376000` strings and approximately 128.537654 bits. Its count at length four also agrees with the independent closed-form result `4! × 26 × 26 × 10 × 8`.

The internal rank sampler masks unused high bits and rejects ranks outside the bound, using only the existing Web Crypto source. It accepts at most 2048 bits and 128 attempts; individual Web Crypto requests remain 1024 bytes. The largest supported policy requires at most 1682 rank bits.

CLI JSON policy files are limited to 16 KiB, decoded as strict UTF-8, and must be regular files. Nonblocking open plus file-type validation prevents a named pipe from hanging the command. Diagnostics do not echo file paths, JSON contents, unknown values or provider errors. Intentional password output remains stdout-only, one result per line, including permitted spaces.

## Local verification actually performed

Final source checks passed on Linux with npm 11.9.0:

| Node.js | Build | Tests | Installed tarball |
| --- | --- | --- | --- |
| 22.23.4 | Passed | 8 suites, 234 tests | Passed |
| 24.19.0 | Passed | 8 suites, 234 tests | Passed |
| 26.13.0 | Passed | 8 suites, 234 tests | Passed |

Commands included `npm ci`, `npm run build`, `npm test`, `npm run test:package`, `npm run check:wordlist` (also invoked by every build), and `git diff --check`. The Node 22 and 26 runs used:

```sh
npm exec --yes --package=node@22 -- sh -c 'node --version && npm run build && npm test && npm run test:package'
npm exec --yes --package=node@26 -- sh -c 'node --version && npm run build && npm test && npm run test:package'
```

Tests retain all previous contracts and add:

- Every supported integer passphrase target, word-count limits, repeated words, hyphen preservation, unambiguous separators, immutable dictionary metadata and unavailable crypto.
- Exhaustive enumeration of small constrained spaces, comparing exact counts and every decoded rank, including intersecting/repeated requirements and exclusions. No sample-frequency test or uniqueness assumption is used.
- Controlled multiword `BigInt` assembly, bit masking, acceptance/rejection boundaries and retry limits.
- Policy length/requirement/alphabet limits, impossible targets, singleton alphabets and validation before randomness.
- Both new CLI paths, strict options, batch counts, the exact file-size boundary, oversized/malformed/invalid-UTF-8 files, directories, FIFOs, whitespace preservation and diagnostic redaction.
- Interactive passphrase generation and EOF. A separate real PTY run selected passphrase, accepted the default 128-bit target, used period separators, and produced exactly ten dictionary words with prompts separated from stdout.

The package check packs and installs into a clean consumer with `--omit=dev`, then verifies CJS/ESM imports, declarations, new CLI modes, bundled dictionary bytes, notices and example policy. It also checks global CLI installation into a temporary prefix and runs all modes in an esbuild browser bundle with only Web Crypto exposed. It does not need repository source files or devDependencies at runtime.

A single local resource sanity run at the largest policy bounds (95 characters, 8 sets, length 256) built the table in about 656 ms and generated 100 results from that table in about 74 ms. This is an observation on this machine, not a performance guarantee or usability measurement.

During implementation, tests first identified prompt-fixture changes after adding the interactive mode. The package check also caught a dictionary-check message contaminating `npm pack --json` stdout; build diagnostics now use stderr. Both were fixed before the final matrix above.

## Integration and remaining work

The local matrix above is separate from GitHub Actions evidence. The stage-two PR must pass the existing remote Node 22/24/26 workflow before merge; its checks and the Notion project card record the observed remote result. The prior stage's successful remote run is linked at the top of this report.

No runtime dependency was added. No npm version bump, publication or release tag is part of this stage. Remaining limitations include one English dictionary, the documented bounded policy schema, approximate floating-point display of entropy, and no native browser/Windows/macOS end-to-end run. The implementation has not been cryptographically audited or formally verified. Device profiles require a separate experiment with actual input-time/error measurements; no such measurements or LLM results are claimed here.
