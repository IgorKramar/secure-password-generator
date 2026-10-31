const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.',
  testMatch: 'browser.spec.cjs',
  timeout: 30000,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: 'node scripts/serve-study.cjs',
    cwd: require('node:path').resolve(__dirname, '../..'),
    url: 'http://127.0.0.1:4173/mobile-input.html',
    reuseExistingServer: false,
  },
  use: {
    browserName: 'chromium',
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.STUDY_CHROMIUM_PATH ? { executablePath: process.env.STUDY_CHROMIUM_PATH } : {},
  },
});
