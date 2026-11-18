import type { AppUpdater, UpdateDownloadedEvent, UpdateInfo } from 'electron-updater';
import type { UpdateFeed } from './in-app-update';
import type { UpdateManifest } from './update-signature';

/** electron-updater가 받은 파일의 sha512가 안내와 다를 때 던지는 오류 코드. 이때 받은 파일은 이미 지웠다. */
const CHECKSUM_MISMATCH_CODE = 'ERR_CHECKSUM_MISMATCH';

/**
 * electron-updater의 `github` 제공자로 공개 릴리스에서 새 버전을 찾고 받는 업데이트 피드.
 * 저장소는 빌드 설정의 `publish`가 앱에 넣은 `app-update.yml`에서 읽는다.
 * 언제 받고 언제 설치할지는 앱이 정한다. 찾자마자 받지 않고(앱이 받음), 끌 때 설치하지 않는다(사용자가 승인할 때만).
 */
export function electronUpdateFeed(updater: AppUpdater): UpdateFeed {
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  // 차등 다운로드는 쓰지 않아 blockmap에 기대지 않는다. Windows 웹 설치 파일도 쓰지 않는다
  updater.disableDifferentialDownload = true;
  updater.disableWebInstaller = true;
  // 옛 버전으로 되돌리지 않고(스펙의 범위 밖), 잘못 나간 버전을 멈출 때 쓰는 사전 릴리스는 받지 않는다
  updater.allowDowngrade = false;
  updater.allowPrerelease = false;
  // electron-updater의 기본 로그는 콘솔로 나간다. 남길 곳이 없어 끈다
  updater.logger = null;

  /** 마지막으로 받은 업데이트 파일과 그 안내. */
  let lastDownloaded: UpdateDownloadedEvent | null = null;
  /** 설치를 맡긴 뒤인지. 그 뒤의 오류는 설치하지 못한 것이다. */
  let installing = false;
  /** 설치하지 못했을 때 부를 함수. */
  let onInstallFailed: (() => void) | null = null;
  updater.on('update-downloaded', (event) => {
    lastDownloaded = event;
  });
  // 듣는 곳이 없으면 EventEmitter가 오류를 던져 앱이 멈춘다. Squirrel.Mac이 새 번들을 거부한 것도 이 이벤트로 온다
  updater.on('error', () => {
    if (!installing) return;
    installing = false;
    onInstallFailed?.();
  });

  return {
    async check() {
      /** 확인 결과. 업데이터가 꺼진 실행이면 null이다. */
      const result = await updater.checkForUpdates();
      return result?.isUpdateAvailable ? manifestOf(result.updateInfo) : null;
    },
    async download() {
      /** 받은 파일의 경로. electron-updater는 update-downloaded를 낸 뒤에 이 약속을 푼다. */
      let files: string[];
      try {
        files = await updater.downloadUpdate();
      } catch (error) {
        // 끝까지 받았지만 sha512가 안내와 다르다. 받다가 끊긴 것은 네트워크 오류로 오므로 여기에 들지 않는다
        if ((error as NodeJS.ErrnoException).code === CHECKSUM_MISMATCH_CODE) return { kind: 'sha512-mismatch' };
        throw error;
      }
      // 이번 다운로드가 낸 update-downloaded인지 받은 파일로 확인한다
      if (!lastDownloaded || lastDownloaded.downloadedFile !== files[0]) throw new Error('update-downloaded 없이 다운로드가 끝났습니다.');
      return { kind: 'downloaded', update: { file: lastDownloaded.downloadedFile, manifest: manifestOf(lastDownloaded) } };
    },
    install() {
      installing = true;
      // Windows는 사용자별 설치라 창 없이 조용히 설치하고 새 버전을 켠다. macOS는 두 인수를 쓰지 않는다
      updater.quitAndInstall(true, true);
    },
    onInstallFailed(listener) {
      onInstallFailed = listener;
    },
  };
}

/** electron-updater가 읽은 안내를 앱의 모양으로 바꾼다. 파일 항목은 yml을 읽은 그대로 넘겨 서명 목록 필드를 살린다. */
function manifestOf(info: UpdateInfo): UpdateManifest {
  return { version: String(info.version), files: Array.isArray(info.files) ? [...info.files] : [] };
}
