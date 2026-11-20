import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { FEEDBACK_FORM_URL } from '../src/main/feedback-form';

// 설정의 "의견 보내기"가 앱 버전과 OS를 담은 제보 폼 주소를 브라우저로 여는지 실제 앱으로 본다.
// 실제 브라우저는 열지 않도록 메인의 shell.openExternal을 가로채 받은 주소만 기록한다.
/** 이 파일의 테스트들이 나눠 쓰는 임시 데이터 폴더. */
let dataDir: string;
/** 띄운 앱. */
let app: ElectronApplication | undefined;

test.beforeEach(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-e2e-'));
});
test.afterEach(async () => {
  await app?.close().catch(() => undefined);
  app = undefined;
  await rm(dataDir, { recursive: true, force: true });
});

/** 앱을 띄우고, 브라우저로 열려는 주소를 모으도록 shell.openExternal을 바꿔 둔다. */
async function launch(): Promise<ElectronApplication> {
  app = await electron.launch({ args: [resolve(__dirname, '..'), `--data-dir=${dataDir}`] });
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as { openedUrls?: string[] }).openedUrls = opened;
    shell.openExternal = async (url: string) => {
      opened.push(url);
    };
  });
  return app;
}

/** 지금까지 브라우저로 열려던 주소. */
async function openedUrls(launched: ElectronApplication): Promise<string[]> {
  return launched.evaluate(() => (globalThis as { openedUrls?: string[] }).openedUrls ?? []);
}

/** 연 주소가 딩동댕 제보 폼이고 앱 버전과 OS를 담았는지 본다. */
async function expectFeedbackUrl(launched: ElectronApplication, url: string) {
  const parsed = new URL(url);
  expect(`${parsed.origin}${parsed.pathname}`).toBe(FEEDBACK_FORM_URL);
  expect(parsed.searchParams.get('version')).toBe(await launched.evaluate(({ app }) => app.getVersion()));
  expect(parsed.searchParams.get('os')).toMatch(/^(macOS|Windows) \S/);
}

test('설정의 "보내기"를 누르면 앱 버전과 OS를 담은 제보 폼을 연다', async () => {
  const launched = await launch();
  const page = await launched.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();

  await page.getByRole('button', { name: '의견 보내기 폼 열기' }).click();

  await expect.poll(() => openedUrls(launched)).toHaveLength(1);
  await expectFeedbackUrl(launched, (await openedUrls(launched))[0] ?? '');
});

test('키보드로 "보내기"에 초점을 옮겨 눌러도 같은 폼을 연다', async () => {
  const launched = await launch();
  const page = await launched.firstWindow();
  await page.getByRole('navigation', { name: '화면' }).getByRole('button', { name: '설정' }).click();

  /** 의견 보내기 단추. */
  const send = page.getByRole('button', { name: '의견 보내기 폼 열기' });
  // 위쪽 줄의 스위치에서 Tab만으로 이 단추에 닿는지 본다(버전 줄에는 상태에 따라 단추가 있을 수 있다)
  await page.getByRole('switch', { name: '수업 중 컴퓨터 화면 켜짐 유지' }).focus();
  for (let i = 0; i < 10 && !(await send.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(send).toBeFocused();
  await page.keyboard.press('Enter');

  await expect.poll(() => openedUrls(launched)).toHaveLength(1);
  await expectFeedbackUrl(launched, (await openedUrls(launched))[0] ?? '');
});
