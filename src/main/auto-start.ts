import type { App } from 'electron';

/**
 * Windows 로그인 항목에 넣는 실행 인자. 이 인자로 뜨면 자동 시작이다.
 * 자동 검증도 이 인자로 "창 없이 뜨기"를 본다.
 */
export const AUTO_START_ARG = '--auto-start';

/** 설정 화면의 "자동 시작 등록 방법" 링크가 여는 README의 절. 절 제목이 바뀌면 이 주소의 해시도 맞춘다. */
export const AUTO_START_HELP_URL = 'https://github.com/code1iners/ding-dong-dang#자동-시작-수동-등록-방법';

/** OS에 물은 로그인 항목 상태. Electron `getLoginItemSettings`가 돌려주는 값 가운데 쓰는 것만 담는다. */
export type LoginItemSnapshot = {
  /** 로그인 때 열도록 등록돼 있는지. */
  openAtLogin: boolean;
  /** macOS: `enabled`, `requires-approval`, `not-found`, `not-registered`. */
  status?: string;
  /** Windows: 등록돼 있고 작업 관리자 등에서 꺼지지 않았는지. */
  executableWillLaunchAtLogin?: boolean;
  /** macOS: 이번 실행이 로그인 때 자동으로 열린 것인지. */
  wasOpenedAtLogin?: boolean;
};

/** 로그인 항목을 읽고 바꾸는 부품. 실제 OS용과 OS를 건드리지 않는 용이 있다. */
export type LoginItemApi = {
  /** 지금 OS의 등록 상태. */
  get(): LoginItemSnapshot;
  /** 등록하거나 지운다. OS가 거절하면 던질 수 있다. */
  set(on: boolean): void;
};

/** 등록이 실제로 로그인 때 앱을 띄울 상태인지. 스위치의 값이 아니라 OS의 답으로 판단한다. */
export function isRegistered(platform: NodeJS.Platform, snapshot: LoginItemSnapshot): boolean {
  if (platform === 'darwin') return snapshot.status === 'enabled';
  if (platform === 'win32') return snapshot.openAtLogin && snapshot.executableWillLaunchAtLogin === true;
  return snapshot.openAtLogin;
}

/**
 * 이번 실행이 자동 시작으로 뜬 것인지. 직접 실행했거나 업데이트 뒤에 다시 실행한 것이면 false다.
 * - 실행 인자: Windows가 등록할 때 넣은 인자이고, 자동 검증도 모든 OS에서 이 인자로 같은 길을 탄다.
 * - macOS: 인자를 넣을 수 없어(macOS 13 이후의 메인 앱 로그인 항목) OS가 알려 주는 `wasOpenedAtLogin`을 따른다.
 */
export function launchedByAutoStart(platform: NodeJS.Platform, argv: readonly string[], snapshot: LoginItemSnapshot): boolean {
  if (argv.includes(AUTO_START_ARG)) return true;
  return platform === 'darwin' && snapshot.wasOpenedAtLogin === true;
}

/** Electron `app`의 로그인 항목으로 만든 실제 OS용 부품. Windows는 등록과 조회에 같은 실행 인자를 넘겨야 값이 맞는다. */
export function electronLoginItem(app: Pick<App, 'getLoginItemSettings' | 'setLoginItemSettings'>, platform: NodeJS.Platform): LoginItemApi {
  /** 등록과 조회에 함께 넣는 옵션. */
  const options = platform === 'win32' ? { args: [AUTO_START_ARG] } : {};
  return {
    get: () => app.getLoginItemSettings(options),
    set: (on) => app.setLoginItemSettings({ openAtLogin: on, ...options }),
  };
}

/** OS의 로그인 항목을 건드리지 않는 부품. 켜고 끈 값만 기억해, 자동 검증 실행이 사용자의 자동 시작 등록을 바꾸지 않게 한다. */
export function inertLoginItem(initiallyOn: boolean): LoginItemApi {
  /** 기억하는 등록 값. */
  let on = initiallyOn;
  return {
    get: () => ({ openAtLogin: on, status: on ? 'enabled' : 'not-registered', executableWillLaunchAtLogin: on }),
    set: (next) => {
      on = next;
    },
  };
}

/**
 * 시작할 때 저장된 설정과 OS 등록을 맞춘다.
 * - 켜 둔 설정이면 처음 실행에만 등록한다. 그 뒤에 사용자가 시스템 설정에서 지웠거나 꺼 둔 것을 조용히 되살리지 않고,
 *   등록되지 않은 채로 남은 것은 설정 화면이 실패로 알린다.
 * - 끈 설정이면 남아 있는 등록을 지운다.
 * OS가 거절해도 앱은 계속 뜬다.
 */
export function reconcileAutoStart(platform: NodeJS.Platform, wanted: boolean, firstRun: boolean, item: LoginItemApi): void {
  /** 이미 켜진 상태인지. */
  const registered = isRegistered(platform, item.get());
  if (wanted ? registered || !firstRun : !registered) return;
  try {
    item.set(wanted);
  } catch {
    // 거절은 OS에 다시 물어 보면 드러난다
  }
}
