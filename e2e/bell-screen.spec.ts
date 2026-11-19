import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { emptyData, type Data } from '../src/shared/data';
import { dataWith, weekdayOf } from './timetable-fixture';

/** 이 파일의 테스트가 쓰는 데이터 폴더. 테스트마다 새로 만든다. */
let dataDir: string;
/** 등록하려고 고르는 파일을 두는 폴더. */
let sourceDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;
/** 앱 창의 화면. */
let page: Page;

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
  sourceDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-src-'));
});

test.afterEach(async () => {
  await app?.close();
  app = undefined;
  await rm(dataDir, { recursive: true, force: true });
  await rm(sourceDir, { recursive: true, force: true });
});

/** 데이터 폴더로 앱을 띄우고 종 화면을 연다. */
async function launch(): Promise<void> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  page = await app.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '종', exact: true }).click();
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

/** 사인파 한 음을 8kHz 8비트 모노 WAV로 만든다. */
function wav(seconds: number): Buffer {
  const rate = 8000;
  const samples = Math.round(seconds * rate);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples, 40);
  const body = Buffer.alloc(samples);
  for (let i = 0; i < samples; i += 1) body[i] = 128 + Math.round(40 * Math.sin((2 * Math.PI * 440 * i) / rate));
  return Buffer.concat([header, body]);
}

/** 소리 파일을 만들어 경로를 돌려준다. */
async function makeFile(name: string, content: Buffer): Promise<string> {
  const path = join(sourceDir, name);
  await writeFile(path, content);
  return path;
}

/** 다음에 "종소리 등록"을 누르면 파일 고르기 창이 이 파일을 고른 것으로 한다. */
async function pickFile(path: string): Promise<void> {
  await app!.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = (() => Promise.resolve({ canceled: false, filePaths: [filePath] })) as typeof dialog.showOpenDialog;
  }, path);
}

/** 종소리 한 줄. */
const row = (name: string) => page.getByRole('listitem').filter({ hasText: name });

/** 숨긴 재생기 창 안의 소리. 울린 적이 없으면 null. */
async function playerAudio() {
  return app!.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('bell.html'));
    if (!win) return null;
    return (await win.webContents.executeJavaScript(
      `(() => { const a = document.querySelector('audio'); return a && { paused: a.paused, volume: a.volume }; })()`,
    )) as { paused: boolean; volume: number } | null;
  });
}

test('내장 음원 열두 개가 처음부터 목록에 있고 시작종과 끝종은 웨스트민스터다', async () => {
  await launch();
  await expect(page.getByRole('list', { name: '종소리 목록' }).getByRole('listitem')).toHaveCount(12);
  await expect(page.getByRole('button', { name: '웨스트민스터 시작 시작종으로 쓰기' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '웨스트민스터 끝 끝종으로 쓰기' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '화음 끝 시작종으로 쓰기' })).toHaveAttribute('aria-pressed', 'false');
  // 내장 음원에는 이름 바꾸기와 지우기가 없다
  await expect(page.getByRole('button', { name: /이름 바꾸기|지우기/ })).toHaveCount(0);
});

test('종소리를 등록해 시작종으로 고른 뒤 지우면 기본 음원으로 돌아가고 되돌리기로 복구된다', async () => {
  await launch();
  await pickFile(await makeFile('우리 학원 종.wav', wav(3)));
  await page.getByRole('button', { name: '종소리 등록' }).click();

  await expect(row('우리 학원 종')).toBeVisible();
  await expect(page.getByText("'우리 학원 종' 종소리를 등록했어요")).toBeVisible();
  /** 저장된 등록 음원. */
  const [sound] = (await saved()).sounds;
  expect(sound).toMatchObject({ name: '우리 학원 종' });
  expect(await readdir(join(dataDir, 'sounds'))).toEqual([sound!.file]);

  await page.getByRole('button', { name: '우리 학원 종 시작종으로 쓰기' }).click();
  await expect(page.getByRole('button', { name: '우리 학원 종 시작종으로 쓰기' })).toHaveAttribute('aria-pressed', 'true');
  expect((await saved()).startBell).toBe(sound!.id);

  await page.getByRole('button', { name: "'우리 학원 종' 지우기" }).click();
  await expect(row('우리 학원 종')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '웨스트민스터 시작 시작종으로 쓰기' })).toHaveAttribute('aria-pressed', 'true');
  expect(await saved()).toMatchObject({ sounds: [], startBell: 'westminster-start' });
  // 되돌릴 수 있는 동안 복사한 파일은 남아 있다
  expect(existsSync(join(dataDir, 'sounds', sound!.file))).toBe(true);

  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(row('우리 학원 종')).toBeVisible();
  await expect(page.getByRole('button', { name: '우리 학원 종 시작종으로 쓰기' })).toHaveAttribute('aria-pressed', 'true');
  expect(await saved()).toMatchObject({ startBell: sound!.id, sounds: [sound] });
  expect(existsSync(join(dataDir, 'sounds', sound!.file))).toBe(true);
});

