import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { emptyData, type Data } from '../src/shared/data';
import { dataWith, weekdayOf } from './timetable-fixture';
import { localDate } from '../src/shared/bell-decision';

/** 이 파일의 테스트가 쓰는 데이터 폴더. 테스트마다 새로 만든다. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 앱 창의 화면. */
let page: Page;

/** 'HH:MM'을 자정부터의 분으로. */
function min(clock: string): number {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return h * 60 + m;
}

/** 오늘 요일의 키. getDay()는 일요일이 0이다. */
const todayKey = weekdayOf();

/** 오늘 이 시각(시, 분, 초)의 Date. */
function today(h: number, m = 0, s = 0): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m, s);
}

/** 수업 시간 목록을 오늘 요일에 배정한 저장 파일을 쓴다. */
async function seed(periods: [string, string][] | null, patch: Partial<Data> = {}): Promise<void> {
  let data: Data = { ...emptyData(), ...patch };
  if (periods) {
    data = dataWith(
      [{ id: 't', name: '시험반', days: [todayKey], periods: periods.map(([start, end]) => ({ start: min(start), end: min(end) })) }],
      data,
    );
  }
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
}

/** 앱을 띄운다. 시각을 주면 화면의 시계를 그 시각으로 옮긴다. */
async function launch(at?: Date): Promise<void> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
  if (at) await setClock(at);
}

/**
 * 화면의 시계를 그 시각으로 옮기고 거기서부터 흐르게 한다. Electron 창에는 Playwright의 clock이 닿지 않아
 * `Date.now`를 직접 바꾼다. 현황 화면은 매초 `Date.now`를 읽어 판정하므로 다음 초부터 이 시각을 쓴다.
 * 종 판정과 저장은 메인 프로세스의 진짜 시각을 쓴다.
 */
async function setClock(at: Date): Promise<void> {
  await page.evaluate((target) => {
    /** 처음 한 번만 진짜 `Date.now`를 붙들어 둔다. */
    const w = window as unknown as { __realNow?: () => number };
    w.__realNow ??= Date.now.bind(Date);
    const real = w.__realNow;
    const offset = target - real();
    Date.now = () => real() + offset;
  }, at.getTime());
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

/** 발바닥 도장의 상태 이름을 차례로 읽는다. */
async function paws(): Promise<string[]> {
  return page.getByRole('list', { name: '오늘 교시' }).getByRole('listitem').evaluateAll((items) =>
    items.map((li) => li.getAttribute('aria-label') ?? ''),
  );
}

/** 오전 두 교시와 오후 한 교시. */
const PERIODS: [string, string][] = [
  ['09:00', '09:50'],
  ['10:00', '10:50'],
  ['13:00', '13:50'],
];

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});

test.afterEach(async () => {
  await quit();
  await chmod(dataDir, 0o755);
  await rm(dataDir, { recursive: true, force: true });
});

