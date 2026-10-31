import { requireInteger } from './limits';

const UINT32_RANGE = 0x1_0000_0000;
// 1 KiB per refill, well below Web Crypto's 65,536-byte request limit.
export const RANDOM_BUFFER_WORDS = 256;
// Fail closed if a broken source keeps returning rejected values.
export const MAX_RANDOM_ATTEMPTS = 128;

export class RandomSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RandomSourceError';
  }
}

/** Internal sampler. Production callers cannot inject a seed or random provider. */
export function createRandomIndex(): (maxExclusive: number) => number {
  const source = globalThis.crypto;
  if (!source || typeof source.getRandomValues !== 'function') {
    throw new RandomSourceError('Web Crypto getRandomValues is unavailable; a cryptographic random source is required');
  }
  const buffer = new Uint32Array(RANDOM_BUFFER_WORDS);
  let cursor = buffer.length;

  return (maxExclusive: number): number => {
    requireInteger(maxExclusive, 'Random index range', 1, UINT32_RANGE);
    const cutoff = UINT32_RANGE - (UINT32_RANGE % maxExclusive);
    for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt++) {
      if (cursor === buffer.length) {
        try {
          source.getRandomValues(buffer);
        } catch {
          // Do not expose provider diagnostics, which could contain sensitive data.
          throw new RandomSourceError('Web Crypto could not provide cryptographic random values');
        }
        cursor = 0;
      }
      const value = buffer[cursor++];
      // The accepted interval contains exactly the same number of values per index.
      if (value < cutoff) return value % maxExclusive;
    }
    throw new RandomSourceError('Cryptographic random source exceeded the rejection limit');
  };
}
