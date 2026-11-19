import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { isHeadlessEnv } from '../src/main/headless';
import { emptyData, type Data, type Weekday } from '../src/shared/data';
import { timetableFields, weekdayOf } from './timetable-fixture';

// 돌아다니는 강아지 창을 실제 앱으로 본다. 행동의 세부(걷기 · 쉬기 길이, 화면 끝)는 shared/roaming-dog.test.ts가 본다.
// 종이 울리는 동안의 확인은 실제 시각을 기다리므로 마지막 테스트 하나에 모았다.

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

/** 저장 파일을 쓰고 앱을 띄운다. 처음 닫을 때 안내는 이미 본 것으로 둔다. */
async function launch(patch: Partial<Data> = {}): Promise<void> {
  const data: Data = { ...emptyData(), ...patch, settings: { ...emptyData().settings, hideNoticeShown: true, ...patch.settings } };
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
}

/** 지금 시각의 자정부터의 분. */
function minuteOfDay(at: Date): number {
  return at.getHours() * 60 + at.getMinutes();
}

/** 오늘 요일 키. getDay()는 일요일이 0이다. */
function today(): Weekday {
  return weekdayOf();
}

/** 강아지 창의 메인 쪽 상태와 주 모니터. */
async function dogWindow() {
  return app!.evaluate(({ BrowserWindow, screen }) => {
    /** 강아지 창들. 하나만 있어야 한다. */
    const dogs = BrowserWindow.getAllWindows().filter((w) => w.webContents.getURL().endsWith('dog.html'));
    /** 주 모니터. */
    const display = screen.getPrimaryDisplay();
    /** 강아지 창. */
    const dog = dogs[0];
    return {
      count: dogs.length,
      visible: dog?.isVisible() ?? false,
      focused: dog?.isFocused() ?? false,
      focusable: dog?.isFocusable() ?? true,
      bounds: dog?.getBounds() ?? null,
      /** 지금 포커스를 가진 창의 화면 파일 이름. 없으면 null. */
      focusedWindow: BrowserWindow.getFocusedWindow()?.webContents.getURL().split('/').pop() ?? null,
      display: { bounds: display.bounds, workArea: display.workArea },
    };
  });
}

/** 강아지 창의 화면. 앱이 뜬 뒤에 만들어지므로 나타날 때까지 기다린다. */
async function dogPage(): Promise<Page> {
  await expect.poll(() => app!.windows().some((p) => p.url().endsWith('dog.html'))).toBe(true);
  return app!.windows().find((p) => p.url().endsWith('dog.html'))!;
}

/** 강아지 그림의 모든 transform을 이은 글. 다시 그리면 바뀐다. */
const pose = (dog: Page) =>
  dog.locator('.roaming-dog').evaluate((el) => [...el.querySelectorAll('[transform]')].map((e) => e.getAttribute('transform')).join('|'));

/** 앱 창이 받은 "지금 종이 울리는 중인지". */
const ringing = () =>
  page.evaluate(
    () =>
      new Promise<boolean>((done) => {
        const stop = window.dingdong.subscribe((s) => {
          stop();
          done(s.bellRinging);
        });
      }),
  );

/** 저장 파일의 설정. */
async function savedSettings(): Promise<Data['settings']> {
  return (JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data).settings;
}

test('앱을 띄우면 주 모니터 바닥에 포커스를 받지 않는 강아지 창이 하나 뜨고, 앱 창을 숨겨도 남는다', async () => {
  await launch();
  await expect.poll(async () => (await dogWindow()).visible).toBe(true);
  /** 강아지 창의 화면. */
  const dog = await dogPage();
  /** 처음 뜬 강아지 창의 상태. */
  const state = await dogWindow();
  expect(state.count).toBe(1);
  expect(state.focused).toBe(false);
  expect(state.focusable).toBe(false);
  // 강아지 발끝(창 아래 끝에서 6px 위)이 작업 영역의 바닥에 있고, 강아지 가운데가 주 모니터 안이다
  const { bounds, display } = state;
  expect(bounds!.y + bounds!.height - 6).toBe(display.workArea.y + display.workArea.height);
  /** 강아지 창(곧 강아지)의 가로 가운데. */
  const center = bounds!.x + bounds!.width / 2;
  expect(center).toBeGreaterThan(display.bounds.x);
  expect(center).toBeLessThan(display.bounds.x + display.bounds.width);
  // 키 96인 기본 테마의 그림이 붙었다. 시간표가 없으면 졸림이다
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'sleepy');
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-theme', 'orange-sitting');
  expect((await dog.locator('.roaming-dog').boundingBox())!.height).toBe(96);
  await dog.screenshot({ path: 'test-results/roaming-dog-window.png', omitBackground: true });

  // 앱 창을 숨겨도 강아지 창은 그대로다
  await (await app!.browserWindow(page)).evaluate((w) => w.close());
  await expect.poll(async () => app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('index.html'))!.isVisible())).toBe(false);
  expect((await dogWindow()).visible).toBe(true);
});

