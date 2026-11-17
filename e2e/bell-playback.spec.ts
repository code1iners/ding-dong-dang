import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { emptyData, WEEKDAYS, type Data } from '../src/shared/data';

// 실제 시각을 기다리는 확인은 이 파일 하나다. 다음 분의 0초에 시작종이 울리는 저장 파일을 만들어 앱을 띄운다.
// 시각을 속이지 않으므로 종 시각까지 최대 1분 남짓 기다린다.

/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 이 테스트만 쓰는 임시 데이터 폴더. */
let dataDir: string;

test.afterEach(async () => {
  await app?.close();
  await rm(dataDir, { recursive: true, force: true });
});

/** 지금 시각의 자정부터의 분. */
function minuteOfDay(at: Date): number {
  return at.getHours() * 60 + at.getMinutes();
}

/** 숨긴 종 재생기 창의 상태와 그 안에서 재생 중인 소리. */
async function playerState(launched: ElectronApplication) {
  return launched.evaluate(async ({ BrowserWindow }) => {
    /** 숨긴 종 재생기 창. 화면을 불러오기 전에는 찾지 못한다. */
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('bell.html'));
    if (!win) return null;
    /** 재생기 창 안의 소리. 울린 적이 없으면 null. */
    const audio = (await win.webContents.executeJavaScript(
      `(() => { const a = document.querySelector('audio'); return a && { paused: a.paused, time: a.currentTime, duration: a.duration, volume: a.volume }; })()`,
    )) as { paused: boolean; time: number; duration: number; volume: number } | null;
    return { visible: win.isVisible(), audio };
  });
}

test('앱 창을 숨겨도 저장된 시간표의 종 시각에 숨긴 창에서 종이 울리고, 앱이 뜨기 직전에 지난 종은 울리지 않는다', async () => {
  test.setTimeout(150_000);

  // 자정을 넘기는 수업 시간은 저장할 수 없어, 하루의 마지막 몇 분이면 자정이 지나기를 기다린다
  while (minuteOfDay(new Date()) >= 24 * 60 - 4) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
  /** 저장 파일을 만드는 시각. */
  const now = new Date();
  /** 지금이 속한 분. 이 분의 0초에 시작한 수업의 시작종은 앱이 뜨기 직전에 지난 종이다. */
  const passed = minuteOfDay(now);
  /** 앱이 뜨고 나서 종이 울릴 분. 앱이 뜨고 확인할 시간을 두려고 20초 넘게 남은 분을 고른다. */
  const target = now.getSeconds() < 40 ? passed + 1 : passed + 2;
  /** 종이 울릴 시각(에포크 ms). */
  const ringAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, target).getTime();

  /** 써 넣을 저장 파일. */
  const data: Data = {
    ...emptyData(),
    timetables: [
      {
        id: 'e2e',
        name: '시험반',
        color: 0,
        // 앞 수업의 끝과 다음 수업의 시작이 같아 target에는 시작종만 울린다
        periods: [
          { start: passed, end: target },
          { start: target, end: target + 1 },
        ],
      },
    ],
    // 음원별 음량 50% × 전체 음량 50%
    soundVolumes: { 'westminster-start': 50 },
    masterVolume: 50,
    // 닫기 버튼으로 숨기도록 처음 닫을 때 안내는 이미 본 것으로 둔다
    settings: { ...emptyData().settings, hideNoticeShown: true },
  };
  /** 오늘의 요일 키. getDay()는 일요일이 0이다. */
  const today = WEEKDAYS[(now.getDay() + 6) % 7]!;
  data.weekdays[today] = 'e2e';

  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data), 'utf8');
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  /** 앱 창의 화면. */
  const page = await app.firstWindow();
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

  // 앱이 뜨고 몇 초가 지나도 막 지난 시작종은 울리지 않는다
  await expect.poll(() => playerState(app!)).toEqual({ visible: false, audio: null });
  await new Promise((r) => setTimeout(r, 3_000));
  expect(Date.now()).toBeLessThan(ringAt);
  expect(await playerState(app)).toEqual({ visible: false, audio: null });
  expect(await ringing()).toBe(false);

  // 트레이에 건네는 메뉴를 가로채어 울리는 동안의 항목을 읽는다
  await app.evaluate(({ Menu }) => {
    const spy = ((globalThis as Record<string, unknown>).__traySpy = { menu: null as Electron.Menu | null });
    const build = Menu.buildFromTemplate.bind(Menu);
    Menu.buildFromTemplate = (template) => (spy.menu = build(template));
  });

  // 닫기 버튼으로 앱 창을 숨긴다. 창이 없어도 메인 프로세스의 스케줄러가 종을 울려야 한다
  await (await app.browserWindow(page)).evaluate((w) => w.close());
  expect(await (await app.browserWindow(page)).evaluate((w) => w.isVisible())).toBe(false);

  // 종 시각이 오면 숨긴 창에서 시작종(웨스트민스터 시작, 8.6초)이 25% 크기로 재생된다
  await expect
    .poll(async () => (await playerState(app!))?.audio?.time ?? 0, {
      timeout: ringAt - Date.now() + 10_000,
      intervals: [250],
    })
    .toBeGreaterThan(0);
  /** 울리기 시작한 직후 재생기의 상태. */
  const state = await playerState(app);
  expect(state?.visible).toBe(false);
  expect(state?.audio?.paused).toBe(false);
  expect(state?.audio?.volume).toBeCloseTo(0.25, 5);
  expect(state?.audio?.duration).toBeCloseTo(8.6, 0);
  expect(await ringing()).toBe(true);
  // 종 시각에서 1초 남짓 안에 울리기 시작했다. 상태를 몇 번 읽는 시간까지 더해 넉넉히 본다
  expect(Date.now() - ringAt).toBeLessThan(4_000);

  // 울리는 동안에만 트레이 메뉴에 "종 멈추기"가 있고, 누르면 종이 멈춘다
  await expect
    .poll(() =>
      app!.evaluate(() => (globalThis as unknown as { __traySpy: { menu: Electron.Menu } }).__traySpy.menu.items.map((i) => i.label || i.type)),
    )
    .toEqual(['딩동댕 열기', '종 멈추기', '오늘 종', 'separator', '딩동댕 종료']);
  await app.evaluate(() => {
    const spy = (globalThis as unknown as { __traySpy: { menu: Electron.Menu } }).__traySpy;
    spy.menu.items.find((i) => i.label === '종 멈추기')!.click();
  });
  await expect.poll(ringing).toBe(false);
  await expect
    .poll(() =>
      app!.evaluate(() => (globalThis as unknown as { __traySpy: { menu: Electron.Menu } }).__traySpy.menu.items.map((i) => i.label || i.type)),
    )
    .toEqual(['딩동댕 열기', '오늘 종', 'separator', '딩동댕 종료']);
});
