<div align="center">

# Secure Password Generator

**English** · [Русский](README.ru.md)

### A word in. A mixed password out.

TypeScript library · interactive Node.js CLI · Web Crypto

[![npm](https://img.shields.io/npm/v/ts-secure-password-generator?style=flat-square&color=7aa2f7)](https://www.npmjs.com/package/ts-secure-password-generator)
[![MIT](https://img.shields.io/badge/license-MIT-9ece6a?style=flat-square)](LICENSE.md)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)

[Install](#install) · [Library](#library) · [CLI](#cli) · [Limits](#security-and-runtime-limits) · [Development](#development)

</div>

Start with a word, mix its letter case, add characters and shuffle the result. The package exposes one function and an interactive command. Its published npm name is **`ts-secure-password-generator`**; the repository name is different.

## Install

Use a current supported Node.js release with global `crypto.getRandomValues` available.

```sh
# Library
npm install ts-secure-password-generator

# Interactive CLI
npm install --global ts-secure-password-generator
secure-passgen
```

## Library

```ts
import { generatePassword } from 'ts-secure-password-generator';

const password = generatePassword('apple', 16);
// Use the result where needed; do not log production passwords.
```

CommonJS:

```js
const { generatePassword } = require('ts-secure-password-generator');
const password = generatePassword('apple', 16);
```

| Argument | Meaning |
|:---|:---|
| `word: string` | Base word whose characters are case-mixed and retained in the result |
| `length: number` | Desired length; use a finite integer at least `word.length + 4` |
| Return value | A password string; throws if the requested length is too short |

The public entry point exports **`generatePassword`**, not the internal `PasswordService` class. For predictable character counts, use ASCII input. The implementation mixes UTF-16 string lengths, code points and Unicode case conversion; exact lengths are not guaranteed for arbitrary Unicode input.

## CLI

Run `secure-passgen`, enter a base word, then enter the desired length. The CLI prints the generated password to the terminal. Input is visible; the result remains in terminal scrollback. There are no non-interactive command-line options.

## How generation works

1. Randomize the case of each character in the base word.
2. Add a special character from `!@#$%^&*`, a digit and an uppercase letter when missing.
3. Fill the requested length with letters, digits and special characters.
4. Shuffle using Fisher–Yates.

## Security and runtime limits

- Random bytes come from `crypto.getRandomValues`. Character selection uses modulo reduction, which introduces bias; this is not an audited password generator or a claim of uniform output.
- A supplied word contributes predictable structure. Password length alone does not establish entropy. Do not use a personal secret as the base word.
- Validate library input yourself: a finite integer length and a practical maximum are required. The library does not comprehensively reject `NaN`, infinity, fractions or excessive lengths.
- The npm entry point is CommonJS with TypeScript declarations. Browser use requires a compatible bundler and Web Crypto; no standalone browser bundle is provided.
- The CLI does not store passwords in a file, but terminal recording or scrollback may retain its output.

## Development

```sh
git clone https://github.com/IgorKramar/secure-password-generator.git
cd secure-password-generator
npm ci
npm run build
npm test
node dist/cli.js
```

`npm ci` also runs the package's `prepare` script, which builds the TypeScript source.

| Location | Purpose |
|:---|:---|
| [src/index.ts](src/index.ts) | Public library export |
| [src/domain/password.ts](src/domain/password.ts) | Generation and random selection |
| [src/application/passwordService.ts](src/application/passwordService.ts) | Internal service |
| [src/cli.ts](src/cli.ts) | Interactive command |
| [tests/](tests/) | Jest tests |

## License

[MIT](LICENSE.md) · Copyright © 2024 Igor Kramar.
