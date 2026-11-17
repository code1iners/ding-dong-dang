import { defineConfig } from '@playwright/test';

// 실제 Electron 앱을 띄우는 테스트다. 실행 전에 `electron-vite build`로 out/을 만든다(npm run test:e2e).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: 'list',
});
