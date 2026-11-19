import { copyFile, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import type { Data } from '../src/shared/data';
import { dataWith } from './timetable-fixture';

// 설정의 "모든 데이터 지우기"를 실제 앱으로 본다. --data-dir로 띄워 임시 폴더만 지우고, OS의 자동 시작 등록은 건드리지 않는다.

/** 이 테스트만 쓰는 임시 폴더. 데이터 폴더와 그 밖의 원본 음원 폴더를 담는다. */
let root: string;
/** 데이터 폴더. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;

test.beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
  dataDir = join(root, 'data');
});
test.afterEach(async () => {
  await app?.close().catch(() => undefined);
  app = undefined;
  await rm(root, { recursive: true, force: true });
});

/** 시간표 하나와 등록 음원 하나가 든 데이터 폴더를 만든다. 예비본과 치워 둔 깨진 파일도 둔다. */
async function seedDataDir(): Promise<void> {
  /** 써 넣을 저장 파일. */
  const data: Data = {
    ...dataWith([{ id: 't1', name: '평일반', days: [], periods: [{ start: 540, end: 590 }] }]),
    sounds: [{ id: 's1', name: '우리 종', file: 's1.wav' }],
    startBell: 's1',
  };
  await mkdir(join(dataDir, 'sounds'), { recursive: true });
  /** 사용자가 따로 가진 원본 음원. 등록할 때 데이터 폴더로 복사된 것과 별개다. */
  const original = join(root, 'my-bell.wav');
  await copyFile(resolve(__dirname, '../resources/sounds/builtin/tiring-start.wav'), original);
  await copyFile(original, join(dataDir, 'sounds', 's1.wav'));
  await writeFile(join(dataDir, 'data.json'), JSON.stringify(data));
  await writeFile(join(dataDir, 'data.backup.json'), JSON.stringify(data));
  await writeFile(join(dataDir, 'data.corrupt.json'), '{ 깨진');
}

test('"모든 데이터 지우기"는 확인 모달을 거쳐 데이터 폴더를 지우고 앱을 종료한다', async () => {
  await seedDataDir();
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  /** 띄운 앱. 아래에서 종료를 기다린다. */
  const launched = app;
  const page = await launched.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();

  /** 맨 아래 줄의 지우기 단추. */
  const wipe = page.getByRole('button', { name: '모든 데이터 지우기' });
  await wipe.click();
  /** 확인 모달. */
  const dialog = page.getByRole('dialog', { name: '모든 데이터를 지울까요?' });
  await expect(dialog).toBeVisible();
  // 되돌릴 수 없는 일이라 처음 초점은 "취소"다
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  // Esc는 아무것도 하지 않고 닫는다
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await wipe.click();
  await dialog.getByRole('button', { name: '취소' }).click();
  await expect(dialog).toHaveCount(0);
  expect(existsSync(join(dataDir, 'data.json'))).toBe(true);

  /** 앱 프로세스가 끝났을 때 풀리는 약속. */
  const exited = new Promise<number | null>((done) => launched.process().once('exit', (code) => done(code)));
  await wipe.click();
  await dialog.getByRole('button', { name: '지우고 종료' }).click();
  expect(await exited).toBe(0);
  app = undefined;

  // 저장 파일, 예비본, 치워 둔 파일, sounds/는 앱 프로세스가 끝난 때 이미 없다
  for (const name of ['data.json', 'data.backup.json', 'data.corrupt.json', 'sounds']) expect(existsSync(join(dataDir, name))).toBe(false);
  // Chromium이 끝나면서 다시 쓴 앱 내부 기록은 앱이 끝난 뒤의 셸이 지워, 폴더째 남지 않는다
  await expect.poll(async () => (existsSync(dataDir) ? await readdir(dataDir, { recursive: true }) : []), { timeout: 5_000 }).toEqual([]);
  // 데이터 폴더 밖의 원본 음원은 그대로다
  expect(existsSync(join(root, 'my-bell.wav'))).toBe(true);
});
