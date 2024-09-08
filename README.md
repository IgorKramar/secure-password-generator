# Secure Password Generator

`secure-password-generator` is a TypeScript library and CLI tool that generates secure passwords based on user-provided words. The package is focused on security and flexibility, adding symbols, numbers, and special characters to create complex and strong passwords.

## Features

- **Library Usage**: Integrate password generation into your TypeScript or JavaScript projects.
- **CLI Application**: Generate passwords directly from the command line.
- **Cryptographically Secure**: Uses cryptographically secure random numbers for password generation.
- **Customization**: Allows you to customize the base word and password length.
- **Cross-Environment**: Works seamlessly in both server-side (Node.js) and client-side (browser) environments.

## Installation

### As a Library

To install it as a library in your project, use npm:

```bash
npm install secure-password-generator
```

### As a CLI Tool

To install the package globally and use it as a CLI tool, run:

```bash
npm install -g secure-password-generator
```

## Usage

### Library

#### Import the Package

First, import the package into your project:

```typescript
import { PasswordService } from 'secure-password-generator';

const userWord = "apple";
const passwordLength = 12;

const password = PasswordService.generatePassword(userWord, passwordLength);
console.log(`Generated password: ${password}`);
```

#### Functions

- **`generatePassword(word: string, length: number): string`**: Generates a secure password based on the provided word and desired length. It randomly mixes character cases, adds special symbols and numbers, and shuffles the result to increase security.

### CLI

After installing the package globally, you can use the `secure-passgen` command to generate passwords.

#### Basic Usage

```bash
secure-passgen
```

#### Interactive Prompt

The CLI tool will prompt you to enter a base word and the desired password length:

```bash
$ secure-passgen
Secure Password Generator CLI
==============================

Enter a base word: apple
Enter desired password length: 12

Generated Password: App1e!23xYz
```

Currently, the CLI operates interactively, but future versions may include command-line options for non-interactive usage.

## Password Generation Rules

- **User Word Transformation**: The user's base word is randomly transformed with mixed character cases (uppercase and lowercase).
- **Character Addition**: Symbols, numbers, and additional letters (uppercase and lowercase) are added to the word to meet the desired password length.
- **Cryptographically Secure**: The password is generated using cryptographically secure random numbers for improved security.
- **Shuffling**: The generated password is shuffled to increase complexity and randomness.

## Testing

The project uses Jest for testing. To run the tests, use the following command:

```bash
npm test
```

## License

[MIT License](./LICENSE.md).