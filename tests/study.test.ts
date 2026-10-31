import { formatInfo, generateStimulus, planTrials, Trial, PROTOCOL, LEGACY_PROTOCOL, TRIAL_LIMIT_MS, StudySession, validateSession, summarize, analyzeSession, editDistance } from '../research/mobile-input/model';
import mobilePolicy from '../examples/mobile-lowercase-policy.json';
import { getPolicyPasswordInfo } from '../src';

function session(): StudySession {
  const plan = planTrials(1);
  const trials = plan.map((p, i) => {
    const target = 'a'.repeat(formatInfo(p.condition).minLength);
    const trial = new Trial(target, p, i, 1000);
    trial.input('insertText', 1001, true);
    return { ...trial.submit(target, 2000)!, ease: 4 };
  });
  return { protocol: LEGACY_PROTOCOL, build: 'a'.repeat(64), participant: 1,
    environment: { device: 'synthetic', os: 'test', browser: 'test', keyboard: 'test', layout: 'test', technique: 'test', englishFamiliarity: 'basic' }, trials };
}

describe('mobile study protocol', () => {
  test('all six orders balance each condition in every measured position and block', () => {
    const first = new Set<string>();
    for (let participant = 1; participant <= 6; participant++) {
      const plan = planTrials(participant);
      expect(plan).toHaveLength(12);
      expect(plan.filter(t => t.practice)).toHaveLength(3);
      first.add(plan.slice(0, 3).map(t => t.condition).join(','));
      for (const condition of ['random62', 'lower25', 'eff10']) {
        const indices = plan.flatMap((t, i) => !t.practice && t.condition === condition ? [i] : []);
        expect(indices).toHaveLength(3);
        expect(new Set(indices.map(i => i % 3)).size).toBe(3);
        expect(new Set(indices.map(i => plan[i].block)).size).toBe(3);
      }
    }
    expect(first.size).toBe(6);
    expect(planTrials(7)).toEqual(planTrials(1));
  });
  test.each([0, -1, 1000, NaN, Infinity, 1.2, '1', null])('rejects invalid participant %p', value => {
    expect(() => planTrials(value as number)).toThrow();
  });
  test('three fixed conditions reach 128 bits; the mobile alphabet is counted after exclusion', () => {
    expect(mobilePolicy.alphabet).toBe('abcdefghijkmnopqrstuvwxyz');
    expect(formatInfo('random62').minLength).toBe(22);
    expect(formatInfo('lower25').minLength).toBe(28);
    expect(formatInfo('eff10').entropyBits).toBe(10 * Math.log2(7776));
    const info = getPolicyPasswordInfo(mobilePolicy, { entropyBits: 128 });
    expect(info.combinations).toBe(25n ** 28n);
    expect(25n ** 27n).toBeLessThan(1n << 128n);
    for (const condition of ['random62', 'lower25', 'eff10'] as const) {
      expect(formatInfo(condition).entropyBits).toBeGreaterThanOrEqual(128);
      expect(formatInfo(condition).entropyBits).toBeLessThan(132);
    }
  });
  test('generation uses the built library and preserves all three format contracts', () => {
    expect(generateStimulus('random62')).toMatch(/^[A-Za-z0-9]{22}$/);
    expect(generateStimulus('lower25')).toMatch(/^[a-km-z]{28}$/);
    expect(generateStimulus('eff10').split(' ')).toHaveLength(10);
    expect(() => generateStimulus('unknown' as never)).toThrow();
  });
  test('distance counts substitutions, additions and deletions without normalization', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('a ', 'a')).toBe(1);
    expect(editDistance('A', 'a')).toBe(1);
    expect(editDistance('', 'abc')).toBe(3);
    expect(() => editDistance('x'.repeat(513), '')).toThrow();
  });
  test('controlled timestamps distinguish correction counts and elapsed times', () => {
    const target = 'a'.repeat(22);
    const trial = new Trial(target, planTrials(1)[0], 0, 100);
    trial.input('insertText', 110, true);
    expect(trial.submit('b'.repeat(22), 120)).toBeNull();
    trial.input('deleteContentBackward', 130, true);
    const result = trial.submit(target, 160)!;
    expect(result).toMatchObject({ status: 'correct', firstInputMs: 10, firstSubmitMs: 20,
      elapsedMs: 60, firstAttemptDistance: 22, wrongSubmissions: 1, inputEvents: 2, deleteEvents: 1, flags: [] });
    expect(JSON.stringify(result)).not.toContain(target);
    expect(() => trial.submit(target, 170)).toThrow();
  });
  test('at the deadline a correct submission is still a timeout', () => {
    const trial = new Trial('a'.repeat(22), planTrials(1)[0], 0, 1000);
    expect(trial.submit('a'.repeat(22), 1000 + TRIAL_LIMIT_MS)).toMatchObject({ status: 'timeout',
      elapsedMs: TRIAL_LIMIT_MS, firstAttemptDistance: null });
  });
  test('background and assisted input stay flagged, even when an attempt is completed', () => {
    const trial = new Trial('a'.repeat(22), planTrials(1)[0], 0, 0);
    trial.flag('backgrounded'); trial.flag('backgrounded'); trial.flag('paste-or-drop');
    trial.input('insertReplacementText', 10, false);
    trial.input('insertCompositionText', 11, true);
    expect(trial.submit('a'.repeat(22), 20)!.flags).toEqual(['backgrounded', 'paste-or-drop', 'replacement', 'untrusted-input', 'composition']);
  });
  test('summary excludes practice and flags, reports attrition and missing trials separately', () => {
    const data = session();
    data.trials[3].flags = ['backgrounded'];
    data.trials[4].status = 'skipped'; data.trials[4].firstAttemptDistance = null; data.trials[4].firstSubmitMs = null;
    data.trials[5].status = 'timeout'; data.trials[5].elapsedMs = TRIAL_LIMIT_MS;
    data.trials[5].firstAttemptDistance = null; data.trials[5].firstSubmitMs = null;
    data.trials.pop();
    const report = summarize(validateSession(data));
    expect(report[0]).toMatchObject({ scheduled: 3, recorded: 3, flagged: 1, completed: 2, medianCompletionMs: 1000 });
    expect(report[1]).toMatchObject({ scheduled: 3, recorded: 2, completed: 1, skipped: 1 });
    expect(report[2]).toMatchObject({ completed: 2, timedOut: 1 });
  });
  test('empty or partial sessions validate and do not acquire artificial measurements', () => {
    const data = session(); data.trials = [];
    expect(validateSession(data)).toBe(data);
    expect(summarize(data).every(r => r.recorded === 0 && r.medianCompletionMs === null)).toBe(true);
  });
  test('v1 all-composition data keep zero primary eligibility and a separate diagnostic', () => {
    const data = session();
    data.trials.forEach(t => { t.flags = ['composition']; });
    data.trials[10].status = 'skipped';
    data.trials[10].firstAttemptDistance = 2; data.trials[10].wrongSubmissions = 3;
    const before = JSON.stringify(data);
    const report = analyzeSession(validateSession(data));
    expect(report.conditions.every(c => c.eligible === 0 && c.medianCompletionMs === null)).toBe(true);
    expect(report.conditions[0]).toMatchObject({ flagged: 3, excluded: 3, observedCompleted: 2, observedSkipped: 1 });
    expect(report.compositionSensitivity!.conditions[0]).toMatchObject({ flagged: 3, excluded: 0, eligible: 3,
      completed: 2, skipped: 1, attempted: 3, firstAttemptErrors: 1, wrongSubmissions: 3, medianCompletionMs: 1000 });
    expect(report.quality.flagCounts.composition).toBe(9);
    expect(report.quality.warnings).toContain('No measured trials are eligible under mobile-input-v1.');
    expect(JSON.stringify(data)).toBe(before);
  });
  test('composition sensitivity never admits another flag or a practice trial', () => {
    const data = session();
    data.trials.forEach(t => { t.flags = ['composition']; });
    data.trials[3].flags.push('backgrounded');
    data.trials[6].flags.push('replacement');
    data.trials[9].flags.push('paste-or-drop');
    const report = analyzeSession(data).compositionSensitivity!;
    expect(report.conditions.every(c => c.recorded === 3 && c.eligible === 2 && c.excluded === 1)).toBe(true);
  });
  test('v2 permits composition only with explicit off settings and per-trial taps', () => {
    const data = session(); data.protocol = PROTOCOL;
    data.inputSettings = { autocorrect: 'off', predictions: 'off', gesture: 'off' };
    data.trials.forEach(t => { t.flags = ['composition']; t.inputMethod = 'taps'; });
    expect(analyzeSession(validateSession(data)).quality.eligible).toBe(9);
    expect(analyzeSession(data).compositionSensitivity).toBeNull();
    data.trials[3].inputMethod = 'assisted';
    data.trials[6].inputMethod = 'unknown';
    data.trials[9].flags.push('untrusted-input');
    const report = analyzeSession(validateSession(data));
    expect(report.quality.eligible).toBe(6);
    expect(report.quality.inputMethodCounts).toEqual({ taps: 7, assisted: 1, unknown: 1 });
    expect(report.conditions.every(c => c.eligible === 2)).toBe(true);
    data.inputSettings.gesture = 'on';
    expect(analyzeSession(validateSession(data)).quality.eligible).toBe(0);
    data.inputSettings.gesture = 'unknown';
    expect(analyzeSession(validateSession(data)).quality.eligible).toBe(0);
  });
  test('a legacy export cannot be silently relabeled v2 or acquire new fields', () => {
    const data = session(); data.protocol = PROTOCOL;
    expect(() => validateSession(data)).toThrow();
    data.inputSettings = { autocorrect: 'off', predictions: 'off', gesture: 'off' };
    expect(() => validateSession(data)).toThrow();
    data.trials.forEach(t => { t.inputMethod = 'taps'; });
    expect(validateSession(data)).toBe(data);
    data.protocol = LEGACY_PROTOCOL;
    expect(() => validateSession(data)).toThrow();
  });
  test('v2 rejects malformed settings and unknown per-trial methods', () => {
    const data = session(); data.protocol = PROTOCOL;
    data.trials.forEach(t => { t.inputMethod = 'taps'; });
    for (const invalid of [null, [], {}, { autocorrect: 'off', predictions: 'off', gesture: true },
      { autocorrect: 'off', predictions: 'off', gesture: 'off', extra: 'off' }]) {
      data.inputSettings = invalid as never;
      expect(() => validateSession(data)).toThrow('Invalid study result');
    }
    data.inputSettings = { autocorrect: 'off', predictions: 'off', gesture: 'off' };
    data.trials[0].inputMethod = 'swipe' as never;
    expect(() => validateSession(data)).toThrow('Invalid study result');
  });
  test.each([
    (d: any) => { d.password = 'DO-NOT-ECHO'; },
    (d: any) => { d.trials[0].target = 'DO-NOT-ECHO'; },
    (d: any) => { d.trials[0].condition = 'unknown'; },
    (d: any) => { d.trials[0].elapsedMs = Infinity; },
    (d: any) => { d.trials[0].deleteEvents = 100; },
    (d: any) => { d.trials[0].firstInputMs = -1; },
    (d: any) => { d.trials[0].firstSubmitMs = null; },
    (d: any) => { d.trials[0].entropyBits = 128; },
    (d: any) => { d.trials[0].status = 'timeout'; },
    (d: any) => { d.trials[0].firstAttemptDistance = 1; },
    (d: any) => { d.trials[0].ease = 8; },
    (d: any) => { d.trials[0].reportedSwitches = -1; },
    (d: any) => { d.environment.device = ''; },
    (d: any) => { d.environment.extra = 'DO-NOT-ECHO'; },
    (d: any) => { d.participant = 1.5; },
    (d: any) => { d.build = 'main'; },
    (d: any) => { d.trials.reverse(); },
  ])('rejects malformed or inconsistent result without echoing content', mutate => {
    const data = session(); mutate(data);
    expect(() => validateSession(data)).toThrow('Invalid study result');
    try { validateSession(data); } catch (e) { expect(String(e)).not.toContain('DO-NOT-ECHO'); }
  });
});
