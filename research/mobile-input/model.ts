// Exercise the built library. This research tool is not part of its public API.
import { generateRandomPassword, getRandomPasswordInfo, generatePassphrase, getPassphraseInfo,
  generatePolicyPassword, getPolicyPasswordInfo } from '../../dist/index';
import mobilePolicy from '../../examples/mobile-lowercase-policy.json';

export const PROTOCOL = 'mobile-input-v1';
export const TARGET_BITS = 128;
export const TRIAL_LIMIT_MS = 300_000;
export const CONDITIONS = ['random62', 'lower25', 'eff10'] as const;
export type Condition = typeof CONDITIONS[number];
export interface PlannedTrial { condition: Condition; practice: boolean; block: number }

const permutations: readonly (readonly Condition[])[] = [
  ['random62', 'lower25', 'eff10'], ['random62', 'eff10', 'lower25'],
  ['lower25', 'random62', 'eff10'], ['lower25', 'eff10', 'random62'],
  ['eff10', 'random62', 'lower25'], ['eff10', 'lower25', 'random62'],
];

/** Sequential anonymous participant number selects one of six predeclared orders. */
export function planTrials(participant: number): PlannedTrial[] {
  if (!Number.isInteger(participant) || participant < 1 || participant > 999) throw new RangeError('Participant must be 1–999');
  const order = permutations[(participant - 1) % permutations.length];
  const trials = order.map(condition => ({ condition, practice: true, block: 0 }));
  for (let block = 1; block <= 3; block++) {
    for (let position = 0; position < 3; position++) {
      trials.push({ condition: order[(position + block - 1) % 3], practice: false, block });
    }
  }
  return trials;
}

export function formatInfo(condition: Condition) {
  switch (condition) {
    case 'random62': {
      const info = getRandomPasswordInfo({ entropyBits: TARGET_BITS });
      return { entropyBits: info.entropyBits, minLength: info.length, maxLength: info.length };
    }
    case 'lower25': {
      const info = getPolicyPasswordInfo(mobilePolicy, { entropyBits: TARGET_BITS });
      return { entropyBits: info.entropyBits, minLength: info.length, maxLength: info.length };
    }
    case 'eff10': {
      const info = getPassphraseInfo({ entropyBits: TARGET_BITS });
      return { entropyBits: info.entropyBits, minLength: info.minLength, maxLength: info.maxLength };
    }
    default: throw new TypeError('Unknown study condition');
  }
}

export function generateStimulus(condition: Condition): string {
  switch (condition) {
    case 'random62': return generateRandomPassword({ entropyBits: TARGET_BITS });
    case 'lower25': return generatePolicyPassword(mobilePolicy, { entropyBits: TARGET_BITS });
    case 'eff10': return generatePassphrase({ entropyBits: TARGET_BITS });
    default: throw new TypeError('Unknown study condition');
  }
}

/** Error distance of a submitted attempt, not a count of physical key presses. */
export function editDistance(a: string, b: string): number {
  if (a.length > 512 || b.length > 512) throw new RangeError('Study text is limited to 512 characters');
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) next.push(Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)));
    row = next;
  }
  return row[b.length];
}

export const FLAGS = ['backgrounded', 'paste-or-drop', 'replacement', 'composition', 'untrusted-input'] as const;
export type Flag = typeof FLAGS[number];
export interface TrialResult extends PlannedTrial {
  index: number;
  characterLength: number;
  entropyBits: number;
  status: 'correct' | 'skipped' | 'timeout';
  elapsedMs: number;
  firstInputMs: number | null;
  firstSubmitMs: number | null;
  firstAttemptDistance: number | null;
  wrongSubmissions: number;
  inputEvents: number;
  deleteEvents: number;
  flags: Flag[];
  ease: number | null;
  reportedSwitches: number | null;
}

/** Stores counts only; submitted text is never retained in a result. */
export class Trial {
  private result: TrialResult;
  private finished = false;
  constructor(private target: string, plan: PlannedTrial, index: number, private start: number) {
    const info = formatInfo(plan.condition);
    this.result = { ...plan, index, characterLength: target.length, entropyBits: info.entropyBits,
      status: 'skipped', elapsedMs: 0, firstInputMs: null, firstSubmitMs: null, firstAttemptDistance: null,
      wrongSubmissions: 0, inputEvents: 0, deleteEvents: 0, flags: [], ease: null, reportedSwitches: null };
  }
  private elapsed(now: number) { return Math.min(TRIAL_LIMIT_MS, Math.max(0, now - this.start)); }
  flag(flag: Flag) {
    if (!this.finished && !this.result.flags.includes(flag)) this.result.flags.push(flag);
  }
  input(type: string, now: number, trusted: boolean) {
    if (this.finished) return;
    this.result.firstInputMs ??= this.elapsed(now);
    this.result.inputEvents++;
    if (type.startsWith('delete')) this.result.deleteEvents++;
    if (type === 'insertReplacementText') this.flag('replacement');
    if (type.includes('Composition')) this.flag('composition');
    if (!trusted) this.flag('untrusted-input');
  }
  submit(value: string, now: number): TrialResult | null {
    if (this.finished) throw new Error('Trial has already finished');
    if (this.elapsed(now) >= TRIAL_LIMIT_MS) return this.finish('timeout', now);
    if (value.length > 512) throw new RangeError('Study text is limited to 512 characters');
    this.result.firstSubmitMs ??= this.elapsed(now);
    this.result.firstAttemptDistance ??= editDistance(value, this.target);
    if (value !== this.target) { this.result.wrongSubmissions++; return null; }
    return this.finish('correct', now);
  }
  finish(status: TrialResult['status'], now: number): TrialResult {
    if (this.finished) throw new Error('Trial has already finished');
    this.finished = true;
    this.result.status = this.elapsed(now) >= TRIAL_LIMIT_MS ? 'timeout' : status;
    this.result.elapsedMs = this.elapsed(now);
    this.target = '';
    return { ...this.result, flags: [...this.result.flags] };
  }
}

