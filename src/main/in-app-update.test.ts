import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CHECK_INTERVAL_MS, InAppUpdate, type DownloadOutcome, type UpdateClock, type UpdateFeed } from './in-app-update';
import { generateSigningKeyPair, SIGNATURES_FIELD, signUpdateFile, computeFileSha512, type UpdateManifest } from './update-signature';

/** 앱에 든 공개 키의 짝. */
const key = generateSigningKeyPair();
/** 앱이 모르는 키. 계정이 털려 올라온 가짜 릴리스를 흉내 낸다. */
const strangerKey = generateSigningKeyPair();
/** 업데이트 파일 이름. */
const FILE_NAME = 'DingDongDang-mac.zip';
/** 지금 앱 버전. */
const CURRENT = '0.1.0';

/** 이 테스트만 쓰는 임시 폴더. 가짜 피드가 받은 파일을 둔다. */
let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ding-dong-dang-update-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** 공개한 릴리스 하나. `signer`가 서명한다. */
type Release = { version: string; content: string; signer: string };

/** 공개한 릴리스를 돌려주고, 받으면 그 내용을 임시 폴더에 파일로 쓰는 업데이트 피드. 실제 GitHub에는 닿지 않는다. */
class FakeFeed implements UpdateFeed {
  /** 지금 공개된 최신 릴리스. null이면 지금 버전이 최신이다. */
  latest: Release | null = null;
  /** 있으면 확인할 때마다 던진다. */
  checkError: Error | null = null;
  /** 있으면 받을 때마다 던진다. */
  downloadError: Error | null = null;
  /** 참이면 electron-updater처럼 sha512가 안내와 다르다며 파일을 남기지 않는다. */
  sha512Mismatch = false;
  /** 확인한 횟수. */
  checks = 0;
  /** 받은 파일의 경로. 받은 순서다. */
  readonly downloads: string[] = [];
  /** 설치하며 다시 시작한 횟수. */
  installs = 0;
  /** 설치하지 못했을 때 부를 함수. */
  private failListener: (() => void) | null = null;
  /** 마지막 확인에서 찾은 릴리스. */
  private found: Release | null = null;

  async check(): Promise<UpdateManifest | null> {
    this.checks += 1;
    if (this.checkError) throw this.checkError;
    this.found = this.latest;
    return this.found && { version: this.found.version, files: [] };
  }

  async download(): Promise<DownloadOutcome> {
    /** 받을 릴리스. */
    const release = this.found;
    if (!release) throw new Error('새 버전을 찾기 전에 받으려 했습니다.');
    if (this.downloadError) throw this.downloadError;
    if (this.sha512Mismatch) return { kind: 'sha512-mismatch' };
    /** 받은 파일. */
    const file = join(dir, FILE_NAME);
    await writeFile(file, release.content);
    this.downloads.push(file);
    /** 받은 파일의 sha512. */
    const sha512 = await computeFileSha512(file);
    /** 이 릴리스의 안내. 서명은 릴리스를 올린 쪽의 키로 한다. */
    const manifest: UpdateManifest = {
      version: release.version,
      files: [{ url: FILE_NAME, sha512, [SIGNATURES_FIELD]: [signUpdateFile({ version: release.version, fileName: FILE_NAME, sha512 }, release.signer)] }],
    };
    return { kind: 'downloaded', update: { file, manifest } };
  }

  install(): void {
    this.installs += 1;
  }

  onInstallFailed(listener: () => void): void {
    this.failListener = listener;
  }

  /** 설치하지 못했다고 알린다. 앱은 꺼지지 않은 채다. */
  failInstall(): void {
    this.failListener?.();
  }
}

/** 값으로 움직이는 시계. `advance`로 시간을 흘려 예약한 일을 부른다. */
class FakeClock implements UpdateClock {
  /** 지금 시각. */
  time = Date.UTC(2026, 10, 16, 0, 0);
  /** 예약한 일. */
  private timers: { at: number; run: () => void }[] = [];

  now(): number {
    return this.time;
  }

  after(ms: number, run: () => void): () => void {
    /** 예약 하나. */
    const timer = { at: this.time + ms, run };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((t) => t !== timer);
    };
  }

  /** 시간을 `ms`만큼 흘리고, 그 사이 때가 된 일을 부른다. */
  advance(ms: number): void {
    this.time += ms;
    /** 때가 된 일. */
    const due = this.timers.filter((t) => t.at <= this.time);
    this.timers = this.timers.filter((t) => t.at > this.time);
    for (const timer of due) timer.run();
  }
}

