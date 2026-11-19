import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { emptyData, type Data } from '../src/shared/data';
import { timetableFields, weekdayOf, weekdayOtherThan } from './timetable-fixture';
import { DOG_THEME_INFOS } from '../src/shared/dog-themes';

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
  return timetableFields([{ id: 't', name: '시험반', days: [weekdayOtherThan(weekdayOf())], periods: [{ start: 600, end: 650 }] }]);
}

test('강아지 견본: 일곱 테마(전신 그림 둘 포함)의 여섯 동작이 모두 그려지고, 동작별 캡처를 남긴다', async () => {
  await launch();
  /** 견본을 띄운 창. 빌드한 renderer의 dog-gallery.html이다. */
  const gallery = app!.waitForEvent('window', (p) => p.url().endsWith('dog-gallery.html'));
  await app!.evaluate(async ({ BrowserWindow, app: electronApp }) => {
    const win = new BrowserWindow({ width: 720, height: 1000, show: false });
    await win.loadFile(`${electronApp.getAppPath()}/out/renderer/dog-gallery.html`);
  });
  const view = await gallery;
  await expect(view.locator('body')).toHaveAttribute('data-ready', 'true');
  /** 칸마다의 [테마, 동작, 시각, 그려졌는지]. */
  const cells = await view.locator('.cell').evaluateAll((els) =>
    els.map((el) => [(el as HTMLElement).dataset.theme, (el as HTMLElement).dataset.action, (el as HTMLElement).dataset.t, (el as HTMLElement).dataset.ok]),
  );
  // (7 테마 + 전신 그림 2) × 6 동작 × 5 시각
  expect(cells).toHaveLength(270);
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
  // 모든 그림이 이동에서 움직인다. 걷는 두 테마는 다리까지 움직여 요소가 더 많다
  expect(Object.keys(moved).sort()).toEqual(
    ['beagle', 'bucktooth', 'code-orange', 'creative', 'fluent-face', 'fluent-face-floor', 'noto-face', 'noto-face-floor', 'orange-sitting'].sort(),
  );
  for (const [id, count] of Object.entries(moved)) expect(count, id).toBeGreaterThan(3);
  expect(moved['bucktooth']).toBeGreaterThan(20);
  expect(moved['code-orange']).toBeGreaterThan(10);
  // 동작마다 움직임을 받은 요소가 모두 다르게 그려진다: 평소 · 신남 · 졸림의 자세가 서로 같지 않다
  const distinct = await view.evaluate(() => {
    /** 테마 → 평소 · 신남 · 졸림이 서로 다른지(0.33초 자세의 transform 글자를 견준다). */
    const out: Record<string, boolean> = {};
    /** 칸 하나의 모든 transform을 이은 글. */
    const pose = (theme: string, action: string) =>
      [...document.querySelectorAll(`.cell[data-theme="${theme}"][data-action="${action}"][data-t="0.33"] [transform]`)]
        .map((el) => el.getAttribute('transform'))
        .join('|');
    for (const theme of new Set([...document.querySelectorAll<HTMLElement>('.cell')].map((c) => c.dataset.theme!))) {
      out[theme] = new Set([pose(theme, 'idle'), pose(theme, 'happy'), pose(theme, 'sleepy')]).size === 3;
    }
    return out;
  });
  expect(Object.entries(distinct).filter(([, ok]) => !ok)).toEqual([]);
  /** 테마 그림에서 번호 순서로 센 그리는 요소의 display 값. */
  const displayOf = (theme: string, index: number) =>
    view.evaluate(
      ([t, i]) => {
        /** 그림에서 그리는 요소들(defs · clipPath · mask 안은 뺀다). */
        const drawn = [...document.querySelector(`.cell[data-theme="${t}"] svg`)!.querySelectorAll('path, circle, ellipse, rect, polygon, polyline, line')].filter(
          (el) => !el.closest('defs, clipPath, mask'),
        );
        return drawn[i as number]!.getAttribute('display');
      },
      [theme, index] as const,
    );
  // 뻐드렁니 강아지의 그림자(요소 4)는 그리지 않는다
  const shadowHidden = await displayOf('bucktooth', 4);
  expect(shadowHidden).toBe('none');
  // 갈색 · 흰색 강아지의 풀밭(요소 0)도 그리지 않는다
  const grassHidden = await displayOf('beagle', 0);
  expect(grassHidden).toBe('none');
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

/** 저장 파일에 적힌 강아지 테마. */
async function savedTheme(): Promise<string> {
  return JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')).settings.dogTheme;
}

/** 설정 화면을 연다. */
async function openSettings(): Promise<void> {
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
}

test('설정 맨 위에 테마 일곱 개가 그림만 나란히 있고 평소 동작으로 움직이며, 누르면 바로 적용하고 저장한다', async () => {
  await launch();
  await openSettings();
  /** 테마 고르기 묶음. */
  const group = page.getByRole('radiogroup', { name: '강아지 테마' });
  /** 테마 단추들. */
  const options = group.getByRole('radio');
  await expect(options).toHaveCount(7);
  expect(await options.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))).toEqual(DOG_THEME_INFOS.map((t) => t.name));
  // 이름은 화면에 글자로 나오지 않는다(그림 파일 안의 style · 편집기 메타데이터 글자는 보이지 않으므로 innerText로 본다)
  expect((await group.evaluate((el) => (el as HTMLElement).innerText)).trim()).toBe('');
  // 일곱 개 모두 그림이 있고 평소 동작이며, 설정 줄들보다 위에 있다
  expect(await group.locator('.dog-art').evaluateAll((els) => els.map((el) => el.getAttribute('data-dog-action')))).toEqual(Array(7).fill('idle'));
  await expect(group.locator('svg')).toHaveCount(7);
  const groupTop = (await group.boundingBox())!.y;
  const firstRowTop = (await page.getByText('컴퓨터를 켜면 자동 시작').boundingBox())!.y;
  expect(groupTop).toBeLessThan(firstRowTop);
  // 기본 테마가 골라져 있다
  await expect(options.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect(options.filter({ has: page.locator('[aria-checked=true]') })).toHaveCount(0);
  expect(await savedTheme()).toBe('orange-sitting');

  /** 테마를 바꾸기 전의 화면 색 · 글꼴 · 모양. 테마는 그림과 움직임만 바꾼다. */
  const look = () =>
    page.evaluate(() => {
      /** 요소의 계산된 스타일 중 모양을 정하는 값들. */
      const style = (sel: string) => {
        const c = getComputedStyle(document.querySelector(sel)!);
        return [c.backgroundColor, c.color, c.fontFamily, c.fontSize, c.borderRadius].join('/');
      };
      return ['body', '.card', '.rail-button', '[role=switch]'].map(style);
    });
  const before = await look();

  // 마지막 테마를 누르면 바로 골라지고 저장된다
  await options.nth(6).click();
  await expect(options.nth(6)).toHaveAttribute('aria-checked', 'true');
  await expect(options.nth(0)).toHaveAttribute('aria-checked', 'false');
  await expect.poll(savedTheme).toBe('creative');
  expect(await look()).toEqual(before);
  await page.screenshot({ path: 'test-results/settings-theme-picker.png' });

  // 화살표 키로도 옮긴다(선택 하나짜리 묶음)
  await options.nth(6).focus();
  await page.keyboard.press('ArrowRight');
  await expect(options.nth(0)).toHaveAttribute('aria-checked', 'true');
  await expect.poll(savedTheme).toBe('orange-sitting');
  await expect(options.nth(0)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(options.nth(6)).toHaveAttribute('aria-checked', 'true');
  await expect.poll(savedTheme).toBe('creative');

  // 메인은 없는 테마 id를 거절한다
  await expect(page.evaluate(() => window.dingdong.command({ type: 'set-dog-theme', id: 'nope' }))).rejects.toThrow();
  expect(await savedTheme()).toBe('creative');
});

test('설정에서 테마를 바꾸면 고리 안 강아지가 바뀌고, 앱을 다시 띄워도 유지된다', async () => {
  await launch();
  await expect(ringDog()).toHaveAttribute('data-dog-theme', 'orange-sitting');
  await openSettings();
  await page.getByRole('radio', { name: '뻐드렁니 강아지' }).click();
  await expect.poll(savedTheme).toBe('bucktooth');
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '현황' }).click();
  await expect(ringDog()).toHaveAttribute('data-dog-theme', 'bucktooth');
  await expect(ringDog().locator('svg path').first()).toBeAttached();
  await app!.close();

  // 저장 파일을 건드리지 않고 같은 데이터 폴더로 다시 띄운다
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
  await expect(ringDog()).toHaveAttribute('data-dog-theme', 'bucktooth');
  await openSettings();
  await expect(page.getByRole('radio', { name: '뻐드렁니 강아지' })).toHaveAttribute('aria-checked', 'true');
  expect(await savedTheme()).toBe('bucktooth');

  // 고른 테마가 시계판 가운데에도 나온다
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '시간표' }).click();
  await expect(page.locator('.dial__dog')).toHaveAttribute('data-dog-theme', 'bucktooth');
});

test('일곱 테마 모두 고리 안에 그려진다', async () => {
  await launch();
  for (const info of DOG_THEME_INFOS) {
    await app!.close();
    await launch({ settings: { ...emptyData().settings, dogTheme: info.id } });
    await expect(ringDog()).toHaveAttribute('data-dog-theme', info.id);
    await expect(ringDog().locator('svg')).toHaveCount(1);
    // 그림이 칸 안에 보이고 잘못 재서 깨지지 않았다
    const box = await ringDog().locator('svg').boundingBox();
    expect(box!.width, info.id).toBeGreaterThan(40);
    expect(box!.height, info.id).toBeGreaterThan(40);
  }
});
