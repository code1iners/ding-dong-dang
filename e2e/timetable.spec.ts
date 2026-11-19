import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import type { Data } from '../src/shared/data';
import { dataWith, timetablesOf, type TimetableSpec } from './timetable-fixture';

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

/** 오늘 요일의 한 글자 이름. 일요일이 0이다. */
const todayName = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]!;

/** 앱을 끈다. */
async function quit(): Promise<void> {
  await app?.close();
  app = undefined;
}

/** 저장 파일을 읽는다. */
async function saved(): Promise<Data> {
  return JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data;
}

/** 시간표 n개가 있고 월요일에 첫 시간표를 배정한 저장 파일을 쓴다. 이름은 "반0", "반1"… */
async function seed(n: number, firstDays: TimetableSpec['days'] = ['mon']): Promise<void> {
  const specs: TimetableSpec[] = Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `반${i}`, days: i === 0 ? firstDays : [], periods: [] }));
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(dataWith(specs)));
}

/** 저장 파일의 시간표를 읽는다. */
async function savedTimetables() {
  return timetablesOf(await saved());
}

/** 저장 파일에서 시간표 하나의 요일. */
async function savedDays(id: string) {
  return (await savedTimetables()).find((t) => t.id === id)?.days;
}

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});

test.afterEach(async () => {
  await quit();
  await chmod(dataDir, 0o755);
  await rm(dataDir, { recursive: true, force: true });
});

test('시간표 화면을 열면 오늘 요일이 선택되어 있고, 요일 동그라미는 배정된 색과 이름을 보여 준다', async () => {
  await seed(2);
  await launch();
  await expect(page.getByRole('button', { pressed: true })).toHaveText(todayName);
  await expect(page.getByRole('button', { pressed: true })).toHaveCount(1);

  /** 월요일 동그라미. */
  const monday = page.getByRole('button', { name: '월요일 · 반0' });
  await expect(monday).toHaveAttribute('title', '월요일 · 반0');
  expect(await monday.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(169, 173, 245)');
  // 배정이 없는 요일은 이름 대신 "시간표 없음"이고 색이 없다
  await expect(page.getByRole('button', { name: '화요일 · 시간표 없음' })).toHaveAttribute('title', '화요일 · 시간표 없음');
});

test('시간표를 만들어 요일에 배정하면 즉시 저장되고 앱을 다시 띄워도 남아 있다', async () => {
  await launch();
  await page.getByRole('button', { name: /^수요일 · / }).click();
  await page.getByRole('button', { name: /시간표 고르기/ }).click();

  /** 시간표 선택 창. */
  const dialog = page.getByRole('dialog', { name: '수요일 시간표' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '새 시간표' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole('button', { name: '수요일 · 새 시간표' })).toBeVisible();
  /** 저장 파일. */
  const created = timetablesOf(await saved());
  expect(created.map((t) => [t.name, t.color])).toEqual([['새 시간표', 0]]);
  expect(created[0]!.days).toContain('wed');

  await quit();
  await launch();
  await page.getByRole('button', { name: /^수요일 · / }).click();
  await expect(page.getByRole('button', { name: '수요일 · 새 시간표' })).toBeVisible();
});

test('시간표를 고르면 선택한 요일만 바뀌고, 없음을 고르면 배정이 풀린다', async () => {
  await seed(3);
  await launch();
  await page.getByRole('button', { name: '금요일' }).click();
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '반2' }).click();
  await expect(page.getByRole('button', { name: '금요일 · 반2' })).toBeVisible();
  expect(await savedDays('t0')).toEqual(['mon']);
  expect(await savedDays('t2')).toEqual(['fri']);

  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '없음' }).click();
  await expect(page.getByRole('button', { name: '금요일 · 시간표 없음' })).toBeVisible();
  expect((await savedTimetables()).flatMap((t) => t.days)).not.toContain('fri');
});

