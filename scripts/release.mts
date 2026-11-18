// 릴리스 명령. 개발 Mac에서 돌린다. 사용법: npm run release(게시), npm run release -- --no-publish(올리지 않는 모드)
// 차례: 두 OS 빌드(빌드 설정의 afterSign이 Mac 최상위 번들을 다시 서명한 뒤 dmg와 zip을 만든다) → 안내 파일의 해시 갱신과 Ed25519 서명
// → 자동 검사 → GitHub Releases 게시. 하나라도 실패하면 거기서 멈추고 올리지 않는다(ADR 0001).
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APP_ID } from '../src/main/app-identity.ts';
import { UPDATE_PUBLIC_KEYS } from '../src/main/update-public-keys.ts';
import { publicKeyOf } from '../src/main/update-signature.ts';
import { buildConfig, OUTPUT_DIR } from './build-config.mts';
import { checkRelease, RELEASE_FILE_NAMES, signUpdateInfo } from './release-check.mts';
import { KEYCHAIN_ACCOUNT, KEYCHAIN_SERVICE } from './update-signing-key.mts';

/** 저장소 뿌리. 명령은 이 폴더에서 돌린다. */
const ROOT = fileURLToPath(new URL('..', import.meta.url));
/** 산출물 폴더의 절대 경로. */
const DIST = fileURLToPath(new URL(`../${OUTPUT_DIR}/`, import.meta.url));
/** 배포 버전의 모양. 태그는 앞에 v를 붙인 semver다. 사전 릴리스 버전은 앱이 받지 않으므로 쓰지 않는다. */
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/** 게시를 시작했는지. 그 뒤에 멈추면 릴리스가 일부 올라갔을 수 있어 알리는 말이 다르다. */
let publishStarted = false;

/** 출력을 모아 돌린 명령의 결과. */
type CommandOutput = {
  /** 종료 코드. 시그널로 끝나면 null. */
  status: number | null;
  /** 표준 출력. */
  stdout: string;
  /** 표준 오류. */
  stderr: string;
};