test('창을 열면 현황 화면이고 수업 중에는 초록 고리, 남은 시간, 끝종까지, 교시별 도장이 나온다', async () => {
  await seed(PERIODS);
  await launch(today(10, 20, 0));
  await expect(page.getByRole('main', { name: '현황' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^끝종까지 (30:00|29:5\d)$/);
  await expect(page.getByText('끝종까지', { exact: true })).toBeVisible();
  await expect(page.locator('.ring circle[stroke="var(--color-green)"]')).toHaveCount(1);
  // 지금 구간(10:00~10:50)에서 10:20이면 50분 중 30분, 3/5가 남았다.
  // 화면이 시계를 옮긴 뒤 처음 그리는 순간이 몇 초 늦을 수 있어, 남은 시간처럼 10:20:00~10:20:03까지를 받는다
  await expect(page.locator('.ring')).toHaveAttribute('data-fraction', /^0\.(6000|599\d)$/);
  expect(await paws()).toEqual(['1교시 · 끝남', '2교시 · 지금', '3교시 · 남음']);
  await expect(page.getByRole('switch', { name: '오늘 종' })).toHaveAttribute('aria-checked', 'true');
  // 종이 따르는 시간표의 이름이 보인다
  await expect(page.locator('.status__timetable')).toHaveText('쓰는 시간표 시험반');
});

test('현황은 쓰는 시간표만 따르고 그 이름을 보여 주며, 쓰는 시간표가 없으면 시간표가 있어도 "시간표가 하나도 없음" 상태다', async () => {
  /** 오늘 수업이 있는 두 시간표. 평일반은 10:00~10:50, 토요반은 10:30~11:00이다. */
  const specs = [
    { id: 'weekday', name: '평일반', days: [todayKey], periods: [{ start: min('10:00'), end: min('10:50') }] },
    { id: 'saturday', name: '토요반', days: [todayKey], periods: [{ start: min('10:30'), end: min('11:00') }] },
  ];
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(dataWith(specs, emptyData(), 'saturday')));
  await launch(today(10, 20, 0));
  /** 쓰는 시간표 이름 줄. */
  const name = page.locator('.status__timetable');
  await expect(name).toHaveText('쓰는 시간표 토요반');
  await expect(name).toHaveAttribute('title', '토요반');
  // 10:20은 평일반의 수업 중이지만 쓰는 시간표인 토요반은 첫 수업 전이다
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^시작종까지 (10:00|09:5\d)$/);
  expect(await paws()).toEqual(['1교시 · 남음']);

  await quit();
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(dataWith(specs, emptyData(), null)));
  await launch(today(10, 20, 0));
  await expect(page.getByText('시간표를 만들어 주세요')).toBeVisible();
  await expect(page.getByRole('button', { name: '시간표 만들기' })).toBeVisible();
  await expect(page.locator('.status__timetable')).toHaveCount(0);
  await expect(page.getByRole('switch', { name: '오늘 종' })).toHaveCount(0);
});

test('쉬는 시간에는 주황 고리와 시작종까지, 첫 수업 전에는 빈 고리와 한 시간 넘는 시:분:초가 나온다', async () => {
  await seed(PERIODS);
  await launch(today(11, 50, 0));
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^시작종까지 (1:10:00|1:09:5\d)$/);
  await expect(page.locator('.ring circle[stroke="var(--color-orange)"]')).toHaveCount(1);
  expect(await paws()).toEqual(['1교시 · 끝남', '2교시 · 끝남', '3교시 · 남음']);

  await setClock(today(12, 55, 0));
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^시작종까지 (05:00|04:5\d)$/);
  await expect(page.getByText('시작종까지', { exact: true })).toBeVisible();

  await setClock(today(7, 48, 0));
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^시작종까지 (1:12:00|1:11:5\d)$/);
  await expect(page.locator('.ring circle[stroke]')).toHaveCount(0);
  expect(await paws()).toEqual(['1교시 · 남음', '2교시 · 남음', '3교시 · 남음']);
});

