import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { emptyData, type Data } from '../src/shared/data';
import { dataWith, timetablesOf, version1Data, weekdayOf, type TimetableSpec } from './timetable-fixture';

// 시간표 화면의 목록(카드)과 저장 파일. 만들기 · 상세 · 쓰는 시간표 바꾸기 · 지우기 흐름은 04~06 티켓이 이 파일에 더한다.

/** 이 파일의 테스트가 쓰는 데이터 폴더. 테스트마다 새로 만든다. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 앱 창의 화면. */
let page: Page;

/** 데이터 폴더로 앱을 띄우고 시간표 화면을 연다. */
async function launch(): Promise<void> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '시간표' }).click();
}

/** 앱을 끈다. */
async function quit(): Promise<void> {
  await app?.close();
  app = undefined;
}

/** 저장 파일을 읽는다. */
async function saved(): Promise<Data> {
  return JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data;
}

/** 시간표들이 든 저장 파일을 쓴다. 첫 시간표가 쓰는 시간표다. */
async function seed(specs: readonly TimetableSpec[]): Promise<void> {
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(dataWith(specs)));
}

/** 앱 창의 안쪽 크기를 바꾸고 화면이 그 크기가 될 때까지 기다린다. */
async function resize(width: number, height: number): Promise<void> {
  await (await app!.browserWindow(page)).evaluate((w, [cw, ch]) => w.setContentSize(cw, ch), [width, height] as const);
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
}

/** 목록의 카드들. */
const cards = () => page.getByRole('list', { name: '시간표 목록' }).getByRole('listitem');

/** 시:분을 자정부터의 분으로. */
const at = (h: number, m: number): number => h * 60 + m;

/** 평일과 토요일의 수업 시각이 다른 평일반, 요일이 없는 방학 특강. */
const SPECS: TimetableSpec[] = [
  {
    id: 'weekday',
    name: '평일반',
    slots: [
      {
        days: ['mon', 'tue', 'wed', 'thu', 'fri'],
        periods: [
          { start: at(9, 0), end: at(9, 50) },
          { start: at(10, 0), end: at(10, 50) },
          { start: at(11, 0), end: at(11, 50) },
        ],
      },
      { days: ['sat'], periods: [{ start: at(10, 0), end: at(11, 30) }] },
    ],
  },
  { id: 'vacation', name: '방학 특강', days: [], periods: [] },
];

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});

test.afterEach(async () => {
  await quit();
  await chmod(dataDir, 0o755);
  await rm(dataDir, { recursive: true, force: true });
});

