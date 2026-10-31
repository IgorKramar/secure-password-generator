export function requireOptions(value: unknown, name: string, keys: readonly string[]): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype) throw new TypeError(`${name} must be a plain object`);
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key))) {
    throw new TypeError(`Unknown ${name} option`);
  }
}
