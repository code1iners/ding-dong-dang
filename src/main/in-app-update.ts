import { rm } from 'node:fs/promises';
import type { UpdateState, UpdateStatus } from '../shared/update';
import { verifyDownloadedUpdate, type DownloadedUpdate, type UpdateManifest } from './update-signature';

/** 확인 간격(밀리초). 앱이 시작할 때 확인하고 그 뒤 24시간마다 확인한다. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** 업데이트 파일을 끝까지 받은 결과. */
export type DownloadOutcome =
  /** 받은 파일의 sha512가 안내와 같다(electron-updater의 `update-downloaded`). 서명은 앱이 따로 검증한다. */
  | { kind: 'downloaded'; update: DownloadedUpdate }
  /** 받은 파일의 sha512가 안내와 달라 업데이터가 파일을 지웠다. 검증 실패와 같게 다룬다. */
  | { kind: 'sha512-mismatch' };

/** 업데이트 피드. 공개 릴리스에서 새 버전을 찾고 받으며, 받아 둔 것을 설치한다. 앱에서는 electron-updater의 `github` 제공자가 맡는다. */
export type UpdateFeed = {
  /** 지금 버전보다 새 버전을 찾는다. 있으면 그 안내, 없으면 null. 확인하지 못하면 던진다. */
  check(): Promise<UpdateManifest | null>;
  /** 마지막 확인에서 찾은 새 버전을 받는다. 받지 못하면(네트워크 오류, 받다가 끊김 등) 던진다. */
  download(): Promise<DownloadOutcome>;
  /** 받아 둔 업데이트를 설치하며 앱을 끄고 새 버전으로 다시 켠다. 앱 안에서 설치하지 못하면 앱은 그대로이고 `onInstallFailed`의 함수가 불린다. */
  install(): void;
  /** 앱 안에서 설치하지 못할 때마다 부를 함수를 둔다. */
  onInstallFailed(listener: () => void): void;
};

/** 확인 시점을 재는 시계. */
export type UpdateClock = {
  /** 지금 시각(에포크 ms). */
  now(): number;
  /** `ms` 뒤에 `run`을 부른다. 돌려준 함수를 부르면 예약을 지운다. */
  after(ms: number, run: () => void): () => void;
};

/** 앱 내 업데이트에 필요한 것. */
export type InAppUpdateOptions = {
  /** 새 버전을 찾고 받는 피드. */
  feed: UpdateFeed;
  /** 확인 시점을 재는 시계. */
  clock: UpdateClock;
  /** 지금 앱 버전. 이보다 높은 버전만 받는다. */
  currentVersion: string;
  /** 서명을 검증할 Ed25519 공개 키 목록. 앱에서는 앱 소스의 공개 키 목록이다. */
  publicKeys: readonly string[];
  /** 설치를 맡기기 직전에 부른다. 다시 켜졌을 때 "업데이트했어요"를 알리도록 설치할 버전을 남긴다. */
  beforeInstall(version: string): void;
};

/**
 * 앱 내 업데이트. 시작할 때와 그 뒤 24시간마다 공개 릴리스를 확인하고, 새 버전이 있으면 묻지 않고 받아 Ed25519 서명을 검증한다.
 * 검증을 통과해야만 준비됨이 되고, 사용자가 승인해 `install`을 부를 때만 설치한다.
 */
export class InAppUpdate {
  /** 지금 상태. */
  private status: UpdateStatus = { kind: 'idle' };
  /** 설치하지 못한 횟수. */
  private installFailures = 0;
  /** 진행 중인 확인과 내려받기. */
  private inFlight: Promise<void> | null = null;
  /** 정해진 확인을 하는지. `start`가 켜고 `stop`이 끈다. */
  private running = false;
  /** 예약한 다음 확인을 지우는 함수. */
  private cancelScheduled: (() => void) | null = null;
  /** 마지막으로 확인에 성공한 시각. 아직 없으면 null. */
  private lastCheckedAt: number | null = null;
  /** 이번 실행에서 검증에 실패한 버전. 같은 실행에서는 다시 받지 않는다. */
  private readonly rejectedVersions = new Set<string>();
  /** 상태가 바뀔 때 부를 함수. */
  private readonly listeners = new Set<(state: UpdateState) => void>();

  constructor(private readonly options: InAppUpdateOptions) {
    // 앱 안에서 설치하지 못하면 앱은 그대로 살아 있다. 준비된 파일은 남아 있으니 준비됨으로 돌린다
    options.feed.onInstallFailed(() => {
      if (this.status.kind !== 'installing') return;
      this.installFailures += 1;
      this.setStatus({ kind: 'ready', version: this.status.version });
    });
  }

  /** 지금 상태. */
  state(): UpdateState {
    return { status: this.status, installFailures: this.installFailures };
  }

