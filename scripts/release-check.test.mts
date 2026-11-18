import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { generateSigningKeyPair, verifyDownloadedUpdate, type UpdateManifest } from '../src/main/update-signature.ts';
import { resignTopLevelBundle } from './mac-signature.mts';
import { checkRelease, RELEASE_FILES, signUpdateInfo } from './release-check.mts';
import { makeAdHocBundle } from './test-mac-bundle.mts';

/** 시험 번들의 식별자. */
const ID = 'app.example.release-test';
/** 시험 릴리스의 버전. */
const VERSION = '0.2.0';
/** 서명 키. */
const KEY = generateSigningKeyPair();
/** 앱이 모르는 서명 키. */
const OTHER_KEY = generateSigningKeyPair();

/** 시험 산출물의 원본을 만드는 폴더. 테스트마다 복사해 쓴다. */
let fixtures: string;
/** 테스트마다 만든 산출물 폴더. */
const releaseDirs: string[] = [];

/** 앱 번들 하나로 zip과 dmg를 만든다. electron-builder처럼 번들을 맨 위에 둔다. */
function packBundle(app: string, zip: string, dmg: string): void {
  execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', app, zip]);
  /** dmg에 담을 폴더. */
  const source = mkdtempSync(join(fixtures, 'dmg-src-'));
  cpSync(app, join(source, 'Test.app'), { recursive: true, verbatimSymlinks: true });
  execFileSync('hdiutil', ['create', '-quiet', '-srcfolder', source, '-volname', 'Test', '-format', 'UDZO', '-ov', dmg]);
}

/**
 * electron-builder가 쓰는 모양의 안내 파일. Mac은 zip 다음에 dmg 항목도 쓴다.
 * 해시는 일부러 틀린 값을 두어 서명 단계가 실제 파일로 고치는지 본다.
 */
function updateInfo(fileName: string, extraFile?: string): string {
  /** 자리만 채운 sha512. */
  const placeholder = Buffer.alloc(64).toString('base64');
  /** 파일 항목. */
  const entries = [fileName, ...(extraFile ? [extraFile] : [])].map((name) => `  - url: ${name}\n    sha512: ${placeholder}\n    size: 1\n`).join('');
  return `version: ${VERSION}
files:
${entries}path: ${fileName}
sha512: ${placeholder}
releaseDate: '2026-11-18T04:19:41.307Z'
`;
}

/** 올바른 산출물 폴더를 새로 만든다(아직 서명하지 않은 안내 파일). */
function freshRelease(): string {
  /** 산출물 폴더. */
  const dir = mkdtempSync(join(tmpdir(), 'ddd-release-'));
  releaseDirs.push(dir);
  cpSync(join(fixtures, 'good'), dir, { recursive: true });
  return dir;
}

/** 검사에 넘기는 값. */
function release(dir: string, publicKeys: readonly string[] = [KEY.publicKey]) {
  return { dir, version: VERSION, appId: ID, publicKeys };
}

/** 안내 파일을 읽는다. */
function readInfo(dir: string, name: string): UpdateManifest & Record<string, unknown> {
  return load(readFileSync(join(dir, name), 'utf8')) as UpdateManifest & Record<string, unknown>;
}

beforeAll(async () => {
  if (process.platform !== 'darwin') return;
  fixtures = mkdtempSync(join(tmpdir(), 'ddd-release-fixtures-'));
  /** 올바른 산출물. */
  const good = join(fixtures, 'good');
  mkdirSync(good);
  /** 지정 요구 조건을 넣은 번들. */
  const signed = makeAdHocBundle(mkdtempSync(join(fixtures, 'signed-')), ID);
  await resignTopLevelBundle(signed, ID);
  packBundle(signed, join(good, RELEASE_FILES.macZip), join(good, RELEASE_FILES.macDmg));
  writeFileSync(join(good, RELEASE_FILES.winInstaller), 'windows installer bytes');
  writeFileSync(join(good, RELEASE_FILES.macUpdateInfo), updateInfo(RELEASE_FILES.macZip, RELEASE_FILES.macDmg));
  writeFileSync(join(good, RELEASE_FILES.winUpdateInfo), updateInfo(RELEASE_FILES.winInstaller));

  /** ad-hoc 서명만 한 번들(지정 요구 조건이 cdhash)로 만든 zip과 dmg. */
  const adHoc = join(fixtures, 'ad-hoc');
  mkdirSync(adHoc);
  packBundle(makeAdHocBundle(mkdtempSync(join(fixtures, 'unsigned-')), ID), join(adHoc, RELEASE_FILES.macZip), join(adHoc, RELEASE_FILES.macDmg));
}, 60_000);

afterAll(() => {
  for (const dir of releaseDirs) rmSync(dir, { recursive: true, force: true });
  if (fixtures) rmSync(fixtures, { recursive: true, force: true });
});

