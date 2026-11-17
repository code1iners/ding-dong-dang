import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';

// 빌드한 실제 앱(out/)을 임시 데이터 폴더로 띄운다. 사용자의 실제 데이터 폴더에는 닿지 않는다.
/** 띄운 앱. */
let app: ElectronApplication;
/** 앱 창의 화면. */
let page: Page;
/** 이 테스트만 쓰는 임시 데이터 폴더. */
let dataDir: string;

test.beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
});

test.afterAll(async () => {
  await app?.close();
  await rm(dataDir, { recursive: true, force: true });
});

test('왼쪽 세로 줄의 단추로 네 화면을 오간다', async () => {
  /** 왼쪽 세로 줄. */
  const rail = page.getByRole('navigation', { name: '화면' });

  // 창을 열면 현황 화면이다
  await expect(page.getByRole('main', { name: '현황' })).toBeVisible();
  await expect(rail.getByRole('button', { name: '현황' })).toHaveAttribute('aria-current', 'page');

  for (const name of ['시간표', '종', '설정', '현황']) {
    await rail.getByRole('button', { name }).click();
    await expect(page.getByRole('main', { name })).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(rail.getByRole('button', { name })).toHaveAttribute('aria-current', 'page');
    await expect(rail.locator('[aria-current="page"]')).toHaveCount(1);
  }
});

test('실행 인자로 준 폴더를 데이터 폴더로 쓴다', async () => {
  /** 앱이 쓰는 데이터 폴더. */
  const userData = await app.evaluate(({ app }) => app.getPath('userData'));
  expect(userData).toBe(dataDir);
});

test('창의 내용 영역은 920×580보다 작아지지 않고 크기를 바꿀 수 있다', async () => {
  /** 줄이고 늘린 뒤의 내용 영역 크기. */
  const sizes = await app.evaluate(({ BrowserWindow }) => {
    /** 앱 창. */
    const w = BrowserWindow.getAllWindows()[0]!;
    const resizable = w.isResizable();
    const before = w.getContentSize();
    w.setContentSize(400, 300);
    const shrunk = w.getContentSize();
    w.setContentSize(1200, 800);
    const grown = w.getContentSize();
    w.setContentSize(before[0]!, before[1]!);
    return { resizable, shrunk, grown };
  });
  expect(sizes).toEqual({ resizable: true, shrunk: [920, 580], grown: [1200, 800] });
  // 렌더러가 보는 크기도 같다
  /** 렌더러가 보는 창 크기. */
  const viewport = await page.evaluate(() => [innerWidth, innerHeight]);
  expect(viewport[0]).toBeGreaterThanOrEqual(920);
  expect(viewport[1]).toBeGreaterThanOrEqual(580);
});

test('렌더러는 Node에 닿지 않고 상태 구독과 명령 두 통로만 쓴다', async () => {
  /** 렌더러 전역에서 보이는 것. */
  const globals = await page.evaluate(() => ({
    require: typeof (globalThis as { require?: unknown }).require,
    process: typeof (globalThis as { process?: unknown }).process,
    api: Object.keys(window.dingdong).sort(),
  }));
  // contextBridge는 contextIsolation이 켜져 있을 때만 값을 내보낸다. 그래서 통로가 보이면 격리가 켜져 있다
  expect(globals).toEqual({ require: 'undefined', process: 'undefined', api: ['command', 'subscribe'] });

  /** 상태 구독으로 처음 받은 상태. */
  const state = await page.evaluate(
    () =>
      new Promise((done) => {
        const stop = window.dingdong.subscribe((s) => {
          stop();
          done(s);
        });
      }),
  );
  /** 앱 버전. */
  const version = await app.evaluate(({ app }) => app.getVersion());
  expect(state).toEqual({ appVersion: version });

  // 모르는 명령은 메인이 거절한다
  /** 모르는 명령이 거절됐는지. */
  const rejected = await page.evaluate(() =>
    window.dingdong.command({ type: 'no-such-command' } as never).then(
      () => false,
      () => true,
    ),
  );
  expect(rejected).toBe(true);
});

test('Jua 글꼴이 내장되어 있고 OS가 어두운 모드여도 색이 바뀌지 않는다', async () => {
  /** 내장 글꼴을 불러온 결과와 본문 글꼴. */
  const font = await page.evaluate(async () => {
    const faces = await document.fonts.load('20px Jua', '딩동댕');
    return { loaded: faces.length > 0 && faces.every((f) => f.status === 'loaded'), family: getComputedStyle(document.body).fontFamily };
  });
  expect(font.loaded).toBe(true);
  expect(font.family.startsWith('Jua')).toBe(true);

  /** 바탕과 지금 화면 단추의 색. */
  const colors = () =>
    page.evaluate(() => {
      const current = document.querySelector('.rail [aria-current="page"]')!;
      return { body: getComputedStyle(document.body).backgroundColor, rail: getComputedStyle(current).backgroundColor };
    });
  /** 밝은 모드에서의 색. */
  const light = await colors();
  expect(light.body).toBe('rgb(207, 227, 248)');

  // 앱이 OS 테마를 밝게 고정한다. OS 설정을 바꿀 수 없어, 고정 여부와 CSS가 어두운 모드에 반응하지 않는지를 나눠 본다
  expect(await app.evaluate(({ nativeTheme }) => [nativeTheme.themeSource, nativeTheme.shouldUseDarkColors])).toEqual([
    'light',
    false,
  ]);

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
  expect(await colors()).toEqual(light);
  await page.emulateMedia({ colorScheme: null });
});
