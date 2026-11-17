import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { emptyData } from '../src/shared/data';
import { createTimetable } from '../src/shared/timetable-ops';
import { trayIconFile } from '../src/main/residency';

// 창을 닫아도 앱이 남는 동작을 실제 앱으로 본다. 트레이 메뉴의 항목과 순서는 residency.test.ts가 본다.
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
async function launch(): Promise<ElectronApplication> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  // 화면이 그려져 창이 뜬 뒤에 닫아야 한다. 그 전에 숨기면 곧이어 뜨는 창이 숨김을 덮는다
  await expect.poll(() => windowVisible(app!)).toBe(true);
  return app;
}

/** 앱 창이 눈에 보이는지. 숨긴 종 재생기 창이 아니라 첫 화면이 붙은 창이다. */
async function windowVisible(launched: ElectronApplication): Promise<boolean> {
  return (await launched.browserWindow(await launched.firstWindow())).evaluate((w) => w.isVisible());
}

/** 앱 창의 닫기 버튼을 누른 것과 같게 닫는다. */
async function pressClose(launched: ElectronApplication): Promise<void> {
  await (await launched.browserWindow(await launched.firstWindow())).evaluate((w) => w.close());
}

test('처음 닫을 때만 안내 모달이 뜨고, "창 닫기"를 누르면 창이 숨으며 앱은 살아 있다', async () => {
  const launched = await launch();
  const page = await launched.firstWindow();

  await pressClose(launched);
  /** 처음 닫을 때 안내. */
  const dialog = page.getByRole('dialog', { name: '딩동댕은 계속 켜져 있어요' });
  await expect(dialog).toBeVisible();
  // 안내를 보는 동안 창은 그대로 있다
  expect(await windowVisible(launched)).toBe(true);

  // Esc는 창을 닫지 않고 안내만 거둔다
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await windowVisible(launched)).toBe(true);
  expect(JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8').catch(() => '{"settings":{}}')).settings.hideNoticeShown).not.toBe(true);

  await pressClose(launched);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '창 닫기' }).click();
  await expect.poll(() => windowVisible(launched)).toBe(false);
  // 앱은 살아 있어 메인 프로세스에 계속 물을 수 있다
  expect(await launched.evaluate(({ app }) => app.isReady())).toBe(true);
  if (process.platform === 'darwin') expect(await launched.evaluate(({ app }) => app.dock?.isVisible())).toBe(false);
  await expect
    .poll(async () => JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')).settings.hideNoticeShown)
    .toBe(true);

  // 다시 열어 닫으면 안내 없이 바로 숨는다
  await launched.evaluate(({ app }) => app.emit('activate'));
  await expect.poll(() => windowVisible(launched)).toBe(true);
  if (process.platform === 'darwin') expect(await launched.evaluate(({ app }) => app.dock?.isVisible())).toBe(true);
  await pressClose(launched);
  await expect.poll(() => windowVisible(launched)).toBe(false);
  await expect(dialog).toHaveCount(0);
});

test('이미 안내를 본 뒤에는 닫기 버튼이 바로 숨긴다', async () => {
  await writeFile(
    join(dataDir, 'data.json'),
    JSON.stringify({ ...emptyData(), settings: { ...emptyData().settings, hideNoticeShown: true } }),
  );
  const launched = await launch();
  await pressClose(launched);
  await expect.poll(() => windowVisible(launched)).toBe(false);
});

