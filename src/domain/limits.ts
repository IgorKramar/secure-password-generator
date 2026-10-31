/** Resource limits shared by the library and CLI. All lengths count ASCII characters. */
export const MIN_PASSWORD_LENGTH = 1;
export const MAX_PASSWORD_LENGTH = 1024;
export const WORD_LENGTH_OVERHEAD = 4;
export const MAX_WORD_LENGTH = MAX_PASSWORD_LENGTH - WORD_LENGTH_OVERHEAD;
export const MAX_PASSWORD_COUNT = 100;
export const DEFAULT_ENTROPY_BITS = 128;

export function requireInteger(value: unknown, name: string, min: number, max: number): asserts value is number {
  if (typeof value !== 'number') throw new TypeError(`${name} must be a number`);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite integer between ${min} and ${max}`);
  }
}