test('수업이 이어져 다음 종이 시작종이어도 수업 중에는 "끝종까지"로 쓴다', async () => {
  await seed([
    ['09:00', '09:50'],
    ['09:50', '10:40'],
  ]);
  await launch(today(9, 20, 0));
  await expect(page.getByText('끝종까지', { exact: true })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveAttribute('aria-label', /^끝종까지 (30:00|29:5\d)$/);
});

test('마지막 수업 뒤에는 "오늘 수업 끝"과 모두 지난 도장이 나온다', async () => {
  await seed(PERIODS);
  await launch(today(15, 0, 0));
  await expect(page.getByText('오늘 수업 끝')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  expect(await paws()).toEqual(['1교시 · 끝남', '2교시 · 끝남', '3교시 · 끝남']);
});

test('수업 없는 날에는 "오늘은 수업이 없어요"만 나오고 도장이 없다', async () => {
  await seed([]);
  await launch(today(10, 0, 0));
  await expect(page.getByText('오늘은 수업이 없어요')).toBeVisible();
  await expect(page.getByRole('list', { name: '오늘 교시' })).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveCount(0);
});

test('시간표가 하나도 없으면 안내와 "시간표 만들기" 단추가 나오고 누르면 시간표 화면으로 간다', async () => {
  await seed(null);
  await launch();
  await expect(page.getByText('시간표를 만들어 주세요')).toBeVisible();
  await expect(page.getByRole('switch', { name: '오늘 종' })).toHaveCount(0);
  await page.getByRole('button', { name: '시간표 만들기' }).click();
  await expect(page.getByRole('main', { name: '시간표' })).toBeVisible();
});

test('남은 시간은 초마다 바뀌고 숫자는 같은 폭의 칸에 들어간다', async () => {
  await seed(PERIODS);
  await launch(today(10, 20, 0));
  /** 남은 시간 이름. */
  const timer = page.getByRole('timer');
  // 진짜 시간이 흐르면 초마다 한 칸씩 줄어든다
  await expect(timer).toHaveAttribute('aria-label', /^끝종까지 (30:00|29:5\d)$/);
  /** 처음 읽은 값. */
  const first = Number(((await timer.getAttribute('aria-label')) ?? '').slice(-2));
  await expect(timer).not.toHaveAttribute('aria-label', new RegExp(`:${String(first).padStart(2, '0')}$`));
  await expect(timer).toHaveAttribute('aria-label', /^끝종까지 29:5\d$/);

  // 1과 8처럼 폭이 다른 숫자도 칸의 폭이 같다
  /** 숫자 칸마다의 폭. */
  const widths = await page.locator('.digits__digit').evaluateAll((cells) => cells.map((c) => c.getBoundingClientRect().width));
  expect(new Set(widths.map((w) => Math.round(w * 10))).size).toBe(1);
});

test('"오늘 종"을 끄면 끈 날짜가 저장되고 앱을 다시 띄워도 꺼져 있으며, 켜면 풀린다. 꺼진 동안에도 현황은 시간표대로다', async () => {
  await seed(PERIODS);
  await launch();
  /** 스위치. */
  const toggle = page.getByRole('switch', { name: '오늘 종' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect.poll(async () => (await saved()).bellsOffDate).toBe(localDate(Date.now()));
  // 현황은 그대로 시간표대로 나온다
  await expect(page.getByRole('list', { name: '오늘 교시' }).getByRole('listitem')).toHaveCount(3);

  await quit();
  await launch();
  await expect(page.getByRole('switch', { name: '오늘 종' })).toHaveAttribute('aria-checked', 'false');

  await page.getByRole('switch', { name: '오늘 종' }).click();
  await expect(page.getByRole('switch', { name: '오늘 종' })).toHaveAttribute('aria-checked', 'true');
  await expect.poll(async () => (await saved()).bellsOffDate).toBeNull();
});

test('저장에 실패하면 실패 알림이 뜨고, 또 실패하면 다시 뜨며, 쓸 수 있게 되면 다음 변경에서 함께 저장된다', async () => {
  test.skip(process.getuid?.() === 0, '루트는 쓰기 권한 검사를 건너뛴다');
  await seed(PERIODS);
  await launch();
  // 데이터 폴더를 읽기 전용으로 바꿔 다음 쓰기를 실패시킨다
  await chmod(dataDir, 0o555);
  /** 스위치. */
  const toggle = page.getByRole('switch', { name: '오늘 종' });
  await toggle.click();
  /** 실패 알림. */
  const alert = page.getByRole('alert').filter({ hasText: '저장하지 못했어요. 디스크에 빈 공간이 있는지 확인하고 다시 저장해 주세요.' });
  await expect(alert).toBeVisible();
  // 메모리에는 남아 화면에 보인다
  await expect(toggle).toHaveAttribute('aria-checked', 'false');

  // 또 실패해도 닫았던 알림이 다시 뜬다
  await alert.getByRole('button', { name: '알림 닫기' }).click();
  await expect(alert).toBeHidden();
  await toggle.click();
  await expect(alert).toBeVisible();

  // 폴더가 다시 쓸 수 있게 되면 다음 변경에서 함께 저장된다
  await chmod(dataDir, 0o755);
  await toggle.click();
  await expect.poll(async () => (await saved()).bellsOffDate).toBe(localDate(Date.now()));
});

test('끈 날짜가 어제인 파일로 띄우면 "오늘 종"이 켜져 있다', async () => {
  /** 어제의 현지 날짜. */
  const yesterday = localDate(Date.now() - 24 * 3_600_000);
  await seed(PERIODS, { bellsOffDate: yesterday });
  await launch();
  await expect(page.getByRole('switch', { name: '오늘 종' })).toHaveAttribute('aria-checked', 'true');
});
