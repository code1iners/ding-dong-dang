import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkMacSignature, resignTopLevelBundle } from './mac-signature.mts';
import { makeAdHocBundle } from './test-mac-bundle.mts';

/** 시험 번들의 식별자. */
const ID = 'app.example.release-test';

/** 테스트가 만든 임시 폴더. */
const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** 새 임시 폴더. */
function tempDir(): string {
  /** 폴더 경로. */
  const dir = mkdtempSync(join(tmpdir(), 'ddd-mac-signature-'));
  tempDirs.push(dir);
  return dir;
}

describe.skipIf(process.platform !== 'darwin')('Mac 최상위 번들의 지정 요구 조건', () => {
  it('ad-hoc 서명만 한 번들(지정 요구 조건이 cdhash)에서 멈춘다', async () => {
    /** ad-hoc 서명만 한 번들. */
    const app = makeAdHocBundle(tempDir(), ID);
    await expect(checkMacSignature(app, ID)).rejects.toThrow(/지정 요구 조건이 `designated => identifier "app.example.release-test"`가 아닙니다: # designated => cdhash/);
  });

  it('최상위 번들만 다시 서명하면 통과하고, 읽은 지정 요구 조건을 돌려준다', async () => {
    /** 다시 서명할 번들. */
    const app = makeAdHocBundle(tempDir(), ID);
    await resignTopLevelBundle(app, ID);
    await expect(checkMacSignature(app, ID)).resolves.toBe(`designated => identifier "${ID}"`);
  });

  it('다른 식별자로 다시 서명한 번들에서 멈춘다', async () => {
    /** 다른 식별자로 서명한 번들. */
    const app = makeAdHocBundle(tempDir(), ID);
    await resignTopLevelBundle(app, 'app.example.other');
    await expect(checkMacSignature(app, ID)).rejects.toThrow(/designated => identifier "app.example.other"/);
  });

  it('다시 서명한 뒤 내용이 바뀌어 서명이 깨진 번들에서 멈춘다', async () => {
    /** 서명 뒤에 고친 번들. */
    const app = makeAdHocBundle(tempDir(), ID);
    await resignTopLevelBundle(app, ID);
    writeFileSync(join(app, 'Contents', 'Info.plist'), '<plist version="1.0"><dict/></plist>\n');
    await expect(checkMacSignature(app, ID)).rejects.toThrow();
  });
});
