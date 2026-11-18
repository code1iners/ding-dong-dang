/**
 * 앱 식별자. macOS 번들 ID이자 Windows AppUserModelID이고, Windows 자동 시작 등록 값의 이름이 된다.
 * Mac의 지정 요구 조건에 들어가므로 첫 릴리스 뒤에는 바꿀 수 없다.
 */
export const APP_ID = 'app.squadify.dingdongdang';

/**
 * electron-updater가 내려받은 업데이트를 두는 폴더 이름. electron-builder가 package.json의 name 뒤에 `-updater`를 붙여 정한다.
 * Windows는 `%LOCALAPPDATA%`, macOS는 `~/Library/Caches` 아래에 생긴다.
 */
export const UPDATER_CACHE_DIR = 'ding-dong-dang-updater';
