// 앱 내 업데이트의 서명 키를 처음 한 번 만든다. 개발 Mac에서 돌린다. 사용법: npm run update:keygen
// 개인 키는 Keychain과 저장소 밖의 사본 파일에 두고 화면에 내지 않는다. 공개 키는 앱 소스의 공개 키 목록에 쓴다. 커밋은 직접 한다.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPDATE_PUBLIC_KEYS } from '../src/main/update-public-keys.ts';
import { generateSigningKeyPair, publicKeyOf } from '../src/main/update-signature.ts';
import { KEY_COPY_DIR, KEY_COPY_FILE, KEYCHAIN_ACCOUNT, KEYCHAIN_SERVICE, renderPublicKeysModule } from './update-signing-key.mts';

/** 앱 소스의 공개 키 목록 파일. */
const publicKeysFile = fileURLToPath(new URL('../src/main/update-public-keys.ts', import.meta.url));
/** 개인 키 사본의 경로. */
const copyPath = join(KEY_COPY_DIR, KEY_COPY_FILE);

/** `security` 명령을 돌린다. 값은 프로세스 목록에 보이지 않게 인수가 아니라 표준 입력으로 넘긴다. */
function security(args: readonly string[], input?: string): { status: number | null; stdout: string } {
  /** 실행 결과. */
  const result = spawnSync('security', args, { input, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout };
}

try {
  if (process.platform !== 'darwin') throw new Error('update:keygen은 Keychain을 쓰므로 macOS에서 돌립니다.');
  // 이미 쓰는 키를 덮으면 설치된 앱이 이후 업데이트를 모두 검증하지 못한다
  if (UPDATE_PUBLIC_KEYS.length > 0) throw new Error('앱 소스의 공개 키 목록에 이미 키가 있습니다. 새 키로 바꿔 쓰면 설치된 앱이 업데이트를 받지 못합니다.');
  if (security(['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT]).status === 0) {
    throw new Error(`Keychain에 이미 ${KEYCHAIN_SERVICE} 항목이 있습니다. 지우기 전에 그 키가 쓰이지 않는지 확인하세요.`);
  }
  if (existsSync(copyPath)) throw new Error(`개인 키 사본이 이미 있습니다: ${copyPath}`);

  /** 새 키 쌍. */
  const { publicKey, privateKey } = generateSigningKeyPair();
  // `-w`를 값 없이 맨 끝에 두면 값을 두 번 입력받는다. 표준 입력으로 두 번 넘긴다
  if (security(['add-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w'], `${privateKey}\n${privateKey}\n`).status !== 0) {
    throw new Error('Keychain에 개인 키를 넣지 못했습니다.');
  }
  // 되읽어 같은 키인지 확인한다
  /** Keychain에서 되읽은 개인 키. */
  const stored = security(['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w']).stdout.trim();
  if (publicKeyOf(stored) !== publicKey) throw new Error('Keychain에서 되읽은 개인 키가 만든 키와 다릅니다.');
  console.log(`Keychain에 개인 키를 넣었습니다: ${KEYCHAIN_SERVICE}`);

  mkdirSync(KEY_COPY_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(copyPath, `${privateKey}\n`, { mode: 0o600, flag: 'wx' });
  console.log(`개인 키 사본을 썼습니다: ${copyPath}`);

  // 개인 키 보관을 마친 뒤 마지막에 쓴다. 중간에 멈추면 목록이 그대로라 처음부터 다시 할 수 있다
  writeFileSync(publicKeysFile, renderPublicKeysModule([publicKey]));
  console.log(`공개 키를 공개 키 목록에 썼습니다. 이 파일을 커밋하세요: ${publicKeysFile}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
