'use strict';
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--lan')) {
  process.stderr.write('Usage: npm run study:serve -- [--lan]\n');
  process.exit(1);
}
let html;
try { html = readFileSync(resolve(__dirname, '../.study/mobile-input.html')); }
catch { process.stderr.write('Build the study first: npm run study:build\n'); process.exit(1); }
const host = args[0] === '--lan' ? '0.0.0.0' : '127.0.0.1';
const server = createServer((request, response) => {
  if ((request.method === 'GET' || request.method === 'HEAD') &&
      (request.url === '/' || request.url === '/mobile-input.html')) {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Content-Length': html.length });
    response.end(request.method === 'HEAD' ? undefined : html);
  } else { response.writeHead(404); response.end(); }
});
server.on('error', () => { process.stderr.write('Cannot start study server on port 4173.\n'); process.exitCode = 1; });
server.listen(4173, host, () => console.log(host === '127.0.0.1' ? 'Study: http://127.0.0.1:4173/mobile-input.html' :
  'Study listening on port 4173 on this computer. On the same trusted Wi-Fi, open http://<computer-LAN-IP>:4173/mobile-input.html. No participant results are sent to this server. Stop with Ctrl+C.'));
