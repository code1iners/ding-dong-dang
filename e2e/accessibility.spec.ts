import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test';
import { emptyData, type Data } from '../src/shared/data';
import { assignWeekday, createTimetable, setPeriods } from '../src/shared/timetable-ops';

/** 이 파일의 테스트가 쓰는 데이터 폴더. 테스트마다 새로 만든다. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 앱 창의 화면. */
let page: Page;

/** 시:분을 자정부터의 분으로. */
const at = (h: number, m: number): number => h * 60 + m;

/** 모든 화면의 모든 부품이 나오도록 채운 저장 파일: 시간표 둘(하나는 월요일에 배정), 등록한 종소리 하나. */
async function seedFull(): Promise<void> {
  let data = createTimetable(emptyData(), 't0', 'mon');
  data = createTimetable(data, 't1');
  data = assignWeekday(data, 'wed', 't0');
  data = setPeriods(data, 't0', [
    { start: at(9, 0), end: at(9, 45) },
    { start: at(9, 55), end: at(10, 40) },
  ]);
  data.timetables = data.timetables.map((t, i) => ({ ...t, name: i === 0 ? '평일반' : '토요반' }));
  data.sounds = [{ id: 'mine', name: '내 종소리', file: 'mine.wav' }];
  data.settings = { ...data.settings, hideNoticeShown: true };
  await mkdir(join(dataDir, 'sounds'), { recursive: true });
  // 재생할 수 없는 파일은 시작할 때 목록에서 빠지므로 내장 음원 파일을 복사해 쓴다
  await copyFile(resolve(__dirname, '../resources/sounds/builtin/chord-end.wav'), join(dataDir, 'sounds', 'mine.wav'));
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
}

/** 데이터 폴더로 앱을 띄운다. */
async function launch(): Promise<void> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
  await expect(page.getByRole('main', { name: '현황' })).toBeVisible();
}

/** 왼쪽 세로 줄의 단추. */
const railButton = (name: string): Locator => page.getByRole('navigation', { name: '화면' }).getByRole('button', { name, exact: true });

/** 마우스 없이 왼쪽 세로 줄의 단추에 초점을 두고 Enter로 화면을 연다. */
async function openScreenByKeyboard(name: string): Promise<void> {
  await focusByTab(railButton(name));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main', { name })).toBeVisible();
}

