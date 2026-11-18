import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ID, UPDATER_CACHE_DIR } from '../src/main/app-identity.ts';
import { DEFAULT_DATA_DIR_NAME } from '../src/main/data-dir.ts';
import { buildConfig } from './build-config.mts';

/** 저장소 뿌리. */
const ROOT = join(import.meta.dirname, '..');

describe('설치 파일 빌드 설정', () => {
  /** 이 저장소의 빌드 설정. */
  const config = buildConfig();

  it('앱 식별자는 app.squadify.dingdongdang이고 표시 이름은 package.json의 "딩동댕"이다', () => {
    expect(config.appId).toBe('app.squadify.dingdongdang');
    expect(config.productName).toBeUndefined();
    expect(JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).productName).toBe('딩동댕');
  });

  it('산출물 이름은 버전과 공백이 없는 셋이다', () => {
    expect(config.nsis?.artifactName).toBe('DingDongDang-Setup.${ext}');
    expect(config.dmg?.artifactName).toBe('DingDongDang.${ext}');
    expect(config.mac?.artifactName).toBe('DingDongDang-mac.${ext}');
  });

  it('Windows는 x64 NSIS 원클릭 사용자별 설치를 베타 툴셋 1.2.1로 만들고, 바로가기 둘과 설치 뒤 실행을 켠다', () => {
    expect(config.win?.target).toEqual([{ target: 'nsis', arch: ['x64'] }]);
    expect(config.toolsets).toEqual({ nsis: '1.2.1' });
    expect(config.nsis).toMatchObject({
      oneClick: true,
      perMachine: false,
      createDesktopShortcut: 'always',
      createStartMenuShortcut: true,
      runAfterFinish: true,
      include: 'build/installer.nsh',
    });
  });

  it('앱 내 업데이트는 code1iners/ding-dong-dang의 공개 릴리스를 github 제공자로 보고, publisherName은 넣지 않는다', () => {
    expect(config.publish).toEqual({ provider: 'github', owner: 'code1iners', repo: 'ding-dong-dang', releaseType: 'release' });
    expect(config.win).not.toHaveProperty('publisherName');
  });

  it('macOS의 CFBundleName은 Helper 앱 파일 이름과 같은 NFD다(어긋나면 앱이 뜨자마자 죽는다)', () => {
    /** 덮어쓴 CFBundleName. */
    const name = config.mac?.extendInfo?.['CFBundleName'];
    expect(name).toBe('딩동댕'.normalize('NFD'));
    expect(name).not.toBe('딩동댕'.normalize('NFC'));
  });

  it('macOS는 Apple Silicon dmg와 zip을 ad-hoc 서명으로 만든다', () => {
    expect(config.mac?.target).toEqual([
      { target: 'dmg', arch: ['arm64'] },
      { target: 'zip', arch: ['arm64'] },
    ]);
    expect(config.mac?.identity).toBe('-');
  });

  it('앱 아이콘은 아이콘 티켓의 산출물이다', () => {
    expect(config.mac?.icon).toBe('resources/icons/app-icon.png');
    expect(config.win?.icon).toBe('resources/icons/app-icon.ico');
  });
});

describe('Windows 제거 매크로', () => {
  /** 매크로 파일의 바이트. */
  const bytes = readFileSync(join(ROOT, 'build/installer.nsh'));
  /** 매크로 본문. */
  const text = bytes.subarray(3).toString('utf8');

  it('UTF-8 BOM으로 시작한다(makensis가 한국어 문구를 깨지 않게)', () => {
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('데이터를 지울지 기본 "아니요"로 묻고, 업데이트가 옛 버전을 걷어 낼 때는 묻지 않는다', () => {
    expect(text).toContain('!macro customUnInstall');
    expect(text).toMatch(/MessageBox MB_YESNO\|MB_ICONQUESTION\|MB_DEFBUTTON2 "저장한 시간표와 종소리도 지울까요\?" \/SD IDNO/);
    expect(text).toContain('${ifNot} ${isUpdated}');
  });

  it('"예"면 데이터 폴더와 내려받아 둔 업데이트를 지우고, 자동 시작 등록은 대답과 상관없이 지운다', () => {
    // 매크로는 NSIS라 앱의 상수를 읽지 못한다. 앱 쪽 이름이 바뀌면 여기서 어긋남이 드러나도록 상수로 비교한다
    expect(text).toContain(`RMDir /r "$APPDATA\\${DEFAULT_DATA_DIR_NAME}"`);
    expect(text).toContain(`RMDir /r "$LOCALAPPDATA\\${UPDATER_CACHE_DIR}"`);
    expect(text).toContain(`DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "${APP_ID}"`);
    // 자동 시작 등록 지우기는 묻는 창보다 앞이라 "아니요"로 건너뛰어도 실행된다.
    // 업데이트는 같은 자리에 새 버전을 깔아 등록이 그대로 맞으므로, 업데이트 때는 지우지 않는다
    expect(text.indexOf('CurrentVersion\\Run"')).toBeLessThan(text.indexOf('MessageBox'));
    expect(text.indexOf('CurrentVersion\\Run"')).toBeGreaterThan(text.indexOf('${ifNot} ${isUpdated}'));
  });
});
