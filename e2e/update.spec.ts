import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { AUTO_START_ARG } from '../src/main/auto-start';
import { UPDATE_ATTEMPT_FILE } from '../src/main/update-attempt';
import type { AppState, UpdateView } from '../src/shared/bridge';
import { CHANNEL } from '../src/shared/bridge';
import type { Data } from '../src/shared/data';
import { dataWith, weekdayOf } from './timetable-fixture';

// 앱 내 업데이트의 화면을 실제 앱으로 본다. --data-dir로 띄운 실행은 실제 릴리스를 확인하지 않으므로,
// 버전 줄의 모습 · 주황 점 · 확인 모달 · 잠금은 테스트가 메인 프로세스에서 가짜 업데이트 상태를 화면에 보내 확인한다.
// 실제 릴리스에서 내려받아 설치하고 다시 켜지는 흐름은 첫 릴리스가 생긴 뒤에 확인한다(티켓 47의 Comments).

/** 이 파일의 테스트가 쓰는 데이터 폴더. 테스트마다 새로 만든다. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 앱 창의 화면. */
let page: Page;

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});
test.afterEach(async () => {
  await app?.close().catch(() => undefined);
  app = undefined;
  await rm(dataDir, { recursive: true, force: true });
});

/** 오늘 요일의 키. getDay()는 일요일이 0이다. */
const todayKey = weekdayOf();

/**
 * 오늘 수업 하나의 시작 시각(자정부터의 분). 진짜 시각에서 여섯 시간 넘게 떨어진 03:00이나 15:00을 골라,
 * 테스트 동안 메인의 진짜 종이 울려 상태를 다시 보내는 일이 없게 한다.
 */
const lessonStart = Math.abs(new Date().getHours() - 3) >= 6 && Math.abs(new Date().getHours() - 3) <= 18 ? 3 * 60 : 15 * 60;

/** 오늘 수업 하나를 배정한 저장 파일을 쓴다. */
async function seedLesson(): Promise<void> {
  const data: Data = dataWith([{ id: 't', name: '시험반', days: [todayKey], periods: [{ start: lessonStart, end: lessonStart + 50 }] }]);
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
}