test('설정의 "닫으면 숨기기"를 끄면 닫기 버튼이 앱을 종료한다', async () => {
  const launched = await launch();
  const page = await launched.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
  /** "닫으면 숨기기" 스위치. 기본은 켜짐이다. */
  const toggle = page.getByRole('switch', { name: '닫으면 숨기기' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  /** 앱 프로세스가 끝났는지 알려 주는 약속. */
  const exited = new Promise<void>((done) => launched.process().once('exit', () => done()));
  await pressClose(launched);
  await exited;
  expect(JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')).settings.hideOnClose).toBe(false);
});

test('앱이 끝나는 중에는 숨지 않고 숨은 앱도 종료 요청에 끝난다 (Cmd+Q와 "딩동댕 종료"가 부르는 app.quit)', async () => {
  await writeFile(
    join(dataDir, 'data.json'),
    JSON.stringify({ ...emptyData(), settings: { ...emptyData().settings, hideNoticeShown: true } }),
  );
  const launched = await launch();
  await pressClose(launched);
  await expect.poll(() => windowVisible(launched)).toBe(false);

  const exited = new Promise<void>((done) => launched.process().once('exit', () => done()));
  await launched.evaluate(({ app }) => app.quit());
  await exited;
});

test('두 번째 실행은 곧바로 끝나고 숨어 있던 기존 앱의 창을 연다', async () => {
  await writeFile(
    join(dataDir, 'data.json'),
    JSON.stringify({ ...emptyData(), settings: { ...emptyData().settings, hideNoticeShown: true } }),
  );
  const launched = await launch();
  await pressClose(launched);
  await expect.poll(() => windowVisible(launched)).toBe(false);

  /** 같은 데이터 폴더로 한 번 더 띄운 프로세스의 종료 코드. */
  const code = await new Promise<number | null>((done) => {
    const second = spawn(launched.process().spawnfile, [resolve(__dirname, '..'), `--data-dir=${dataDir}`], { stdio: 'ignore' });
    second.once('exit', done);
  });
  expect(code).toBe(0);
  await expect.poll(() => windowVisible(launched)).toBe(true);
  // 앱 창과 숨긴 종 재생기 창뿐이다. 두 번째 실행이 창을 더 만들지 않는다
  expect(await launched.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(2);
});

test('저장하지 않은 편집이 있어도 종료 요청은 확인 없이 앱을 끝낸다', async () => {
  const launched = await launch();
  const page = await launched.firstWindow();
  await page.evaluate(() => window.dingdong.command({ type: 'set-editing-dirty', dirty: true }));

  const exited = new Promise<void>((done) => launched.process().once('exit', () => done()));
  await launched.evaluate(({ app }) => app.quit());
  await exited;
});

// 트레이는 OS가 그려 에이전트가 볼 수 없다. 대신 메인 프로세스가 트레이에 건넨 메뉴와 아이콘을 가로채어 실제 앱이 만든 것을 읽는다.
test('트레이 메뉴의 "오늘 종"은 현황의 스위치와 같은 값이고, 끄면 빗금 아이콘으로 바뀐다', async () => {
  // 시간표가 하나는 있어야 현황에 "오늘 종" 스위치가 나온다
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(createTimetable(emptyData(), 't0')));
  const launched = await launch();
  const page = await launched.firstWindow();
  /** 켜짐과 꺼짐 아이콘 파일 이름. */
  const files = { on: trayIconFile(process.platform, true), off: trayIconFile(process.platform, false) };

  await launched.evaluate(({ Menu, Tray, nativeImage, app }, f) => {
    /** 가로챈 값을 담아 두는 곳. */
    const spy = ((globalThis as Record<string, unknown>).__traySpy = { menu: null as Electron.Menu | null, icon: '' });
    /** 파일의 그림 바이트(base64). */
    const png = (file: string) =>
      nativeImage.createFromPath(`${app.getAppPath()}/resources/icons/${file}`).toPNG().toString('base64');
    const on = png(f.on);
    const off = png(f.off);
    const build = Menu.buildFromTemplate.bind(Menu);
    Menu.buildFromTemplate = (template) => (spy.menu = build(template));
    const setImage = Tray.prototype.setImage;
    Tray.prototype.setImage = function (image) {
      const bytes = (image as Electron.NativeImage).toPNG().toString('base64');
      spy.icon = bytes === on ? 'on' : bytes === off ? 'off' : 'unknown';
      return setImage.call(this, image);
    };
  }, files);

  /** 가로챈 메뉴의 항목 글자와 "오늘 종" 체크, 그리고 마지막 아이콘. */
  const trayNow = () =>
    launched.evaluate(() => {
      const spy = (globalThis as unknown as { __traySpy: { menu: Electron.Menu | null; icon: string } }).__traySpy;
      return { labels: spy.menu?.items.map((i) => i.label || i.type) ?? null, checked: spy.menu?.items.find((i) => i.label === '오늘 종')?.checked, icon: spy.icon };
    });
  /** 현황 화면의 "오늘 종" 스위치. */
  const statusSwitch = page.getByRole('switch', { name: '오늘 종' });
  await expect(statusSwitch).toHaveAttribute('aria-checked', 'true');

  // 현황에서 끄면 트레이가 다시 만들어져 체크가 풀리고 아이콘이 꺼짐으로 바뀐다
  await statusSwitch.click();
  await expect.poll(trayNow).toEqual({ labels: ['딩동댕 열기', '오늘 종', 'separator', '딩동댕 종료'], checked: false, icon: 'off' });

  // 트레이 메뉴에서 켜면 현황의 스위치도 켜지고 아이콘이 돌아온다
  await launched.evaluate(() => {
    const spy = (globalThis as unknown as { __traySpy: { menu: Electron.Menu } }).__traySpy;
    spy.menu.items.find((i) => i.label === '오늘 종')!.click();
  });
  await expect(statusSwitch).toHaveAttribute('aria-checked', 'true');
  await expect.poll(trayNow).toMatchObject({ checked: true, icon: 'on' });

  // 트레이 메뉴에서 끄면 현황의 스위치도 꺼진다
  await launched.evaluate(() => {
    const spy = (globalThis as unknown as { __traySpy: { menu: Electron.Menu } }).__traySpy;
    // 체크 항목은 누르면 스스로 뒤집힌 값을 동작에 넘긴다
    spy.menu.items.find((i) => i.label === '오늘 종')!.click();
  });
  await expect(statusSwitch).toHaveAttribute('aria-checked', 'false');
  await expect.poll(trayNow).toMatchObject({ checked: false, icon: 'off' });
});
