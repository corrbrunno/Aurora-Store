const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests-ui',
  workers: 1,
  fullyParallel: false,
  timeout: 120000,
  reporter: [
    ['list'],
    ['json', { outputFile: 'logs/playwright-resultado.json' }],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    { name: 'chrome', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
});
