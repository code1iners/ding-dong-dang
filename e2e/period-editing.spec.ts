import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { emptyData, type Data } from '../src/shared/data';
import { assignWeekday, createTimetable, setPeriods } from '../src/shared/timetable-ops';

/** 이 파일의 테스트가 쓰는 데이터 폴더. 테스트마다 새로 만든다. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 앱 창의 화면. */
let page: Page;

/** 시간표 "평일반"을 월요일과 수요일에 배정한 저장 파일을 쓴다. 수업 시간은 `periods`다. */
async function seed(periods: { start: number; end: number }[] = [], settings: Partial<Data['settings']> = {}): Promise<void> {
  let data = createTimetable(emptyData(), 't0', 'mon');
  data = assignWeekday(data, 'wed', 't0');
  data = setPeriods(data, 't0', periods);
  data.timetables = data.timetables.map((t) => ({ ...t, name: '평일반' }));
  data.settings = { ...data.settings, ...settings };
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
}

/** 시:분을 자정부터의 분으로. */
const at = (h: number, m: number): number => h * 60 + m;

/** 앱을 띄우고 시간표 화면의 월요일을 연다. */
async function launch(): Promise<void> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '시간표' }).click();
  await page.getByRole('button', { name: /^월요일 · / }).click();
}

/** 앱을 끈다. 저장하지 않은 편집이 남은 채로는 창 닫기가 멈추므로 `close()` 대신 바로 끝낸다. */
async function quit(): Promise<void> {
  await app?.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => undefined);
  app = undefined;
}

/** 저장 파일을 읽는다. */
async function saved(): Promise<Data> {
  return JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data;
}

/** 시각 칸에 네 자리 숫자를 쳐서 확정한다. */
async function typeTime(label: string, digits: string): Promise<void> {
  const field = page.getByLabel(label, { exact: true });
  await field.click();
  await field.pressSequentially(digits);
  await field.press('Enter');
}

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});

test.afterEach(async () => {
  await quit();
  await chmod(dataDir, 0o755);
  await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('수업 시간을 더해 저장하면 앱을 다시 띄워도 남아 있고, 그 시간표를 쓰는 다른 요일도 함께 바뀐다', async () => {
  await seed();
  await launch();
  // 고치기 전에는 되돌리기와 저장이 없다
  await expect(page.getByRole('button', { name: '저장', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '수업 시간', exact: true }).click();
  // 새 줄은 09:00~09:50이고 시작 시각 칸에 초점이 있다
  await expect(page.getByLabel('1교시 시작 시각')).toBeFocused();
  await expect(page.getByLabel('1교시 시작 시각')).toHaveValue('09:00');
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:50');
  await expect(page.getByRole('button', { name: '되돌리기' })).toBeVisible();

  await typeTime('1교시 끝 시각', '1020');
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('10:20');
  // 저장 전에는 파일이 그대로다
  expect((await saved()).timetables[0]?.periods).toEqual([]);

  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: '수업 시간을 저장했어요' })).toBeVisible();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toHaveCount(0);
  expect((await saved()).timetables[0]?.periods).toEqual([{ start: at(9, 0), end: at(10, 20) }]);

  // 같은 시간표를 쓰는 수요일에도 같은 수업 시간이 보인다
  await page.getByRole('button', { name: /^수요일 · / }).click();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('10:20');

  await quit();
  await launch();
  await expect(page.getByLabel('1교시 시작 시각')).toHaveValue('09:00');
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('10:20');
});

test('교시 번호는 시작 시각 순서로 매겨지고 시계판 호에 같은 번호가 붙는다', async () => {
  await seed([{ start: at(9, 0), end: at(9, 50) }, { start: at(11, 0), end: at(11, 50) }]);
  await launch();
  const dial = page.getByRole('img', { name: '12시간 시계판' });
  await expect(dial.locator('.dial__period')).toHaveText(['1', '2']);

  // 하나 더 더해 가운데 시각으로 고치면, 끼어든 수업이 2교시가 되고 뒤의 수업이 3교시가 된다
  await page.getByRole('button', { name: '수업 시간', exact: true }).click();
  // 시작을 먼저 고치면 번호가 바뀌어 칸 이름이 달라지므로, 끝을 먼저 고친다
  await typeTime('3교시 끝 시각', '1040');
  await typeTime('3교시 시작 시각', '1020');
  // 초점이 줄 밖으로 나가면 시작 시각 순으로 정렬된다
  await page.getByRole('button', { name: '되돌리기' }).focus();
  await expect(page.getByLabel('1교시 시작 시각')).toHaveValue('09:00');
  await expect(page.getByLabel('2교시 시작 시각')).toHaveValue('10:20');
  await expect(page.getByLabel('3교시 시작 시각')).toHaveValue('11:00');
  await expect(dial.locator('.dial__period')).toHaveText(['1', '2', '3']);
});