test('앱을 시작할 때마다 바닥의 무작위 위치에 나타난다', async () => {
  /** 띄울 때마다의 강아지 창 x. */
  const xs: number[] = [];
  for (let i = 0; i < 3; i++) {
    await launch();
    await expect.poll(async () => (await dogWindow()).visible).toBe(true);
    xs.push((await dogWindow()).bounds!.x);
    await app!.close();
    app = undefined;
  }
  expect(new Set(xs).size).toBeGreaterThan(1);
});

test('수업 중에는 걸어 다니고, 걷는 테마는 걷는 쪽으로 그림을 돌린다', async () => {
  // 자정을 넘기는 수업 시간은 저장할 수 없어, 하루의 마지막 몇 분이면 자정이 지나기를 기다린다
  while (minuteOfDay(new Date()) >= 24 * 60 - 3) await new Promise((r) => setTimeout(r, 5_000));
  const now = minuteOfDay(new Date());
  await launch({
    ...timetableFields([{ id: 't', name: '시험반', days: [today()], periods: [{ start: now, end: now + 2 }] }]),
    settings: { ...emptyData().settings, dogTheme: 'bucktooth' },
  });
  const dog = await dogPage();
  // 수업 중에는 걷기부터 한다
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'move');
  /** 처음 창 자리. */
  const first = (await dogWindow()).bounds!.x;
  await expect.poll(async () => (await dogWindow()).bounds!.x, { timeout: 2_000 }).not.toBe(first);
  /** 걸은 쪽. */
  const direction = Math.sign((await dogWindow()).bounds!.x - first);
  // 뻐드렁니 강아지는 오른쪽을 보는 그림이라, 왼쪽으로 걸으면 뒤집는다
  /** 그림을 돌리는 변환. */
  const flip = await dog.locator('.roaming-dog__flip').evaluate((el) => (el as HTMLElement).style.transform);
  expect(flip).toBe(`scaleX(${direction})`);
  await dog.screenshot({ path: 'test-results/roaming-dog-walk.png', omitBackground: true });
});

test('얼굴 테마(Fluent Emoji, Noto Emoji)는 화면 바닥에서 같은 세트의 전신 그림으로 나온다', async () => {
  // 그리는 요소 수로 그림을 가린다: Fluent 얼굴 9 · 전신 8, Noto 얼굴 12 · 전신 17(themes.ts의 부위 표)
  for (const [themeId, drawn] of [
    ['fluent-face', 8],
    ['noto-face', 17],
  ] as const) {
    await launch({ settings: { ...emptyData().settings, dogTheme: themeId } });
    /** 강아지 창의 화면. */
    const dog = await dogPage();
    await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-theme', themeId);
    await expect(dog.locator('.roaming-dog__flip svg').locator('path, circle, ellipse, rect, polygon, polyline, line')).toHaveCount(drawn);
    await dog.screenshot({ path: `test-results/roaming-dog-${themeId}.png`, omitBackground: true });
    await app!.close();
    app = undefined;
  }
});