/** 가짜 피드와 시계로 앱 내 업데이트를 만든다. */
function setup() {
  const feed = new FakeFeed();
  const clock = new FakeClock();
  /** 설치 직전에 남긴 버전. */
  const attempts: string[] = [];
  const update = new InAppUpdate({
    feed,
    clock,
    currentVersion: CURRENT,
    publicKeys: [key.publicKey],
    beforeInstall: (version) => attempts.push(version),
  });
  return { feed, clock, update, attempts };
}

describe('앱 내 업데이트: 확인', () => {
  it('시작하면 바로 확인하고, 새 버전이 없으면 최신이다', async () => {
    const { feed, update } = setup();
    expect(update.state().status).toEqual({ kind: 'idle' });
    update.start();
    await update.whenIdle();
    expect(feed.checks).toBe(1);
    expect(update.state().status).toEqual({ kind: 'up-to-date' });
  });

  it('확인에 실패하면 확인 실패이고, "다시 확인"으로 다시 확인한다', async () => {
    const { feed, update } = setup();
    feed.checkError = new Error('인터넷이 안 돼요');
    update.start();
    await update.whenIdle();
    expect(update.state().status).toEqual({ kind: 'check-failed' });

    feed.checkError = null;
    await update.checkNow();
    expect(feed.checks).toBe(2);
    expect(update.state().status).toEqual({ kind: 'up-to-date' });
  });

  it('처음 확인 뒤 24시간마다 다시 확인한다', async () => {
    const { feed, clock, update } = setup();
    update.start();
    await update.whenIdle();
    clock.advance(CHECK_INTERVAL_MS - 1);
    await update.whenIdle();
    expect(feed.checks).toBe(1);
    clock.advance(1);
    await update.whenIdle();
    expect(feed.checks).toBe(2);
    clock.advance(CHECK_INTERVAL_MS);
    await update.whenIdle();
    expect(feed.checks).toBe(3);
  });

  it('잠자기에서 깨어났을 때 마지막 확인이 24시간 넘게 지났으면 바로 확인하고, 아니면 확인하지 않는다', async () => {
    const { feed, clock, update } = setup();
    update.start();
    await update.whenIdle();
    // 잠든 동안에는 타이머가 멈춘다. 시각만 흐른 것으로 흉내 낸다
    clock.time += CHECK_INTERVAL_MS - 60_000;
    await update.checkIfDue();
    expect(feed.checks).toBe(1);
    clock.time += 60_000;
    await update.checkIfDue();
    expect(feed.checks).toBe(2);
  });

  it('멈추면 더는 저절로 확인하지 않는다', async () => {
    const { feed, clock, update } = setup();
    update.start();
    await update.whenIdle();
    update.stop();
    clock.advance(CHECK_INTERVAL_MS * 2);
    await update.whenIdle();
    expect(feed.checks).toBe(1);
  });
});

