'use strict';
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const raw = readFileSync(join(root, 'data/eff-large-wordlist.txt'));
assert.equal(createHash('sha256').update(raw).digest('hex'),
  'addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e', 'The vendored EFF source changed');
const rows = raw.toString('ascii').trimEnd().split('\n').map(line => line.split(/\s+/));
assert.equal(rows.length, 7776);
const words = rows.map(([code, word, extra], index) => {
  const expectedCode = index.toString(6).padStart(5, '0').split('').map(digit => Number(digit) + 1).join('');
  assert.equal(code, expectedCode, 'Invalid dice-code order');
  assert.equal(extra, undefined);
  assert(/^[a-z]+(?:-[a-z]+)?$/.test(word), 'Unexpected word spelling');
  return word;
});
assert.equal(new Set(words).size, 7776, 'Dictionary entries must be unique');
assert.equal(Math.min(...words.map(word => word.length)), 3);
assert.equal(Math.max(...words.map(word => word.length)), 9);
assert.deepEqual(JSON.parse(readFileSync(join(root, 'src/data/eff-words.json'), 'utf8')), words,
  'Bundled dictionary must preserve the source words and order');
// Keep npm pack --json stdout parseable when this runs from prepack.
console.error('EFF dictionary verified: original SHA-256, 7776 unique entries, unchanged spelling/order.');