test('강아지를 누르면 2초쯤 신남이 되고 하트 8개가 떠올라 사라진다', async () => {
  await launch();
  const dog = await dogPage();
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'sleepy');
  await dog.locator('.roaming-dog').click();
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'happy');
  await expect(dog.locator('.heart')).toHaveCount(8);
  // 하트가 떠오르는 중간에 찍는다
  await dog.waitForTimeout(250);
  await dog.screenshot({ path: 'test-results/roaming-dog-hearts.png', omitBackground: true });
  await expect(dog.locator('.heart')).toHaveCount(0, { timeout: 1_500 });
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'sleepy', { timeout: 3_000 });
  // 창은 포커스를 받지 않는다
  expect((await dogWindow()).focused).toBe(false);
});

test('커서가 강아지 그림 위에 있을 때만 강아지 창이 클릭을 받는다', async () => {
  await launch();
  await expect.poll(async () => (await dogWindow()).visible).toBe(true);
  // 실제 마우스 대신 메인이 읽는 커서 위치를 바꿔 끼우고, 강아지 창의 클릭 통과 설정이 바뀌는 것을 본다
  await app!.evaluate(({ BrowserWindow, screen }) => {
    const g = globalThis as unknown as { __ignore: boolean[]; __cursor: Electron.Point };
    const dog = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('dog.html'))!;
    g.__ignore = [];
    g.__cursor = { x: -100_000, y: -100_000 };
    const set = dog.setIgnoreMouseEvents.bind(dog);
    dog.setIgnoreMouseEvents = (ignore, options) => {
      g.__ignore.push(ignore);
      set(ignore, options);
    };
    screen.getCursorScreenPoint = () => g.__cursor;
  });
  /** 커서를 그 자리로 옮긴다. */
  const moveCursor = (x: number, y: number) =>
    app!.evaluate((_, point) => {
      (globalThis as unknown as { __cursor: Electron.Point }).__cursor = point;
    }, { x, y });
  /** 마지막으로 정한 클릭 통과 값. 바꾼 적이 없으면 처음 값(통과)이다. */
  const ignoring = () => app!.evaluate(() => (globalThis as unknown as { __ignore: boolean[] }).__ignore.at(-1) ?? true);

  const { bounds } = await dogWindow();
  /** 강아지 발끝 가운데. 창 아래 가운데에서 6px 위다. */
  const feet = { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height - 6 };
  // 강아지 그림 위: 클릭을 받는다
  await moveCursor(feet.x, feet.y - 40);
  await expect.poll(ignoring, { timeout: 500 }).toBe(false);
  // 창 안이지만 강아지 밖(창의 왼쪽 위 여백): 다시 통과시킨다
  await moveCursor(bounds!.x + 4, bounds!.y + 4);
  await expect.poll(ignoring, { timeout: 500 }).toBe(true);
  // 창 밖: 통과 그대로다
  await moveCursor(feet.x + 1000, feet.y);
  await new Promise((r) => setTimeout(r, 200));
  expect(await ignoring()).toBe(true);
});

/**
 * 실제 마우스 대신 메인이 읽는 커서 위치를 바꿔 끼운다. 끌기의 위치는 메인이 이 값으로 정한다.
 * 돌려주는 함수로 커서를 옮긴다.
 */
async function fakeCursor(start: Electron.Point): Promise<(x: number, y: number) => Promise<void>> {
  await app!.evaluate(({ screen }, point) => {
    const g = globalThis as unknown as { __cursor: Electron.Point };
    g.__cursor = point;
    screen.getCursorScreenPoint = () => g.__cursor;
  }, start);
  return (x, y) =>
    app!.evaluate((_, point) => {
      (globalThis as unknown as { __cursor: Electron.Point }).__cursor = point;
    }, { x, y });
}

/** 강아지 창의 자리로 본 강아지 발끝 가운데(화면 좌표). 창 아래 가운데에서 6px 위다. */
async function feet(): Promise<Electron.Point> {
  const { bounds } = await dogWindow();
  return { x: bounds!.x + bounds!.width / 2, y: bounds!.y + bounds!.height - 6 };
}

