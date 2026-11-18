// 앱 내 업데이트 서명 키(Ed25519)의 보관 자리. 키 생성 명령(`npm run update:keygen`)과 릴리스 명령이 함께 쓴다.
// 개인 키는 개발 Mac의 Keychain과 저장소 밖의 사본에만 두고 저장소에는 넣지 않는다(ADR 0001).
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Keychain 항목의 서비스 이름. 릴리스 명령이 이 이름으로 개인 키를 읽는다. */
export const KEYCHAIN_SERVICE = 'ding-dong-dang-update-signing';
/** Keychain 항목의 계정 이름. */
export const KEYCHAIN_ACCOUNT = 'ding-dong-dang';
/** 개인 키 사본을 두는 폴더. 같은 Mac의 같은 디스크다(티켓 11에서 사용자에게 알렸다). */
export const KEY_COPY_DIR = join(homedir(), 'workspace', 'keys', 'ding-dong-dang');
/** 개인 키 사본 파일 이름. */
export const KEY_COPY_FILE = 'update-signing-private-key.txt';

/** 공개 키 목록 파일(`src/main/update-public-keys.ts`)의 내용. 키 생성 명령이 파일을 통째로 다시 쓴다. */
export function renderPublicKeysModule(publicKeys: readonly string[]): string {
  /** 목록 항목 줄. */
  const items = publicKeys.map((publicKey) => `  '${publicKey}',\n`).join('');
  return [
    '// 앱 내 업데이트 파일의 서명을 검증하는 Ed25519 공개 키 목록이다. 앱과 릴리스 명령의 서명 재검증이 함께 쓴다.',
    '// `npm run update:keygen`이 이 파일을 다시 쓴다. 손으로 고치는 것은 키를 바꾸는 일을 마치며 옛 키를 뺄 때뿐이다.',
    '',
    '/** Ed25519 공개 키(SPKI DER의 base64). 평소에는 하나이고, 키를 바꾸는 동안에만 둘이다. */',
    `export const UPDATE_PUBLIC_KEYS: readonly string[] = [${items ? `\n${items}` : ''}];`,
    '',
  ].join('\n');
}
