import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { emptyData, type Data, type Weekday } from '../src/shared/data';
import { dataWith, timetablesOf, weekdayOf, type TimetableSpec } from './timetable-fixture';

// 시간표 상세의 편집: 시간대 탭 · 요일 켜고 끄기 · 수업 시간 고치기가 초안에 쌓였다가 "저장" 한 번으로 반영된다.

/** 이 파일의 테스트가 쓰는 데이터 폴더. 테스트마다 새로 만든다. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 앱 창의 화면. */
let page: Page;

/** 시:분을 자정부터의 분으로. */
const at = (h: number, m: number): number => h * 60 + m;

/** 평일반 한 시간표가 든 저장 파일을 쓴다. 시간대를 주지 않으면 요일도 수업 시간도 없는 시간대 하나다. */
async function seed(spec: Partial<TimetableSpec> = {}, settings: Partial<Data['settings']> = {}): Promise<void> {
  const data = dataWith([{ id: 't0', name: '평일반', days: [], periods: [], ...spec } as TimetableSpec]);
  data.settings = { ...data.settings, ...settings };
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
}

/** 앱을 띄우고 시간표 화면을 연다. `open`이면 평일반의 상세로 들어간다. */
async function launch(open = true): Promise<void> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
  await rail('시간표').click();
  if (open) await page.getByRole('button', { name: /^평일반/ }).click();
}

/** 앱을 끈다. 저장하지 않은 초안이 남은 채로는 창 닫기가 멈추므로 `close()` 대신 바로 끝낸다. */
async function quit(): Promise<void> {
  await app?.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => undefined);
  app = undefined;
}

/** 저장 파일을 읽는다. */
async function saved(): Promise<Data> {
  return JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data;
}

/** 저장 파일의 평일반 시간대. */
async function savedSlots(): Promise<Data['timetables'][number]['slots']> {
  return timetablesOf(await saved())[0]!.slots;
}

/** 왼쪽 세로 줄의 단추. */
const rail = (name: string) => page.getByRole('navigation', { name: '화면' }).getByRole('button', { name, exact: true });

/** 시간대 탭들. "+ 다른 시간대"는 빠진다. */
const tabs = () => page.getByRole('group', { name: '시간대' }).locator('.slot-tab:not(.slot-tab--add)');
/** 시간대 탭 하나. */
const tab = (name: string) => page.getByRole('group', { name: '시간대' }).getByRole('button', { name, exact: true });
/** "+ 다른 시간대". */
const addSlotButton = () => page.getByRole('button', { name: '다른 시간대' });
/** 고른 시간대의 요일 동그라미들. */
const dayButtons = () => page.getByRole('group', { name: '이 시간대를 쓰는 요일' }).getByRole('button');
/** 요일 동그라미 하나. */
const day = (name: string) => page.getByRole('group', { name: '이 시간대를 쓰는 요일' }).getByRole('button', { name });
/** 오른쪽 카드 아래의 "되돌리기"와 "저장". */
const revertButton = () => page.getByRole('button', { name: '되돌리기' });
const saveButton = () => page.locator('.period-foot').getByRole('button', { name: '저장', exact: true });
/** 저장하지 않고 떠나려 할 때 뜨는 확인 창. */
const leaveDialog = () => page.getByRole('dialog', { name: '바꾼 내용을 저장할까요?' });

/** 시각 칸에 네 자리 숫자를 쳐서 확정한다. */
async function typeTime(label: string, digits: string): Promise<void> {
  const field = page.getByLabel(label, { exact: true });
  await field.click();
  await field.pressSequentially(digits);
  await field.press('Enter');
}

/** 자정부터의 분을 시각 칸에 칠 네 자리 숫자로. */
const digitsOf = (minutes: number): string => `${String(Math.floor(minutes / 60)).padStart(2, '0')}${String(minutes % 60).padStart(2, '0')}`;

/** 평일 다섯 요일. */
const WEEK: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});