test('강아지를 끌면 커서를 따라오고 주 모니터 밖으로 나가지 않으며, 놓으면 낙하산을 펴고 수직으로 내려와 착지한다. 내려오는 중에 다시 잡을 수 있다', async () => {
  test.setTimeout(60_000);
  await launch();
  const dog = await dogPage();
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'sleepy');
  const { display } = await dogWindow();
  const start = await feet();
  /** 강아지 칸 안의 누를 자리(창 안 좌표). 발끝에서 40px 위다. */
  const boxBox = (await dog.locator('.roaming-dog').boundingBox())!;
  const press = { x: boxBox.x + boxBox.width / 2, y: boxBox.y + boxBox.height - 40 };
  const moveCursor = await fakeCursor({ x: start.x, y: start.y - 40 });

  // 누르고 커서를 옮기면 끌려가기가 되고, 누른 자리(발끝 40px 위)를 커서 밑에 둔 채 따라온다
  await dog.mouse.move(press.x, press.y);
  await dog.mouse.down();
  await moveCursor(start.x + 20, start.y - 40);
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'drag');
  /** 커서에서 발끝까지의 거리. */
  const grab = { x: 0, y: 40 };
  const target = { x: display.bounds.x + 400, y: display.bounds.y + 300 };
  await moveCursor(target.x, target.y);
  /** 발끝이 그 자리에서 1px(창 자리의 반올림) 안에 있는지. */
  const near = async (x: number | null, y: number | null) => {
    const f = await feet();
    return (x === null || Math.abs(f.x - x) <= 1) && (y === null || Math.abs(f.y - y) <= 1);
  };
  await expect.poll(() => near(target.x + grab.x, target.y + grab.y), { timeout: 1_000 }).toBe(true);
  await dog.screenshot({ path: 'test-results/roaming-dog-drag.png', omitBackground: true });

  // 주 모니터 밖(위 · 왼쪽 · 오른쪽)으로 커서를 내보내도 강아지는 끝에서 멈춘다
  /** 강아지 칸의 키와 너비. */
  const height = boxBox.height;
  const width = boxBox.width;
  await moveCursor(display.bounds.x - 2000, display.bounds.y - 2000);
  // 좌우는 걸어 다니는 범위(끝에서 반 너비 + 8px)까지, 위로는 머리가 위 끝에 닿을 때까지다
  await expect.poll(() => near(display.bounds.x + width / 2 + 8, display.bounds.y + height), { timeout: 1_000 }).toBe(true);
  await moveCursor(display.bounds.x + display.bounds.width + 2000, display.bounds.y + 200);
  await expect.poll(() => near(display.bounds.x + display.bounds.width - width / 2 - 8, null), { timeout: 1_000 }).toBe(true);

  // 맨 위에서 놓으면 낙하산이 펼쳐지고, 옆으로 흐르지 않고 내려와 7~8초 뒤 바닥에 착지한다
  await moveCursor(target.x, display.bounds.y - 2000);
  await expect.poll(() => near(null, display.bounds.y + height), { timeout: 1_000 }).toBe(true);
  const top = await feet();
  await dog.mouse.up();
  const releasedAt = Date.now();
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'fall');
  await expect(dog.locator('.parachute')).toHaveAttribute('data-state', 'open');
  await dog.waitForTimeout(600);
  await dog.screenshot({ path: 'test-results/roaming-dog-parachute.png', omitBackground: true });
  // 내려온 뒤에는 하트가 나오지 않는다(끌고 놓은 것은 누른 것이 아니다)
  expect(await dog.locator('.heart').count()).toBe(0);
  /** 내려오는 동안 본 발끝. */
  const seen: Electron.Point[] = [];
  const floorY = display.workArea.y + display.workArea.height;
  while ((await dog.locator('.roaming-dog').getAttribute('data-dog-action')) === 'fall' && Date.now() - releasedAt < 12_000) {
    seen.push(await feet());
    await dog.waitForTimeout(250);
  }
  /** 놓은 뒤 착지까지 걸린 시간(초). 확인 간격만큼 늦게 잴 수 있다. */
  const seconds = (Date.now() - releasedAt) / 1000;
  expect(seconds).toBeGreaterThanOrEqual(7);
  expect(seconds).toBeLessThanOrEqual(8.5);
  expect(new Set(seen.map((f) => f.x))).toEqual(new Set([top.x]));
  expect(seen.every((f, i) => i === 0 || f.y >= seen[i - 1]!.y)).toBe(true);
  expect((await feet()).y).toBe(floorY);
  await expect(dog.locator('.parachute')).toHaveAttribute('data-state', 'fold');

  // 다시 끌어 올려 놓고, 내려오는 중에 다시 잡으면 낙하를 멈추고 끌려간다
  const ground = await feet();
  await moveCursor(ground.x, ground.y - 40);
  await dog.mouse.down();
  await moveCursor(ground.x, ground.y - 400);
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'drag');
  await dog.mouse.up();
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'fall');
  await dog.waitForTimeout(500);
  const falling = await feet();
  expect(falling.y).toBeGreaterThan(ground.y - 400 + 40);
  expect(falling.y).toBeLessThan(floorY);
  // 강아지 칸은 창 안에서 늘 같은 자리라, 같은 자리를 누르면 내려오는 강아지를 누른 것이다
  await moveCursor(falling.x, falling.y - 40);
  await dog.mouse.down();
  await moveCursor(falling.x + 200, falling.y - 40);
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'drag');
  await expect(dog.locator('.parachute')).not.toHaveAttribute('data-state', 'open');
  await expect.poll(() => near(falling.x + 200, null), { timeout: 1_000 }).toBe(true);
  await dog.mouse.up();
  // 창은 포커스를 받지 않는다
  expect((await dogWindow()).focused).toBe(false);
});