test('겹치는 수업 시간은 그 줄에 오류를 보이고 저장을 잠그며 자동으로 고치지 않는다', async () => {
  await seed([{ start: at(9, 0), end: at(9, 50) }, { start: at(10, 0), end: at(10, 50) }]);
  await launch();
  const save = page.getByRole('button', { name: '저장', exact: true });

  await typeTime('2교시 시작 시각', '0930');
  await expect(page.getByRole('alert').filter({ hasText: '09:00~09:50 수업과 겹쳐요' })).toBeVisible();
  await expect(page.locator('.period-row--bad')).toHaveCount(2);
  await expect(save).toBeDisabled();
  // 자동으로 고치지 않는다
  await expect(page.getByLabel('2교시 시작 시각')).toHaveValue('09:30');

  // 고치면 오류가 사라지고 저장이 열린다
  await typeTime('2교시 시작 시각', '1000');
  await expect(page.locator('.period-row--bad')).toHaveCount(0);
  await expect(save).toBeEnabled();

  // 끝이 시작보다 이르면 마찬가지로 잠긴다
  await typeTime('2교시 끝 시각', '0950');
  await expect(page.getByRole('alert').filter({ hasText: '끝 시각이 시작 시각보다 늦어야 해요' })).toBeVisible();
  await expect(save).toBeDisabled();

  // 24시 이상도 그대로 받아 범위 오류로 알린다
  await typeTime('2교시 끝 시각', '2500');
  await expect(page.getByRole('alert').filter({ hasText: '00:00부터 23:59 사이' })).toBeVisible();
  await expect(save).toBeDisabled();
});

test('되돌리기는 마지막 저장 상태로 돌리고 줄을 지울 수 있다', async () => {
  await seed([{ start: at(9, 0), end: at(9, 50) }, { start: at(10, 0), end: at(10, 50) }]);
  await launch();
  await page.getByRole('button', { name: '2교시 지우기' }).click();
  await expect(page.getByLabel('2교시 시작 시각')).toHaveCount(0);
  await typeTime('1교시 시작 시각', '0830');
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(page.getByLabel('1교시 시작 시각')).toHaveValue('09:00');
  await expect(page.getByLabel('2교시 시작 시각')).toHaveValue('10:00');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toHaveCount(0);
});

test('저장하지 않고 다른 화면으로 가려 하면 모달이 뜨고, 계속 편집 · 저장 안 함 · 저장이 각각 동작한다', async () => {
  await seed([{ start: at(9, 0), end: at(9, 50) }]);
  await launch();
  const rail = page.getByRole('navigation', { name: '화면' });
  await typeTime('1교시 끝 시각', '0955');

  // 계속 편집: 화면과 편집이 그대로다
  await rail.getByRole('button', { name: '설정' }).click();
  const dialog = page.getByRole('dialog', { name: '바꾼 내용을 저장할까요?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: '계속 편집' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:55');

  // Esc도 아무것도 하지 않고 닫는다
  await rail.getByRole('button', { name: '설정' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:55');

  // 다른 요일로 가도 묻는다. 저장 안 함은 편집을 버리고 간다
  await page.getByRole('button', { name: /^화요일 · / }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '저장 안 함' }).click();
  await expect(page.getByRole('button', { name: /^화요일 · / })).toHaveAttribute('aria-pressed', 'true');
  expect((await saved()).timetables[0]?.periods).toEqual([{ start: at(9, 0), end: at(9, 50) }]);
  await page.getByRole('button', { name: /^월요일 · / }).click();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:50');

  // 저장: 저장하고 가려던 화면으로 간다
  await typeTime('1교시 끝 시각', '1000');
  await rail.getByRole('button', { name: '설정' }).click();
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(rail.getByRole('button', { name: '설정' })).toHaveAttribute('aria-current', 'page');
  expect((await saved()).timetables[0]?.periods).toEqual([{ start: at(9, 0), end: at(10, 0) }]);

  // 시간표 선택 창을 열려 할 때도 묻는다
  await rail.getByRole('button', { name: '시간표' }).click();
  // 화면을 다시 열면 오늘 요일이 선택되어 있다
  await page.getByRole('button', { name: /^월요일 · / }).click();
  await typeTime('1교시 끝 시각', '1010');
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '계속 편집' }).click();
});