  /** 상태가 바뀔 때마다 `listener`를 부른다. 돌려준 함수를 부르면 그만 부른다. */
  onChange(listener: (state: UpdateState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** 바로 확인하고, 그 뒤 확인을 마칠 때마다 24시간 뒤에 다시 확인한다. */
  start(): void {
    this.running = true;
    void this.run(false);
  }

  /** 다음 확인을 멈춘다. 앱을 끝낼 때 부른다. */
  stop(): void {
    this.running = false;
    this.cancelScheduled?.();
    this.cancelScheduled = null;
  }

  /** 설정 화면의 "다시 확인". 바로 확인한다. 확인이 진행 중이면 그 확인을 기다린다. */
  checkNow(): Promise<void> {
    return this.inFlight ?? this.run(true);
  }

  /**
   * 잠자기에서 깨어났을 때 부른다. 잠든 동안에는 타이머가 멈춰 정해진 확인이 밀린다.
   * 마지막 확인에서 24시간이 지났으면(아직 확인하지 못했으면) 바로 확인한다.
   */
  checkIfDue(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    /** 마지막으로 확인에 성공한 뒤 지난 시간. */
    const since = this.lastCheckedAt === null ? Infinity : this.options.clock.now() - this.lastCheckedAt;
    return since >= CHECK_INTERVAL_MS ? this.run(false) : Promise.resolve();
  }

  /** 진행 중인 확인과 내려받기가 끝나면 풀린다. 시계가 시작한 확인을 기다릴 때 쓴다. */
  whenIdle(): Promise<void> {
    return this.inFlight ?? Promise.resolve();
  }

  /** 사용자가 승인한 설치. 준비됨일 때만 설치할 버전을 남기고 설치를 맡긴다. 맡겼으면 true. */
  install(): boolean {
    if (this.status.kind !== 'ready') return false;
    /** 설치할 버전. */
    const version = this.status.version;
    this.options.beforeInstall(version);
    this.setStatus({ kind: 'installing', version });
    this.options.feed.install();
    return true;
  }

  /** 확인과 내려받기를 한 번 하고 다음 확인을 예약한다. */
  private run(byUser: boolean): Promise<void> {
    this.inFlight ??= this.checkAndDownload(byUser)
      // 피드가 예상하지 못한 오류를 던져도 다음 확인은 이어 간다
      .catch(() => undefined)
      .finally(() => {
        this.inFlight = null;
        if (this.running) this.schedule();
      });
    return this.inFlight;
  }

  /** 24시간 뒤에 확인하도록 예약한다. 앞서 예약한 확인은 지운다. */
  private schedule(): void {
    this.cancelScheduled?.();
    this.cancelScheduled = this.options.clock.after(CHECK_INTERVAL_MS, () => {
      this.cancelScheduled = null;
      void this.run(false);
    });
  }

  /**
   * 새 버전을 확인하고, 있으면 받아 검증한다.
   * 준비됨과 설치 중은 사용자가 볼 안내라서, 정해진 확인이 "확인 중"이나 확인 실패로 덮지 않는다.
   */
  private async checkAndDownload(byUser: boolean): Promise<void> {
    /** 확인을 시작할 때의 상태. */
    const before = this.status;
    if (before.kind === 'installing') return;
    /** 확인하는 동안 상태를 "확인 중"으로 바꿀지. 확인이 실패하면 확인 실패를 보일지도 이것으로 정한다. */
    const showsProgress = byUser || before.kind !== 'ready';
    if (showsProgress) this.setStatus({ kind: 'checking' });

    /** 찾은 새 버전의 안내. */
    let manifest: UpdateManifest | null;
    try {
      manifest = await this.options.feed.check();
    } catch {
      this.setStatus(showsProgress ? { kind: 'check-failed' } : before);
      return;
    }
    this.lastCheckedAt = this.options.clock.now();
    if (!manifest) {
      this.setStatus({ kind: 'up-to-date' });
      return;
    }
    // 이미 받아 검증한 버전이면 다시 받지 않는다
    if (before.kind === 'ready' && before.version === manifest.version) {
      this.setStatus(before);
      return;
    }
    // 검증에 실패한 버전은 이번 실행에서 다시 받지 않는다. 앞서 준비한 버전이 있으면 그대로 둔다
    if (this.rejectedVersions.has(manifest.version)) {
      this.reject(manifest.version, before);
      return;
    }

    this.setStatus({ kind: 'downloading', version: manifest.version });
    /** 끝까지 받은 결과. */
    let outcome: DownloadOutcome;
    try {
      outcome = await this.options.feed.download();
    } catch {
      // 네트워크 오류나 받다가 끊긴 것이다. 검증 실패와 달리 다음 확인에서 다시 받는다
      this.setStatus(before.kind === 'ready' && !byUser ? before : { kind: 'check-failed' });
      return;
    }
    if (outcome.kind === 'sha512-mismatch') {
      this.reject(manifest.version, before);
      return;
    }
    /** 받은 파일. */
    const { update } = outcome;
    /** 검증이 실패한 까닭. 통과하면 null. */
    const failure = await verifyDownloadedUpdate(update, this.options.currentVersion, this.options.publicKeys);
    if (failure) {
      // 지우지 못해도 준비됨이 아니므로 설치되지 않는다
      await rm(update.file, { force: true }).catch(() => undefined);
      this.reject(update.manifest.version, before);
      return;
    }
    this.setStatus({ kind: 'ready', version: update.manifest.version });
  }

  /** 받은 버전을 설치 후보로 두지 않는다. 아무것도 보여 주지 않고, 앞서 준비한 버전이 있으면 그대로 둔다. */
  private reject(version: string, before: UpdateStatus): void {
    this.rejectedVersions.add(version);
    this.setStatus(before.kind === 'ready' ? before : { kind: 'idle' });
  }

  /** 상태를 바꾸고, 바뀌었으면 듣는 쪽에 알린다. */
  private setStatus(status: UpdateStatus): void {
    if (JSON.stringify(status) === JSON.stringify(this.status)) return;
    this.status = status;
    for (const listener of this.listeners) listener(this.state());
  }
}
