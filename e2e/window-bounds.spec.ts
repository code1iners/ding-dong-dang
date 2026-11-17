import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { emptyData } from '../src/shared/data';

// 창 자리와 크기가 저장 파일을 거쳐 다시 띄운 앱에 돌아오는지 실제 앱으로 본다.
/** 이 파일의 테스트들이 나눠 쓰는 임시 데이터 폴더. */
let dataDir: string;

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});
test.afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true });
});

/** 임시 데이터 폴더로 앱을 띄운다. */
function launch(): Promise<ElectronApplication> {
  return electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
}

/** 앱의 첫 창의 바깥 자리와 크기. */
async function windowBounds(app: ElectronApplication) {
  await app.firstWindow();
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getBounds());
}

test('옮기고 크기를 바꾼 창은 다시 띄우면 그 자리와 크기로 열린다', async () => {
  const first = await launch();
  await first.firstWindow();
  await first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setBounds({ x: 120, y: 90, width: 1100, height: 700 }));
  /** 자리를 바꾼 직후 창이 실제로 가진 값. */
  const moved = await windowBounds(first);
  // 저장은 잠깐 미뤄서 이루어지므로 파일에 나타날 때까지 기다린다
  await expect
    .poll(async () => {
      try {
        return JSON.parse(await readFile(join(dataDir, 'data.json'), 'utf8')).window;
      } catch {
        // 아직 파일이 없거나 쓰는 중이다
        return null;
      }
    })
    .toEqual(moved);
  await first.close();

  const second = await launch();
  expect(await windowBounds(second)).toEqual(moved);
  await second.close();
});

test('저장된 자리가 연결된 모니터 밖이면 기본 위치로 열린다', async () => {
  await writeFile(
    join(dataDir, 'data.json'),
    JSON.stringify({ ...emptyData(), window: { x: -30000, y: -30000, width: 1100, height: 700 } }),
  );
  const app = await launch();
  const bounds = await windowBounds(app);
  /** 연결된 모니터들의 작업 영역. */
  const areas = await app.evaluate(({ screen }) => screen.getAllDisplays().map((d) => d.workArea));
  expect(areas.some((a) => bounds.x >= a.x && bounds.x < a.x + a.width && bounds.y >= a.y && bounds.y < a.y + a.height)).toBe(true);
  await app.close();
});