/** Tab을 눌러 `target`에 초점이 닿을 때까지 간다. 80번 안에 닿지 않으면 실패한다. */
async function focusByTab(target: Locator): Promise<void> {
  const handle = await target.elementHandle();
  if (!handle) throw new Error('초점을 보낼 요소가 화면에 없어요');
  for (let i = 0; i < 80; i += 1) {
    if (await handle.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab으로 닿지 못했어요: ${await handle.evaluate((el) => el.outerHTML.slice(0, 120))}`);
}

/** 지금 초점이 있는 요소가 보이는 초점 표시를 가졌는지. 가지지 못했으면 그 요소를 설명하는 글을 돌려준다. */
async function missingFocusIndicator(): Promise<string | null> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return '초점이 어디에도 없어요';
    const describe = `${el.tagName.toLowerCase()}.${el.className} "${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20) ?? ''}"`;
    /** DESIGN.md 초점 색 #1F4FA8. */
    const FOCUS = 'rgb(31, 79, 168)';
    /** 테두리가 초점 색의 3px 이상인지. */
    const ringOf = (target: Element, pseudo?: string): boolean => {
      const style = getComputedStyle(target, pseudo);
      const outline = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 3 && style.outlineColor === FOCUS;
      const shadow = style.boxShadow.includes(FOCUS) && /\b3px\b/.test(style.boxShadow);
      return outline || shadow;
    };
    if (ringOf(el)) return null;
    // 시각 칸은 투명한 입력 칸 위에 겹쳐 그린 칸이 초점을 보인다
    if (el.closest('.time-field--focused') && ringOf(el.closest('.time-field')!)) return null;
    // 슬라이더는 손잡이의 가상 요소가 초점을 그려 계산된 스타일로는 읽을 수 없다. 아래에서 화면에 그려진 색을 센다
    if (el instanceof HTMLInputElement && el.type === 'range') return 'range';
    return describe;
  });
}

/** 지금 초점이 있는 슬라이더 둘레(손잡이)에 초점 색 픽셀이 그려져 있는지 화면 캡처에서 센다. */
async function sliderShowsFocusPixels(): Promise<boolean> {
  const box = await page.evaluate(() => {
    const r = document.activeElement!.getBoundingClientRect();
    return { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16 };
  });
  const png = (await page.screenshot({ clip: box })).toString('base64');
  return page.evaluate(async (data) => {
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    let count = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (Math.abs(pixels[i]! - 31) < 12 && Math.abs(pixels[i + 1]! - 79) < 12 && Math.abs(pixels[i + 2]! - 168) < 12) count += 1;
    }
    // 3px 고리가 손잡이를 둘러싸면 수십 픽셀 이상이다
    return count > 40;
  }, png);
}

/**
 * 화면(또는 모달) 안을 Tab으로 한 바퀴 돌며 모든 정지점에 초점 표시가 있는지 확인한다.
 * `scope`를 주면 초점이 그 안에서만 돌아야 한다. 정지점 수를 돌려준다.
 */
async function everyStopShowsFocus(scope?: string): Promise<number> {
  /** 처음 정지점의 설명. 한 바퀴 돌아 다시 닿으면 멈춘다. */
  const seen = new Set<string>();
  const problems: string[] = [];
  for (let i = 0; i < 80; i += 1) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return 'none';
      if (!el.dataset.a11yStop) el.dataset.a11yStop = String(Math.random());
      return el.dataset.a11yStop;
    });
    if (seen.has(id)) break;
    seen.add(id);
    if (scope) {
      const inside = await page.evaluate((selector) => !!document.activeElement?.closest(selector), scope);
      if (!inside) {
        // 모달이 떠 있는 동안에는 알림의 단추에만 닿을 수 있다
        const inToast = await page.evaluate(() => !!document.activeElement?.closest('.toasts'));
        expect(inToast, '초점이 모달 밖으로 나갔어요').toBe(true);
      }
    }
    let missing = await missingFocusIndicator();
    if (missing === 'range') missing = (await sliderShowsFocusPixels()) ? null : '슬라이더 손잡이에 초점 색이 없어요';
    if (missing) problems.push(missing);
  }
  expect(problems, '초점 표시가 없는 부품').toEqual([]);
  return seen.size;
}

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
  await mkdir(join(dataDir, 'sounds'), { recursive: true });
});

test.afterEach(async () => {
  await app?.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => undefined);
  app = undefined;
  await rm(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test('키보드만으로 시간표를 만들고 수업 시간을 저장하고 요일에 배정한다', async () => {
  await launch();

  // 시간표가 하나도 없는 현황에서 "시간표 만들기" → 시간표 화면
  await focusByTab(page.getByRole('button', { name: '시간표 만들기' }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('main', { name: '시간표' })).toBeVisible();

  // 오늘 요일의 시간표 고르기 단추 → 모달이 열리고 초점이 모달 안에 간다
  /** 시간표 고르기 단추. 이름에 요일이 들어 있다. */
  const select = page.getByRole('button', { name: /시간표 고르기/ });
  await focusByTab(select);
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);

  // 모달 안의 "새 시간표"로 가서 만든다 → 오늘 요일에 배정되고 모달이 닫힌다
  await focusByTab(dialog.getByRole('button', { name: '새 시간표' }));
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  // 닫히면 초점이 연 곳으로 돌아간다
  await expect(select).toBeFocused();
  await expect(select).toContainText('새 시간표');

  // "수업 시간"을 더하면 그 줄의 시작 시각 칸으로 초점이 간다. 숫자 키로 시각을 쓰고 Enter로 확정한다
  await focusByTab(page.getByRole('button', { name: '수업 시간' }));
  await page.keyboard.press('Enter');
  const start = page.getByLabel('1교시 시작 시각', { exact: true });
  await expect(start).toBeFocused();
  await page.keyboard.type('0850');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('1교시 끝 시각', { exact: true })).toBeFocused();
  await page.keyboard.type('0935');
  await page.keyboard.press('Enter');

  // 저장은 키보드로 눌러야 하는 단추다
  await focusByTab(page.getByRole('button', { name: '저장', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: '수업 시간을 저장했어요' })).toBeVisible();
  /** 저장된 파일. */
  const saved = JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data;
  expect(saved.timetables[0]?.periods).toEqual([{ start: at(8, 50), end: at(9, 35) }]);

  // 다른 요일 동그라미를 키보드로 고르고(눌림 상태가 바뀐다) 시간표를 배정한다
  const tuesday = page.getByRole('button', { name: /^화요일 · / });
  await focusByTab(tuesday);
  await page.keyboard.press('Space');
  await expect(tuesday).toHaveAttribute('aria-pressed', 'true');
  await focusByTab(select);
  await page.keyboard.press('Enter');
  await focusByTab(dialog.locator('.timetable-list').getByRole('button', { name: '새 시간표' }));
  await page.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);
  expect(((JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data).weekdays as Record<string, string | null>).tue).toBe(
    saved.timetables[0]?.id,
  );
});

test('키보드만으로 시작종을 바꾸고 설정의 스위치와 슬라이더를 바꾸고, 모달을 Esc로 닫는다', async () => {
  await seedFull();
  await launch();

  // 종 화면: 등록한 종소리를 시작종으로 고른다(선택 동그라미는 눌림 상태를 알린다)
  await openScreenByKeyboard('종');
  const pick = page.getByRole('button', { name: '내 종소리 시작종으로 쓰기' });
  await expect(pick).toHaveAttribute('aria-pressed', 'false');
  await focusByTab(pick);
  await page.keyboard.press('Space');
  await expect(pick).toHaveAttribute('aria-pressed', 'true');
  expect(((JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data).startBell)).toBe('mine');

  // 설정 화면: 스위치는 Space로, 슬라이더는 화살표로 바꾼다
  await openScreenByKeyboard('설정');
  const hide = page.getByRole('switch', { name: '닫으면 숨기기' });
  const before = await hide.getAttribute('aria-checked');
  await focusByTab(hide);
  await page.keyboard.press('Space');
  await expect(hide).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');

  const size = page.getByRole('slider', { name: '강아지 크기' });
  const sizeBefore = Number(await size.inputValue());
  await focusByTab(size);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => Number(await size.inputValue())).toBe(sizeBefore + 2);

  // 모달: "모든 데이터 지우기"가 열리고 처음 초점은 "취소", Esc는 아무것도 하지 않고 닫아 초점을 돌려준다
  const wipe = page.getByRole('button', { name: '모든 데이터 지우기' });
  await focusByTab(wipe);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '모든 데이터를 지울까요?' })).toBeVisible();
  await expect(page.getByRole('button', { name: '취소' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(wipe).toBeFocused();
  // 지워지지 않았다
  expect((JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')) as Data).timetables).toHaveLength(2);
});

test('모든 화면과 모달에서 Tab이 닿는 부품마다 초점 표시가 보이고, 모달 안에서는 초점이 모달 밖으로 나가지 않는다', async () => {
  await seedFull();
  await launch();

  // 현황
  expect(await everyStopShowsFocus()).toBeGreaterThan(4);

  // 시간표 화면
  await openScreenByKeyboard('시간표');
  await page.getByRole('button', { name: /^월요일 · / }).click();
  expect(await everyStopShowsFocus()).toBeGreaterThan(8);

  // 시간표 선택 창: 선택 모드와 편집 모드, 지우기 확인
  await page.getByRole('button', { name: /시간표 고르기/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await everyStopShowsFocus('[role="dialog"]')).toBe(5);
  await page.getByRole('button', { name: '편집', exact: true }).click();
  expect(await everyStopShowsFocus('[role="dialog"]')).toBeGreaterThan(5);
  await page.getByRole('button', { name: "'평일반' 지우기" }).click();
  await expect(page.getByRole('dialog', { name: "'평일반' 시간표를 지울까요?" })).toBeVisible();
  expect(await everyStopShowsFocus('[role="dialog"]')).toBe(2);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // 수업 시간을 고치면 나오는 "되돌리기" · "저장"
  await page.getByLabel('1교시 끝 시각', { exact: true }).fill('0946');
  await page.getByLabel('1교시 끝 시각', { exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: '저장', exact: true })).toBeVisible();
  expect(await everyStopShowsFocus()).toBeGreaterThan(10);
  // 저장하지 않은 편집을 두고 나가려 하면 뜨는 모달(단추 셋)
  await railButton('종').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: '바꾼 내용을 저장할까요?' })).toBeVisible();
  expect(await everyStopShowsFocus('[role="dialog"]')).toBe(3);
  await page.getByRole('button', { name: '저장 안 함' }).click();

  // 종 화면
  await openScreenByKeyboard('종');
  expect(await everyStopShowsFocus()).toBeGreaterThan(30);

  // 설정 화면과 데이터 지우기 모달
  await openScreenByKeyboard('설정');
  expect(await everyStopShowsFocus()).toBeGreaterThan(8);
  await page.getByRole('button', { name: '모든 데이터 지우기' }).focus();
  await page.keyboard.press('Enter');
  expect(await everyStopShowsFocus('[role="dialog"]')).toBe(2);
});

test('아이콘만 있는 단추는 대상을 포함한 이름이 있고 마우스를 올리면 같은 이름이 뜬다. 스위치와 선택 동그라미는 상태를 알린다', async () => {
  await seedFull();
  await launch();

  // 접근성 트리가 보는 이름을 화면마다 모아, 이름이 빈 조작 부품이 없는지 본다
  /** 이름이 없는 조작 부품과, 아이콘만 있는 단추의 title이 이름과 다른 곳. */
  async function audit(): Promise<{ unnamed: string[]; titleMismatch: string[] }> {
    const unnamed: string[] = [];
    const titleMismatch: string[] = [];
    for (const role of ['button', 'switch', 'slider', 'textbox'] as const) {
      for (const el of await page.getByRole(role).all()) {
        // 강아지는 아이콘만 있는 단추가 아니라 그림 자체를 누르는 부품이다. 이름만 확인한다
        const isDog = await el.evaluate((node) => node.classList.contains('ring-dog__button'));
        const name = (await el.evaluate((node) => node.getAttribute('aria-label') ?? '')) || (await el.innerText()).trim();
        const accessible = await el.evaluate(async (node) => {
          // 접근성 이름이 비었는지 aria-labelledby까지 따라가 확인한다
          const ids = node.getAttribute('aria-labelledby')?.split(' ') ?? [];
          const labelled = ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
          return labelled;
        });
        if (!name && !accessible) unnamed.push(await el.evaluate((node) => node.outerHTML.slice(0, 100)));
        // 아이콘만 있는 단추: 글자가 없고 aria-label이 있는 단추
        const iconOnly = (await el.innerText()).trim() === '' && (await el.evaluate((node) => node.hasAttribute('aria-label')));
        if (iconOnly) {
          const title = await el.getAttribute('title');
          const label = await el.getAttribute('aria-label');
          // 슬라이더 등 입력 부품은 title 없이 이름만 둔다
          if (role === 'button' && !isDog && title !== label) titleMismatch.push(`${label} / ${title}`);
        }
      }
    }
    return { unnamed, titleMismatch };
  }

  /** 화면마다 이름 감사 결과. */
  const results: Record<string, Awaited<ReturnType<typeof audit>>> = {};
  for (const screen of ['현황', '시간표', '종', '설정']) {
    await railButton(screen).click();
    results[screen] = await audit();
  }
  expect(results).toEqual({
    현황: { unnamed: [], titleMismatch: [] },
    시간표: { unnamed: [], titleMismatch: [] },
    종: { unnamed: [], titleMismatch: [] },
    설정: { unnamed: [], titleMismatch: [] },
  });

  // 대상을 포함한 이름 몇 가지를 직접 확인한다
  await railButton('시간표').click();
  await page.getByRole('button', { name: /^월요일 · / }).click();
  await expect(page.getByRole('button', { name: '1교시 지우기' })).toHaveAttribute('title', '1교시 지우기');
  await expect(page.getByRole('button', { name: '2교시 지우기' })).toHaveAttribute('title', '2교시 지우기');
  await railButton('종').click();
  await expect(page.getByRole('button', { name: "'내 종소리' 지우기" })).toHaveAttribute('title', "'내 종소리' 지우기");
  await expect(page.getByRole('button', { name: "'내 종소리' 이름 바꾸기" })).toHaveAttribute('title', "'내 종소리' 이름 바꾸기");
  await expect(page.getByRole('button', { name: '내 종소리 미리 듣기' })).toHaveAttribute('title', /미리 듣기/);

  // 스위치는 켜짐 · 꺼짐, 선택 동그라미는 선택 여부를 알린다
  await expect(page.getByRole('button', { name: '내 종소리 시작종으로 쓰기' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '웨스트민스터 시작종으로 쓰기' }).or(page.locator('[aria-pressed="true"].pick').first())).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await railButton('설정').click();
  for (const name of ['돌아다니는 강아지', '컴퓨터를 켜면 자동 시작', '닫으면 숨기기', '수업 중 화면 켜 두기']) {
    await expect(page.getByRole('switch', { name })).toHaveAttribute('aria-checked', /^(true|false)$/);
  }

  // 알림은 화면 읽기 프로그램에 읽힌다: 성공은 status, 실패는 alert
  await expect(page.locator('.toast[role="status"], .toast[role="alert"]')).toHaveCount(0);
  const tree = await page.locator('body').ariaSnapshot();
  expect(tree).toContain('navigation "화면"');
  expect(tree).toContain('main "설정"');
});

test('성공 알림은 status, 실패 알림은 alert로 접근성 트리에 나타난다', async () => {
  await seedFull();
  await launch();
  await railButton('시간표').click();
  await page.getByRole('button', { name: /^월요일 · / }).click();
  await page.getByLabel('1교시 끝 시각', { exact: true }).fill('0946');
  await page.getByLabel('1교시 끝 시각', { exact: true }).press('Enter');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('수업 시간을 저장했어요');

  // 겹치는 시각은 그 줄 아래에 alert로 이유를 알린다
  await page.getByRole('button', { name: '수업 시간' }).click();
  await page.getByLabel('3교시 시작 시각', { exact: true }).fill('0900');
  await page.getByLabel('3교시 시작 시각', { exact: true }).press('Enter');
  await expect(page.getByRole('alert').first()).toBeVisible();
});

test('OS의 동작 줄이기가 켜져 있으면 창 안의 강아지가 멈추고 모달과 알림이 움직임 없이 나타난다', async () => {
  await seedFull();
  await launch();

  /** 현황 고리 안 강아지 그림의 마크업. 움직이면 시간에 따라 바뀐다. */
  const dogMarkup = (): Promise<string> => page.locator('.ring-dog .dog-art').first().innerHTML();

  // 동작 줄이기가 꺼져 있으면 그림이 시간에 따라 바뀐다(이 검사가 움직임을 알아보는지 확인)
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(300);
  const seen = new Set<string>();
  for (let i = 0; i < 12; i += 1) {
    seen.add(await dogMarkup());
    await page.waitForTimeout(250);
  }
  expect(seen.size, '동작 줄이기가 꺼져 있을 때 강아지가 움직여야 이 검사가 의미가 있어요').toBeGreaterThan(1);

  // 켜지면 멈춘다
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(500);
  const still = new Set<string>();
  for (let i = 0; i < 12; i += 1) {
    still.add(await dogMarkup());
    await page.waitForTimeout(250);
  }
  expect(still.size).toBe(1);

  // 모달과 알림은 흐려지는 애니메이션 없이 나타난다
  await railButton('설정').click();
  await page.getByRole('button', { name: '모든 데이터 지우기' }).click();
  await expect(page.locator('.modal-backdrop')).toBeVisible();
  expect(await page.locator('.modal-backdrop').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('.modal').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  await page.keyboard.press('Escape');

  await railButton('종').click();
  await page.getByRole('button', { name: "'내 종소리' 지우기" }).click();
  const toast = page.locator('.toast').first();
  await expect(toast).toBeVisible();
  expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

  // 꺼져 있을 때는 같은 요소에 흐려지는 애니메이션이 붙는다
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await toast.evaluate((el) => getComputedStyle(el).animationName)).toBe('fade-in');
});

/** 화면별 캡처에서 글자나 단추가 잘렸는지 보는 검사. 넘치거나 잘린 요소의 설명을 돌려준다. */
async function clippedElements(): Promise<string[]> {
  return page.evaluate(() => {
    const clipped: string[] = [];
    const vw = innerWidth;
    const vh = innerHeight;
    for (const el of document.querySelectorAll<HTMLElement>('button, input, [role="switch"], .card, .modal, .toast, h2, span, p')) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden') continue;
      /** 스크롤하는 조상 안에 있으면 보이는 영역 밖은 정상이다. */
      const scrolled = (() => {
        for (let p: HTMLElement | null = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowY;
          if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return true;
        }
        return false;
      })();
      const tag = `${el.tagName.toLowerCase()}.${el.className} "${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24)}"`;
      // 창 밖으로 나갔는가
      if (!scrolled && (rect.right > vw + 1 || rect.bottom > vh + 1 || rect.left < -1 || rect.top < -1)) clipped.push(`창 밖: ${tag}`);
      // 글자가 자기 칸보다 넓어 잘리거나 겹치는가
      if (style.overflow === 'hidden' && el.scrollWidth > el.clientWidth + 1 && el.children.length === 0) clipped.push(`글자 잘림: ${tag}`);
      if (el.matches('button, [role="switch"]') && el.scrollWidth > el.clientWidth + 1) clipped.push(`단추 넘침: ${tag}`);
    }
    return clipped;
  });
}

test('창을 최소 크기와 큰 크기로 띄운 모든 화면에서 글자와 단추가 잘리지 않는다', async () => {
  await seedFull();
  await launch();
  const shots = process.env.A11Y_SHOTS;
  const window = await app!.browserWindow(page);
  /** 크기마다 화면별 잘림 목록. */
  const problems: Record<string, string[]> = {};
  for (const [width, height] of [
    [920, 580],
    [1600, 1000],
  ] as const) {
    await window.evaluate((w, [cw, ch]) => w.setContentSize(cw, ch), [width, height] as const);
    await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
    for (const screen of ['현황', '시간표', '종', '설정']) {
      await railButton(screen).click();
      if (screen === '시간표') await page.getByRole('button', { name: /^월요일 · / }).click();
      await page.waitForTimeout(150);
      problems[`${width}x${height} ${screen}`] = await clippedElements();
      if (shots) await page.screenshot({ path: join(shots, `${width}x${height}-${screen}.png`) });
    }
    // 모달도 본다
    await railButton('시간표').click();
    await page.getByRole('button', { name: /시간표 고르기/ }).click();
    problems[`${width}x${height} 시간표 선택 창`] = await clippedElements();
    if (shots) await page.screenshot({ path: join(shots, `${width}x${height}-시간표 선택 창.png`) });
    await page.keyboard.press('Escape');
    await railButton('설정').click();
    await page.getByRole('button', { name: '모든 데이터 지우기' }).click();
    problems[`${width}x${height} 지우기 모달`] = await clippedElements();
    if (shots) await page.screenshot({ path: join(shots, `${width}x${height}-지우기 모달.png`) });
    await page.keyboard.press('Escape');
  }
  expect(Object.fromEntries(Object.entries(problems).filter(([, list]) => list.length > 0))).toEqual({});
});
