// Mac 최상위 번들의 지정 요구 조건(ADR 0001). 빌드 설정의 afterSign 훅이 다시 서명하고, 릴리스 명령이 올리기 전에 검사한다.
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

/** 명령을 돌려 표준 출력을 돌려준다. 실패하면 표준 오류를 담아 거부한다. */
const run = promisify(execFile);

/** 최상위 번들에 넣는 지정 요구 조건. 업데이트가 빌드마다 바뀌는 cdhash가 아니라 이 식별자로 새 번들을 검증하게 한다. */
export function designatedRequirement(identifier: string): string {
  return `designated => identifier "${identifier}"`;
}

/**
 * 앱 번들의 서명을 검사한다. 중첩 코드까지 `codesign --verify --deep --strict`를 통과하고,
 * 최상위 번들의 지정 요구 조건이 정확히 `designated => identifier "<식별자>"`여야 한다. 맞으면 읽은 줄을 돌려준다.
 */
export async function checkMacSignature(appPath: string, identifier: string): Promise<string> {
  try {
    await run('codesign', ['--verify', '--deep', '--strict', appPath]);
  } catch (error) {
    throw new Error(`${appPath}의 서명이 깨져 있습니다: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  /** 기대하는 줄. */
  const expected = designatedRequirement(identifier);
  /** `codesign -d -r-`의 출력. 요구 조건은 표준 출력에 나온다. */
  const { stdout } = await run('codesign', ['-d', '-r-', appPath]);
  // 서명에 넣은 조건은 "designated =>"로, 넣지 않아 시스템이 계산한 기본 조건(cdhash)은 "# designated =>"로 시작한다
  /** 읽은 지정 요구 조건 줄. */
  const actual = stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('designated =>') || line.startsWith('# designated =>'));
  if (actual !== expected) throw new Error(`${appPath}의 지정 요구 조건이 \`${expected}\`가 아닙니다: ${actual ?? '(없음)'}`);
  return actual;
}

/**
 * 최상위 번들만 지정 요구 조건을 넣어 ad-hoc으로 다시 서명한다. `--deep`을 쓰지 않아 Helper · Framework 같은 중첩 코드는 그대로 둔다.
 * `mac.requirements`로 넣으면 중첩 코드에도 같은 조건이 붙어 서명이 깨지므로 이렇게 따로 한다(ADR 0001).
 */
export async function resignTopLevelBundle(appPath: string, identifier: string): Promise<void> {
  await run('codesign', [
    '--force',
    '--sign',
    '-',
    '--preserve-metadata=entitlements,flags,runtime',
    '--requirements',
    `=${designatedRequirement(identifier)}`,
    appPath,
  ]);
}

/** afterSign 훅이 electron-builder에게서 받는 값 중 쓰는 것. */
type AfterSignContext = {
  /** 빌드하는 OS. */
  electronPlatformName: string;
  /** `.app`이 든 폴더. */
  appOutDir: string;
  /** `.app` 이름을 정하는 앱 정보. */
  packager: { appInfo: { productFilename: string } };
};

/**
 * electron-builder가 번들 전체를 ad-hoc 서명한 뒤, dmg와 zip을 만들기 전에 부르는 훅을 만든다.
 * 최상위 번들만 다시 서명하고 검사한다. 통과하지 못하면 dmg와 zip을 만들기 전에 빌드를 멈춘다.
 */
export function createAfterSign(identifier: string): (context: AfterSignContext) => Promise<void> {
  return async function resignAfterBuilderSign(context) {
    if (context.electronPlatformName !== 'darwin') return;
    /** 다시 서명할 번들. */
    const appPath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    await resignTopLevelBundle(appPath, identifier);
    await checkMacSignature(appPath, identifier);
  };
}