test('시간표마다 카드가 있고, 카드에 색 점 · 이름 · 모든 시간대의 요일 · 첫 시간대의 작은 시계판이 보인다', async () => {
  await seed(SPECS);
  await launch();
  // 예전 머리 줄의 시간표 선택 입력기와 요일 배정 동그라미는 없다
  await expect(page.getByRole('button', { name: /시간표 고르기/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^월요일 · / })).toHaveCount(0);

  await expect(cards()).toHaveCount(2);
  const [weekday, vacation] = [cards().nth(0), cards().nth(1)];
  await expect(weekday).toHaveAttribute('title', '평일반');
  await expect(weekday.locator('.tcard__name')).toHaveText('평일반');
  // 시간표 색 0번 점
  expect(await weekday.locator('.dot').evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(169, 173, 245)');
  // 두 시간대의 요일을 합친 월~토가 켜진다
  await expect(weekday.locator('.mini-day--on')).toHaveText(['월', '화', '수', '목', '금', '토']);
  await expect(weekday.locator('.mini-day')).toHaveCount(7);
  // 작은 시계판은 첫 시간대(평일)의 수업 시간 셋을 호로 그린다
  await expect(weekday.locator('.dial--compact path')).toHaveCount(3);

  await expect(vacation.locator('.tcard__name')).toHaveText('방학 특강');
  await expect(vacation.locator('.mini-day--on')).toHaveCount(0);
  await expect(vacation.locator('.dial--compact path')).toHaveCount(0);
  // 화면 읽기는 요일을 글로 듣는다
  await expect(vacation).toContainText('요일 없음');
});

test('20자 이름은 카드에서 한 줄로 줄고 전체 이름은 title에 있으며, 카드들의 요일 줄 위치가 같다', async () => {
  /** 20자 이름. */
  const long = '방학 특강 오전반 고등부 심화수학A반';
  expect([...long]).toHaveLength(20);
  await seed([
    { name: '평일반', days: ['mon'], periods: [] },
    { name: long, days: ['sat'], periods: [] },
    { name: '토요반', days: ['sat'], periods: [] },
  ]);
  await launch();

  for (const [width, height] of [
    [920, 580],
    [1000, 640],
  ] as const) {
    await resize(width, height);
    const longCard = cards().nth(1);
    await expect(longCard).toHaveAttribute('title', long);
    /** 긴 이름 칸의 크기. 한 줄이면 높이가 글자 한 줄이고, 줄어들었으면 글자가 칸보다 넓다. */
    const name = await longCard.locator('.tcard__name').evaluate((el) => ({
      height: el.getBoundingClientRect().height,
      lineHeight: parseFloat(getComputedStyle(el).lineHeight),
      truncated: el.scrollWidth > el.clientWidth,
    }));
    expect(name.height).toBeLessThanOrEqual(name.lineHeight + 1);
    expect(name.truncated).toBe(true);
    // 세 칸 격자라 세 카드가 한 줄에 놓이고, 요일 줄의 높이가 같다
    const boxes = await cards().evaluateAll((els) =>
      els.map((el) => ({ left: el.getBoundingClientRect().left, days: el.querySelector('.mini-days')!.getBoundingClientRect().top })),
    );
    expect(new Set(boxes.map((b) => Math.round(b.left))).size).toBe(3);
    expect(new Set(boxes.map((b) => Math.round(b.days))).size).toBe(1);
  }
});

test('시간표가 하나도 없으면 강아지와 "시간표를 만들어 주세요"가 있는 빈 상태가 보인다', async () => {
  await launch();
  await expect(cards()).toHaveCount(0);
  const empty = page.getByRole('region', { name: '시간표 없음' });
  await expect(empty.getByText('시간표를 만들어 주세요')).toBeVisible();
  await expect(empty.locator('.dog-art')).toBeVisible();
  // 강아지는 카드를 채우지 않고 96px 칸에 그려진다
  expect((await empty.locator('.dog-art').boundingBox())?.height).toBe(96);
});

test('버전 1 저장 파일로 띄우면 알림 없이 시간표가 빈 채로 시작하고, 음원 · 설정 · 창 위치는 남는다', async () => {
  /** 버전 1에서 쓰던 값들. */
  const base: Data = {
    ...emptyData(),
    masterVolume: 60,
    settings: { ...emptyData().settings, dogTheme: 'beagle', hideNoticeShown: true },
  };
  await writeFile(
    join(dataDir, 'data.json'),
    JSON.stringify(version1Data({ name: '평일반', days: [weekdayOf()], periods: [{ start: at(9, 0), end: at(9, 50) }] }, base)),
  );
  await launch();
  await expect(page.getByText('시간표를 만들어 주세요')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  // 올려 쓴 형태는 다음 저장 때 파일에 남는다. 설정 하나를 바꿔 저장하게 한다
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
  await page.getByRole('switch', { name: '닫으면 숨기기' }).click();
  await expect.poll(async () => (await saved()).version).toBe(2);
  const file = await saved();
  expect(timetablesOf(file)).toEqual([]);
  expect(file.activeTimetable).toBeNull();
  expect('weekdays' in file).toBe(false);
  expect(file.masterVolume).toBe(60);
  expect(file.settings.dogTheme).toBe('beagle');
});

test('저장된 시간표를 읽지 못하면 새로 시작했다는 알림이 한 번 남는다', async () => {
  await writeFile(join(dataDir, 'data.json'), '{깨진 파일');
  await writeFile(join(dataDir, 'data.backup.json'), 'also broken');
  await launch();
  /** 알림. */
  const alert = page.getByRole('alert').filter({ hasText: '저장된 시간표를 읽지 못해 새로 시작했어요' });
  await expect(alert).toBeVisible();
  // 실패 알림은 4초가 지나도 남고 ×로 닫는다
  await page.waitForTimeout(4500);
  await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: '알림 닫기' }).click();
  await expect(alert).toBeHidden();
  // 화면을 오가도 다시 뜨지 않는다
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '시간표' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('같은 요일이 두 시간대에 든 저장 파일은 깨진 파일로 보고 새로 시작한다', async () => {
  const broken = dataWith([
    {
      name: '평일반',
      slots: [
        { days: ['mon', 'tue'], periods: [] },
        { days: ['tue'], periods: [] },
      ],
    },
  ]);
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(broken));
  await launch();
  await expect(page.getByRole('alert').filter({ hasText: '저장된 시간표를 읽지 못해 새로 시작했어요' })).toBeVisible();
  await expect(cards()).toHaveCount(0);
});