test('선택 창의 목록은 다섯 줄 반 높이에서 스크롤되고, 없음과 새 시간표는 맨 아래에 계속 보인다', async () => {
  await seed(9);
  await launch();
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  const dialog = page.getByRole('dialog');
  /** 목록의 크기. */
  const list = await dialog.locator('.timetable-list').evaluate((el) => ({
    client: el.clientHeight,
    scroll: el.scrollHeight,
  }));
  // 줄 46 × 5 + 사이 8 × 5 + 반 줄 23 = 293이 보이고, 위 여백 8은 선택 테두리 자리다
  expect(list.client).toBe(293 + 8);
  expect(list.scroll).toBeGreaterThan(list.client);
  await expect(dialog.getByRole('button', { name: '없음' })).toBeInViewport();
  await expect(dialog.getByRole('button', { name: '새 시간표' })).toBeInViewport();

  // 색은 만든 순서대로 여덟을 돌고 아홉째는 처음 색이다
  /** 점들의 색. */
  const colors = await dialog.locator('.timetable-list .dot').evaluateAll((els) =>
    els.map((el) => getComputedStyle(el).backgroundColor),
  );
  expect(colors[0]).toBe('rgb(169, 173, 245)');
  expect(colors[7]).toBe('rgb(231, 154, 214)');
  expect(colors[8]).toBe(colors[0]);
});

test('Esc는 아무것도 바꾸지 않고 선택 창을 닫고 초점은 입력기로 돌아온다', async () => {
  await seed(2);
  await launch();
  /** 시간표 선택 입력기. */
  const select = page.getByRole('button', { name: /시간표 고르기/ });
  await select.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(select).toBeFocused();
  expect(await savedDays('t0')).toEqual(['mon']);
});

test('편집을 누를 때만 이름 바꾸기와 지우기가 나타나고 빈 이름으로는 바꿀 수 없다', async () => {
  await seed(2);
  await launch();
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: /이름 바꾸기|지우기/ })).toHaveCount(0);

  await dialog.getByRole('button', { name: '편집' }).click();
  await expect(dialog.getByRole('button', { name: "'반1' 이름 바꾸기" })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '없음' })).toBeHidden();

  await dialog.getByRole('button', { name: "'반1' 이름 바꾸기" }).click();
  /** 이름 입력 칸. */
  const input = dialog.getByRole('textbox');
  await input.fill('   ');
  await expect(dialog.getByRole('alert')).toContainText('이름을 비울 수 없어요');
  await expect(dialog.getByRole('button', { name: "'반1' 이름 저장" })).toBeDisabled();
  await input.press('Enter');
  expect((await savedTimetables())[1]!.name).toBe('반1');

  // Esc는 이름 바꾸기만 접고 창은 닫지 않는다
  await input.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveCount(0);

  await dialog.getByRole('button', { name: "'반1' 이름 바꾸기" }).click();
  await dialog.getByRole('textbox').fill('토요반');
  await dialog.getByRole('textbox').press('Enter');
  await expect(dialog.getByText('토요반')).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveCount(0);
  await expect.poll(async () => (await savedTimetables())[1]!.name).toBe('토요반');

  await dialog.getByRole('button', { name: '완료' }).click();
  await expect(dialog.getByRole('button', { name: /이름 바꾸기/ })).toHaveCount(0);
});

test('배정되지 않은 시간표는 바로 지워지고 알림의 되돌리기로 원래 자리에 복구된다', async () => {
  await seed(3);
  await launch();
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '편집' }).click();
  await dialog.getByRole('button', { name: "'반1' 지우기" }).click();

  // 확인 모달 없이 바로 지워진다
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(dialog.getByText('반1', { exact: true })).toBeHidden();
  /** 되돌리기 알림. */
  const toast = page.getByRole('status').filter({ hasText: "'반1' 시간표를 지웠어요" });
  await expect(toast).toBeVisible();
  expect((await savedTimetables()).map((t) => t.id)).toEqual(['t0', 't2']);

  // 4초가 지나도 남는다
  await page.waitForTimeout(4500);
  await expect(toast).toBeVisible();

  // 모달이 떠 있어도 알림의 단추에 키보드로 닿는다
  await toast.getByRole('button', { name: '되돌리기' }).focus();
  await page.keyboard.press('Enter');
  await expect(dialog.getByText('반1', { exact: true })).toBeVisible();
  await expect.poll(async () => (await savedTimetables()).map((t) => t.id)).toEqual(['t0', 't1', 't2']);
  await expect(toast).toBeHidden();

  // 되돌렸다는 성공 알림은 4초 뒤에 사라진다
  /** 성공 알림. */
  const done = page.getByRole('status').filter({ hasText: "'반1' 시간표를 되돌렸어요" });
  await expect(done).toBeVisible();
  await expect(done.getByRole('button')).toHaveCount(0);
  await page.waitForTimeout(3000);
  await expect(done).toBeVisible();
  await expect(done).toBeHidden({ timeout: 3000 });
});