test.afterEach(async () => {
  await quit();
  await chmod(dataDir, 0o755);
  await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('요일을 켜고 시간대를 더하고 수업 시간을 더해 저장하면, 앱을 다시 띄워도 남고 목록 카드에 시간대 요약이 보인다', async () => {
  await seed();
  await launch();
  // 바꾼 것이 없어도 "되돌리기" · "저장"은 늘 있고 꺼져 있다
  await expect(revertButton()).toBeDisabled();
  await expect(saveButton()).toBeDisabled();
  await expect(tabs()).toHaveText(['요일 없음']);
  // 시간대가 하나면 "이 시간대 지우기"가 없다
  await expect(page.getByRole('button', { name: '이 시간대 지우기' })).toHaveCount(0);

  for (const name of ['월요일', '화요일', '수요일', '목요일', '금요일']) await day(name).click();
  await expect(day('월요일')).toHaveAttribute('aria-pressed', 'true');
  await expect(tabs()).toHaveText(['월~금']);
  await expect(page.getByRole('heading', { name: '월~금 수업 시간' })).toBeVisible();
  await expect(revertButton()).toBeEnabled();
  await expect(saveButton()).toBeEnabled();

  await page.getByRole('button', { name: '수업 시간', exact: true }).click();
  // 새 줄은 09:00~09:50이고 시작 시각 칸에 초점이 있다
  await expect(page.getByLabel('1교시 시작 시각')).toBeFocused();
  await expect(page.getByLabel('1교시 시작 시각')).toHaveValue('09:00');
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:50');
  await typeTime('1교시 끝 시각', '1020');
  // 시계판에 그 시간대의 수업 시간이 호로 그려진다
  await expect(page.getByRole('img', { name: '12시간 시계판' }).locator('.dial__period')).toHaveText(['1']);

  // 다른 시간대를 더하면 그 시간대가 골라지고, 평일 다섯 요일은 요일 줄에 없다
  await addSlotButton().click();
  await expect(tabs()).toHaveText(['월~금', '요일 없음']);
  await expect(tab('요일 없음')).toHaveAttribute('aria-pressed', 'true');
  await expect(dayButtons()).toHaveText(['토', '일']);
  await expect(day('토요일')).toBeFocused();
  await day('토요일').click();
  await page.getByRole('button', { name: '수업 시간', exact: true }).click();
  await expect(page.getByRole('heading', { name: '토 수업 시간' })).toBeVisible();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:50');

  // 저장 전에는 파일이 그대로다
  expect(await savedSlots()).toEqual([{ days: [], periods: [] }]);
  await saveButton().click();
  await expect(page.getByRole('status').filter({ hasText: '저장했어요' })).toBeVisible();
  await expect(revertButton()).toBeDisabled();
  await expect(saveButton()).toBeDisabled();
  await expect
    .poll(savedSlots)
    .toEqual([
      { days: WEEK, periods: [{ start: at(9, 0), end: at(10, 20) }] },
      { days: ['sat'], periods: [{ start: at(9, 0), end: at(9, 50) }] },
    ]);

  await quit();
  await launch(false);
  // 목록 카드의 시간대 요약
  await expect(page.locator('.tcard__meta > span')).toHaveText(['월~금 1교시 · 09:00~10:20', '토 1교시 · 09:00~09:50']);
  await page.getByRole('button', { name: /^평일반/ }).click();
  await expect(tabs()).toHaveText(['월~금', '토']);
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('10:20');
  await tab('토').click();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:50');
});

test('상세에서 오늘 요일을 켜고 다음 분의 수업 시간을 저장하면 그 시각에 종이 울린다', async () => {
  test.setTimeout(300_000);
  /** 자정부터 지금까지의 분. */
  const minuteOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes();
  // 자정을 넘기는 수업 시간은 저장할 수 없어, 하루의 마지막 몇 분이면 자정이 지나기를 기다린다
  while (minuteOfDay(new Date()) >= 24 * 60 - 5) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
  await seed();
  await launch();

  /** 화면에서 저장까지 할 시간을 30초 넘게 두고 고른, 종이 울릴 분. */
  const now = new Date();
  const target = minuteOfDay(now) + (now.getSeconds() < 30 ? 1 : 2);
  /** 종이 울릴 시각(에포크 ms). */
  const ringAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, target).getTime();
  /** 오늘의 요일 이름. */
  const today = { mon: '월요일', tue: '화요일', wed: '수요일', thu: '목요일', fri: '금요일', sat: '토요일', sun: '일요일' }[weekdayOf(now)];

  await day(today).click();
  await page.getByRole('button', { name: '수업 시간', exact: true }).click();
  // 끝을 먼저 고쳐, 어느 순서로 고쳐도 마지막 값이 맞게 한다
  await typeTime('1교시 끝 시각', digitsOf(target + 2));
  await typeTime('1교시 시작 시각', digitsOf(target));
  await saveButton().click();
  await expect(page.getByRole('status').filter({ hasText: '저장했어요' })).toBeVisible();
  expect(Date.now()).toBeLessThan(ringAt);

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
  expect(await ringing()).toBe(false);
  await expect.poll(ringing, { timeout: ringAt - Date.now() + 10_000, intervals: [250] }).toBe(true);
  // 저장한 시각에서 몇 초 안에 울렸다
  expect(Date.now() - ringAt).toBeLessThan(5_000);
});

test('되돌리기는 초안을 버리고, 바꾼 것이 없으면 되돌리기 · 저장이 꺼지며, 잘못된 시각이 있으면 저장만 잠긴다', async () => {
  await seed({
    days: WEEK,
    periods: [
      { start: at(9, 0), end: at(9, 50) },
      { start: at(10, 0), end: at(10, 50) },
    ],
  });
  await launch();

  // 켰다가 다시 끄면 저장된 값과 같아져 둘 다 다시 꺼진다
  await day('토요일').click();
  await expect(saveButton()).toBeEnabled();
  await day('토요일').click();
  await expect(revertButton()).toBeDisabled();
  await expect(saveButton()).toBeDisabled();

  // 겹치는 시각은 그 줄에 이유를 보이고 "저장"만 잠근다. 자동으로 고치지 않는다
  await typeTime('2교시 시작 시각', '0930');
  await expect(page.getByRole('alert').filter({ hasText: '09:00~09:50 수업과 겹쳐요' })).toBeVisible();
  await expect(page.locator('.period-row--bad')).toHaveCount(2);
  await expect(saveButton()).toBeDisabled();
  await expect(revertButton()).toBeEnabled();
  await expect(page.getByLabel('2교시 시작 시각')).toHaveValue('09:30');

  // 되돌리기는 초안을 한 번에 버린다: 시각, 지운 줄, 더한 시간대 모두
  await page.getByRole('button', { name: '2교시 지우기' }).click();
  await addSlotButton().click();
  await expect(tabs()).toHaveCount(2);
  await revertButton().click();
  await expect(tabs()).toHaveText(['월~금']);
  await expect(page.getByLabel('1교시 시작 시각')).toHaveValue('09:00');
  await expect(page.getByLabel('2교시 시작 시각')).toHaveValue('10:00');
  await expect(page.locator('.period-row--bad')).toHaveCount(0);
  await expect(revertButton()).toBeDisabled();
  await expect(saveButton()).toBeDisabled();
  expect(await savedSlots()).toEqual([
    {
      days: WEEK,
      periods: [
        { start: at(9, 0), end: at(9, 50) },
        { start: at(10, 0), end: at(10, 50) },
      ],
    },
  ]);
});

test('한 시간대에서 켠 요일은 다른 시간대의 요일 줄에 없고, 모든 요일이 들면 "+ 다른 시간대"가 사라지며, 시간대를 지울 수 있다', async () => {
  await seed({ slots: [{ days: WEEK, periods: [] }, { days: ['sat'], periods: [{ start: at(10, 0), end: at(11, 30) }] }] });
  await launch();
  await expect(tabs()).toHaveText(['월~금', '토']);
  await expect(tab('월~금')).toHaveAttribute('aria-pressed', 'true');
  await expect(dayButtons()).toHaveText(['월', '화', '수', '목', '금', '일']);
  await expect(page.getByRole('button', { name: '이 시간대 지우기' })).toBeVisible();

  await tab('토').click();
  await expect(dayButtons()).toHaveText(['토', '일']);
  await expect(page.getByLabel('1교시 시작 시각')).toHaveValue('10:00');
  await day('일요일').click();
  await expect(tabs()).toHaveText(['월~금', '토 · 일']);
  // 남은 요일이 없으면 "+ 다른 시간대"가 없다
  await expect(addSlotButton()).toHaveCount(0);
  await tab('월~금').click();
  await expect(dayButtons()).toHaveText(['월', '화', '수', '목', '금']);

  // 고른 시간대를 지우면 남은 시간대가 골라지고 그 탭에 초점이 간다
  await page.getByRole('button', { name: '이 시간대 지우기' }).click();
  await expect(tabs()).toHaveText(['토 · 일']);
  await expect(tab('토 · 일')).toBeFocused();
  await expect(page.getByRole('button', { name: '이 시간대 지우기' })).toHaveCount(0);
  await expect(addSlotButton()).toBeVisible();
  await expect(dayButtons()).toHaveCount(7);

  await saveButton().click();
  await expect.poll(savedSlots).toEqual([{ days: ['sat', 'sun'], periods: [{ start: at(10, 0), end: at(11, 30) }] }]);
});

test('저장하지 않고 목록이나 다른 화면으로 가려 하면 확인 창이 뜨고, 계속 편집 · 저장 안 함 · 저장이 각각 동작한다', async () => {
  await seed({ days: ['mon'], periods: [{ start: at(9, 0), end: at(9, 50) }] });
  await launch();
  const back = page.getByRole('button', { name: '시간표 목록' });
  await typeTime('1교시 끝 시각', '0955');

  // 계속 편집: 화면과 초안이 그대로다
  await back.click();
  await expect(leaveDialog()).toBeVisible();
  await expect(leaveDialog()).toContainText("'평일반' 시간표의 요일이나 수업 시간을 바꿨어요.");
  await expect(leaveDialog().getByRole('button', { name: '저장', exact: true })).toBeFocused();
  await leaveDialog().getByRole('button', { name: '계속 편집' }).click();
  await expect(leaveDialog()).toBeHidden();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:55');

  // Esc도 아무것도 하지 않고 닫는다
  await rail('설정').click();
  await page.keyboard.press('Escape');
  await expect(leaveDialog()).toBeHidden();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:55');

  // 저장 안 함: 초안을 버리고 가려던 화면으로 간다
  await rail('설정').click();
  await leaveDialog().getByRole('button', { name: '저장 안 함' }).click();
  await expect(rail('설정')).toHaveAttribute('aria-current', 'page');
  expect(await savedSlots()).toEqual([{ days: ['mon'], periods: [{ start: at(9, 0), end: at(9, 50) }] }]);

  // 저장: 저장하고 목록으로 간다
  await rail('시간표').click();
  await page.getByRole('button', { name: /^평일반/ }).click();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:50');
  await day('화요일').click();
  await typeTime('1교시 끝 시각', '1000');
  await back.click();
  await leaveDialog().getByRole('button', { name: '저장', exact: true }).click();
  await expect(leaveDialog()).toBeHidden();
  await expect(page.getByRole('list', { name: '시간표 목록' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '저장했어요' })).toBeVisible();
  await expect.poll(savedSlots).toEqual([{ days: ['mon', 'tue'], periods: [{ start: at(9, 0), end: at(10, 0) }] }]);

  // 바꾼 것이 없으면 묻지 않고 간다
  await page.getByRole('button', { name: /^평일반/ }).click();
  await back.click();
  await expect(leaveDialog()).toHaveCount(0);
  await expect(page.getByRole('list', { name: '시간표 목록' })).toBeVisible();
});

test('잘못된 시각이 있으면 확인 창의 저장도 잠기고 어느 시간대의 몇 교시인지 알린다', async () => {
  await seed({
    slots: [
      { days: WEEK, periods: [] },
      {
        days: ['sat'],
        periods: [
          { start: at(9, 0), end: at(9, 50) },
          { start: at(10, 0), end: at(10, 50) },
        ],
      },
    ],
  });
  await launch();
  await tab('토').click();
  await typeTime('2교시 시작 시각', '0930');
  // 다른 탭으로 가도 잘못된 시각이 든 탭에 느낌표가 남는다
  await tab('월~금').click();
  await expect(tab('토 (잘못된 시각이 있어요)')).toBeVisible();
  await expect(saveButton()).toBeDisabled();
  // 잘못된 줄이 보이지 않는 시간대에서는 잠근 이유를 "저장" 곁에 글로 쓴다
  await expect(page.getByRole('alert').filter({ hasText: '토 시간대에 잘못된 시각이 있어요. 고친 뒤 저장해 주세요.' })).toBeVisible();
  await page.getByRole('button', { name: '시간표 목록' }).click();
  await expect(leaveDialog().getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await expect(leaveDialog().getByRole('alert')).toContainText('토 1교시: 09:30~10:50 수업과 겹쳐요');
  // 오류가 있으면 처음 초점이 맨 앞의 "계속 편집"에 간다
  await expect(leaveDialog().getByRole('button', { name: '계속 편집' })).toBeFocused();
});

test('저장하지 않고 창을 닫으려 하면 닫히지 않고 확인 창이 뜬다', async () => {
  // 닫기 버튼이 앱을 끝내게 해 두어, 초안을 버린 뒤 창이 닫히는 것을 본다(숨기는 길은 residency.spec.ts가 본다)
  await seed({ days: ['mon'], periods: [{ start: at(9, 0), end: at(9, 50) }] }, { hideOnClose: false });
  await launch();
  await day('화요일').click();
  // 화면이 보낸 "편집 중" 알림을 메인이 받은 뒤에 닫는다. 같은 채널은 순서대로 처리되므로 같은 알림을 한 번 더 보내 그 끝을 기다린다
  await page.evaluate(() => window.dingdong.command({ type: 'set-editing-dirty', dirty: true }));
  await (await app!.browserWindow(page)).evaluate((win) => win.close());
  await expect(leaveDialog()).toBeVisible();
  expect(page.isClosed()).toBe(false);

  await leaveDialog().getByRole('button', { name: '계속 편집' }).click();
  await expect(day('화요일')).toHaveAttribute('aria-pressed', 'true');

  // 저장 안 함을 누르면 초안을 버리고 창이 닫힌다
  await (await app!.browserWindow(page)).evaluate((win) => win.close());
  // 클릭이 끝나기 전에 창이 닫힐 수 있으니 닫힘을 먼저 기다리기 시작한다
  const closed = page.waitForEvent('close');
  await leaveDialog().getByRole('button', { name: '저장 안 함' }).click();
  await closed;
  expect(await savedSlots()).toEqual([{ days: ['mon'], periods: [{ start: at(9, 0), end: at(9, 50) }] }]);
});

test('저장에 실패하면 초안이 그대로 남고 실패 알림이 뜨며, 다시 저장할 수 있다', async () => {
  test.skip(process.getuid?.() === 0, '루트는 쓰기 권한 검사를 건너뛴다');
  await seed({ days: ['mon'], periods: [{ start: at(9, 0), end: at(9, 50) }] });
  await launch();
  await typeTime('1교시 끝 시각', '1000');
  await chmod(dataDir, 0o555);
  await saveButton().click();

  await expect(page.getByRole('alert').filter({ hasText: '저장하지 못했어요' })).toBeVisible();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('10:00');
  await expect(revertButton()).toBeEnabled();
  await expect(saveButton()).toBeEnabled();

  // 폴더가 다시 쓸 수 있게 되면 같은 "저장"으로 저장된다
  await chmod(dataDir, 0o755);
  await saveButton().click();
  await expect(saveButton()).toBeDisabled();
  await expect.poll(savedSlots).toEqual([{ days: ['mon'], periods: [{ start: at(9, 0), end: at(10, 0) }] }]);
});

test('시각을 치고 Enter 없이 바로 "저장"을 눌러도 친 시각이 저장된다', async () => {
  await seed({ days: ['mon'], periods: [{ start: at(9, 0), end: at(9, 50) }] });
  await launch();
  // 초안이 이미 있는 상태에서 친다
  await day('화요일').click();
  const end = page.getByLabel('1교시 끝 시각', { exact: true });
  await end.click();
  await end.pressSequentially('1000');
  await saveButton().click();
  await expect.poll(savedSlots).toEqual([{ days: ['mon', 'tue'], periods: [{ start: at(9, 0), end: at(10, 0) }] }]);
  await expect(end).toHaveValue('10:00');
});

test('교시 번호는 시작 시각 순서이고, 줄 밖으로 초점이 나가면 줄이 정렬되며 시계판 호에 같은 번호가 붙는다', async () => {
  await seed({
    days: ['mon'],
    periods: [
      { start: at(9, 0), end: at(9, 50) },
      { start: at(11, 0), end: at(11, 50) },
    ],
  });
  await launch();
  const dial = page.getByRole('img', { name: '12시간 시계판' });
  await expect(dial.locator('.dial__period')).toHaveText(['1', '2']);
  await page.getByRole('button', { name: '수업 시간', exact: true }).click();
  // 시작을 먼저 고치면 번호가 바뀌어 칸 이름이 달라지므로, 끝을 먼저 고친다
  await typeTime('3교시 끝 시각', '1040');
  await typeTime('3교시 시작 시각', '1020');
  await revertButton().focus();
  await expect(page.getByLabel('2교시 시작 시각')).toHaveValue('10:20');
  await expect(page.locator('.period-row__num')).toHaveText(['1', '2', '3']);
  await expect(dial.locator('.dial__period')).toHaveText(['1', '2', '3']);
});

test('창 920 × 580과 1000에서 상세의 두 카드가 잘리거나 겹치지 않고, 교시가 많아도 "되돌리기" · "저장"이 보인다', async () => {
  /** 열네 교시. 오른쪽 카드에 다 들어가지 않는다. */
  const many = Array.from({ length: 14 }, (_, i) => ({ start: at(8, 0) + i * 50, end: at(8, 0) + i * 50 + 40 }));
  await seed({
    name: '2026 겨울방학 애견미용 집중 특강반 오전 고등부',
    slots: [
      { days: WEEK, periods: many },
      { days: ['sat'], periods: [] },
      { days: [], periods: [] },
    ],
  });
  await launch(false);
  await page.getByRole('button', { name: /^2026 겨울방학/ }).click();
  for (const [width, height] of [
    [920, 580],
    [1000, 640],
  ] as const) {
    await (await app!.browserWindow(page)).evaluate((w, [cw, ch]) => w.setContentSize(cw, ch), [width, height] as const);
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
    /** 요소의 화면 위 칸. */
    const boxOf = async (selector: string) => (await page.locator(selector).boundingBox())!;
    const left = await boxOf('.timetable-detail .card--dial');
    const right = await boxOf('.timetable-detail .card--periods');
    // 두 카드가 창 안에 있고 겹치지 않는다
    expect(left.x + left.width).toBeLessThanOrEqual(right.x);
    for (const card of [left, right]) {
      expect(card.y + card.height).toBeLessThanOrEqual(height);
      expect(card.x + card.width).toBeLessThanOrEqual(width);
    }
    // 왼쪽 카드 안의 부품이 카드 밖으로 나가지 않는다
    for (const selector of ['.timetable-name', '.slot-tabs', '.slot-days-row', '.timetable-detail .dial']) {
      const part = await boxOf(selector);
      expect(part.x + part.width, selector).toBeLessThanOrEqual(left.x + left.width);
      expect(part.y + part.height, selector).toBeLessThanOrEqual(left.y + left.height);
    }
    // 줄만 스크롤하고 "되돌리기" · "저장"은 오른쪽 카드 안에 보인다
    expect(await page.locator('.period-list').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    for (const button of [revertButton(), saveButton()]) {
      await expect(button).toBeInViewport();
      const box = (await button.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(right.y + right.height);
    }
  }
});

test('목록 카드의 시간대 요약은 두 줄까지이고, 셋째부터 "외 N개"로 줄인다', async () => {
  await writeFile(
    join(dataDir, 'data.json'),
    JSON.stringify(
      dataWith(
        [
          {
            name: '평일반',
            slots: [
              { days: WEEK, periods: [{ start: at(9, 0), end: at(9, 50) }, { start: at(15, 0), end: at(15, 50) }] },
              { days: ['sat'], periods: [] },
              { days: ['sun'], periods: [] },
              { days: [], periods: [] },
            ],
          },
        ],
        emptyData(),
      ),
    ),
  );
  await launch(false);
  await expect(page.locator('.tcard__meta > span')).toHaveText(['월~금 2교시 · 09:00~15:50', '토 수업 시간 없음', '외 2개']);
});