/** 앱을 띄운다. */
async function launch(...extraArgs: string[]): Promise<void> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`, ...extraArgs] });
  page = await app.firstWindow();
}

/** 메인이 가진 진짜 상태. 테스트가 보낸 가짜 상태가 아니다. */
async function mainState(): Promise<AppState> {
  return page.evaluate(
    () =>
      new Promise<AppState>((done) => {
        const off = window.dingdong.subscribe((state) => {
          queueMicrotask(() => off());
          done(state);
        });
      }),
  );
}

/**
 * 메인 프로세스에서 앱 창에 업데이트 값(과 그 밖의 값)을 바꾼 상태를 보낸다. 메인이 실제로 확인한 것처럼 화면이 그린다.
 * 메인의 진짜 상태 위에 덮으므로, 앞서 보낸 가짜 값은 이어지지 않는다.
 */
async function sendUpdate(update: Partial<UpdateView>, patch: Partial<AppState> = {}): Promise<void> {
  /** 보낼 상태. */
  const state = await mainState();
  await app!.evaluate(
    ({ BrowserWindow }, { channel, next }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (win.webContents.getURL().endsWith('/index.html')) win.webContents.send(channel, next);
      }
    },
    { channel: CHANNEL.stateChanged, next: { ...state, ...patch, update: { ...state.update, ...update } } },
  );
}

/** 화면의 시계를 오늘 이 분(자정부터)으로 옮긴다. Electron 창에는 Playwright의 clock이 닿지 않아 `Date.now`를 직접 바꾼다. */
async function setClock(minutes: number): Promise<void> {
  /** 옮길 시각. */
  const d = new Date();
  const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(minutes / 60), minutes % 60).getTime();
  await page.evaluate((target) => {
    const w = window as unknown as { __realNow?: () => number };
    w.__realNow ??= Date.now.bind(Date);
    const real = w.__realNow;
    const offset = target - real();
    Date.now = () => real() + offset;
  }, at);
}

/** 설정 화면을 연다. */
async function openSettings(): Promise<void> {
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
}

/** 버전 줄. */
function versionRow() {
  return page.locator('.setting-row', { has: page.locator('#setting-version') });
}

test('--data-dir로 띄운 실행은 실제 릴리스를 확인하지 않고 버전 줄에 지금 버전만 보인다', async () => {
  await launch();
  await openSettings();
  /** 앱 버전. */
  const version = await app!.evaluate(({ app: electronApp }) => electronApp.getVersion());
  await expect(versionRow()).toContainText(`버전 ${version}`);
  await expect(versionRow().getByRole('button')).toHaveCount(0);
  await expect(versionRow()).not.toContainText('최신 버전이에요');
  await expect(versionRow()).not.toContainText('새 버전을 확인하지 못했어요');
  expect((await mainState()).update.status).toEqual({ kind: 'off' });
});

test('버전 줄의 세 모습: 최신 버전이에요, 확인 실패와 다시 확인, 새 버전이 있어요와 업데이트', async () => {
  await launch();
  await openSettings();

  await sendUpdate({ status: { kind: 'up-to-date' } });
  await expect(versionRow()).toContainText('최신 버전이에요');
  await expect(versionRow().getByRole('button')).toHaveCount(0);

  await sendUpdate({ status: { kind: 'check-failed' } });
  await expect(versionRow()).toContainText('새 버전을 확인하지 못했어요');
  await expect(versionRow().getByRole('button', { name: '다시 확인' })).toBeVisible();

  await sendUpdate({ status: { kind: 'ready', version: '9.9.0' } });
  await expect(versionRow()).toContainText('새 버전이 있어요');
  await expect(versionRow()).not.toContainText('9.9.0');
  await expect(versionRow().getByRole('button', { name: '업데이트' })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath('version-row-ready.png') });
});

test('새 버전이 준비되면 왼쪽 설정 단추에 주황 점이 붙고, 준비되지 않으면 없다', async () => {
  await launch();
  /** 세로 줄의 설정 단추. */
  const settings = page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: /^설정/ });
  await expect(settings.locator('.rail-button__dot')).toHaveCount(0);
  await expect(settings).toHaveAccessibleName('설정');

  await sendUpdate({ status: { kind: 'ready', version: '9.9.0' } });
  await expect(settings.locator('.rail-button__dot')).toBeVisible();
  await expect(settings).toHaveAccessibleName('설정, 새 버전이 있어요');
  // 다른 화면에 있어도 점은 붙어 있다
  await expect(page.getByRole('main', { name: '현황' })).toBeVisible();

  await sendUpdate({ status: { kind: 'check-failed' } });
  await expect(settings.locator('.rail-button__dot')).toHaveCount(0);
});

test('"업데이트"를 누르면 확인 모달이 뜨고, "나중에"는 아무것도 하지 않고 닫는다', async () => {
  await seedLesson();
  await launch();
  await setClock(lessonStart - 23);
  await openSettings();
  await sendUpdate({ status: { kind: 'ready', version: '9.9.0' } });

  await versionRow().getByRole('button', { name: '업데이트' }).click();
  /** 확인 모달. */
  const dialog = page.getByRole('dialog', { name: '업데이트할까요?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.modal__dog')).toBeVisible();
  /** 앱 버전. */
  const version = await app!.evaluate(({ app: electronApp }) => electronApp.getVersion());
  await expect(dialog.locator('.update-versions')).toContainText(version);
  await expect(dialog.locator('.update-versions')).toContainText('9.9.0');
  await expect(dialog).toContainText('앱이 잠깐 꺼졌다가 다시 켜져요.');
  await expect(dialog).toContainText(/다음 종까지 2[23]분 남았어요\./);
  // 수업 중에 Enter 한 번으로 꺼지지 않게 처음 초점은 "나중에"다
  await expect(dialog.getByRole('button', { name: '나중에' })).toBeFocused();
  await expect(dialog.getByRole('button', { name: '업데이트' })).toBeEnabled();
  // 흐려지며 나타나는 0.15초가 끝난 뒤에 찍는다
  await expect(page.locator('.modal-backdrop')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: test.info().outputPath('update-modal.png') });

  await dialog.getByRole('button', { name: '나중에' }).click();
  await expect(dialog).toHaveCount(0);
  // 설치하지 않았으니 새 버전은 그대로 준비돼 있다
  await expect(versionRow().getByRole('button', { name: '업데이트' })).toBeEnabled();

  // Esc도 아무것도 하지 않고 닫는다
  await versionRow().getByRole('button', { name: '업데이트' }).click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('다음 종까지 2분이 안 남으면 "업데이트"가 잠기고 "종이 울린 뒤에 할 수 있어요"가 보인다', async () => {
  await seedLesson();
  await launch();
  await setClock(lessonStart - 3);
  await openSettings();
  await sendUpdate({ status: { kind: 'ready', version: '9.9.0' } });
  /** 버전 줄의 업데이트 단추. */
  const rowButton = versionRow().getByRole('button', { name: '업데이트' });
  await expect(rowButton).toBeEnabled();

  // 모달을 연 채 2분 안으로 들어오면 모달의 단추도 잠긴다
  await rowButton.click();
  /** 확인 모달. */
  const dialog = page.getByRole('dialog', { name: '업데이트할까요?' });
  await expect(dialog).toContainText(/다음 종까지 [23]분 남았어요\./);
  await setClock(lessonStart - 1);
  await expect(dialog.getByRole('button', { name: '업데이트' })).toBeDisabled();
  await expect(dialog).toContainText('종이 울린 뒤에 할 수 있어요.');
  await page.keyboard.press('Escape');

  await expect(rowButton).toBeDisabled();
  await expect(versionRow()).toContainText('종이 울린 뒤에 할 수 있어요');
  await page.screenshot({ path: test.info().outputPath('version-row-locked.png') });

  // 종이 울리는 중에도 잠긴다. 다음 종이 멀어도 같다
  await setClock(lessonStart + 10);
  await expect(rowButton).toBeEnabled();
  await sendUpdate({ status: { kind: 'ready', version: '9.9.0' } }, { bellRinging: true });
  await expect(rowButton).toBeDisabled();
  await expect(versionRow()).toContainText('종이 울린 뒤에 할 수 있어요');
});

test('앱 내 업데이트로 다시 켜지면 자동 시작이어도 창을 열고 "<버전>으로 업데이트했어요"를 한 번 알린다', async () => {
  /** 이 실행의 앱 버전. package.json의 version이다. */
  const version: string = JSON.parse(await readFile(resolve(__dirname, '../package.json'), 'utf8')).version;
  await writeFile(join(dataDir, UPDATE_ATTEMPT_FILE), JSON.stringify({ from: '0.0.1', to: version }));
  await launch(AUTO_START_ARG);

  /** 기대하는 알림 문장. 끝 숫자의 소리에 맞춘 조사가 붙는다. */
  const text = new RegExp(`^${version.replaceAll('.', '\\.')}(으로|로) 업데이트했어요$`);
  await expect(page.getByRole('status').filter({ hasText: text })).toBeVisible();
  expect(await app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().some((w) => w.isVisible() && w.webContents.getURL().endsWith('/index.html')))).toBe(true);
  // 알렸으면 메인도 잊는다
  await expect.poll(async () => (await mainState()).update.justUpdated).toBeNull();
});