test('설정의 크기 슬라이더를 움직이면 즉시 저장되고 강아지 · 하트 · 낙하산이 함께 커진다. 키 64와 160에서 하트와 낙하산이 창 안에 다 들어온다', async () => {
  test.setTimeout(60_000);
  await launch();
  const dog = await dogPage();
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'sleepy');
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
  /** 크기 슬라이더. 기본 키는 96이다. */
  const slider = page.getByRole('slider', { name: '강아지 크기' });
  await expect(slider).toHaveValue('96');

  for (const height of [64, 160]) {
    // 키보드로 끝까지 옮긴다(Home은 64, End는 160)
    await slider.focus();
    await page.keyboard.press(height === 64 ? 'Home' : 'End');
    await expect(slider).toHaveValue(String(height));
    await expect.poll(async () => (await savedSettings()).dogHeight).toBe(height);
    await expect.poll(async () => (await dog.locator('.roaming-dog').boundingBox())?.height).toBe(height);
    // 창 크기는 검증 티켓의 식이다: 너비 max(1.6W + 92, W + 0.75H, 1.5H) + 8, 높이 1.925H + 18
    const width = (await dog.locator('.roaming-dog').boundingBox())!.width;
    await expect.poll(async () => (await dogWindow()).bounds!.height).toBe(Math.ceil(1.925 * height + 18));
    expect((await dogWindow()).bounds!.width).toBe(Math.ceil(Math.max(1.6 * width + 92, width + 0.75 * height, 1.5 * height) + 8));

    // 끌어 올려 놓아 낙하산을 펴고, 내려오는 중에 눌러 하트를 띄운다
    const at = await feet();
    const moveCursor = await fakeCursor({ x: at.x, y: at.y - height / 2 });
    const box = (await dog.locator('.roaming-dog').boundingBox())!;
    await dog.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await dog.mouse.down();
    await moveCursor(at.x, at.y - height / 2 - 400);
    await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'drag');
    await dog.mouse.up();
    await expect(dog.locator('.parachute')).toHaveAttribute('data-state', 'open');
    await dog.locator('.roaming-dog').click();
    await expect(dog.locator('.heart')).toHaveCount(8);
    await dog.waitForTimeout(450);
    await dog.screenshot({ path: `test-results/roaming-dog-size-${height}.png`, omitBackground: true });
    // 낙하산과 모든 하트(떠오르는 끝까지)가 창 안에 있다
    const inside = await dog.evaluate(() => {
      /** 상자가 창 안에 다 들어오는지. */
      const fits = (r: { left: number; top: number; right: number; bottom: number }) =>
        r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
      /** 낙하산의 상자. */
      const chute = document.querySelector('.parachute')!.getBoundingClientRect();
      // 하트는 떠오르는 동안 움직이므로, 놓인 자리에서 떠오르기를 마친 끝 자리(옆으로 dx, 위로 rise, 1.1배)까지 넣어 본다
      const hearts = [...document.querySelectorAll<HTMLElement>('.heart')].map((h) => {
        const size = parseFloat(h.style.width);
        const left = parseFloat(h.style.left) - size / 2;
        const top = parseFloat(h.style.top) - size / 2;
        const dx = parseFloat(h.style.getPropertyValue('--heart-dx'));
        const rise = parseFloat(h.style.getPropertyValue('--heart-rise'));
        const grow = size * 0.05;
        return {
          left: Math.min(left, left + dx) - grow,
          right: Math.max(left, left + dx) + size + grow,
          top: top + rise - grow,
          bottom: top + size + 6 + grow,
        };
      });
      return { chute: fits(chute), hearts: hearts.every(fits), chuteBox: chute.toJSON() as DOMRect, heartBoxes: hearts, window: [innerWidth, innerHeight] };
    });
    expect(inside.chute, JSON.stringify(inside)).toBe(true);
    expect(inside.hearts, JSON.stringify(inside)).toBe(true);
    // 낙하산은 키에 맞춰 커진다(너비 1.5H)
    expect(Math.round(inside.chuteBox.width)).toBe(Math.round(1.5 * height));
    // 착지할 때까지 기다리지 않고 다음 크기로 넘어간다
  }

  // 고리 안 강아지의 크기는 바뀌지 않는다
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '현황' }).click();
  const ring = page.locator('.ring-dog__button');
  await expect(ring).toBeVisible();
  const before = (await ring.boundingBox())!;
  await page.evaluate(() => window.dingdong.command({ type: 'set-dog-height', height: 64 }));
  await expect.poll(async () => (await savedSettings()).dogHeight).toBe(64);
  expect(await ring.boundingBox()).toEqual(before);
});