describe.skipIf(process.platform !== 'darwin')('릴리스 검사', { timeout: 30_000 }, () => {
  it('올바른 산출물은 서명 뒤 검사를 통과하고, 그 안내 파일을 앱의 검증 함수도 받아들인다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    await signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey]);
    /** 검사 결과. */
    const report = await checkRelease(release(dir));
    expect(report.join('\n')).toContain(`designated => identifier "${ID}"`);

    for (const [info, files] of [
      [RELEASE_FILES.macUpdateInfo, [RELEASE_FILES.macZip, RELEASE_FILES.macDmg]],
      [RELEASE_FILES.winUpdateInfo, [RELEASE_FILES.winInstaller]],
    ] as const) {
      /** 서명 단계가 실제 파일의 크기로 고친 안내 파일. */
      const manifest = readInfo(dir, info);
      expect(manifest.files).toEqual(files.map((file) => expect.objectContaining({ url: file, size: readFileSync(join(dir, file)).length })));
      for (const file of files) {
        await expect(verifyDownloadedUpdate({ file: join(dir, file), manifest }, '0.1.0', [KEY.publicKey])).resolves.toBeNull();
      }
    }
  });

  it('Mac 최상위 번들에 지정 요구 조건이 빠진 zip에서 멈춘다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    cpSync(join(fixtures, 'ad-hoc', RELEASE_FILES.macZip), join(dir, RELEASE_FILES.macZip));
    await signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey]);
    await expect(checkRelease(release(dir))).rejects.toThrow(/지정 요구 조건이 `designated => identifier "app.example.release-test"`가 아닙니다: # designated => cdhash/);
  });

  it('Mac 최상위 번들에 지정 요구 조건이 빠진 dmg에서 멈춘다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    cpSync(join(fixtures, 'ad-hoc', RELEASE_FILES.macDmg), join(dir, RELEASE_FILES.macDmg));
    await signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey]);
    await expect(checkRelease(release(dir))).rejects.toThrow(/지정 요구 조건이 .*가 아닙니다: # designated => cdhash/);
  });

  it('앱이 모르는 키로 서명한 안내 파일에서 멈춘다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    await signUpdateInfo({ dir, version: VERSION }, [OTHER_KEY.privateKey]);
    await expect(checkRelease(release(dir))).rejects.toThrow(/서명 1개가 앱의 공개 키 목록으로 검증되지 않습니다/);
  });

  it('서명이 없는 안내 파일에서 멈춘다', async () => {
    /** 산출물 폴더. 서명 단계를 건너뛴다. */
    const dir = freshRelease();
    await expect(checkRelease(release(dir))).rejects.toThrow(/sha512가 실제 파일과 다릅니다|크기/);
    await signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey]);
    /** 서명 목록만 뺀 안내 파일. */
    const text = readFileSync(join(dir, RELEASE_FILES.winUpdateInfo), 'utf8').replace(/\n\s+dingDongDangSignatures:\n(\s+- .+\n)+/, '\n');
    writeFileSync(join(dir, RELEASE_FILES.winUpdateInfo), text);
    await expect(checkRelease(release(dir))).rejects.toThrow(/latest.yml의 DingDongDang-Setup.exe 항목에 서명 목록\(dingDongDangSignatures\)이 없거나/);
  });

  it('서명 뒤에 바꿔치기한 업데이트 파일에서 멈춘다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    await signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey]);
    // 크기가 같은 다른 내용
    writeFileSync(join(dir, RELEASE_FILES.winInstaller), 'windows installer BYTES');
    await expect(checkRelease(release(dir))).rejects.toThrow(/latest.yml에 적힌 DingDongDang-Setup.exe의 sha512가 실제 파일과 다릅니다/);
  });

  it('키를 바꾸는 동안 공개 키 하나의 서명이 빠지면 멈추고, 두 키로 서명하면 통과한다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    /** 키를 바꾸는 동안의 공개 키 목록. */
    const rotating = [KEY.publicKey, OTHER_KEY.publicKey];
    await signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey]);
    await expect(checkRelease(release(dir, rotating))).rejects.toThrow(/이 공개 키로 만든 서명이 없습니다/);
    await signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey, OTHER_KEY.privateKey]);
    await expect(checkRelease(release(dir, rotating))).resolves.toHaveLength(4);
  });

  it('버전이 든 파일 이름에서 멈춘다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    /** 버전이 든 이름. */
    const versioned = `DingDongDang-${VERSION}-mac.zip`;
    renameSync(join(dir, RELEASE_FILES.macZip), join(dir, versioned));
    writeFileSync(join(dir, RELEASE_FILES.macUpdateInfo), updateInfo(versioned, RELEASE_FILES.macDmg));
    await expect(signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey])).rejects.toThrow(/릴리스 파일이 없습니다: DingDongDang-mac.zip/);
    // 고정 이름 파일이 남아 있어도 안내 파일이 버전 든 이름을 가리키면 멈춘다
    cpSync(join(dir, versioned), join(dir, RELEASE_FILES.macZip));
    await expect(checkRelease(release(dir))).rejects.toThrow(/latest-mac.yml의 파일 이름에 버전이나 공백이 들어 있습니다: DingDongDang-0.2.0-mac.zip/);
  });

  it('안내 파일이 업데이트 파일을 가리키지 않거나 올리지 않는 파일을 가리키면 멈춘다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    writeFileSync(join(dir, RELEASE_FILES.macUpdateInfo), updateInfo(RELEASE_FILES.macDmg));
    await expect(signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey])).rejects.toThrow(/latest-mac.yml에 DingDongDang-mac.zip 항목이 없습니다/);
    writeFileSync(join(dir, RELEASE_FILES.macUpdateInfo), updateInfo(RELEASE_FILES.macZip, 'DingDongDang-mac.zip.blockmap'));
    await expect(signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey])).rejects.toThrow(/latest-mac.yml이 올리지 않는 파일을 가리킵니다: DingDongDang-mac.zip.blockmap/);
  });

  it('안내 파일의 버전이 앱 버전과 다르면 멈춘다', async () => {
    /** 산출물 폴더. */
    const dir = freshRelease();
    await signUpdateInfo({ dir, version: VERSION }, [KEY.privateKey]);
    await expect(checkRelease({ ...release(dir), version: '0.3.0' })).rejects.toThrow(/latest.yml의 버전\(0.2.0\)이 앱 버전\(0.3.0\)과 다릅니다/);
  });
});
