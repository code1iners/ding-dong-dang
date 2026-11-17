// 아이콘 산출물의 이름과 크기. 만드는 스크립트(build-icons.mts)와 검사하는 테스트가 함께 쓴다.

export const ICON_FILES = {
  /** macOS 앱 아이콘 원본. 틀과 그림자 없는 1024px 정사각형. */
  appPng: 'app-icon.png',
  /** Windows 앱 아이콘. 둥근 타일. */
  appIco: 'app-icon.ico',
  trayMacOn: 'trayTemplate.png',
  trayMacOn2x: 'trayTemplate@2x.png',
  trayMacOff: 'trayOffTemplate.png',
  trayMacOff2x: 'trayOffTemplate@2x.png',
  trayWinOn: 'tray-win.ico',
  trayWinOff: 'tray-win-off.ico',
} as const;

/** macOS 앱 아이콘 원본의 한 변. */
export const APP_ICON_SIZE = 1024;
/** Windows 앱 아이콘 .ico에 담는 크기. Microsoft 최소 요건과 Electron 권장을 함께 채운다. */
export const TILE_ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 256] as const;
/** macOS 메뉴 막대 아이콘의 1배와 2배 한 변 길이. */
export const MAC_TRAY_SIZES = [16, 32] as const;
/** Windows 트레이 .ico에 담는 크기. 화면 배율마다 쓰는 크기가 다르다. */
export const TRAY_ICO_SIZES = [16, 20, 24, 32] as const;
