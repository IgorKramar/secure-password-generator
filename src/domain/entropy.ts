import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, requireInteger } from './limits';

/** Internal helpers accept an alphabet size, after exclusions and deduplication. */
export function entropyForLength(length: number, alphabetSize: number): number {
  requireInteger(length, 'Length', MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH);
  requireInteger(alphabetSize, 'Alphabet size', 2, 128);
  return length * Math.log2(alphabetSize);
}

export function lengthForEntropy(entropyBits: number, alphabetSize: number): number {
  requireInteger(alphabetSize, 'Alphabet size', 2, 128);
  const bitsPerCharacter = Math.log2(alphabetSize);
  requireInteger(entropyBits, 'Entropy bits', 1, Math.floor(MAX_PASSWORD_LENGTH * bitsPerCharacter));
  let length = Math.ceil(entropyBits / bitsPerCharacter);
  // Guard floating-point division at a boundary; reported entropy must reach the target.
  if (length * bitsPerCharacter < entropyBits) length++;
  if (length > 1 && (length - 1) * bitsPerCharacter >= entropyBits) length--;
  if (length > MAX_PASSWORD_LENGTH) throw new RangeError('Entropy target exceeds the maximum password length');
  return length;
}
