// 설치 파일 빌드 설정. electron-builder는 저장소 뿌리의 electron-builder.ts로 이 설정을 읽는다. 빌드 명령은 `npm run dist`다.
import { readFileSync } from 'node:fs';
import type { Configuration } from 'electron-builder';
import { APP_ID } from '../src/main/app-identity.ts';

/** electron-builder 출력 폴더. */
export const OUTPUT_DIR = 'dist';

/** package.json의 productName. 표시 이름 "딩동댕"이다. */
const PRODUCT_NAME: string = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).productName;

/** 설치 파일 빌드 설정. 표시 이름은 따로 두지 않고 package.json의 productName("딩동댕")을 쓴다. */
export function buildConfig(): Configuration {
  return {
    appId: APP_ID,
    directories: { output: OUTPUT_DIR, buildResources: 'build' },
    // 앱이 읽는 것은 electron-vite가 만든 out/과 아이콘 · 내장 음원뿐이다. 아이콘의 SVG 원본은 넣지 않는다
    files: ['out/**', 'resources/**', '!resources/icons/source/**', 'package.json'],
    mac: {
      icon: 'resources/icons/app-icon.png',
      // Apple Silicon만 만든다. dmg는 처음 설치할 때, zip은 앱 내 업데이트가 쓴다
      target: [
        { target: 'dmg', arch: ['arm64'] },
        { target: 'zip', arch: ['arm64'] },
      ],
      // 번들 전체를 ad-hoc 서명한다. 값이 없으면 서명을 건너뛰어 번들이 깨진 채 남는다
      identity: '-',
      extendInfo: {
        // electron-builder는 codesign 때문에 번들과 Helper 앱의 파일 이름을 NFD로 만들지만 CFBundleName은 NFC로 둔다.
        // Electron은 CFBundleName으로 Helper를 찾으므로, 한글 이름이 어긋나 앱이 뜨자마자 SIGTRAP으로 죽는다.
        // 파일 이름과 같은 NFD로 맞춘다. 화면에 보이는 CFBundleDisplayName은 그대로 NFC이고 보기에는 같다
        CFBundleName: PRODUCT_NAME.normalize('NFD'),
      },
      // 산출물 이름에 버전과 공백을 넣지 않아 `releases/latest/download/<파일 이름>` 고정 주소를 쓴다
      artifactName: 'DingDongDang-mac.${ext}',
    },
    dmg: { artifactName: 'DingDongDang.${ext}' },
    win: {
      icon: 'resources/icons/app-icon.ico',
      target: [{ target: 'nsis', arch: ['x64'] }],
    },
    // 관리자 권한 없이 사용자 폴더에 설치하고, 바로가기 둘을 만들고, 끝나면 앱을 띄운다
    nsis: {
      oneClick: true,
      perMachine: false,
      createDesktopShortcut: 'always',
      createStartMenuShortcut: true,
      runAfterFinish: true,
      // 제거할 때 데이터를 지울지 묻는 매크로
      include: 'build/installer.nsh',
      artifactName: 'DingDongDang-Setup.${ext}',
    },
    // 앱 내 업데이트가 확인하는 공개 릴리스. electron-builder가 이 값으로 앱에 app-update.yml을 넣고 latest*.yml을 만든다.
    // 서명하지 않고 배포하므로 Windows 설치 파일의 서명을 확인하는 win.publisherName은 넣지 않는다
    publish: { provider: 'github', owner: 'code1iners', repo: 'ding-dong-dang', releaseType: 'release' },
    // 기본 NSIS 툴셋의 makensis는 x86_64 전용이라 Rosetta 없는 Apple Silicon에서 멈춘다. 베타 툴셋(makensis 3.12)은 그대로 돈다
    toolsets: { nsis: '1.2.1' },
  };
}
