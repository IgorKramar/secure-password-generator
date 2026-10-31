const { test, expect } = require('@playwright/test');
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');
const { validateSession, planTrials } = require('../../.study/model.cjs');
const url = 'http://127.0.0.1:4173/mobile-input.html';

async function setup(page) {
  await page.goto(url);
  for (const name of ['device', 'os', 'browser', 'keyboard', 'layout']) await page.locator(`[name=${name}]`).fill('AUTOMATED CHECK — NOT PARTICIPANT DATA');
  await page.locator('[name=technique]').selectOption('two-thumbs-portrait');
  await page.locator('[name=englishFamiliarity]').selectOption('basic');
  await page.locator('[type=checkbox]').check();
  await page.locator('#setup button').click();
}
async function rate(page) {
  await page.locator('#rating').selectOption('4');
  await page.locator('#feedback button').click();
}
async function download(page) {
  const event = page.waitForEvent('download');
  await page.locator('#save').click();
  const result = await event;
  return JSON.parse(readFileSync(await result.path(), 'utf8'));
}

test('complete mobile-sized session exports counts, no strings, storage or network', async ({ page }) => {
  const requests = [];
  const errors = [];
  page.on('request', r => { if (r.url() !== url) requests.push(r.url()); });
  page.on('pageerror', e => errors.push(e.message));
  await setup(page);
  await expect(page.locator('body')).toContainText('Copyright (c) 2024 Igor Kramar');
  await expect(page.locator('body')).toContainText('Creative Commons Attribution 4.0');
  const targets = [];
  for (let i = 0; i < 12; i++) {
    await page.locator('#next').click();
    const target = await page.locator('#target').innerText();
    targets.push(target);
    await expect(page.locator('#answer')).toBeFocused();
    // Trusted browser events exercise the instrument, not a human performance claim.
    if (i === 3) {
      await page.keyboard.type('!');
      await page.getByRole('button', { name: 'Проверить', exact: true }).click();
      await expect(page.locator('#message')).toContainText('Пока не совпало');
      await page.keyboard.press('Backspace');
    }
    await page.keyboard.type(target);
    await page.getByRole('button', { name: 'Проверить', exact: true }).click();
    await rate(page);
  }
  await expect(page.locator('#progress')).toHaveText('Сессия завершена');
  const result = validateSession(await download(page));
  expect(result.trials).toHaveLength(12);
  expect(result.trials.map(t => t.condition)).toEqual(planTrials(1).map(t => t.condition));
  expect(result.trials.every(t => t.status === 'correct')).toBeTruthy();
  expect(result.trials[3].wrongSubmissions).toBe(1);
  expect(result.trials[3].deleteEvents).toBe(1);
  for (const text of targets) expect(JSON.stringify(result)).not.toContain(text);
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length,
    overflow: document.documentElement.scrollWidth > innerWidth }))).toEqual({ local: 0, session: 0, overflow: false });
});

test('paste, composition, replacement and background flags survive a skipped attempt', async ({ page }) => {
  await setup(page);
  await page.locator('#next').click();
  await page.evaluate(() => {
    const input = document.querySelector('#answer');
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    input.dispatchEvent(paste);
    if (!paste.defaultPrevented) throw new Error('Paste must be blocked');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertReplacementText', bubbles: true }));
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.locator('#skip').click();
  await rate(page);
  const result = validateSession(await download(page));
  expect(result.trials[0].status).toBe('skipped');
  expect(result.trials[0].flags.sort()).toEqual(['backgrounded', 'composition', 'paste-or-drop', 'replacement', 'untrusted-input']);
});

test('timeout ends the attempt without fabricating successful input', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  await page.locator('#next').click();
  await page.clock.fastForward(300000);
  await expect(page.locator('#feedback')).toBeVisible();
  const result = validateSession(await download(page));
  expect(result.trials[0].status).toBe('timeout');
  expect(result.trials[0].elapsedMs).toBe(300000);
  expect(result.trials[0].firstAttemptDistance).toBeNull();
});

test('missing crypto stops generation with a clear message', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(globalThis, 'crypto', { value: undefined }));
  await setup(page);
  await page.locator('#next').click();
  await expect(page.locator('#message')).toContainText('Криптографический источник недоступен');
  await expect(page.locator('#entry')).toBeHidden();
});

test('analyzer validates bounded files, reports incomplete data and redacts failures', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'study-check-'));
  const script = resolve(__dirname, '../../scripts/analyze-study.cjs');
  const run = (...paths) => spawnSync(process.execPath, [script, ...paths], { encoding: 'utf8', timeout: 3000 });
  try {
    const file = join(temporary, 'DO-NOT-ECHO.json');
    const data = { protocol: 'mobile-input-v1', build: 'a'.repeat(64), participant: 1,
      environment: { device: 'synthetic', os: 'test', browser: 'test', keyboard: 'test', layout: 'test', technique: 'test', englishFamiliarity: 'basic' }, trials: [] };
    const text = JSON.stringify(data);
    writeFileSync(file, text.padEnd(128 * 1024, ' '));
    const accepted = run(file);
    expect(accepted.status).toBe(0);
    expect(accepted.stderr).toBe('');
    expect(JSON.parse(accepted.stdout).participants[0]).toMatchObject({ complete: false });
    expect(JSON.parse(accepted.stdout).participants[0].conditions.every(c => c.recorded === 0 && c.medianCompletionMs === null)).toBeTruthy();
    expect(run(file, file).status).toBe(1);
    const second = join(temporary, 'second.json');
    writeFileSync(second, JSON.stringify({ ...data, participant: 2, build: 'b'.repeat(64) }));
    expect(run(file, second).status).toBe(1);
    for (const content of [text.padEnd(128 * 1024 + 1, ' '), '{"password":"DO-NOT-ECHO"}', '{bad', Buffer.from([0xff])]) {
      writeFileSync(file, content);
      const rejected = run(file);
      expect(rejected.status).toBe(1);
      expect(rejected.stdout).toBe('');
      expect(rejected.stderr).not.toContain('DO-NOT-ECHO');
    }
    expect(run(temporary).status).toBe(1);
    expect(run().status).toBe(1);
    if (process.platform !== 'win32') {
      const fifo = join(temporary, 'pipe');
      expect(spawnSync('mkfifo', [fifo]).status).toBe(0);
      const result = run(fifo);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
