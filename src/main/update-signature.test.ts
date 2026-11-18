import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  computeFileSha512,
  generateSigningKeyPair,
  SIGNATURES_FIELD,
  signUpdateFile,
  verifyDownloadedUpdate,
  type UpdateManifest,
} from './update-signature';

/** 이 테스트만 쓰는 임시 폴더. 받은 업데이트 파일을 둔다. */
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-signature-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** 앱에 든 공개 키의 짝. */
const key = generateSigningKeyPair();
/** 앱이 모르는 다른 키. */
const otherKey = generateSigningKeyPair();

/** 업데이트 파일 이름. latest-mac.yml 파일 항목의 `url`과 같다. */
const FILE_NAME = 'DingDongDang-mac.zip';

/** 받은 업데이트 파일을 쓰고, 그 파일에 맞는 안내(서명은 주어진 개인 키들로)를 만든다. */
async function downloaded(content: string, version: string, signers: string[]): Promise<{ file: string; manifest: UpdateManifest }> {
  /** 받은 파일의 경로. */
  const file = join(dir, FILE_NAME);
  await writeFile(file, content);
  /** 파일의 sha512. */
  const sha512 = await computeFileSha512(file);
  /** 서명 목록. */
  const signatures = signers.map((privateKey) => signUpdateFile({ version, fileName: FILE_NAME, sha512 }, privateKey));
  return { file, manifest: { version, files: [{ url: FILE_NAME, sha512, size: content.length, [SIGNATURES_FIELD]: signatures }] } };
}

describe('받은 업데이트 파일의 서명 검증', () => {
  it('앱의 공개 키로 맞는 서명은 통과한다', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [key.privateKey]);
    expect(await verifyDownloadedUpdate({ file, manifest }, '0.1.0', [key.publicKey])).toBeNull();
  });

  it('앱이 모르는 키로 한 서명은 거절한다', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [otherKey.privateKey]);
    expect(await verifyDownloadedUpdate({ file, manifest }, '0.1.0', [key.publicKey])).toBe('signature-mismatch');
  });

  it('서명 값이 망가졌으면 거절한다', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [key.privateKey]);
    /** 서명 첫 글자를 바꾼 안내. */
    const entry = manifest.files[0] as Record<string, string[]>;
    const signature = entry[SIGNATURES_FIELD]![0]!;
    entry[SIGNATURES_FIELD] = [(signature[0] === 'A' ? 'B' : 'A') + signature.slice(1)];
    expect(await verifyDownloadedUpdate({ file, manifest }, '0.1.0', [key.publicKey])).toBe('signature-mismatch');
  });

  it('안내 파일의 버전을 바꾸면 거절한다', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [key.privateKey]);
    expect(await verifyDownloadedUpdate({ file, manifest: { ...manifest, version: '0.3.0' } }, '0.1.0', [key.publicKey])).toBe(
      'signature-mismatch',
    );
  });

  it('안내 파일의 sha512와 받은 파일을 함께 바꿔도 거절한다', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [key.privateKey]);
    await writeFile(file, '가짜 버전');
    /** 가짜 파일에 맞춘 sha512. */
    const sha512 = await computeFileSha512(file);
    const entry = { ...(manifest.files[0] as object), sha512 };
    expect(await verifyDownloadedUpdate({ file, manifest: { ...manifest, files: [entry] } }, '0.1.0', [key.publicKey])).toBe(
      'signature-mismatch',
    );
  });

  it('안내는 그대로 두고 받은 파일만 바꿔치면 거절한다(안내의 sha512를 믿지 않고 직접 계산한다)', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [key.privateKey]);
    await writeFile(file, '가짜 버전');
    expect(await verifyDownloadedUpdate({ file, manifest }, '0.1.0', [key.publicKey])).toBe('signature-mismatch');
  });

  it('서명 필드가 없거나 빈 목록이면 거절한다', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', []);
    expect(await verifyDownloadedUpdate({ file, manifest }, '0.1.0', [key.publicKey])).toBe('signatures-missing');
    /** 서명 필드를 뺀 파일 항목. */
    const unsigned = { ...(manifest.files[0] as Record<string, unknown>) };
    delete unsigned[SIGNATURES_FIELD];
    expect(await verifyDownloadedUpdate({ file, manifest: { ...manifest, files: [unsigned] } }, '0.1.0', [key.publicKey])).toBe(
      'signatures-missing',
    );
  });

  it('서명 목록 중 하나만 맞아도 통과한다(키를 바꾸는 동안 두 키로 서명한다)', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [otherKey.privateKey, key.privateKey]);
    expect(await verifyDownloadedUpdate({ file, manifest }, '0.1.0', [key.publicKey])).toBeNull();
  });

  it('공개 키 목록 중 하나만 맞아도 통과한다', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [key.privateKey]);
    expect(await verifyDownloadedUpdate({ file, manifest }, '0.1.0', [otherKey.publicKey, key.publicKey])).toBeNull();
  });

  it('지금 버전보다 높지 않으면 서명이 맞아도 거절한다', async () => {
    const { file, manifest } = await downloaded('옛 버전', '0.1.0', [key.privateKey]);
    expect(await verifyDownloadedUpdate({ file, manifest }, '0.1.0', [key.publicKey])).toBe('not-newer');
  });

  it('받은 파일 이름의 항목이 안내에 없으면 거절한다', async () => {
    const { file, manifest } = await downloaded('새 버전', '0.2.0', [key.privateKey]);
    const entry = { ...(manifest.files[0] as object), url: 'Other.zip' };
    expect(await verifyDownloadedUpdate({ file, manifest: { ...manifest, files: [entry] } }, '0.1.0', [key.publicKey])).toBe(
      'file-entry-missing',
    );
  });
});