test('설정의 "돌아다니는 강아지" 스위치와 트레이 메뉴 항목이 같은 값이고, 끄면 강아지 창이 숨는다', async () => {
  // 트레이에 건네는 메뉴를 가로채어 항목을 읽고 누른다
  await launch();
  await app!.evaluate(({ Menu }) => {
    const spy = ((globalThis as Record<string, unknown>).__traySpy = { menu: null as Electron.Menu | null });
    const build = Menu.buildFromTemplate.bind(Menu);
    Menu.buildFromTemplate = (template) => (spy.menu = build(template));
  });
  /** 트레이 메뉴의 "돌아다니는 강아지" 체크. 메뉴를 다시 만들 때까지는 null이다. */
  const trayChecked = () =>
    app!.evaluate(
      () =>
        (globalThis as unknown as { __traySpy: { menu: Electron.Menu | null } }).__traySpy.menu?.items.find((i) => i.label === '돌아다니는 강아지')
          ?.checked ?? null,
    );
  await expect.poll(async () => (await dogWindow()).visible).toBe(true);

  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
  /** "돌아다니는 강아지" 스위치. 기본은 켜짐이다. */
  const toggle = page.getByRole('switch', { name: '돌아다니는 강아지' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  // 강아지 테마 바로 아래 줄이다(DESIGN.md의 설정 순서)
  expect(await page.locator('.setting-row > span').first().textContent()).toBe('돌아다니는 강아지');

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await dogWindow()).visible).toBe(false);
  await expect.poll(trayChecked).toBe(false);
  expect((await savedSettings()).roamingDog).toBe(false);

  // 트레이 메뉴로 다시 켜면 스위치도 켜지고 강아지 창이 다시 뜬다
  await app!.evaluate(() => {
    const spy = (globalThis as unknown as { __traySpy: { menu: Electron.Menu } }).__traySpy;
    // 체크 항목의 click은 체크를 뒤집은 뒤 동작을 부른다
    spy.menu.items.find((i) => i.label === '돌아다니는 강아지')!.click();
  });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await dogWindow()).visible).toBe(true);
  await expect.poll(trayChecked).toBe(true);
  expect((await savedSettings()).roamingDog).toBe(true);
  expect((await dogWindow()).count).toBe(1);
});