test('다른 일을 하면 되돌리기 알림이 사라진다', async () => {
  await seed(3);
  await launch();
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: '편집' }).click();
  await dialog.getByRole('button', { name: "'반1' 지우기" }).click();
  /** 되돌리기 알림. */
  const toast = page.getByRole('status').filter({ hasText: "'반1' 시간표를 지웠어요" });
  await expect(toast).toBeVisible();
  await dialog.getByRole('button', { name: "'반2' 지우기" }).click();
  await expect(toast).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: "'반2' 시간표를 지웠어요" })).toBeVisible();
});

test('배정된 시간표를 지우려 하면 영향받는 요일을 보여 주는 확인 모달이 뜨고 기본 초점은 취소다', async () => {
  // 반0은 월요일과 토요일에 배정한다
  await seed(2, ['mon', 'sat']);
  await launch();

  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '편집' }).click();
  await page.getByRole('dialog').getByRole('button', { name: "'반0' 지우기" }).click();

  /** 확인 모달. */
  const confirm = page.getByRole('dialog', { name: "'반0' 시간표를 지울까요?" });
  await expect(confirm).toContainText('월요일, 토요일에 쓰는 시간표예요.');
  await expect(confirm).toContainText('지우면 그 요일에는 종이 울리지 않아요.');
  await expect(confirm.getByRole('button', { name: '취소' })).toBeFocused();
  await expect(confirm.getByRole('button', { name: '시간표 지우기' })).toBeVisible();

  // Esc는 아무것도 하지 않고 확인 모달만 닫는다
  await page.keyboard.press('Escape');
  await expect(confirm).toBeHidden();
  await expect(page.getByRole('dialog', { name: '시간표 편집' })).toBeVisible();
  expect((await savedTimetables())).toHaveLength(2);

  // 지우면 그 요일은 없음이 된다
  await page.getByRole('dialog').getByRole('button', { name: "'반0' 지우기" }).click();
  await confirm.getByRole('button', { name: '시간표 지우기' }).click();
  await expect(confirm).toBeHidden();
  await expect.poll(async () => (await savedTimetables()).flatMap((t) => t.days)).toEqual([]);
  expect((await savedTimetables()).map((t) => t.id)).toEqual(['t1']);
  // 배정된 시간표를 지울 때는 되돌리기 알림이 없다
  await expect(page.getByRole('status')).toHaveCount(0);
  // 지운 뒤에도 초점은 모달 안에 있다
  await expect(page.getByRole('dialog').getByRole('button', { name: '완료' })).toBeFocused();
});

test('Tab은 모달 안에서만 돈다', async () => {
  await seed(2);
  await launch();
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
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

test('저장에 실패하면 실패 알림이 뜨고 바꾼 내용은 화면에 남는다', async () => {
  test.skip(process.getuid?.() === 0, '루트는 쓰기 권한 검사를 건너뛴다');
  await launch();
  // 데이터 폴더를 읽기 전용으로 바꿔 다음 쓰기를 실패시킨다
  await chmod(dataDir, 0o555);
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '새 시간표' }).click();

  /** 실패 알림. */
  const alert = page.getByRole('alert').filter({ hasText: '저장하지 못했어요. 디스크에 빈 공간이 있는지 확인하고 다시 저장해 주세요.' });
  await expect(alert).toBeVisible();
  // 메모리에는 남아 화면에 보인다
  await expect(page.getByRole('button', { name: new RegExp(`^${todayName}요일 · 새 시간표$`) })).toBeVisible();

  // 또 실패해도 닫았던 알림이 다시 뜬다
  await alert.getByRole('button', { name: '알림 닫기' }).click();
  await expect(alert).toBeHidden();
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '없음' }).click();
  await expect(alert).toBeVisible();

  // 폴더가 다시 쓸 수 있게 되면 다음 변경에서 함께 저장된다
  await chmod(dataDir, 0o755);
  await page.getByRole('button', { name: /시간표 고르기/ }).click();
  await page.getByRole('dialog').locator('.timetable-option--new').click();
  await expect.poll(async () => (await savedTimetables()).length).toBe(2);
});
