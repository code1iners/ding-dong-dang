import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { emptyData, type Data } from '../src/shared/data';
import { dataWith, timetablesOf, version1Data, weekdayOf, type TimetableSpec } from './timetable-fixture';

// 시간표 화면의 목록(카드) · 만들기 · 상세 · 쓰는 시간표 바꾸기 · 지우기와 저장 파일. 상세 편집은 period-editing.spec.ts가 맡는다.

/** 이 파일의 테스트가 쓰는 데이터 폴더. 테스트마다 새로 만든다. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 앱 창의 화면. */
let page: Page;

/** 데이터 폴더로 앱을 띄우고 시간표 화면을 연다. */
async function launch(): Promise<void> {
  app = await electron.launch({
    args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`],
  });
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

/** 목록의 시간표 카드들. 맨 끝의 "새 시간표" 카드는 빠진다. */
const cards = () => page.getByRole('list', { name: '시간표 목록' }).locator('button.tcard:not(.tcard--new)');

/** 이름을 받는 창. */
const createDialog = () => page.getByRole('dialog', { name: '새 시간표' });

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
  // 시간대마다 요일 요약, 교시 수, 첫 시작~마지막 끝
  await expect(weekday.locator('.tcard__meta > span')).toHaveText(['월~금 3교시 · 09:00~11:50', '토 1교시 · 10:00~11:30']);

  await expect(vacation.locator('.tcard__name')).toHaveText('방학 특강');
  await expect(vacation.locator('.mini-day--on')).toHaveCount(0);
  await expect(vacation.locator('.dial--compact path')).toHaveCount(0);
  await expect(vacation.locator('.tcard__meta > span')).toHaveText(['요일 없음 수업 시간 없음']);
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
      els.map((el) => ({
        left: el.getBoundingClientRect().left,
        days: el.querySelector('.mini-days')!.getBoundingClientRect().top,
      })),
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
  await expect(empty.getByRole('button', { name: '시간표 만들기' })).toBeVisible();
  await expect(empty.locator('.dog-art')).toBeVisible();
  // 강아지는 카드를 채우지 않고 96px 칸에 그려진다
  expect((await empty.locator('.dog-art').boundingBox())?.height).toBe(96);
});

test('버전 1 저장 파일로 띄우면 알림 없이 시간표가 빈 채로 시작하고, 음원 · 설정 · 창 위치는 남는다', async () => {
  /** 버전 1에서 쓰던 값들. */
  const base: Data = {
    ...emptyData(),
    masterVolume: 60,
    settings: {
      ...emptyData().settings,
      dogTheme: 'beagle',
      hideNoticeShown: true,
    },
  };
  await writeFile(
    join(dataDir, 'data.json'),
    JSON.stringify(
      version1Data(
        {
          name: '평일반',
          days: [weekdayOf()],
          periods: [{ start: at(9, 0), end: at(9, 50) }],
        },
        base,
      ),
    ),
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

/** 상세 화면의 위 줄 "← 시간표 목록". */
const backButton = () => page.getByRole('button', { name: '시간표 목록' });

test('빈 상태에서 이름을 받아 만들면 상세로 들어가고, 앱을 다시 띄워도 그 시간표가 쓰는 시간표로 남는다', async () => {
  await launch();
  const makeButton = page.getByRole('button', { name: '시간표 만들기' });
  // Esc로 닫으면 초점이 "시간표 만들기"로 돌아온다
  await makeButton.click();
  await page.keyboard.press('Escape');
  await expect(createDialog()).toBeHidden();
  await expect(makeButton).toBeFocused();

  await makeButton.click();
  const dialog = createDialog();
  await expect(dialog).toBeVisible();
  const name = dialog.getByRole('textbox', { name: '이름' });
  await expect(name).toHaveAttribute('placeholder', '예: 평일반');
  await expect(name).toBeFocused();
  const create = dialog.getByRole('button', { name: '만들기' });
  // 비어 있거나 공백뿐인 이름은 받지 않는다
  await expect(create).toBeDisabled();
  await name.fill('   ');
  await expect(create).toBeDisabled();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();

  await name.fill('  평일반 ');
  await create.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: "'평일반' 시간표를 만들었어요" })).toBeVisible();
  // 상세: 위 줄의 "← 시간표 목록"과 왼쪽 카드의 이름. 초점은 첫 요일 동그라미에 있다
  await expect(page.getByRole('group', { name: '이 시간대를 쓰는 요일' }).getByRole('button', { name: '월요일' })).toBeFocused();
  await expect(backButton()).toBeVisible();
  await expect(page.locator('.timetable-name__text')).toHaveText('평일반');
  // 시간표가 하나뿐이면 "쓰는 중" 표시가 없다
  await expect(page.getByText('쓰는 중')).toHaveCount(0);

  await expect
    .poll(async () =>
      timetablesOf(await saved()).map((t) => ({
        name: t.name,
        active: t.active,
      })),
    )
    .toEqual([{ name: '평일반', active: true }]);
  expect(timetablesOf(await saved())[0]!.slots).toEqual([{ days: [], periods: [] }]);

  await quit();
  await launch();
  await expect(cards()).toHaveCount(1);
  await expect(cards().first()).toContainText('평일반');
  await expect(page.getByText('쓰는 중')).toHaveCount(0);
  expect(timetablesOf(await saved())[0]!.active).toBe(true);

  // 카드를 누르면 그 시간표의 상세로 들어가고, "← 시간표 목록"을 누르면 목록으로 돌아온다
  await cards().first().click();
  await expect(page.locator('.timetable-name__text')).toHaveText('평일반');
  await backButton().click();
  await expect(cards()).toHaveCount(1);
  await expect(cards().first()).toBeFocused();
});

test('이름 창을 ×나 Esc, "취소"로 닫으면 아무것도 생기지 않고 초점이 누른 카드로 돌아온다', async () => {
  await seed(SPECS);
  await launch();
  const newCard = page.getByRole('button', { name: '새 시간표' });
  // 목록 맨 끝 칸이 "새 시간표" 카드다
  await expect(page.getByRole('list', { name: '시간표 목록' }).locator('.tcard').last()).toHaveClass(/tcard--new/);

  for (const close of ['×', 'Esc', '취소'] as const) {
    await newCard.click();
    await createDialog().getByRole('textbox', { name: '이름' }).fill('토요반');
    if (close === '×') await createDialog().getByRole('button', { name: '새 시간표 창 닫기' }).click();
    else if (close === 'Esc') await page.keyboard.press('Escape');
    else await createDialog().getByRole('button', { name: '취소' }).click();
    await expect(createDialog()).toBeHidden();
    await expect(newCard).toBeFocused();
  }
  await expect(cards()).toHaveCount(2);
  expect(timetablesOf(await saved()).map((t) => t.name)).toEqual(['평일반', '방학 특강']);
});

test('카드는 전체 이름이 든 단추 하나이고, 상세의 ✎로 그 자리에서 이름을 바꾼다', async () => {
  /** 두 줄을 넘는 긴 이름. */
  const long = '2026 겨울방학 애견미용 집중 특강반 오전 고등부 심화 과정 주말 보충 수업과 평일 저녁 연습반을 함께 묶은 시간표';
  await seed([{ id: 'long', name: long, days: [], periods: [] }, ...SPECS]);
  await launch();
  // 화면 읽기 이름에 잘리지 않은 전체 이름이 있다
  await page.getByRole('button', { name: new RegExp(long) }).click();
  const nameText = page.locator('.timetable-name__text');
  await expect(nameText).toHaveText(long);
  // 이름은 두 줄까지 보이고 나머지는 줄인다
  const lines = await nameText.evaluate((el) =>
    Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
  );
  expect(lines).toBe(2);

  const pen = page.getByRole('button', { name: `'${long}' 이름 바꾸기` });
  // ×는 취소한다
  await pen.click();
  const input = page.getByRole('textbox', { name: `'${long}' 새 이름` });
  await expect(input).toBeFocused();
  await input.fill('바뀌면 안 되는 이름');
  await page.getByRole('button', { name: '이름 바꾸기 취소' }).click();
  await expect(nameText).toHaveText(long);
  await expect(pen).toBeFocused();
  // Esc도 취소한다
  await pen.click();
  await input.fill('또 바뀌면 안 되는 이름');
  await page.keyboard.press('Escape');
  await expect(nameText).toHaveText(long);
  // 빈 이름은 받지 않는다
  await pen.click();
  await input.fill('  ');
  await expect(page.getByRole('button', { name: '이름 저장' })).toBeDisabled();
  await expect(page.getByRole('alert').filter({ hasText: '이름을 비울 수 없어요' })).toBeVisible();
  // ✓는 바로 저장한다
  await input.fill(' 겨울 특강 ');
  await page.getByRole('button', { name: '이름 저장' }).click();
  await expect(nameText).toHaveText('겨울 특강');
  await expect(page.getByRole('button', { name: "'겨울 특강' 이름 바꾸기" })).toBeFocused();
  await expect.poll(async () => timetablesOf(await saved()).map((t) => t.name)).toEqual(['겨울 특강', '평일반', '방학 특강']);

  await backButton().click();
  await expect(cards().first()).toHaveAttribute('title', '겨울 특강');
});

test('창 920 × 580과 1000에서 이름 창과 상세 뼈대가 창 안에 있고 겹치지 않는다', async () => {
  await seed([
    {
      name: '2026 겨울방학 애견미용 집중 특강반 오전 고등부',
      days: [],
      periods: [],
    },
    {
      name: '2026 겨울방학 애견미용 집중 특강반 오후 중등부',
      days: [],
      periods: [],
    },
  ]);
  await launch();
  for (const [width, height] of [
    [920, 580],
    [1000, 640],
  ] as const) {
    await resize(width, height);
    await page.getByRole('button', { name: '새 시간표' }).click();
    const box = (await createDialog().boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    await page.keyboard.press('Escape');

    await cards().first().click();
    /** 요소의 화면 위 칸. */
    const boxOf = async (selector: string) => (await page.locator(selector).boundingBox())!;
    /** 위 줄과 왼쪽 카드, 이름 줄의 단추. */
    const [bar, card, pen] = [
      await boxOf('.timetable-detail__bar'),
      await boxOf('.timetable-detail .card--dial'),
      await boxOf('.timetable-name .icon-button'),
    ];
    expect(bar.y + bar.height).toBeLessThanOrEqual(card.y);
    expect(card.y + card.height).toBeLessThanOrEqual(height);
    expect(pen.x + pen.width).toBeLessThanOrEqual(card.x + card.width);
    await expectBarFits(width);
    await backButton().click();
    // 쓰는 시간표가 아닌 시간표는 "이 시간표 쓰기" 단추가 나와 위 줄이 더 길다
    await cards().nth(1).click();
    await expect(page.getByRole('button', { name: '이 시간표 쓰기' })).toBeVisible();
    await expectBarFits(width);
    await backButton().click();
  }
});

/** 상세 위 줄의 왼쪽 링크와 오른쪽 동작이 창 안에 한 줄로 있고 서로 겹치지 않으며, 단추 글자가 잘리지 않는다. */
async function expectBarFits(width: number): Promise<void> {
  const back = (await backButton().boundingBox())!;
  const actions = (await page.locator('.timetable-detail__actions').boundingBox())!;
  expect(back.x + back.width).toBeLessThanOrEqual(actions.x);
  expect(actions.x + actions.width).toBeLessThanOrEqual(width);
  expect(Math.abs(back.y + back.height / 2 - (actions.y + actions.height / 2))).toBeLessThan(8);
  const clipped = await page
    .locator('.timetable-detail__actions > *')
    .evaluateAll((els) => els.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1).length);
  expect(clipped).toBe(0);
}

/** 요일 키의 화면 이름. 상세의 요일 동그라미 이름이다. */
const WEEKDAY_NAME: Record<string, string> = {
  mon: '월요일',
  tue: '화요일',
  wed: '수요일',
  thu: '목요일',
  fri: '금요일',
  sat: '토요일',
  sun: '일요일',
};

/** 왼쪽 세로 줄의 화면 단추. */
const railButton = (name: string) => page.getByRole('navigation', { name: '화면' }).getByRole('button', { name, exact: true });

/** 현황 화면 오늘 교시의 도장 수. */
const pawCount = () => page.getByRole('list', { name: '오늘 교시' }).getByRole('listitem').count();

/** 지우기 확인 창. */
const deleteDialog = (name: string) => page.getByRole('dialog', { name: `'${name}' 시간표를 지울까요?` });

test('두 번째 시간표를 만들면 쓰는 중 표시가 생기고, "이 시간표 쓰기"로 표시가 옮겨 가며 초안은 그대로이고 종과 현황이 새 시간표를 따른다', async () => {
  /** 오늘 요일. 현황의 도장 수로 종이 어느 시간표를 따르는지 본다. */
  const today = weekdayOf();
  await seed([
    {
      id: 'weekday',
      name: '평일반',
      days: [today],
      periods: [
        { start: at(9, 0), end: at(9, 50) },
        { start: at(10, 0), end: at(10, 50) },
      ],
    },
  ]);
  await launch();
  await expect(page.getByText('쓰는 중')).toHaveCount(0);

  // 두 번째 시간표를 만들면 상세에 "이 시간표 쓰기"가, 목록의 쓰는 시간표 카드에 표시와 굵은 테두리가 생긴다
  await page.getByRole('button', { name: '새 시간표' }).click();
  await createDialog().getByRole('textbox', { name: '이름' }).fill('토요반');
  await createDialog().getByRole('button', { name: '만들기' }).click();
  const activate = page.getByRole('button', { name: '이 시간표 쓰기' });
  await expect(activate).toBeVisible();
  await expect(page.locator('.timetable-detail .badge')).toHaveCount(0);
  await backButton().click();
  await expect(cards().nth(0)).toHaveClass(/tcard--active/);
  await expect(cards().nth(0).locator('.badge')).toHaveText('쓰는 중');
  await expect(cards().nth(1)).not.toHaveClass(/tcard--active/);
  await expect(cards().nth(1).locator('.badge')).toHaveCount(0);
  // 표시가 있어도 없어도 요일 줄 높이가 같다
  const daysTop = await cards().evaluateAll((els) =>
    els.map((el) => Math.round(el.querySelector('.mini-days')!.getBoundingClientRect().top)),
  );
  expect(new Set(daysTop).size).toBe(1);
  // 쓰는 시간표의 상세에는 단추 대신 표시가 있다
  await cards().nth(0).click();
  await expect(page.locator('.timetable-detail__actions .badge')).toHaveText('쓰는 중');
  await expect(activate).toHaveCount(0);
  await backButton().click();

  // 토요반에 오늘 요일과 수업 시간 하나를 초안으로 둔 채 "이 시간표 쓰기"를 누른다
  await cards().nth(1).click();
  await page.getByRole('group', { name: '이 시간대를 쓰는 요일' }).getByRole('button', { name: WEEKDAY_NAME[today] }).click();
  await page.getByRole('button', { name: '수업 시간', exact: true }).click();
  await activate.click();
  await expect(page.getByRole('status').filter({ hasText: "이제 '토요반' 시간표로 종이 울려요" })).toBeVisible();
  const badge = page.locator('.timetable-detail__actions .badge');
  await expect(badge).toHaveText('쓰는 중');
  await expect(badge).toBeFocused();
  // 쓰는 시간표만 저장되고 초안은 저장되지 않은 채 남는다
  await expect.poll(async () => (await saved()).activeTimetable).not.toBe('weekday');
  const saturday = timetablesOf(await saved()).find((t) => t.name === '토요반')!;
  expect(saturday.active).toBe(true);
  expect(saturday.slots).toEqual([{ days: [], periods: [] }]);
  await expect(page.getByRole('button', { name: '저장', exact: true })).toHaveAttribute('aria-disabled', 'false');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect.poll(async () => timetablesOf(await saved()).find((t) => t.name === '토요반')!.days).toEqual([today]);

  // 표시가 토요반 카드로 옮겨 간다
  await backButton().click();
  await expect(cards().nth(0)).not.toHaveClass(/tcard--active/);
  await expect(cards().nth(1)).toHaveClass(/tcard--active/);
  await expect(cards().nth(1).locator('.badge')).toHaveText('쓰는 중');

  // 현황은 토요반의 이름과 수업 시간 하나를 따른다
  await railButton('현황').click();
  await expect(page.locator('.status__timetable')).toHaveText('쓰는 시간표 토요반');
  await expect.poll(pawCount).toBe(1);
});

test('지우기는 항상 확인 창을 거치고, 쓰는 시간표를 지우면 다른 시간표로 넘기지 않고 종이 멈추며, 하나 남으면 쓰는 중 표시가 사라진다', async () => {
  await seed([
    {
      id: 'weekday',
      name: '평일반',
      days: [weekdayOf()],
      periods: [{ start: at(9, 0), end: at(9, 50) }],
    },
    { id: 'saturday', name: '토요반', days: ['sat'], periods: [] },
    { id: 'vacation', name: '방학 특강', days: [], periods: [] },
  ]);
  await launch();

  // 쓰는 시간표가 아닌 시간표: "취소"에 초점이 있고 "취소"로 닫으면 남는다
  await cards().nth(2).click();
  const remove = page.getByRole('button', {
    name: "'방학 특강' 시간표 지우기",
  });
  await expect(remove).toHaveText('시간표 지우기');
  await remove.click();
  const vacationDialog = deleteDialog('방학 특강');
  await expect(vacationDialog).toContainText('지운 시간표는 되돌릴 수 없어요.');
  await expect(vacationDialog.getByRole('button', { name: '취소' })).toBeFocused();
  await vacationDialog.getByRole('button', { name: '취소' }).click();
  await expect(vacationDialog).toBeHidden();
  await expect(remove).toBeFocused();
  expect(timetablesOf(await saved())).toHaveLength(3);
  // 확인하면 지우고 목록으로 돌아가며, 되돌리기는 없다
  await remove.click();
  await vacationDialog.getByRole('button', { name: '시간표 지우기' }).click();
  const deletedToast = page.getByRole('status').filter({ hasText: "'방학 특강' 시간표를 지웠어요" });
  await expect(deletedToast).toBeVisible();
  await expect(deletedToast.getByRole('button', { name: '되돌리기' })).toHaveCount(0);
  await expect(cards()).toHaveCount(2);
  await expect(cards().first()).toBeFocused();
  await expect.poll(async () => timetablesOf(await saved()).map((t) => t.name)).toEqual(['평일반', '토요반']);
  await expect(cards().nth(0).locator('.badge')).toHaveText('쓰는 중');

  // 쓰는 시간표: 저장 안 한 초안이 있어도 묻지 않고 초안과 함께 지운다
  await cards().nth(0).click();
  await page.getByRole('group', { name: '이 시간대를 쓰는 요일' }).getByRole('button', { name: '일요일' }).click();
  await page.getByRole('button', { name: "'평일반' 시간표 지우기" }).click();
  const weekdayDialog = deleteDialog('평일반');
  await expect(weekdayDialog).toContainText('지금 종이 울리는 시간표예요. 지우면 다른 시간표를 쓰기 전까지 종이 울리지 않아요.');
  await weekdayDialog.getByRole('button', { name: '시간표 지우기' }).click();
  await expect(page.getByRole('status').filter({ hasText: "'평일반' 시간표를 지웠어요" })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(cards()).toHaveCount(1);
  // 남은 토요반으로 넘기지 않고, 하나 남았으니 쓰는 중 표시도 없다
  await expect.poll(async () => (await saved()).activeTimetable).toBeNull();
  expect(
    timetablesOf(await saved()).map((t) => ({
      name: t.name,
      active: t.active,
      days: t.days,
    })),
  ).toEqual([{ name: '토요반', active: false, days: ['sat'] }]);
  await expect(page.getByText('쓰는 중')).toHaveCount(0);
  await expect(cards().first()).not.toHaveClass(/tcard--active/);

  // 하나뿐인 시간표는 쓰는 시간표가 아니어도 종이 멈춘다고 알린다
  await cards().first().click();
  await page.getByRole('button', { name: "'토요반' 시간표 지우기" }).click();
  await expect(deleteDialog('토요반')).toContainText('지금 종이 울리는 시간표예요.');
  await page.keyboard.press('Escape');
  await expect(deleteDialog('토요반')).toBeHidden();

  // 쓰는 시간표가 없으니 현황은 "시간표 없음" 상태다
  await railButton('현황').click();
  await expect(page.getByText('시간표를 만들어 주세요')).toBeVisible();
  await expect(page.locator('.status__timetable')).toHaveCount(0);
});