export interface StudySession {
  protocol: typeof PROTOCOL;
  build: string;
  participant: number;
  environment: { device: string; os: string; browser: string; keyboard: string; layout: string; technique: string; englishFamiliarity: string };
  trials: TrialResult[];
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  return (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2;
}

/** Descriptive within-person summaries; flags and missing outcomes remain visible. */
export function summarize(session: StudySession) {
  return CONDITIONS.map(condition => {
    const measured = session.trials.filter(t => t.condition === condition && !t.practice);
    const eligible = measured.filter(t => t.flags.length === 0);
    const completed = eligible.filter(t => t.status === 'correct');
    return { condition, scheduled: 3, recorded: measured.length, flagged: measured.length - eligible.length,
      completed: completed.length, skipped: eligible.filter(t => t.status === 'skipped').length,
      timedOut: eligible.filter(t => t.status === 'timeout').length,
      firstAttemptErrors: eligible.filter(t => t.firstAttemptDistance !== null && t.firstAttemptDistance > 0).length,
      attempted: eligible.filter(t => t.firstAttemptDistance !== null).length,
      medianCompletionMs: median(completed.map(t => t.elapsedMs)),
      medianEase: median(eligible.flatMap(t => t.ease === null ? [] : [t.ease])),
    };
  });
}

/** Reject edited/unknown fields before analysis; never relay their content to diagnostics. */
export function validateSession(value: unknown): StudySession {
  const bad = (): never => { throw new Error('Invalid study result; expected the mobile-input-v1 export schema'); };
  function object(v: unknown, keys: string[]): Record<string, unknown> {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return bad();
    const o = v as Record<string, unknown>;
    if (Object.keys(o).sort().join('|') !== [...keys].sort().join('|')) return bad();
    return o;
  }
  function number(v: unknown, min: number, max: number, integer = false): boolean {
    return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max && (!integer || Number.isInteger(v));
  }
  const root = object(value, ['protocol', 'build', 'participant', 'environment', 'trials']);
  if (root.protocol !== PROTOCOL || typeof root.build !== 'string' || !/^[a-f0-9]{64}$/.test(root.build) ||
      !number(root.participant, 1, 999, true)) return bad();
  const env = object(root.environment, ['device', 'os', 'browser', 'keyboard', 'layout', 'technique', 'englishFamiliarity']);
  for (const v of Object.values(env)) if (typeof v !== 'string' || v.length < 1 || v.length > 120 || /[\x00-\x1f]/.test(v)) return bad();
  if (!Array.isArray(root.trials) || root.trials.length > 12) return bad();
  const plan = planTrials(root.participant as number);
  for (let i = 0; i < root.trials.length; i++) {
    const t = object(root.trials[i], ['condition', 'practice', 'block', 'index', 'characterLength', 'entropyBits', 'status',
      'elapsedMs', 'firstInputMs', 'firstSubmitMs', 'firstAttemptDistance', 'wrongSubmissions', 'inputEvents',
      'deleteEvents', 'flags', 'ease', 'reportedSwitches']);
    const info = formatInfo(plan[i].condition);
    if (t.index !== i || t.condition !== plan[i].condition || t.practice !== plan[i].practice || t.block !== plan[i].block ||
        t.entropyBits !== info.entropyBits || !number(t.characterLength, info.minLength, info.maxLength, true) ||
        !['correct', 'skipped', 'timeout'].includes(t.status as string) || !number(t.elapsedMs, 0, TRIAL_LIMIT_MS)) return bad();
    for (const key of ['firstInputMs', 'firstSubmitMs']) if (t[key] !== null && !number(t[key], 0, t.elapsedMs as number)) return bad();
    if (t.firstAttemptDistance !== null && !number(t.firstAttemptDistance, 0, 512, true)) return bad();
    for (const key of ['wrongSubmissions', 'inputEvents', 'deleteEvents']) if (!number(t[key], 0, 1_000_000, true)) return bad();
    if ((t.deleteEvents as number) > (t.inputEvents as number) ||
        ((t.inputEvents === 0) !== (t.firstInputMs === null)) ||
        ((t.firstSubmitMs === null) !== (t.firstAttemptDistance === null))) return bad();
    if (t.firstAttemptDistance === null && (t.wrongSubmissions !== 0 || t.status === 'correct')) return bad();
    if (t.firstAttemptDistance === 0 && (t.status !== 'correct' || t.wrongSubmissions !== 0)) return bad();
    if (typeof t.firstAttemptDistance === 'number' && t.firstAttemptDistance > 0 && t.wrongSubmissions === 0) return bad();
    if ((t.status === 'timeout') !== (t.elapsedMs === TRIAL_LIMIT_MS)) return bad();
    if (t.ease !== null && !number(t.ease, 1, 7, true)) return bad();
    if (t.reportedSwitches !== null && !number(t.reportedSwitches, 0, 999, true)) return bad();
    if (!Array.isArray(t.flags) || t.flags.some(f => !FLAGS.includes(f)) || new Set(t.flags).size !== t.flags.length) return bad();
  }
  return value as StudySession;
}
