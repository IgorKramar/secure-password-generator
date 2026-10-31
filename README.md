# Secure Password Generator

**English** · [Русский](README.ru.md)

TypeScript library and Node.js CLI for independent random passwords, EFF passphrases, site-policy passwords and the existing word-based transformation. The npm package is **`ts-secure-password-generator`**; the command is **`secure-passgen`**. There are no runtime dependencies.

These changes are **unreleased**. The package version is unchanged; an existing registry release may not provide the new API. Build and install this checkout's tarball to use the implementation described below.

## Install and develop

Supported Node.js lines: **22, 24 and 26**, with global Web Crypto enabled. Use a current patch release. These are the LTS lines in the [official release schedule](https://nodejs.org/en/about/previous-releases), checked on 2026-10-31; Node.js 20 is EOL and is no longer supported. CI runs on Linux for all three supported lines.

```sh
git clone https://github.com/IgorKramar/secure-password-generator.git
cd secure-password-generator
npm ci
npm run build
npm test
npm run test:package
npm pack
```

`npm ci` installs the locked development dependencies. `npm test` builds before testing. `npm pack` also builds through `prepack`. The package check packs the actual artifact, installs it in a clean temporary project with `--omit=dev`, then checks CommonJS/ESM imports, declarations, the installed CLI and a browser bundle. It removes its temporary directory afterward.

Install the resulting tarball in your application, or globally for the command (replace the path):

```sh
npm install /absolute/path/ts-secure-password-generator-0.0.2.tgz
npm install --global /absolute/path/ts-secure-password-generator-0.0.2.tgz
secure-passgen random --entropy 128
```

After a release containing these changes, registry installation uses `npm install ts-secure-password-generator` or `npm install --global ts-secure-password-generator`.

## Library

```ts
import {
  generateRandomPassword,
  getRandomPasswordInfo,
  generatePassword,
} from 'ts-secure-password-generator';

const random = generateRandomPassword(); // 128-bit target -> 22 characters
const longer = generateRandomPassword({ length: 24 });
const readable = generateRandomPassword({ entropyBits: 129, excludeAmbiguous: true });
const info = getRandomPasswordInfo({ entropyBits: 128 });
// { length: 22, alphabet: 'abc...XYZ0123456789', alphabetSize: 62,
//   entropyBits: 130.99231882851126 } (alphabet abbreviated here)
const legacy = generatePassword('apple', 16);
// Pass passwords to their consumer; do not log production passwords.
```

CommonJS is also supported:

```js
const { generateRandomPassword, generatePassword } = require('ts-secure-password-generator');
```

`generateRandomPassword(options?)` returns a string. `getRandomPasswordInfo(options?)` validates the same options and returns `{ length, alphabet, alphabetSize, entropyBits }` without using randomness. The returned entropy is the calculated value for the resolved length, not the requested target.

| Option | Contract |
| --- | --- |
| `length?: number` | Integer from 1 to 1024; mutually exclusive with `entropyBits` |
| `entropyBits?: number` | Positive integer target; maximum 6097, or 5972 with exclusions |
| `excludeAmbiguous?: boolean` | Default `false`; removes exactly `0O1Il` (zero, uppercase O, one, uppercase I, lowercase l) |
| Neither size option | Target 128 bits; an explicitly `undefined` option counts as absent |

Options must be a plain object; unknown properties, arrays, `null`, wrong value types, fractions, `NaN` and infinities are rejected at runtime, including calls from JavaScript. An explicit short length is allowed: length 1 gives about **5.95 bits**, not 128 bits. Use the policy API below when a custom alphabet or required character sets are needed.

The package exports `RandomPasswordOptions` and `RandomPasswordInfo` types, `RANDOM_ALPHABET`, `AMBIGUOUS_CHARACTERS`, and the limit constants listed below. The internal service and random sampler are not part of the supported public API.

## Alphabet and entropy

The default alphabet is exactly 62 unique ASCII characters, in this order:

```text
abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789
```

With `excludeAmbiguous: true`, it contains **57** characters. Each position is sampled independently and uniformly. There is **no requirement** to include any particular character category; a result containing only lowercase letters is valid.

For this mode only, with length `L` and actual alphabet size `A`:

```text
H = L × log2(A)
L = ceil(targetBits / log2(A))
```

The resolved length must reach the target and fit the maximum length; otherwise generation fails. Rounding tests cover every supported integer target for both alphabets.

| Request | Alphabet size | Length | Calculated entropy |
| --- | ---: | ---: | ---: |
| Default / target 128 | 62 | 22 | 130.99 bits |
| Target 128, exclusions | 57 | 22 | 128.32 bits |
| Target 129 | 62 | 22 | 130.99 bits |
| Target 129, exclusions | 57 | 23 | 134.16 bits |
| Explicit length 16 | 62 | 16 | 95.27 bits |

This model assumes a correct cryptographic source, independent uniform choices and no further filtering or selection. It does not apply to word-based passwords, site policies, or choosing a preferred result from multiple candidates.

## Passphrases

```ts
import { generatePassphrase, getPassphraseInfo, EFF_WORDLIST_INFO } from 'ts-secure-password-generator';

const phrase = generatePassphrase(); // 128-bit target -> 10 words, separated by spaces
const sixWords = generatePassphrase({ wordCount: 6, separator: '_' });
const info = getPassphraseInfo({ entropyBits: 128 });
// wordCount: 10, wordlistSize: 7776, entropyBits: approximately 129.248125
// combinations is an exact bigint; minLength/maxLength bound the character count.
```

Words are selected independently **with replacement** from [EFF's Long Wordlist](https://www.eff.org/dice). Repeated words are valid. The 7776 distinct entries are preserved exactly, including four hyphenated words. There is no case transformation, normalization or filtering. The default separator is one space; `_` and `.` are also supported. These separators occur in no dictionary entry, so every output has an unambiguous word sequence. Empty separators and `-` are rejected.

`wordCount` and `entropyBits` are mutually exclusive positive integers. Neither supplied means a 128-bit target; `undefined` counts as absent. Word counts range from 1 to 32, entropy targets from 1 to 413. For `W` words and dictionary size `D`, `N = D^W` and `H = W × log2(D)`. Six words give about 77.55 bits; ten give about 129.25 bits. Target decisions compare `N` with `2^target` exactly. Character length varies: each word has 3–9 ASCII characters, so 32 words occupy at most 319 characters including separators. This mode does not enforce site character categories.

`getPassphraseInfo()` returns `wordCount`, `wordlistSize`, `separator`, exact `combinations`, approximate `entropyBits`, and character-length `minLength`/`maxLength`. `PassphraseOptions`/`PassphraseInfo` types, immutable `EFF_WORDLIST`/`EFF_WORDLIST_INFO` and `PASSPHRASE_SEPARATORS` are exported. Only the bundled English dictionary is supported in this version; no network request is made during generation.

The original file, SHA-256, attribution and transformation description are included in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Every build checks the source checksum, all dice codes, uniqueness and the generated JSON against that source. `npm run check:wordlist` runs the check independently. EFF's data is CC BY 4.0; the project's code remains MIT.

## Site policies and exact counts

```ts
import { generatePolicyPassword, getPolicyPasswordInfo, PasswordPolicy } from 'ts-secure-password-generator';

const policy: PasswordPolicy = {
  alphabet: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*',
  requiredSets: ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789', '!@#$%^&*'],
  minLength: 12,
  maxLength: 64,
};
const password = generatePolicyPassword(policy, { entropyBits: 128 });
const info = getPolicyPasswordInfo(policy, { entropyBits: 128 });
// length: 21, alphabetSize: 70, entropyBits: approximately 128.537654
// combinations: 493957420278351331015146882126053376000n
```

`PasswordPolicy` has these fields:

| Field | Contract |
| --- | --- |
| `alphabet` | Required string of 1–95 unique printable ASCII characters, U+0020–U+007E |
| `requiredSets?` | At most 8 nonempty strings of unique characters from `alphabet`; at least one character from each set is required |
| `excludeCharacters?` | Unique characters from `alphabet` to remove; default empty string |
| `minLength?` / `maxLength?` | Integers in 1–256, defaults 1 / 256; minimum must not exceed maximum |

`PolicyPasswordOptions` and `PolicyPasswordInfo` types are also exported. Required sets may overlap: one character can satisfy multiple sets. Exclusions are applied before counting, including optional `excludeAmbiguous: true`. The same three size/exclusion options as random mode are accepted by `generatePolicyPassword(policy, options?)` and `getPolicyPasswordInfo(policy, options?)`; the actual policy length bounds apply. `length` and `entropyBits` remain mutually exclusive; the default target is 128. The global policy-target cap is 1681 bits; a smaller alphabet or tighter bounds may make a lower target impossible. Empty alphabets, impossible required sets, unknown fields, duplicate characters, unsupported Unicode and invalid numeric values fail clearly. A singleton alphabet is allowed for explicit lengths with zero entropy; it cannot meet a positive target.

The generator counts **valid complete strings**, using a dynamic-programming table indexed by remaining length and missing required sets. It samples one uniform `BigInt` rank below the exact count, then decodes that rank into a password using the counted completions. It does not generate a candidate and repair its categories. The count includes intersections between required sets. The CLI compiles the table once and reuses it for a batch.

For this mode, `H = log2(N)`, where `N` is the exact number of valid strings at the chosen length. Length selection compares `N >= 2^targetBits` using integers. This matters near boundaries: `2^128 - 1` does not meet 128 bits even if a floating-point logarithm rounds to 128. `getPolicyPasswordInfo` returns `length`, the effective `alphabet`/`alphabetSize`/`requiredSets`, exact `combinations: bigint`, and approximate `entropyBits: number`. Convert `combinations` to a decimal string when serializing to JSON; native `JSON.stringify` does not serialize `bigint`.

The smaller policy length limit bounds the table to at most 65,792 cells. Character-position rules, regular expressions, maximum category counts, repetition restrictions and automatic discovery of a site's rules are not supported. [examples/site-policy.json](examples/site-policy.json) is an illustrative policy, not a promise about any named site's current requirements. Enumeration tests compare counts and every rank against independently generated small spaces; this is not a formal proof.

## Existing word-based API and Unicode

`generatePassword(word: string, length: number): string` remains available. For nonempty, bounded ASCII inputs it keeps the existing behavior:

1. Randomize the case of the word's letters.
2. Add a character from `!@#$%^&*`, a digit and an uppercase Latin letter if the respective category is missing.
3. Fill to the requested length using those special characters, digits and Latin letters.
4. Shuffle with Fisher–Yates, retaining every original character and its multiplicity, ignoring letter case.

The word is **not a random seed**. A user-chosen word introduces predictable structure; this mode is not uniform over all strings and receives **no entropy estimate**. Lowercase letters are not a required category.

**Unicode contract:** the word must contain 1–1020 ASCII characters, U+0000 through U+007F. Length counts ASCII characters (equivalently UTF-16 code units and Unicode code points for this subset). Cyrillic, emoji, `ß`, combining marks and malformed surrogate sequences are rejected clearly. There is no normalization, transliteration or multi-character case expansion. The library preserves ASCII control characters for compatibility; the interactive CLI accepts only printable ASCII, U+0020 through U+007E.

The requested length must be an integer at least `word.length + 4` and at most 1024. Empty words, invalid types, non-finite/fractional lengths and excessive requests now fail instead of producing malformed output or looping. This is an intentional tightening of previously unchecked inputs. Random indices and case choices now use unbiased selection, so exact outputs or previous biased distributions are not preserved.

## CLI

```sh
secure-passgen random --length 24
secure-passgen random --length 20 --count 5
secure-passgen random --length 16 --exclude-ambiguous
secure-passgen random --entropy 128
secure-passgen random                           # default target: 128 bits
secure-passgen passphrase --entropy 128
secure-passgen passphrase --words 6 --separator _ --count 5
secure-passgen random --policy examples/site-policy.json --entropy 128
secure-passgen --help
secure-passgen from-word                        # interactive legacy mode
secure-passgen                                  # interactive mode selection
```

Random and passphrase commands work without a terminal. `--policy` reads a regular UTF-8 JSON file of at most 16 KiB; its path and contents are not repeated in errors. The example path above is relative to a repository checkout; pass your own file path when using an installed command. Successful generation writes **only passwords, one per line, to stdout**, ending with a newline. Prompts and errors go to stderr. Help goes to stdout. Exit codes are 0 for success/help, 1 for invalid input or generation failure/EOF, and 130 for interactive Ctrl+C. A batch is generated before any passwords are printed, so a generation error does not print a partial batch.

Options use separate values (`--length 24`), not `--length=24`. All numeric options accept decimal integers only. Values such as `16abc`, `16.5`, `1e2`, signs and surrounding whitespace are rejected. Unknown/duplicate options, missing values, positional extras and `--length` together with `--entropy` also fail. The default count is 1; `--count` applies to random and passphrase modes. `--words` conflicts with `--entropy`; passphrase does not accept `--length`, `--exclude-ambiguous` or `--policy`.

With no arguments, a terminal on **stdin and stderr** is required. Choose `random` (default), `passphrase` or `from-word`. Random prompts for length (blank means a 128-bit target), count and ambiguous-character exclusion. Passphrase prompts for word count (blank means 128 bits), result count and separator. From-word prompts for the base word and length; it is also available directly with `secure-passgen from-word`. Ctrl+C cancels and Ctrl+D/EOF ends input without hanging. Running either interactive entry point outside a terminal fails immediately with usage guidance; stdout can be redirected while input and prompts remain in the terminal.

The base word is visible while typed. Password output can remain in terminal scrollback or recordings, and redirected output can persist on disk. The program does not log passwords, store them in a file itself, or include input values in error messages. Do not enter personal secrets as base words.

## Randomness and resource limits

All modes use **`globalThis.crypto.getRandomValues`** exclusively. There is no fallback to `Math.random`, time, a supplied word or any predictable seed. An unavailable or failing cryptographic source produces a clear error.

For an index range `n`, the sampler reads an unsigned 32-bit value `x`, computes `cutoff = 2^32 - (2^32 mod n)`, rejects `x >= cutoff`, then returns `x mod n`. The accepted interval contains an equal number of values for every index. The same sampler serves character and word selection, case choices and shuffle indices. See also [Node.js `crypto.randomInt`](https://nodejs.org/api/crypto.html#cryptorandomintmin-max-callback) for the standard requirement to avoid modulo bias.

Requests are buffered in 256 unsigned 32-bit values (**1024 bytes**), below the Web Crypto limit of **65,536 bytes per call**. A limit of 128 draws per index makes a persistently rejecting broken source fail closed; no biased fallback is used. For the character/word/shuffle ranges used here, rejection probability per draw is below `7776 / 2^32`. Policy ranks assemble at most 2048 bits from this same source, mask unused high bits and reject ranks outside the valid count. Rank rejection probability is below one half per attempt and retries are capped at 128.

| Exported constant | Value / use |
| --- | --- |
| `MIN_PASSWORD_LENGTH` | 1, random mode |
| `MAX_PASSWORD_LENGTH` | 1024, random and from-word |
| `WORD_LENGTH_OVERHEAD` | 4 |
| `MAX_WORD_LENGTH` | 1020 |
| `MAX_PASSWORD_COUNT` | 100, CLI batch; at most 102,400 password characters per invocation |
| `DEFAULT_ENTROPY_BITS` | 128 |
| `MAX_ENTROPY_BITS` | 6097 for the 62-character alphabet; exclusions lower the effective maximum to 5972 |
| `MAX_PASSPHRASE_WORDS` / `MAX_PASSPHRASE_ENTROPY_BITS` | 32 words / 413 bits |
| `MAX_POLICY_PASSWORD_LENGTH` / `MAX_POLICY_REQUIRED_SETS` | 256 characters / 8 required sets |
| `MAX_POLICY_ALPHABET_SIZE` / `MAX_POLICY_ENTROPY_BITS` | 95 characters / 1681 bits |
| `MAX_POLICY_TABLE_CELLS` | 65,792 |

These practical limits bound allocation and generation work; they are not security recommendations. A one-character password is valid input but not a suitable security target.

## Environments and verification

The library entry point is CommonJS with TypeScript declarations and supports named imports from Node ESM. Browser consumers need a CommonJS-capable bundler, Web Crypto and ES2022 support (or appropriate transpilation); the core has no Node imports. The package smoke check uses esbuild and a context exposing only Web Crypto, without `process`, `require` or `Buffer`. This is a compatibility check, not a real-browser end-to-end test. There is no standalone browser bundle or browser UI.

CI runs `npm ci`, build, tests and the package check on pull requests, pushes to `main`, and manual dispatch. The release workflow performs build, tests and packaging checks before `npm publish`. Merging a development PR does not publish a package or create a release tag.

Tests use controlled random sequences to check acceptance/rejection and transformations, plus runtime/API/CLI checks. They do not require two generated passwords to differ and do not infer correctness from small-sample statistics. The project has **not been cryptographically audited or formally verified**. It cannot protect passwords on a compromised device.

See [stage-one verification](docs/stage-one-verification.md) and [stage-two verification](docs/stage-two-verification.md) for the baseline, checks and remote CI evidence. Further work includes device-profile experiments, additional dictionaries/policy rules, LLM experiments, formal proofs, a browser sandbox and storage.

## Code map

| Location | Purpose |
| --- | --- |
| [src/index.ts](src/index.ts) | Supported library exports |
| [src/domain/](src/domain/) | Validation, limits, sampling, word/random/passphrase/policy generation, entropy |
| [src/cli/](src/cli/) | Argument parsing, terminal interaction and output |
| [tests/](tests/) | Jest API, sampler and CLI tests |
| [scripts/check-package.cjs](scripts/check-package.cjs) | Installed-artifact checks |

Code: [MIT](LICENSE.md) · Copyright © 2024 Igor Kramar. Dictionary: [EFF, CC BY 4.0](THIRD_PARTY_NOTICES.md).
