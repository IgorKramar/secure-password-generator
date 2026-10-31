const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

export function replaceCrypto(value: unknown): void {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value });
}

export function restoreCrypto(): void {
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  else Reflect.deleteProperty(globalThis, 'crypto');
}

/** Test-only controlled source. Production exposes no provider/seed injection. */
export function mockRandomWords(words: readonly number[] = [], fallback = 0): jest.Mock {
  let cursor = 0;
  const getRandomValues = jest.fn((array: Uint32Array) => {
    for (let i = 0; i < array.length; i++) array[i] = words[cursor++] ?? fallback;
    return array;
  });
  replaceCrypto({ getRandomValues });
  return getRandomValues;
}