test('화면이 잠기거나 PC가 잠들면 그리기를 멈추고, 풀리면 다시 그린다', async () => {
  await launch();
  const dog = await dogPage();
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'sleepy');
  // 졸림도 그리는 중이므로 1초 안에 자세가 바뀐다
  const moving = await pose(dog);
  await expect.poll(() => pose(dog), { timeout: 2_000 }).not.toBe(moving);

  for (const [lock, unlock] of [
    ['lock-screen', 'unlock-screen'],
    ['suspend', 'resume'],
  ] as const) {
    await app!.evaluate(({ powerMonitor }, ev) => powerMonitor.emit(ev), lock);
    await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-paused', 'true');
    const still = await pose(dog);
    await dog.waitForTimeout(1_200);
    expect(await pose(dog)).toBe(still);

    await app!.evaluate(({ powerMonitor }, ev) => powerMonitor.emit(ev), unlock);
    await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-paused', 'false');
    await expect.poll(() => pose(dog), { timeout: 2_000 }).not.toBe(still);
  }

  // 잠긴 채 잠들었다 깨어나면 화면이 아직 잠겨 있어 멈춘 채로 있고, 잠금이 풀려야 다시 그린다
  for (const ev of ['lock-screen', 'suspend', 'resume'] as const) await app!.evaluate(({ powerMonitor }, e) => powerMonitor.emit(e), ev);
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-paused', 'true');
  await app!.evaluate(({ powerMonitor }) => powerMonitor.emit('unlock-screen'));
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-paused', 'false');
});

