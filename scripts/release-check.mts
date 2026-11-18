// 릴리스 명령이 올리기 전에 하는 안내 파일 서명과 자동 검사. 하나라도 틀리면 거부해 올리지 않게 한다(ADR 0001).
// 안내 파일(latest*.yml)은 electron-builder가 쓰고 electron-updater가 읽는 것과 같은 js-yaml로 다룬다.
import { execFile } from 'node:child_process';
import { access, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { dump, load } from 'js-yaml';
import {
  computeFileSha512,
  isSignedByAnyKey,
  parsePublicKey,
  readSignatureList,
  SIGNATURES_FIELD,
  type SignedFile,
  signUpdateFile,
} from '../src/main/update-signature.ts';
import { checkMacSignature } from './mac-signature.mts';

/** 명령을 돌린다. */
const run = promisify(execFile);

/**
 * 릴리스에 올리는 다섯 파일. 앞의 셋은 빌드 설정의 artifactName이 만드는 이름이다.
 * 이름에 버전과 공백이 없어야 `releases/latest/download/<파일 이름>` 고정 주소가 버전이 바뀌어도 그대로 맞는다.
 */
export const RELEASE_FILES = {
  winInstaller: 'DingDongDang-Setup.exe',
  macDmg: 'DingDongDang.dmg',
  macZip: 'DingDongDang-mac.zip',
  winUpdateInfo: 'latest.yml',
  macUpdateInfo: 'latest-mac.yml',
} as const;

/**
 * 릴리스에 올리는 파일 이름 목록. electron-builder가 함께 만드는 `.blockmap`은 올리지 않는다.
 * 앱이 차등 다운로드를 끄고(`src/main/update-feed.ts`) 늘 파일 전체를 받으므로 쓰지 않기 때문이다.
 */
export const RELEASE_FILE_NAMES: readonly string[] = Object.values(RELEASE_FILES);

/** 안내 파일과 그 안내가 가리키는 업데이트 파일의 짝. */
const UPDATE_INFO_TARGETS = [
  { updateInfo: RELEASE_FILES.winUpdateInfo, updateFile: RELEASE_FILES.winInstaller },
  { updateInfo: RELEASE_FILES.macUpdateInfo, updateFile: RELEASE_FILES.macZip },
] as const;

/** 서명하거나 검사할 산출물 폴더와 그 버전. */
export type ReleaseDir = {
  /** 다섯 파일이 든 폴더. electron-builder 출력 폴더다. */
  dir: string;
  /** 앱 버전(package.json의 version). */
  version: string;
};

/** 검사할 릴리스. */
export type Release = ReleaseDir & {
  /** Mac 최상위 번들의 지정 요구 조건에 들어갈 앱 식별자. */
  appId: string;
  /** 앱 소스의 공개 키 목록. 앱이 업데이트를 검증하는 그 목록이다. */
  publicKeys: readonly string[];
};

/** 안내 파일의 파일 항목 하나. */
type UpdateInfoEntry = {
  /** 항목이 가리키는 파일 이름(`url`). */
  fileName: string;
  /** yml을 읽은 항목 객체. `content` 안의 객체 그대로라 고치면 다시 쓸 때 반영된다. */
  entry: Record<string, unknown>;
};

/** 읽은 안내 파일 하나. */
type ParsedUpdateInfo = {
  /** 안내 파일 이름. */
  updateInfo: string;
  /** 앱이 받는 업데이트 파일 이름. 예전 형식의 path와 맨 위 sha512가 이 파일을 가리킨다. */
  updateFile: string;
  /** yml을 읽은 객체. */
  content: Record<string, unknown>;
  /** 파일 항목. Mac은 electron-builder가 zip 다음에 dmg 항목도 쓴다. */
  entries: UpdateInfoEntry[];
};

/** 객체인지. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 파일 이름에 버전이나 공백이 들어 있으면 거부한다. */
function checkVersionlessName(name: string, version: string, where: string): void {
  if (name.includes(version) || /\s/.test(name)) {
    throw new Error(`${where}의 파일 이름에 버전이나 공백이 들어 있습니다: ${name}. 고정 주소로 받을 수 있게 ${RELEASE_FILE_NAMES.join(', ')}만 씁니다.`);
  }
}

/** 다섯 파일이 모두 있는지 확인한다. */
async function checkFilesExist({ dir }: ReleaseDir): Promise<void> {
  /** 빠진 파일. */
  const missing: string[] = [];
  for (const name of RELEASE_FILE_NAMES) {
    try {
      await access(join(dir, name));
    } catch {
      missing.push(name);
    }
  }
  if (missing.length > 0) throw new Error(`릴리스 파일이 없습니다: ${missing.join(', ')}`);
}

/**
 * 안내 파일 하나를 읽고 모양을 확인한다. 버전이 앱 버전과 같고, 파일 항목이 모두 버전 없는 이름의 릴리스 파일이며,
 * 그중에 앱이 받는 업데이트 파일이 있고, 예전 형식의 path가 그 파일이어야 한다. 앱은 이 이름으로 파일을 받으므로 어긋나면 업데이트가 실패한다.
 */
async function parseUpdateInfo({ dir, version }: ReleaseDir, updateInfo: string, updateFile: string): Promise<ParsedUpdateInfo> {
  /** yml을 읽은 객체. */
  const content = load(await readFile(join(dir, updateInfo), 'utf8'));
  if (!isRecord(content)) throw new Error(`안내 파일로 읽을 수 없습니다: ${updateInfo}`);
  if (content.version !== version) throw new Error(`${updateInfo}의 버전(${String(content.version)})이 앱 버전(${version})과 다릅니다.`);

  /** 파일 항목. */
  const files: unknown[] = Array.isArray(content.files) ? content.files : [];
  /** 읽은 항목. */
  const entries = files.map((file): UpdateInfoEntry => {
    if (!isRecord(file) || typeof file.url !== 'string') throw new Error(`${updateInfo}에 url이 없는 파일 항목이 있습니다.`);
    return { fileName: file.url, entry: file };
  });
  for (const { fileName } of entries) checkVersionlessName(fileName, version, updateInfo);
  if (content.path !== undefined) checkVersionlessName(String(content.path), version, `${updateInfo}의 path`);

  /** 릴리스에 올리지 않아 앱이 받을 수 없는 파일. */
  const notUploaded = entries.filter(({ fileName }) => !RELEASE_FILE_NAMES.includes(fileName));
  if (notUploaded.length > 0) throw new Error(`${updateInfo}이 올리지 않는 파일을 가리킵니다: ${notUploaded.map((e) => e.fileName).join(', ')}`);
  if (!entries.some(({ fileName }) => fileName === updateFile)) throw new Error(`${updateInfo}에 ${updateFile} 항목이 없습니다.`);
  if (content.path !== undefined && content.path !== updateFile) {
    throw new Error(`${updateInfo}의 path가 ${updateFile}가 아닙니다: ${String(content.path)}`);
  }
  return { updateInfo, updateFile, content, entries };
}

/** 두 안내 파일을 모두 읽는다. 하나라도 틀리면 아무것도 고치지 않고 거부한다. */
async function parseAllUpdateInfo(release: ReleaseDir): Promise<ParsedUpdateInfo[]> {
  await checkFilesExist(release);
  /** 읽은 안내 파일. */
  const parsed: ParsedUpdateInfo[] = [];
  for (const { updateInfo, updateFile } of UPDATE_INFO_TARGETS) parsed.push(await parseUpdateInfo(release, updateInfo, updateFile));
  return parsed;
}

/**
 * 두 안내 파일의 해시를 실제 파일로 다시 계산해 고치고, 파일 항목마다 개인 키 하나에 서명 하나씩 넣는다(키를 바꾸는 동안이면 둘).
 * 서명 필드는 처음부터 목록이다. 다른 필드와 순서는 그대로 두고 electron-builder와 같은 방식으로 다시 쓴다.
 */
export async function signUpdateInfo(release: ReleaseDir, privateKeys: readonly string[]): Promise<string[]> {
  if (privateKeys.length === 0) throw new Error('서명할 개인 키가 없습니다.');
  /** 서명 결과. */
  const report: string[] = [];
  for (const { updateInfo, updateFile, content, entries } of await parseAllUpdateInfo(release)) {
    for (const { fileName, entry } of entries) {
      /** 파일 경로. */
      const filePath = join(release.dir, fileName);
      /** 실제 sha512. */
      const sha512 = await computeFileSha512(filePath);
      entry.sha512 = sha512;
      entry.size = (await stat(filePath)).size;
      // 예전 electron-updater가 읽는 맨 위 sha512는 업데이트 파일을 가리킨다
      if (fileName === updateFile && content.sha512 !== undefined) content.sha512 = sha512;
      /** 서명 문장에 담는 값. */
      const file: SignedFile = { version: release.version, fileName, sha512 };
      entry[SIGNATURES_FIELD] = privateKeys.map((privateKey) => signUpdateFile(file, privateKey));
    }
    // electron-builder의 serializeToYaml과 같은 옵션이다
    await writeFile(join(release.dir, updateInfo), dump(content, { lineWidth: 8000, noRefs: true }));
    report.push(`${updateInfo}: ${entries.map((e) => e.fileName).join(', ')}의 해시를 고치고 서명 ${privateKeys.length}개씩 넣음`);
  }
  return report;
}

/**
 * 파일 항목 하나의 해시와 서명을 디스크의 실제 파일로 검사하고, 다시 계산한 sha512를 돌려준다.
 * 넣은 서명은 모두 앱의 공개 키 목록으로 검증되어야 하고, 목록의 키마다 그 키로 만든 서명이 있어야 한다.
 * 키를 바꾸는 동안 서명이 하나 빠지면 그 키만 아는 앱이 업데이트를 받지 못하기 때문이다.
 */
async function checkEntry({ dir, version, publicKeys }: Release, updateInfo: string, { fileName, entry }: UpdateInfoEntry): Promise<string> {
  /** 파일 경로. */
  const filePath = join(dir, fileName);
  /** 실제 크기. */
  const { size } = await stat(filePath);
  if (entry.size !== size) throw new Error(`${updateInfo}에 적힌 ${fileName}의 크기(${String(entry.size)})가 실제 크기(${size})와 다릅니다.`);
  /** 실제 sha512. */
  const sha512 = await computeFileSha512(filePath);
  if (entry.sha512 !== sha512) throw new Error(`${updateInfo}에 적힌 ${fileName}의 sha512가 실제 파일과 다릅니다.`);

  /** 넣은 서명 목록. */
  const signatures = readSignatureList(entry);
  if (!signatures) throw new Error(`${updateInfo}의 ${fileName} 항목에 서명 목록(${SIGNATURES_FIELD})이 없거나 형식이 틀립니다.`);
  /** 앱처럼 실제 파일에서 다시 만든 서명 문장의 값. */
  const file: SignedFile = { version, fileName, sha512 };
  /** 목록의 어떤 키로도 검증되지 않는 서명. */
  const unverified = signatures.filter((signature) => !isSignedByAnyKey(file, [signature], publicKeys));
  if (unverified.length > 0) {
    throw new Error(`${updateInfo}의 ${fileName} 서명 ${unverified.length}개가 앱의 공개 키 목록으로 검증되지 않습니다. Keychain의 개인 키와 src/main/update-public-keys.ts의 공개 키가 짝인지 확인하세요.`);
  }
  /** 그 키로 만든 서명이 없는 공개 키. */
  const unsigned = publicKeys.filter((publicKey) => !isSignedByAnyKey(file, signatures, [publicKey]));
  if (unsigned.length > 0) throw new Error(`${updateInfo}의 ${fileName}에 이 공개 키로 만든 서명이 없습니다: ${unsigned.join(', ')}`);
  return sha512;
}

/** 안내 파일 하나의 모든 항목과 맨 위 sha512를 검사한다. */
async function checkUpdateInfo(release: Release, { updateInfo, updateFile, content, entries }: ParsedUpdateInfo): Promise<string> {
  for (const item of entries) {
    /** 다시 계산한 sha512. */
    const sha512 = await checkEntry(release, updateInfo, item);
    if (item.fileName === updateFile && content.sha512 !== undefined && content.sha512 !== sha512) {
      throw new Error(`${updateInfo}의 맨 위 sha512가 ${updateFile}의 실제 sha512와 다릅니다.`);
    }
  }
  return `${updateInfo}: ${entries.map((e) => e.fileName).join(', ')}의 크기 · sha512 일치, 서명이 공개 키 ${release.publicKeys.length}개로 검증됨`;
}

/** 폴더에 든 앱 번들 하나의 경로. 없거나 여럿이면 거부한다. */
async function findSingleApp(dir: string, where: string): Promise<string> {
  /** 번들 이름. */
  const apps = (await readdir(dir)).filter((name) => name.endsWith('.app'));
  /** 하나뿐인 번들. */
  const [app] = apps;
  if (apps.length !== 1 || app === undefined) throw new Error(`${where}에 앱 번들이 하나가 아닙니다: ${apps.join(', ') || '(없음)'}`);
  return join(dir, app);
}

/** zip을 앱 내 업데이트처럼 `ditto`로 풀어 그 안의 최상위 번들을 검사한다. 묶는 과정에서 서명이 깨질 수 있어 따로 본다. */
async function checkZipBundle({ dir, appId }: Release): Promise<string> {
  /** 풀 임시 폴더. */
  const unzipDir = await mkdtemp(join(tmpdir(), 'ddd-release-zip-'));
  try {
    await run('ditto', ['-x', '-k', join(dir, RELEASE_FILES.macZip), unzipDir]);
    return `${RELEASE_FILES.macZip}: ${await checkMacSignature(await findSingleApp(unzipDir, RELEASE_FILES.macZip), appId)}`;
  } finally {
    await rm(unzipDir, { recursive: true, force: true });
  }
}

/** dmg를 읽기 전용으로 붙여 그 안의 최상위 번들을 검사한다. 처음 설치한 Mac도 이후 업데이트를 받으려면 이 번들에 조건이 있어야 한다. */
async function checkDmgBundle({ dir, appId }: Release): Promise<string> {
  /** 붙일 자리. */
  const mountPoint = await mkdtemp(join(tmpdir(), 'ddd-release-dmg-'));
  try {
    // 체크섬 확인(-noverify를 빼면 몇 초 걸린다)은 건너뛴다. 받은 dmg를 macOS가 열 때 따로 확인한다
    await run('hdiutil', ['attach', '-readonly', '-nobrowse', '-noautoopen', '-noverify', '-mountpoint', mountPoint, join(dir, RELEASE_FILES.macDmg)]);
    try {
      return `${RELEASE_FILES.macDmg}: ${await checkMacSignature(await findSingleApp(mountPoint, RELEASE_FILES.macDmg), appId)}`;
    } finally {
      await run('hdiutil', ['detach', '-quiet', '-force', mountPoint]);
    }
  } finally {
    await rm(mountPoint, { recursive: true, force: true });
  }
}

/**
 * 올리기 전 자동 검사. 다섯 파일이 버전 없는 이름으로 모두 있고, 안내 파일의 버전 · 파일 이름 · 크기 · sha512 · 서명이 맞고,
 * zip과 dmg 안의 Mac 최상위 번들이 지정 요구 조건을 가져야 한다. 하나라도 틀리면 이유와 함께 거부한다. 통과하면 확인한 내용을 한 줄씩 돌려준다.
 */
export async function checkRelease(release: Release): Promise<string[]> {
  if (release.publicKeys.length === 0) throw new Error('앱 소스의 공개 키 목록이 비어 있습니다. npm run update:keygen으로 키를 만드세요.');
  // 목록에 키가 아닌 값이 있으면 앱도 그 값으로 검증하지 못한다
  for (const publicKey of release.publicKeys) parsePublicKey(publicKey);

  /** 검사 결과. */
  const report: string[] = [];
  for (const parsed of await parseAllUpdateInfo(release)) report.push(await checkUpdateInfo(release, parsed));
  report.push(await checkZipBundle(release));
  report.push(await checkDmgBundle(release));
  return report;
}
