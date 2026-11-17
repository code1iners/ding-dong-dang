import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { emptyData, WEEKDAYS, type Data } from '../src/shared/data';

// 강아지 그리기와 창 안의 강아지(고리 안, 처음 닫을 때 모달, 시계판 가운데).
// 종이 울리는 동안 고리 안 강아지를 누르면 멈추는 것은 실제 시각을 기다려야 해서 bell-playback.spec.ts에서 본다.

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

/** 저장 파일을 쓰고 앱을 띄운다. */
async function launch(patch: Partial<Data> = {}): Promise<void> {
  const data: Data = { ...emptyData(), ...patch, settings: { ...emptyData().settings, hideNoticeShown: true, ...patch.settings } };
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
}

/** 고리 안 강아지의 그림 칸. */
const ringDog = () => page.locator('.ring-dog .dog-art');

/** 시간표는 있지만 오늘 요일에 배정이 없는 저장 값. 현황은 "수업 없는 날"이다. */
function noClassToday(): Partial<Data> {
  const today = WEEKDAYS[(new Date().getDay() + 6) % 7]!;
  /** 오늘이 아닌 요일 하나. */
  const other = WEEKDAYS.find((d) => d !== today)!;
  return {
    timetables: [{ id: 't', name: '시험반', color: 0, periods: [{ start: 600, end: 650 }] }],
    weekdays: { ...emptyData().weekdays, [other]: 't' },
  };
}

test('강아지 견본: 두 테마의 여섯 동작이 모두 그려지고, 동작별 캡처를 남긴다', async () => {
  await launch();
  /** 견본을 띄운 창. 빌드한 renderer의 dog-gallery.html이다. */
  const gallery = app!.waitForEvent('window', (p) => p.url().endsWith('dog-gallery.html'));
  await app!.evaluate(async ({ BrowserWindow, app: electronApp }) => {
    const win = new BrowserWindow({ width: 720, height: 1700, show: false });
    await win.loadFile(`${electronApp.getAppPath()}/out/renderer/dog-gallery.html`);
  });
  const view = await gallery;
  await expect(view.locator('body')).toHaveAttribute('data-ready', 'true');
  /** 칸마다의 [테마, 동작, 시각, 그려졌는지]. */
  const cells = await view.locator('.cell').evaluateAll((els) =>
    els.map((el) => [(el as HTMLElement).dataset.theme, (el as HTMLElement).dataset.action, (el as HTMLElement).dataset.t, (el as HTMLElement).dataset.ok]),
  );
  // 2 테마 × 6 동작 × 5 시각
  expect(cells).toHaveLength(60);
  expect(cells.filter((c) => c[3] !== 'true')).toEqual([]);
  // 부위 표의 모든 부위가 그림에서 요소를 찾았는지: 표에 적은 번호의 요소가 실제로 transform을 받았다
  const moved = await view.evaluate(() => {
    /** 테마 → 움직임을 받은 요소 수. 동작 '이동'에서 센다. */
    const out: Record<string, number> = {};
    for (const cell of document.querySelectorAll<HTMLElement>('.cell[data-action="move"][data-t="0.11"]')) {
      out[cell.dataset.theme!] = cell.querySelectorAll('[transform*="matrix"]').length;
    }
    return out;
  });
  expect(moved['orange-sitting']).toBeGreaterThan(10);
  expect(moved['bucktooth']).toBeGreaterThan(20);
  // 뻐드렁니 강아지의 그림자는 그리지 않는다
  const shadowHidden = await view.evaluate(
    () => document.querySelector('.cell[data-theme="bucktooth"] svg')!.querySelectorAll('path')[4]!.getAttribute('display'),
  );
  expect(shadowHidden).toBe('none');
  await view.screenshot({ path: 'test-results/dog-gallery.png', fullPage: true });
});

test('고리 안 강아지: 시간표가 없으면 평소, 수업 없는 날이면 졸림이다', async () => {
  await launch();
  await expect(ringDog()).toHaveAttribute('data-dog-action', 'idle');
  await expect(ringDog()).toHaveAttribute('data-dog-theme', 'orange-sitting');
  await expect(ringDog().locator('svg path').first()).toBeAttached();
  await app!.close();

  await launch(noClassToday());
  await expect(page.getByText('오늘은 수업이 없어요')).toBeVisible();
  await expect(ringDog()).toHaveAttribute('data-dog-action', 'sleepy');
  await page.locator('.ring').screenshot({ path: 'test-results/ring-dog-sleepy.png' });
});

test('고리 안 강아지를 누르면 2초쯤 신남이 되고 하트 8개가 떠올라 사라진다', async () => {
  await launch(noClassToday());
  await expect(ringDog()).toHaveAttribute('data-dog-action', 'sleepy');
  // 종이 울리지 않을 때의 이름은 그냥 강아지다
  const button = page.getByRole('button', { name: '강아지', exact: true });
  await button.click();
  await expect(ringDog()).toHaveAttribute('data-dog-action', 'happy');
  await expect(page.locator('.heart')).toHaveCount(8);
  await page.locator('.ring').screenshot({ path: 'test-results/ring-dog-happy.png' });
  // 하트는 늦게 시작한 것까지 누른 뒤 1초 안에 사라지고 DOM에서도 빠진다
  await expect(page.locator('.heart')).toHaveCount(0, { timeout: 1_500 });
  // 2초쯤 지나면 원래 동작으로 돌아온다
  await expect(ringDog()).toHaveAttribute('data-dog-action', 'sleepy', { timeout: 3_000 });
});

test('강아지는 움직이고, OS의 동작 줄이기가 켜져 있으면 멈춘 그림이다', async () => {
  await launch();
  /** 고리 안 강아지 그림의 모든 transform을 이은 글. */
  const pose = () => ringDog().evaluate((el) => [...el.querySelectorAll('[transform]')].map((e) => e.getAttribute('transform')).join('|'));
  // 평소는 초당 4번 그리므로 1초 안에 자세가 바뀐다
  const first = await pose();
  await expect.poll(pose, { timeout: 2_000 }).not.toBe(first);

  await page.emulateMedia({ reducedMotion: 'reduce' });
  // 동작 줄이기로 바뀐 뒤 한 번 다시 그린 자세에서 멈춘다
  await page.waitForTimeout(300);
  const still = await pose();
  await page.waitForTimeout(1_200);
  expect(await pose()).toBe(still);
});

test('처음 닫을 때 모달과 시간표 시계판 가운데에 강아지가 나온다', async () => {
  await launch({ ...noClassToday(), settings: { ...emptyData().settings, hideNoticeShown: false } });
  await page.getByRole('button', { name: '시간표' }).click();
  await expect(page.locator('.dial .dog-art svg')).toBeAttached();
  await expect(page.locator('.dial .dog-art')).toHaveAttribute('data-dog-action', 'idle');
  await page.locator('.card--dial').screenshot({ path: 'test-results/dial-dog.png' });

  await (await app!.browserWindow(page)).evaluate((w) => w.close());
  const modal = page.getByRole('dialog', { name: '딩동댕은 계속 켜져 있어요' });
  await expect(modal).toBeVisible();
  await expect(modal.locator('.dog-art svg')).toBeVisible();
  await modal.screenshot({ path: 'test-results/close-modal-dog.png' });
});
