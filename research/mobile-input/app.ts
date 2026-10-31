import { generateStimulus, planTrials, PROTOCOL, StudySession, Trial, TrialResult, TRIAL_LIMIT_MS, summarize, validateSession,
  InputMethod, InputSettings, settingsConfirmedOff } from './model';

declare const STUDY_BUILD: string;
function element<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error('Study interface is incomplete');
  return node as T;
}
const setup = element<HTMLFormElement>('setup');
const entry = element<HTMLFormElement>('entry');
const answer = element<HTMLInputElement>('answer');
const feedback = element<HTMLFormElement>('feedback');
const next = element<HTMLButtonElement>('next');
const save = element<HTMLButtonElement>('save');
const message = element('message');
const target = element('target');
const progress = element('progress');
let session: StudySession;
let plan: ReturnType<typeof planTrials>;
let active: Trial | undefined;
let pending: TrialResult | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

function finish(result: TrialResult) {
  clearTimeout(timer);
  active = undefined;
  result.inputMethod = 'unknown';
  pending = result;
  session.trials.push(result);
  answer.value = '';
  target.textContent = '';
  entry.hidden = true;
  feedback.reset();
  feedback.hidden = false;
  save.hidden = false;
  message.textContent = result.status === 'correct' ? 'Совпало. Оцените эту попытку.' :
    result.status === 'timeout' ? 'Лимит 5 минут истёк. Попытка сохранена как незавершённая.' : 'Попытка пропущена; она останется в результатах.';
  element('rating').focus();
}

setup.addEventListener('submit', event => {
  event.preventDefault();
  if (!setup.reportValidity()) return;
  const data = new FormData(setup);
  const participant = Number(data.get('participant'));
  plan = planTrials(participant);
  const field = (name: string) => String(data.get(name)).trim();
  const inputSettings = { autocorrect: field('autocorrect'), predictions: field('predictions'), gesture: field('gesture') } as InputSettings;
  if (!settingsConfirmedOff(inputSettings)) {
    message.textContent = 'Этот опыт сравнивает отдельные нажатия. Сначала отключите автокоррекцию, подсказки и жестовый ввод в настройках клавиатуры; затем отметьте каждую настройку как выключенную.';
    message.scrollIntoView({ block: 'center' });
    return;
  }
  session = { protocol: PROTOCOL, build: STUDY_BUILD, participant,
    inputSettings,
    environment: { device: field('device'), os: field('os'), browser: field('browser'), keyboard: field('keyboard'),
      layout: field('layout'), technique: field('technique'), englishFamiliarity: field('englishFamiliarity') }, trials: [] };
  try { validateSession(session); }
  catch { message.textContent = 'Заполните сведения об устройстве: 1–120 символов на поле, без управляющих символов.'; return; }
  setup.hidden = true;
  element('instructions').hidden = true;
  next.hidden = false;
  message.textContent = 'Будет 3 тренировочных и 9 измеряемых попыток. Сделайте перерыв между ними, если нужно.';
  updateProgress();
});

function updateProgress() {
  const i = session.trials.length;
  progress.textContent = i < plan.length ? `${i + 1} / ${plan.length} · ${plan[i].practice ? 'тренировка' : 'измерение, блок ' + plan[i].block}` : 'Сессия завершена';
}

next.addEventListener('click', () => {
  if (active || pending || session.trials.length >= plan.length) return;
  const i = session.trials.length;
  let stimulus: string;
  try { stimulus = generateStimulus(plan[i].condition); }
  catch { message.textContent = 'Криптографический источник недоступен. Откройте страницу в обычном браузере с Web Crypto; генерация остановлена.'; return; }
  next.hidden = true;
  entry.hidden = false;
  answer.value = '';
  target.textContent = stimulus;
  // The visible target and focus are set in the same task. The timer includes
  // reading and keyboard opening, not a separate typing-only latency.
  active = new Trial(stimulus, plan[i], i, performance.now());
  answer.focus();
  message.textContent = 'Перепечатайте образец точно, включая пробелы. Затем нажмите «Проверить».';
  timer = setTimeout(() => { if (active) finish(active.finish('timeout', performance.now())); }, TRIAL_LIMIT_MS);
});

entry.addEventListener('submit', event => {
  event.preventDefault();
  if (!active) return;
  const result = active.submit(answer.value, performance.now());
  if (result) finish(result);
  else { message.textContent = 'Пока не совпало. Исправьте текст и повторите проверку.'; answer.focus(); }
});
answer.addEventListener('input', event => {
  const input = event as InputEvent;
  active?.input(input.inputType, performance.now(), event.isTrusted);
});
answer.addEventListener('compositionstart', () => active?.flag('composition'));
function blockPaste(event: Event) { if (active) { event.preventDefault(); active.flag('paste-or-drop'); message.textContent = 'Вставка отключена для измерения ручного ввода; попытка отмечена для исключения из сравнения.'; } }
answer.addEventListener('paste', blockPaste);
answer.addEventListener('drop', blockPaste);
answer.addEventListener('beforeinput', event => {
  if (/insertFrom(Paste|Drop)/.test((event as InputEvent).inputType)) blockPaste(event);
});
document.addEventListener('visibilitychange', () => { if (document.hidden) active?.flag('backgrounded'); });
element('skip').addEventListener('click', () => { if (active) finish(active.finish('skipped', performance.now())); });

feedback.addEventListener('submit', event => {
  event.preventDefault();
  if (!pending || !feedback.reportValidity()) return;
  pending.ease = Number(element<HTMLSelectElement>('rating').value);
  pending.inputMethod = element<HTMLSelectElement>('input-method').value as InputMethod;
  const switches = element<HTMLInputElement>('switches').value;
  pending.reportedSwitches = switches === '' ? null : Number(switches);
  pending = undefined;
  feedback.hidden = true;
  updateProgress();
  if (session.trials.length < plan.length) {
    next.hidden = false;
    message.textContent = 'Следующая попытка начнётся только после нажатия кнопки.';
    next.focus();
  } else {
    const summary = summarize(session);
    message.textContent = summary.every(result => result.eligible === 0) ?
      'Ни одна измеряемая попытка не подходит под условия v2. Данные сохранены: скачайте JSON для разбора причин. Перезагрузка удалит данные.' :
      'Готово. Скачайте JSON с результатами. Перезагрузка удалит данные из страницы.';
    element('summary').textContent = JSON.stringify(summary, null, 2);
    element('results').hidden = false;
    save.focus();
  }
});

save.addEventListener('click', () => {
  validateSession(session);
  const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${PROTOCOL}-p${session.participant}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener('beforeunload', event => {
  if (session && (active || session.trials.length)) { event.preventDefault(); event.returnValue = ''; }
});
element('build').textContent = `${PROTOCOL} · ${STUDY_BUILD.slice(0,12)}`;
