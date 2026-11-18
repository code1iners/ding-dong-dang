import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { AUTO_START_ARG } from '../src/main/auto-start';

// 자동 시작 설정과 "자동 시작으로 뜨면 창을 열지 않는" 동작을 실제 앱으로 본다.
// OS에 실제로 등록되고 지워지는지는 패키징한 앱으로 따로 확인한다(티켓 41의 Comments).
/** 이 파일의 테스트들이 나눠 쓰는 임시 데이터 폴더. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});
test.afterEach(async () => {
  await app?.close().catch(() => undefined);
  app = undefined;
  await rm(dataDir, { recursive: true, force: true });
});

/** 임시 데이터 폴더로 앱을 띄운다. */
async function launch(...extraArgs: string[]): Promise<ElectronApplication> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`, ...extraArgs] });
  return app;
}

/** 저장 파일의 설정. */
async function savedSettings(): Promise<{ autoStart: boolean }> {
  return JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')).settings;
}

/** 지금 떠 있는 창들이 불러온 주소와 보이는지. */
async function windows(launched: ElectronApplication): Promise<{ url: string; visible: boolean }[]> {
  return launched.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => ({ url: w.webContents.getURL(), visible: w.isVisible() })),
  );
}

test('설정의 "컴퓨터를 켜면 자동 시작" 스위치를 끄고 켜면 저장 값이 따라간다', async () => {
  const launched = await launch();
  const page = await launched.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();

  /** 자동 시작 스위치. */
  const toggle = page.getByRole('switch', { name: '컴퓨터를 켜면 자동 시작' });
  // 처음에는 켜져 있고 실패 표시는 없다
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('등록하지 못했어요')).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await savedSettings()).autoStart).toBe(false);
  await expect(page.getByText('등록하지 못했어요')).toHaveCount(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await savedSettings()).autoStart).toBe(true);
});

test('--data-dir로 띄운 실행은 OS의 자동 시작 등록을 건드리지 않는다', async () => {
  const launched = await launch();
  const page = await launched.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
  /** 자동 시작 스위치. */
  const toggle = page.getByRole('switch', { name: '컴퓨터를 켜면 자동 시작' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await toggle.click();

  // 화면은 켜졌다고 하지만 OS에는 이 앱 실행 파일의 로그인 항목이 생기지 않았다
  const os = await launched.evaluate(({ app }) => app.getLoginItemSettings());
  expect(os.openAtLogin).toBe(false);
  if (process.platform === 'darwin') expect(os.status).not.toBe('enabled');
});

test('자동 시작으로 뜨면 앱 창 없이 떠 있고, 다시 열면 창이 나온다', async () => {
  const launched = await launch(AUTO_START_ARG);
  // 앱이 다 뜰 때까지 기다린다. 숨긴 종 재생기 창은 있어도 앱 화면(index.html)은 없다
  await expect.poll(async () => (await windows(launched)).length).toBeGreaterThan(0);
  await new Promise((r) => setTimeout(r, 1500));
  const before = await windows(launched);
  expect(before.some((w) => w.url.endsWith('index.html'))).toBe(false);
  // 돌아다니는 강아지 창은 앱 창과 무관하게 화면 바닥에 뜬다. 그 밖에는 보이는 창이 없다
  expect(before.some((w) => w.url.endsWith('dog.html') && w.visible)).toBe(true);
  expect(before.some((w) => !w.url.endsWith('dog.html') && w.visible)).toBe(false);
  expect(await launched.evaluate(({ app }) => app.isReady())).toBe(true);
  if (process.platform === 'darwin') expect(await launched.evaluate(({ app }) => app.dock?.isVisible())).toBe(false);

  // 두 번째 실행이 오면(직접 실행) 창을 연다
  await launched.evaluate(({ app }) => app.emit('second-instance'));
  await expect
    .poll(async () => (await windows(launched)).some((w) => w.url.endsWith('index.html') && w.visible))
    .toBe(true);
});

test('직접 실행하면 창이 열린다', async () => {
  const launched = await launch();
  await expect
    .poll(async () => (await windows(launched)).some((w) => w.url.endsWith('index.html') && w.visible))
    .toBe(true);
});
