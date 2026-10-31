'use strict';
const { openSync, fstatSync, readSync, closeSync, constants } = require('node:fs');
const { createHash } = require('node:crypto');
const { validateSession, analyzeSession } = require('../.study/model.cjs');
const paths = process.argv.slice(2);
try {
  if (paths.length < 1 || paths.length > 100) throw new Error();
  const seen = new Set();
  const reports = paths.map(path => {
    const fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    let bytes;
    try {
      if (!fstatSync(fd).isFile()) throw new Error();
      const buffer = Buffer.alloc(128 * 1024 + 1);
      let size = 0;
      while (size < buffer.length) {
        const count = readSync(fd, buffer, size, buffer.length - size, null);
        if (!count) break;
        size += count;
      }
      if (size > 128 * 1024) throw new Error();
      bytes = buffer.subarray(0, size);
    } finally { closeSync(fd); }
    const session = validateSession(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
    if (seen.has(session.participant)) throw new Error();
    seen.add(session.participant);
    return { protocol: session.protocol, participant: session.participant, build: session.build, environment: session.environment,
      ...(session.inputSettings ? { inputSettings: session.inputSettings } : {}),
      complete: session.trials.length === 12 && session.trials.every(t => t.ease !== null),
      inputSha256: createHash('sha256').update(bytes).digest('hex'), ...analyzeSession(session) };
  });
  if (new Set(reports.map(r => r.build)).size !== 1) throw new Error();
  if (new Set(reports.map(r => r.protocol)).size !== 1) throw new Error();
  process.stdout.write(JSON.stringify({ protocol: reports[0].protocol, analysisVersion: '2.0',
    interpretation: 'conditions follows each session protocol: v1 excludes every flag; v2 requires reported settings off and taps, allowing composition alone. Legacy compositionSensitivity is a separate post-hoc diagnostic, not a confirmatory result. Descriptive within-person summaries only; no pooled speedup or significance claim.', participants: reports }, null, 2) + '\n');
} catch {
  process.stderr.write('Cannot analyze study results: supply 1–100 regular UTF-8 JSON files (at most 128 KiB each), with valid exports, unique participant numbers and the same protocol/build. File paths and contents are not echoed.\n');
  process.exitCode = 1;
}
