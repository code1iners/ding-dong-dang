import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { APP_ID, UPDATER_CACHE_DIR } from './app-identity';
import { BACKUP_FILE, CORRUPT_FILE, DATA_FILE, SOUNDS_DIR, TEMP_FILE } from './storage';

/** 지우기 범위를 정하는 데 쓰는 이 PC의 경로. */
export type WipeInput = {
  /** 이 PC의 OS. 데이터 폴더 밖에 남는 기록의 자리가 OS마다 다르다. */
  platform: NodeJS.Platform;
  /** 데이터 폴더. Chromium의 저장 위치(창 크기 같은 앱 내부 기록)도 이 안에 있다. */
  dataDir: string;
  /** 사용자 홈 폴더. */
  home: string;
  /** Windows의 `%LOCALAPPDATA%`. 없으면 홈 아래의 `AppData/Local`이다. */
  localAppData?: string;
  /** 실행 인자 `--data-dir`로 바꾼 데이터 폴더인지. 자동 검증 실행이 이 PC의 실제 앱 기록을 지우지 않게 한다. */
  usesCustomDataDir: boolean;
};

/**
 * "모든 데이터 지우기"가 지울 경로. 스펙의 지우기 범위 가운데 자동 시작 등록을 뺀 파일 쪽이다.
 * 우리가 쓴 파일을 먼저 두어, 폴더째 지우기가 중간에 막혀도 시간표와 등록 음원은 먼저 사라지게 한다.
 * 사용자가 따로 가진 원본 음원은 데이터 폴더 밖에 있어 건드리지 않는다.
 * Windows 제거 매크로(`build/installer.nsh`)도 같은 범위를 지운다.
 */
export function wipeTargets({ platform, dataDir, home, localAppData, usesCustomDataDir }: WipeInput): string[] {
  /** 데이터 폴더 안의 저장 파일, 예비본, 치워 둔 파일, 쓰는 도중의 임시 파일, 등록 음원, 그리고 폴더 자체. */
  const dataDirTargets = [DATA_FILE, BACKUP_FILE, CORRUPT_FILE, TEMP_FILE, SOUNDS_DIR].map((name) => join(dataDir, name)).concat(dataDir);
  if (usesCustomDataDir) return dataDirTargets;
  if (platform === 'win32') return [...dataDirTargets, join(localAppData ?? join(home, 'AppData', 'Local'), UPDATER_CACHE_DIR)];
  if (platform === 'darwin') {
    /** macOS가 번들 ID 이름으로 앱 밖에 남기는 기록이 있는 곳. */
    const library = join(home, 'Library');
    return [
      ...dataDirTargets,
      // 내려받아 둔 업데이트: electron-updater의 내려받기와 Squirrel.Mac(ShipIt)이 풀어 둔 것
      join(library, 'Caches', UPDATER_CACHE_DIR),
      join(library, 'Caches', APP_ID),
      join(library, 'Caches', `${APP_ID}.ShipIt`),
      join(library, 'HTTPStorages', APP_ID),
      join(library, 'Saved Application State', `${APP_ID}.savedState`),
      join(library, 'Preferences', `${APP_ID}.plist`),
    ];
  }
  return dataDirTargets;
}

/** 경로들을 차례로 지운다. 없는 경로는 지운 것으로 보고, 지우지 못한 것은 앱이 끝난 뒤의 셸 명령에 맡긴다. */
export function wipePaths(paths: readonly string[]): void {
  for (const path of paths) {
    try {
      // Windows에서 잠깐 잡혀 있는 파일은 몇 번 다시 해 본다
      rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    } catch {
      // 남은 것은 앱이 끝난 뒤 다시 지운다
    }
  }
}

/** 앱이 끝난 뒤 한 번 더 지우려고 따로 띄울 셸 명령. */
export type ShellCommand = { file: string; args: string[] };

/**
 * 앱이 끝난 뒤 지우기 경로를 한 번 더 지우는 셸 명령. 따로 띄워 앱보다 오래 산다.
 * Chromium은 창을 닫은 뒤에도 프로세스가 끝날 때까지 데이터 폴더에 기록(`Code Cache`, `Network Persistent State` 등)을 다시 쓰고,
 * Windows에서는 쥐고 있는 파일을 지우지도 못해, 같은 프로세스에서 지운 것만으로는 폴더가 남을 수 있다.
 * - Windows: ping으로 3초쯤 기다린 뒤 경로마다 폴더로도 파일로도 지워 본다. Node의 shell 실행처럼 `/s`와 바깥 따옴표로 감싼다.
 * - 그 밖: 앱 프로세스(`pid`)가 끝나기를 기다린 뒤 지운다.
 */
export function removeAfterExitCommand(platform: NodeJS.Platform, pid: number, paths: readonly string[]): ShellCommand {
  if (platform === 'win32') {
    /** 기다린 뒤 차례로 지우는 cmd 줄. */
    const line = ['ping -n 4 127.0.0.1 >nul', ...paths.map((p) => `rmdir /s /q "${p}" 2>nul & del /f /q "${p}" 2>nul`)].join(' & ');
    return { file: 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`] };
  }
  /** 작은따옴표로 감싼 경로들. 안의 작은따옴표는 닫고 이스케이프한 뒤 다시 연다. */
  const quoted = paths.map((p) => `'${p.replaceAll("'", "'\\''")}'`).join(' ');
  return { file: '/bin/sh', args: ['-c', `while kill -0 ${pid} 2>/dev/null; do sleep 0.1; done; rm -rf -- ${quoted}`] };
}
