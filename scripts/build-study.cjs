'use strict';
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { createHash } = require('node:crypto');
const { buildSync } = require('esbuild');
const root = resolve(__dirname, '..');
const out = resolve(root, '.study');
mkdirSync(out, { recursive: true });
const entry = resolve(root, 'research/mobile-input/app.ts');
const notices = ['LICENSE.md', 'THIRD_PARTY_NOTICES.md'].map(file => readFileSync(resolve(root, file), 'utf8')).join('\n');
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const template = readFileSync(resolve(root, 'research/mobile-input/index.html'), 'utf8').replace('STUDY_NOTICES', escapeHtml(notices));
const build = define => buildSync({ entryPoints: [entry], bundle: true, platform: 'browser', target: 'es2022',
  format: 'iife', write: false, minify: true, define: { STUDY_BUILD: JSON.stringify(define) }, logLevel: 'silent' }).outputFiles[0].text;
// Fingerprint the entire bundled implementation and HTML, not only a Git label.
const fingerprint = createHash('sha256').update(build('')).update(template).digest('hex');
const script = build(fingerprint).replace(/<\/script/gi, '<\\/script');
const style = template.match(/<style>([\s\S]*?)<\/style>/)[1];
const hash = text => createHash('sha256').update(text).digest('base64');
const csp = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'`;
writeFileSync(resolve(out, 'mobile-input.html'), template.replace('STUDY_CSP', csp).replace('/* STUDY_SCRIPT */', script));
buildSync({ entryPoints: [resolve(root, 'research/mobile-input/model.ts')], bundle: true, platform: 'node',
  format: 'cjs', target: 'node22', outfile: resolve(out, 'model.cjs'), logLevel: 'silent' });
const { PROTOCOL } = require(resolve(out, 'model.cjs'));
writeFileSync(resolve(out, 'build.json'), JSON.stringify({ protocol: PROTOCOL, fingerprint }, null, 2) + '\n');
console.log(`Built .study/mobile-input.html (${PROTOCOL}, ${fingerprint.slice(0, 12)}). Building does not collect participant measurements.`);
