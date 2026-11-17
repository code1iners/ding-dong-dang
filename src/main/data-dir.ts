import { isAbsolute, resolve } from 'node:path';

/** 데이터 폴더를 바꾸는 실행 인자의 앞부분. */
const DATA_DIR_ARG = '--data-dir=';

/** 기본 데이터 폴더의 이름. 데이터 폴더와 산출물 이름은 영문 `ding-dong-dang` 계열로 고정한다. */
export const DEFAULT_DATA_DIR_NAME = 'ding-dong-dang';

/**
 * 실행 인자 `--data-dir=<경로>`가 가리키는 데이터 폴더. 인자가 없거나 비어 있으면 null이다.
 * 상대 경로는 실행한 곳(cwd) 기준으로 푼다. 자동 검증이 임시 폴더를 쓰려고 두는 인자라 화면에는 드러내지 않는다.
 */
export function dataDirFromArgv(argv: readonly string[], cwd: string): string | null {
  /** `--data-dir=`로 시작하는 실행 인자. */
  const arg = argv.find((a) => a.startsWith(DATA_DIR_ARG));
  /** 인자에 적힌 경로. */
  const value = arg?.slice(DATA_DIR_ARG.length).trim();
  if (!value) return null;
  return isAbsolute(value) ? value : resolve(cwd, value);
}