test('지운 뒤 알림을 닫으면 복사해 둔 파일이 지워진다', async () => {
  await launch();
  await pickFile(await makeFile('쉬는 종.wav', wav(2)));
  await page.getByRole('button', { name: '종소리 등록' }).click();
  await expect(row('쉬는 종')).toBeVisible();
  await page.getByRole('button', { name: "'쉬는 종' 지우기" }).click();
  await expect(page.getByText("'쉬는 종' 종소리를 지웠어요")).toBeVisible();
  expect(await readdir(join(dataDir, 'sounds'))).toHaveLength(1);

  await page.getByRole('button', { name: '알림 닫기' }).click();
  await expect.poll(() => readdir(join(dataDir, 'sounds'))).toEqual([]);
});

test('지운 종소리를 이어서 지워도 방금 지운 것은 되돌리면 파일까지 돌아온다', async () => {
  await launch();
  for (const name of ['첫째', '둘째']) {
    await pickFile(await makeFile(`${name}.wav`, wav(2)));
    await page.getByRole('button', { name: '종소리 등록' }).click();
    await expect(row(name)).toBeVisible();
  }
  await page.getByRole('button', { name: "'첫째' 지우기" }).click();
  await page.getByRole('button', { name: "'둘째' 지우기" }).click();
  // 첫째의 알림이 닫히면서 정리가 돌지만, 둘째는 아직 되돌릴 수 있어 파일이 남아야 한다
  await expect.poll(async () => (await readdir(join(dataDir, 'sounds'))).length).toBe(1);
  await page.getByRole('button', { name: '되돌리기' }).click();
  await expect(row('둘째')).toBeVisible();
  const [sound] = (await saved()).sounds;
  expect(sound!.name).toBe('둘째');
  expect(await readdir(join(dataDir, 'sounds'))).toEqual([sound!.file]);
});

test('61초짜리 파일은 이유와 함께 거절되고, 지원하지 않는 형식도 거절된다', async () => {
  await launch();
  await pickFile(await makeFile('긴 소리.wav', wav(61)));
  await page.getByRole('button', { name: '종소리 등록' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '60초를 넘어요' })).toBeVisible();
  await expect(page.getByRole('list', { name: '종소리 목록' }).getByRole('listitem')).toHaveCount(12);

  await pickFile(await makeFile('깨진 소리.mp3', Buffer.from('mp3가 아닌 내용')));
  await page.getByRole('button', { name: '종소리 등록' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '재생할 수 없어요' })).toBeVisible();
  await pickFile(await makeFile('메모.txt', Buffer.from('x')));
  await page.getByRole('button', { name: '종소리 등록' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'mp3, wav, m4a, ogg' })).toBeVisible();

  // 거절된 파일은 복사되지도, 저장 파일에 기록되지도 않는다
  expect(existsSync(join(dataDir, 'sounds')) ? await readdir(join(dataDir, 'sounds')) : []).toEqual([]);
  expect(existsSync(join(dataDir, 'data.json')) ? (await saved()).sounds : []).toEqual([]);
});

test('60초 정확히인 파일은 등록된다', async () => {
  await launch();
  await pickFile(await makeFile('딱 일분.wav', wav(60)));
  await page.getByRole('button', { name: '종소리 등록' }).click();
  await expect(row('딱 일분')).toBeVisible();
});

test('sounds/의 파일을 지우고 앱을 다시 띄우면 그 줄이 없고 쓰이던 자리는 기본 음원이다', async () => {
  await launch();
  await pickFile(await makeFile('우리 종.wav', wav(2)));
  await page.getByRole('button', { name: '종소리 등록' }).click();
  await expect(row('우리 종')).toBeVisible();
  await page.getByRole('button', { name: '우리 종 끝종으로 쓰기' }).click();
  await expect.poll(async () => (await saved()).endBell).not.toBe('westminster-end');
  /** 등록한 음원. */
  const [sound] = (await saved()).sounds;
  await quit();

  await rm(join(dataDir, 'sounds', sound!.file));
  await launch();
  await expect(page.getByRole('list', { name: '종소리 목록' }).getByRole('listitem')).toHaveCount(12);
  await expect(row('우리 종')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '웨스트민스터 끝 끝종으로 쓰기' })).toHaveAttribute('aria-pressed', 'true');
  expect(await saved()).toMatchObject({ sounds: [], endBell: 'westminster-end' });
});

