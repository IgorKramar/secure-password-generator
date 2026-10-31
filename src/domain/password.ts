import { MAX_PASSWORD_LENGTH, MAX_WORD_LENGTH, WORD_LENGTH_OVERHEAD, requireInteger } from './limits';
import { createRandomIndex } from './random';

export class PasswordGenerator {
  private static readonly SPECIAL_CHARS = '!@#$%^&*';
  private static readonly NUMBERS = '0123456789';
  private static readonly LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  private static readonly UPPERCASE = PasswordGenerator.LOWERCASE.toUpperCase();

  constructor(private readonly userWord: string) {
    if (typeof userWord !== 'string') throw new TypeError('Word must be a string');
    if (userWord.length < 1 || userWord.length > MAX_WORD_LENGTH) {
      throw new RangeError(`Word must contain between 1 and ${MAX_WORD_LENGTH} ASCII characters`);
    }
    // ASCII case conversion preserves length. Reject Unicode, including lone surrogates.
    if (/[^\x00-\x7F]/.test(userWord)) {
      throw new RangeError('Word must contain only ASCII characters (U+0000 to U+007F)');
    }
  }

  /** Retains the word's characters (ignoring case), adds missing categories and shuffles. */
  generate(length: number): string {
    requireInteger(length, 'Length', 1, MAX_PASSWORD_LENGTH);
    if (length < this.userWord.length + WORD_LENGTH_OVERHEAD) {
      throw new RangeError('Password must be at least 4 characters longer than the user word');
    }
    const randomIndex = createRandomIndex();
    const pick = (alphabet: string): string => alphabet[randomIndex(alphabet.length)];
    const chars = this.userWord.split('').map(char => randomIndex(2) === 1 ? char.toUpperCase() : char.toLowerCase());

    for (const category of [PasswordGenerator.SPECIAL_CHARS, PasswordGenerator.NUMBERS, PasswordGenerator.UPPERCASE]) {
      if (!chars.some(char => category.includes(char))) chars.push(pick(category));
    }
    const alphabet = PasswordGenerator.SPECIAL_CHARS + PasswordGenerator.NUMBERS +
      PasswordGenerator.LOWERCASE + PasswordGenerator.UPPERCASE;
    while (chars.length < length) chars.push(pick(alphabet));

    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  }
}