test('오류가 있으면 모달의 저장도 잠긴다', async () => {
  await seed([{ start: at(9, 0), end: at(9, 50) }, { start: at(10, 0), end: at(10, 50) }]);
  await launch();
  await typeTime('2교시 시작 시각', '0930');
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();
  const dialog = page.getByRole('dialog', { name: '바꾼 내용을 저장할까요?' });
  await expect(dialog.getByRole('button', { name: '저장', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('alert')).toContainText('겹쳐요');
  // 오류가 있으면 처음 초점이 맨 앞의 계속 편집에 간다
  await expect(dialog.getByRole('button', { name: '계속 편집' })).toBeFocused();
});

test('저장하지 않고 창을 닫으려 하면 닫히지 않고 모달이 뜬다', async () => {
  // 닫기 버튼이 앱을 끝내게 해 두어, 편집을 버린 뒤 창이 닫히는 것을 본다(숨기는 길은 residency.spec.ts가 본다)
  await seed([{ start: at(9, 0), end: at(9, 50) }], { hideOnClose: false });
  await launch();
  await typeTime('1교시 끝 시각', '0955');
  // 화면이 보낸 "편집 중" 알림을 메인이 받은 뒤에 닫는다. 같은 채널은 순서대로 처리되므로 같은 알림을 한 번 더 보내 그 끝을 기다린다
  await page.evaluate(() => window.dingdong.command({ type: 'set-editing-dirty', dirty: true }));
  await (await app!.browserWindow(page)).evaluate((win) => win.close());
  const dialog = page.getByRole('dialog', { name: '바꾼 내용을 저장할까요?' });
  await expect(dialog).toBeVisible();
  expect(page.isClosed()).toBe(false);

  // 계속 편집을 누르면 그대로 남는다
  await dialog.getByRole('button', { name: '계속 편집' }).click();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('09:55');

  // 저장 안 함을 누르면 편집을 버리고 창이 닫힌다
  await (await app!.browserWindow(page)).evaluate((win) => win.close());
  // 클릭이 끝나기 전에 창이 닫힐 수 있으니 닫힘을 먼저 기다리기 시작한다
  const closed = page.waitForEvent('close');
  await dialog.getByRole('button', { name: '저장 안 함' }).click();
  await closed;
  expect((await saved()).timetables[0]?.periods).toEqual([{ start: at(9, 0), end: at(9, 50) }]);
});

test('저장에 실패하면 편집 상태가 그대로 남고 실패 알림이 뜬다', async () => {
  test.skip(process.getuid?.() === 0, '루트는 쓰기 권한 검사를 건너뛴다');
  await seed([{ start: at(9, 0), end: at(9, 50) }]);
  await launch();
  await typeTime('1교시 끝 시각', '1000');
  await chmod(dataDir, 0o555);
  await page.getByRole('button', { name: '저장', exact: true }).click();

  await expect(page.getByRole('alert').filter({ hasText: '저장하지 못했어요' })).toBeVisible();
  await expect(page.getByLabel('1교시 끝 시각')).toHaveValue('10:00');
  await expect(page.getByRole('button', { name: '되돌리기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeEnabled();

  // 폴더가 다시 쓸 수 있게 되면 같은 "저장"으로 저장된다
  await chmod(dataDir, 0o755);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('button', { name: '저장', exact: true })).toHaveCount(0);
  await expect.poll(async () => (await saved()).timetables[0]?.periods).toEqual([{ start: at(9, 0), end: at(10, 0) }]);
});

test('시각의 숫자는 어떤 숫자든 같은 폭의 칸에 들어간다', async () => {
  await seed([{ start: at(11, 11), end: at(18, 8) }]);
  await launch();
  /** 시작 시각 칸의 숫자 칸 폭들. */
  const widths = async (): Promise<number[]> =>
    page
      .getByLabel('1교시 시작 시각')
      .locator('xpath=..')
      .locator('.time-field__digit')
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  const before = await widths();
  expect(before).toHaveLength(4);
  expect(new Set(before).size).toBe(1);
  await typeTime('1교시 시작 시각', '0808');
  expect(await widths()).toEqual(before);
});