describe('앱 내 업데이트: 내려받기와 검증', () => {
  it('새 버전을 찾으면 묻지 않고 내려받아, 서명이 맞으면 준비됨이다', async () => {
    const { feed, update } = setup();
    feed.latest = { version: '0.2.0', content: '새 버전', signer: key.privateKey };
    update.start();
    await update.whenIdle();
    expect(feed.downloads).toHaveLength(1);
    expect(update.state().status).toEqual({ kind: 'ready', version: '0.2.0' });
    // 저절로 설치하지 않는다
    expect(feed.installs).toBe(0);
  });

  it('서명이 틀리면 받은 파일을 지우고 아무것도 보여 주지 않으며, 같은 실행에서 같은 버전을 다시 받지 않는다', async () => {
    const { feed, clock, update } = setup();
    feed.latest = { version: '0.2.0', content: '가짜 버전', signer: strangerKey.privateKey };
    update.start();
    await update.whenIdle();
    expect(update.state().status).toEqual({ kind: 'idle' });
    expect(existsSync(feed.downloads[0]!)).toBe(false);

    clock.advance(CHECK_INTERVAL_MS);
    await update.whenIdle();
    expect(feed.checks).toBe(2);
    expect(feed.downloads).toHaveLength(1);
    expect(update.state().status).toEqual({ kind: 'idle' });
  });

  it('받은 파일의 sha512가 안내와 다르다고 업데이터가 거부해도 아무것도 보여 주지 않는다', async () => {
    const { feed, update } = setup();
    feed.latest = { version: '0.2.0', content: '새 버전', signer: key.privateKey };
    feed.sha512Mismatch = true;
    update.start();
    await update.whenIdle();
    expect(update.state().status).toEqual({ kind: 'idle' });
  });

  it('내려받다 끊기면 확인 실패이고 다음 확인에서 다시 받는다', async () => {
    const { feed, update } = setup();
    feed.latest = { version: '0.2.0', content: '새 버전', signer: key.privateKey };
    feed.downloadError = new Error('끊겼어요');
    update.start();
    await update.whenIdle();
    expect(update.state().status).toEqual({ kind: 'check-failed' });

    feed.downloadError = null;
    await update.checkNow();
    expect(update.state().status).toEqual({ kind: 'ready', version: '0.2.0' });
  });

  it('준비된 뒤의 정해진 확인이 실패해도 준비됨을 지우지 않고, 같은 버전을 다시 받지 않는다', async () => {
    const { feed, clock, update } = setup();
    feed.latest = { version: '0.2.0', content: '새 버전', signer: key.privateKey };
    update.start();
    await update.whenIdle();

    feed.checkError = new Error('인터넷이 안 돼요');
    clock.advance(CHECK_INTERVAL_MS);
    await update.whenIdle();
    expect(update.state().status).toEqual({ kind: 'ready', version: '0.2.0' });

    feed.checkError = null;
    clock.advance(CHECK_INTERVAL_MS);
    await update.whenIdle();
    expect(feed.downloads).toHaveLength(1);
    expect(update.state().status).toEqual({ kind: 'ready', version: '0.2.0' });
  });

  it('준비된 뒤에 더 새 버전이 나오면 그것을 받아 준비됨을 바꾼다', async () => {
    const { feed, clock, update } = setup();
    feed.latest = { version: '0.2.0', content: '새 버전', signer: key.privateKey };
    update.start();
    await update.whenIdle();
    feed.latest = { version: '0.3.0', content: '더 새 버전', signer: key.privateKey };
    clock.advance(CHECK_INTERVAL_MS);
    await update.whenIdle();
    expect(update.state().status).toEqual({ kind: 'ready', version: '0.3.0' });
  });

  it('상태가 바뀔 때마다 알린다', async () => {
    const { feed, update } = setup();
    feed.latest = { version: '0.2.0', content: '새 버전', signer: key.privateKey };
    /** 알림받은 상태의 종류. */
    const seen: string[] = [];
    update.onChange((state) => seen.push(state.status.kind));
    update.start();
    await update.whenIdle();
    expect(seen).toEqual(['checking', 'downloading', 'ready']);
  });
});

describe('앱 내 업데이트: 설치', () => {
  it('준비됨일 때 설치하면 설치 직전에 버전을 남기고 설치를 맡긴다', async () => {
    const { feed, update, attempts } = setup();
    feed.latest = { version: '0.2.0', content: '새 버전', signer: key.privateKey };
    update.start();
    await update.whenIdle();

    expect(update.install()).toBe(true);
    expect(attempts).toEqual(['0.2.0']);
    expect(feed.installs).toBe(1);
    expect(update.state().status).toEqual({ kind: 'installing', version: '0.2.0' });
  });

  it('준비되지 않았으면 설치하지 않는다', async () => {
    const { feed, update, attempts } = setup();
    update.start();
    await update.whenIdle();
    expect(update.install()).toBe(false);
    expect(feed.installs).toBe(0);
    expect(attempts).toEqual([]);
  });

  it('설치하지 못하면 준비됨으로 돌아가고 실패 횟수가 는다', async () => {
    const { feed, update } = setup();
    feed.latest = { version: '0.2.0', content: '새 버전', signer: key.privateKey };
    update.start();
    await update.whenIdle();
    update.install();
    feed.failInstall();
    expect(update.state()).toEqual({ status: { kind: 'ready', version: '0.2.0' }, installFailures: 1 });
  });
});