/** 명령을 돌려 출력을 모은다. 값은 화면에 내지 않는다. */
function capture(command: string, args: readonly string[]): CommandOutput {
  /** 실행 결과. */
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** 명령을 화면에 출력이 보이게 돌린다. 실패하면 멈춘다. */
function runVisible(command: string, args: readonly string[]): void {
  /** 실행 결과. */
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')}이(가) 실패했습니다(종료 코드 ${result.status}).`);
}

/** 단계 제목을 알린다. */
function step(title: string): void {
  console.log(`\n▶ ${title}`);
}

/**
 * Keychain에서 서명 개인 키를 읽고, 짝인 공개 키가 앱 소스의 공개 키 목록에 있는지 확인한다.
 * 빌드에 몇 분이 걸리므로 키가 틀렸으면 빌드 전에 멈춘다. 키 내용은 화면에 내지 않는다.
 */
function readSigningKey(): string {
  /** `security`의 결과. */
  const result = capture('security', ['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', KEYCHAIN_ACCOUNT, '-w']);
  if (result.status !== 0) throw new Error(`Keychain에서 서명 키(${KEYCHAIN_SERVICE})를 읽지 못했습니다. 처음이면 npm run update:keygen으로 만드세요.`);
  /** 개인 키. */
  const privateKey = result.stdout.trim();
  /** 짝인 공개 키. */
  const publicKey = publicKeyOf(privateKey);
  if (!UPDATE_PUBLIC_KEYS.includes(publicKey)) {
    throw new Error(`Keychain의 서명 키와 짝인 공개 키가 src/main/update-public-keys.ts에 없습니다: ${publicKey}`);
  }
  console.log(`Keychain의 서명 키를 읽었습니다. 공개 키: ${publicKey}`);
  return privateKey;
}

/** 게시할 GitHub 저장소(`owner/repo`). 앱이 업데이트를 확인하는 빌드 설정의 publish와 같은 곳이다. */
function releaseRepo(): string {
  /** 빌드 설정의 게시 위치. */
  const publish = buildConfig().publish;
  if (!publish || typeof publish !== 'object' || Array.isArray(publish) || publish.provider !== 'github') {
    throw new Error('빌드 설정의 publish가 github 제공자가 아닙니다.');
  }
  return `${publish.owner}/${publish.repo}`;
}

/**
 * 게시하기 전에 알 수 있는 실패를 빌드 전에 찾는다. 작업 트리가 깨끗하고, 이 Mac의 `gh`가 로그인되어 있고, 저장소가 있고,
 * 같은 태그의 릴리스가 아직 없고, 태그를 붙일 지금 커밋이 GitHub에 올라가 있어야 한다.
 */
function checkCanPublish(repo: string, tag: string): string {
  if (capture('git', ['status', '--porcelain']).stdout.trim() !== '') throw new Error('커밋하지 않은 변경이 있습니다. 릴리스는 커밋한 내용으로만 만듭니다.');
  if (capture('gh', ['auth', 'status']).status !== 0) throw new Error('이 Mac의 gh가 로그인되어 있지 않습니다. gh auth login을 먼저 하세요.');

  // 저장소가 없어도 릴리스 조회는 "release not found"를 내므로 저장소부터 본다
  if (capture('gh', ['repo', 'view', repo, '--json', 'name']).status !== 0) throw new Error(`GitHub 저장소 ${repo}를 찾지 못했습니다. 저장소를 만들고 push한 뒤 다시 하세요.`);
  /** 같은 태그의 릴리스 조회. 없어야 한다. */
  const existing = capture('gh', ['release', 'view', tag, '--repo', repo, '--json', 'tagName']);
  if (existing.status === 0) throw new Error(`${repo}에 ${tag} 릴리스가 이미 있습니다. package.json의 version을 올리세요.`);
  if (!/not found/i.test(existing.stderr)) throw new Error(`${repo}의 릴리스를 조회하지 못했습니다: ${existing.stderr.trim()}`);

  /** 태그를 붙일 커밋. */
  const commit = capture('git', ['rev-parse', 'HEAD']).stdout.trim();
  if (capture('gh', ['api', `repos/${repo}/commits/${commit}`, '--silent']).status !== 0) {
    throw new Error(`지금 커밋(${commit})이 ${repo}에 없습니다. 먼저 push하세요.`);
  }
  return commit;
}

/** 초안이 아닌 게시 상태로 릴리스를 만들고, 다섯 파일을 올리고, 게시된 상태를 다시 읽어 확인한다. */
function publishRelease(repo: string, tag: string, version: string, commit: string): void {
  /** 올릴 파일의 경로. */
  const files = RELEASE_FILE_NAMES.map((name) => `${DIST}${name}`);
  runVisible('gh', ['release', 'create', tag, ...files, '--repo', repo, '--target', commit, '--title', version, '--notes', `딩동댕 ${version}`, '--latest']);

  /** 게시한 릴리스. */
  const view = capture('gh', ['release', 'view', tag, '--repo', repo, '--json', 'isDraft,isPrerelease,assets']);
  if (view.status !== 0) throw new Error(`게시한 릴리스를 읽지 못했습니다: ${view.stderr.trim()}`);
  /** 읽은 값. `gh release view --json`의 필드 이름 그대로다. */
  const released: {
    /** 초안인지. */
    isDraft: boolean;
    /** 사전 릴리스인지. */
    isPrerelease: boolean;
    /** 올라간 파일. */
    assets: { name: string }[];
  } = JSON.parse(view.stdout);
  /** 올라간 파일 이름. */
  const uploaded = released.assets.map((asset) => asset.name).sort();
  if (released.isDraft || released.isPrerelease || uploaded.join() !== [...RELEASE_FILE_NAMES].sort().join()) {
    throw new Error(`게시한 릴리스의 상태가 기대와 다릅니다: ${view.stdout.trim()}`);
  }
}

/** 명령의 본체. */
async function main(args: readonly string[]): Promise<void> {
  /** 알 수 없는 인수. 오타로 게시 모드가 되지 않게 멈춘다. */
  const unknown = args.filter((arg) => arg !== '--no-publish');
  if (unknown.length > 0) throw new Error(`알 수 없는 인수입니다: ${unknown.join(' ')}. 올리지 않으려면 --no-publish를 씁니다.`);
  /** 올리지 않는 모드인지. */
  const noPublish = args.includes('--no-publish');
  if (process.platform !== 'darwin') throw new Error('릴리스 명령은 Mac 번들을 서명하고 Keychain을 쓰므로 macOS에서 돌립니다.');

  /** 앱 버전. */
  const version: string = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  if (!VERSION_PATTERN.test(version)) throw new Error(`package.json의 version이 MAJOR.MINOR.PATCH가 아닙니다: ${version}`);
  /** 태그. */
  const tag = `v${version}`;
  /** 게시할 저장소. */
  const repo = releaseRepo();
  console.log(`딩동댕 ${version} 릴리스(${noPublish ? '올리지 않는 모드' : `${repo}에 ${tag}로 게시`})`);

  step('서명 키');
  /** 서명 개인 키. */
  const privateKey = readSigningKey();
  /** 태그를 붙일 커밋. 올리지 않는 모드에서는 보지 않는다. */
  let commit: string | null = null;
  if (!noPublish) {
    step('게시 전 확인');
    commit = checkCanPublish(repo, tag);
  }

  step('두 OS 빌드와 Mac 최상위 번들 재서명');
  // 지난 빌드의 파일이 섞여 올라가지 않게 비우고 시작한다
  rmSync(DIST, { recursive: true, force: true });
  runVisible('npm', ['run', 'dist']);

  step('안내 파일의 해시 갱신과 서명');
  for (const line of await signUpdateInfo({ dir: DIST, version }, [privateKey])) console.log(line);

  step('자동 검사');
  for (const line of await checkRelease({ dir: DIST, version, appId: APP_ID, publicKeys: UPDATE_PUBLIC_KEYS })) console.log(line);

  if (commit === null) {
    console.log(`\n올리지 않는 모드라 여기서 멈춥니다. 검사를 통과한 파일(${DIST}): ${RELEASE_FILE_NAMES.join(', ')}`);
    return;
  }
  step('GitHub Releases 게시');
  publishStarted = true;
  publishRelease(repo, tag, version, commit);
  console.log(`\n게시했습니다: https://github.com/${repo}/releases/tag/${tag}`);
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  /** 멈춘 자리에 따라 다른 안내. */
  const status = publishStarted ? '게시 도중에 멈췄습니다. GitHub의 릴리스 화면에서 상태를 확인하세요.' : '릴리스를 멈췄습니다. 아무것도 올리지 않았습니다.';
  console.error(`\n${status}\n${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