test('시작할 때 재생할 수 없는 등록 파일은 알리지 않고 목록에서 뺀다', async () => {
  const data = emptyData();
  data.sounds = [{ id: 'bad', name: '깨진 종', file: 'bad.mp3' }];
  data.startBell = 'bad';
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
  await mkdir(join(dataDir, 'sounds'));
  await writeFile(join(dataDir, 'sounds', 'bad.mp3'), 'not audio');
  await launch();
  await expect.poll(async () => (await saved()).sounds).toEqual([]);
  await expect(row('깨진 종')).toHaveCount(0);
  expect((await saved()).startBell).toBe('westminster-start');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('음량과 이름 바꾸기가 즉시 저장된다', async () => {
  await launch();
  await page.getByRole('slider', { name: '전체 음량' }).fill('40');
  await page.getByRole('slider', { name: '화음 끝 음량' }).fill('70');
  await expect.poll(async () => (await saved()).masterVolume).toBe(40);
  expect((await saved()).soundVolumes).toEqual({ 'chord-end': 70 });

  await pickFile(await makeFile('옛 이름.wav', wav(2)));
  await page.getByRole('button', { name: '종소리 등록' }).click();
  await page.getByRole('button', { name: "'옛 이름' 이름 바꾸기" }).click();
  await page.getByRole('textbox', { name: "'옛 이름' 새 이름" }).fill('새 이름');
  await page.keyboard.press('Enter');
  await expect(row('새 이름')).toBeVisible();
  await expect.poll(async () => (await saved()).sounds.map((s) => s.name)).toEqual(['새 이름']);
});

test('미리 듣기는 누르면 재생되고 다시 누르면 멈추며, 다른 줄을 누르면 앞의 것이 끊기고, 실제 종과 같은 크기다', async () => {
  const data = emptyData();
  data.masterVolume = 50;
  data.soundVolumes = { 'tiring-start': 80 };
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
  await launch();

  /** "띠링 시작"의 미리 듣기 단추. */
  const first = page.getByRole('button', { name: '띠링 시작 미리 듣기' });
  await first.click();
  await expect(page.getByRole('button', { name: '띠링 시작 미리 듣기 멈추기' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(playerAudio).toMatchObject({ paused: false, volume: 0.4 });

  // 다른 줄을 누르면 앞의 것이 끊기고 새 줄이 재생된다
  await page.getByRole('button', { name: '화음 시작 미리 듣기' }).click();
  await expect(page.getByRole('button', { name: '띠링 시작 미리 듣기' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: '화음 시작 미리 듣기 멈추기' })).toBeVisible();
  await expect.poll(playerAudio).toMatchObject({ paused: false, volume: 0.5 });

  // 다시 누르면 멈춘다
  await page.getByRole('button', { name: '화음 시작 미리 듣기 멈추기' }).click();
  await expect(page.getByRole('button', { name: '화음 시작 미리 듣기' })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(playerAudio).toBeNull();
});

test('미리 듣기가 끝까지 울리면 단추가 원래대로 돌아온다', async () => {
  await launch();
  // 가장 짧은 내장 음원(띠링, 2.0초)
  await page.getByRole('button', { name: '띠링 끝 미리 듣기' }).click();
  await expect(page.getByRole('button', { name: '띠링 끝 미리 듣기 멈추기' })).toBeVisible();
  await expect(page.getByRole('button', { name: '띠링 끝 미리 듣기' })).toBeVisible({ timeout: 8000 });
});

test('미리 듣는 중에 종 시각이 오면 미리 듣기가 끊기고 종이 울린다', async () => {
  test.setTimeout(150_000);
  // 자정을 넘기는 수업 시간은 저장할 수 없어, 하루의 마지막 몇 분이면 자정이 지나기를 기다린다
  while (new Date().getHours() * 60 + new Date().getMinutes() >= 24 * 60 - 4) {
    await new Promise((r) => setTimeout(r, 5_000));
  }
  const now = new Date();
  const passed = now.getHours() * 60 + now.getMinutes();
  /** 시작종이 울릴 분. 앱이 뜨고 미리 듣기를 누를 시간을 두려고 30초 넘게 남은 분을 고른다. */
  const target = now.getSeconds() < 20 ? passed + 1 : passed + 2;
  const ringAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, target).getTime();

  const data = dataWith([{ id: 'e2e', name: '시험반', days: [weekdayOf(now)], periods: [{ start: target, end: target + 1 }] }]);
  // 종은 음원별 20% × 전체 50% = 0.1, 긴 미리 듣기(웨스트민스터 끝, 8.6초)는 100% × 50% = 0.5
  data.masterVolume = 50;
  data.soundVolumes = { 'westminster-start': 20 };
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
  await launch();

  // 종 시각 3초 전에 8.6초짜리를 미리 듣기 시작한다
  await new Promise((r) => setTimeout(r, Math.max(0, ringAt - 3000 - Date.now())));
  await page.getByRole('button', { name: '웨스트민스터 끝 미리 듣기' }).click();
  await expect.poll(playerAudio).toMatchObject({ paused: false, volume: 0.5 });

  // 종 시각이 지나면 미리 듣기는 끊기고 종이 자기 크기로 울린다
  await expect(page.getByRole('button', { name: '웨스트민스터 끝 미리 듣기' })).toBeVisible({ timeout: 10_000 });
  await expect.poll(playerAudio).toMatchObject({ paused: false, volume: 0.1 });
});