test('종이 울리면 강아지가 신남이 되고 누르면 종이 멈추며, 설정을 끈 채 종이 울리면 바닥 가운데에 나타났다 재생이 끝나면 사라진다. 앱 창은 포커스를 잃지 않는다', async () => {
  // 투명하게 띄운 헤드리스 실행에서는 앱 창이 포커스를 받지 못해 포커스 단언이 성립하지 않는다
  test.skip(isHeadlessEnv(process.env), '헤드리스 실행에서는 포커스를 검증할 수 없다');
  test.setTimeout(200_000);
  // 자정을 넘기는 수업 시간은 저장할 수 없어, 하루의 마지막 몇 분이면 자정이 지나기를 기다린다
  while (minuteOfDay(new Date()) >= 24 * 60 - 4) await new Promise((r) => setTimeout(r, 5_000));
  const now = new Date();
  /** 앱이 뜬 뒤 종이 처음 울릴 분. 앱이 뜨고 확인할 시간을 두려고 20초 넘게 남은 분을 고른다. */
  const target = now.getSeconds() < 40 ? minuteOfDay(now) + 1 : minuteOfDay(now) + 2;
  /** 첫 종(시작종)이 울릴 시각. 1분 뒤에 끝종이 울린다. */
  const ringAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, target).getTime();
  await launch({
    // 시작종은 눌러 멈출 틈이 있게 긴 것(웨스트민스터, 8.6초), 끝종은 재생이 끝나는 것까지 빨리 보도록 짧은 것(띠링, 2초)이다
    startBell: 'westminster-start',
    endBell: 'tiring-end',
    ...timetableFields([{ id: 't', name: '시험반', days: [today()], periods: [{ start: target, end: target + 1 }] }]),
  });
  const dog = await dogPage();
  await expect.poll(async () => (await dogWindow()).visible).toBe(true);

  // 시작종이 울리는 동안 돌아다니는 강아지는 제자리에서 신남이다
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'happy', { timeout: ringAt - Date.now() + 10_000 });
  // 울리는 동안 강아지를 누르면 종이 멈춘다. 누른 뒤 2초쯤 신남이고, 그 뒤 수업 중의 동작으로 돌아간다
  await dog.locator('.roaming-dog').click();
  await expect.poll(ringing, { timeout: 2_000 }).toBe(false);
  await expect(dog.locator('.heart')).toHaveCount(8);
  await expect(dog.locator('.roaming-dog')).not.toHaveAttribute('data-dog-action', 'happy', { timeout: 4_000 });

  // 설정을 끄면 강아지 창이 숨는다
  await page.evaluate(() => window.dingdong.command({ type: 'set-roaming-dog', on: false }));
  await expect.poll(async () => (await dogWindow()).visible).toBe(false);

  // 끝종 몇 초 전에 앱 창을 앞으로 가져와 포커스를 주고, 그 뒤로 앱 창이 포커스를 잃는지 기록한다.
  // 이 Mac을 쓰는 사람의 다른 조작이 끼어들지 않게 강아지 창이 나타나는 순간 둘레만 본다
  await new Promise((r) => setTimeout(r, Math.max(0, ringAt + 60_000 - 3_000 - Date.now())));
  await app!.evaluate(({ app: electronApp, BrowserWindow }) => {
    electronApp.focus({ steal: true });
    /** 앱 창. */
    const main = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('index.html'))!;
    main.focus();
    const g = globalThis as unknown as { __blurs: number; __earlyBlurs: number; __dogShown: boolean };
    g.__blurs = 0;
    g.__earlyBlurs = 0;
    g.__dogShown = false;
    // 강아지 창이 뜨기 전에 잃은 포커스는 강아지 창 탓이 아니라 이 Mac의 다른 앱(사람의 조작)이 맨 앞을 가져간 것이다
    BrowserWindow.getAllWindows()
      .find((w) => w.webContents.getURL().endsWith('dog.html'))!
      .once('show', () => (g.__dogShown = true));
    main.on('blur', () => {
      g.__blurs += 1;
      if (!g.__dogShown) g.__earlyBlurs += 1;
    });
  });
  await new Promise((r) => setTimeout(r, 300));
  /** 강아지 창이 나타나기 전에 포커스를 가진 창. 앱이 맨 앞이면 앱 창이다. */
  const focusedBefore = (await dogWindow()).focusedWindow;
  // 다른 시스템 창이 맨 앞을 잡고 있으면 앱 창이 포커스를 받지 못한다. 그때는 직접 보지 못한 것이라 결과에 남긴다
  if (focusedBefore !== 'index.html') test.info().annotations.push({ type: 'warning', description: `앱 창이 포커스를 받지 못했다(${focusedBefore})` });
  /** 앱 창이 포커스를 잃은 횟수. */
  const blurs = () => app!.evaluate(() => (globalThis as unknown as { __blurs: number }).__blurs);

  // 끈 채로 끝종이 울리면 그동안만 주 모니터 바닥의 가운데에 신남으로 나타난다
  await expect.poll(async () => (await dogWindow()).visible, { timeout: ringAt + 60_000 - Date.now() + 10_000, intervals: [100] }).toBe(true);
  const shown = await dogWindow();
  expect(shown.count).toBe(1);
  /** 강아지 창이 뜨기 전에 다른 앱이 맨 앞을 가져갔는지. 그러면 포커스는 직접 보지 못한 것이라 결과에 남기고 판정하지 않는다. */
  const disturbed = (await app!.evaluate(() => (globalThis as unknown as { __earlyBlurs: number }).__earlyBlurs)) > 0;
  if (disturbed) test.info().annotations.push({ type: 'warning', description: '강아지 창이 뜨기 전에 다른 앱이 맨 앞을 가져가 포커스를 판정하지 못했다' });
  await expect(dog.locator('.roaming-dog')).toHaveAttribute('data-dog-action', 'happy');
  const { bounds, display } = shown;
  expect(Math.abs(bounds!.x + bounds!.width / 2 - (display.bounds.x + display.bounds.width / 2))).toBeLessThanOrEqual(1);
  expect(bounds!.y + bounds!.height - 6).toBe(display.workArea.y + display.workArea.height);
  // 강아지 창이 떠도 앱 창은 포커스를 잃지 않고, 강아지 창도 포커스를 받지 않는다
  if (!disturbed) {
    expect(shown.focusedWindow).toBe(focusedBefore);
    expect(await blurs()).toBe(0);
  }
  expect(shown.focused).toBe(false);
  await dog.screenshot({ path: 'test-results/roaming-dog-summoned.png', omitBackground: true });

  // 재생이 끝나면 사라진다
  await expect.poll(async () => (await dogWindow()).visible, { timeout: 6_000 }).toBe(false);
  if (!disturbed) {
    expect((await dogWindow()).focusedWindow).toBe(focusedBefore);
    expect(await blurs()).toBe(0);
  }
});
