# 46: 설치 파일과 데이터 지우기

**What to build:** 개발 Mac에서 Windows 설치 파일과 Mac dmg가 만들어진다. Windows에서 앱을 제거할 때 데이터를 지울지 묻고, 설정 화면의 "모든 데이터 지우기"로 흔적을 전부 지운다. [스펙](../spec.md)의 "배포와 설치"를 따른다. 근거는 [배포와 설치 방식 결정](11-distribution-decision.md), [서명 없는 빌드 산출물의 설치 실측](14-unsigned-build-install-measurement.md), [저장 방식과 백업 결정](17-storage-and-backup.md)의 검증 절이다. 저장소 주소와 앱 식별자는 [구현 전에 사용자에게 받을 것](29-user-inputs.md)에 있다.

Blocked by: 29, 40

Status: resolved

- [x] 명령 하나로 이 Mac에서 `DingDongDang-Setup.exe`(NSIS 원클릭, 사용자별 설치, x64, 베타 NSIS 툴셋 `1.2.1`), `DingDongDang.dmg`, `DingDongDang-mac.zip`(Apple Silicon, ad-hoc 서명)이 만들어진다. 파일 이름에 버전과 공백이 없다.
- [x] 앱 식별자는 `app.squadify.dingdongdang`, 표시 이름은 "딩동댕"이고 데이터 폴더 이름은 영문이다. 앱 아이콘이 [앱 아이콘과 트레이 아이콘](39-app-and-tray-icons.md)의 산출물이다.
- [x] Windows 설치 파일은 바탕 화면과 시작 메뉴에 바로가기를 만들고 설치가 끝나면 앱을 띄우게 설정되어 있다.
- [x] Windows 제거 때 "저장한 시간표와 종소리도 지울까요?"를 묻는 매크로가 들어 있다(기본 "아니요", 앱 내 업데이트가 옛 버전을 걷어 낼 때는 건너뜀, 자동 시작 등록은 항상 지움, `.nsh`는 UTF-8 BOM).
- [x] 설정 화면 맨 아래 "모든 데이터" 줄의 단추가 확인 모달(기본 초점 "취소")을 거쳐 스펙의 지우기 범위를 지우고 앱을 종료한다.
- [x] 실제 앱 테스트: "모든 데이터 지우기" 뒤에 임시 데이터 폴더에 저장 파일, 예비본, `sounds/`가 남지 않고 앱이 종료된다.
- [x] 에이전트가 확인한다: Mac 앱의 `codesign --verify --deep --strict`가 통과한다, 만들어진 Mac 앱을 이 Mac에서 띄우면 종 재생이 시작된다, exe가 NSIS 설치 파일로 판정된다. Windows에서의 설치와 제거는 확인하지 않는다.
- [x] 타입 검사, 린트, 전체 자동 테스트가 통과한다.

## Comments

- 2026-11-18 (에이전트): 구현했다.
  - 빌드 명령은 `npm run dist`(electron-vite build 뒤 `electron-builder --mac --win --publish never`)다. 설정은 `scripts/build-config.mts`에 있고 뿌리의 `electron-builder.ts`가 읽는다. 산출물은 `dist/`(git 제외)에 `DingDongDang-Setup.exe`, `DingDongDang.dmg`, `DingDongDang-mac.zip`으로 나온다.
  - 제거 매크로는 `build/installer.nsh`(UTF-8 BOM)다. 일부러 틀린 명령을 넣으면 makensis가 이 파일의 줄을 짚고 멈추는 것으로 실제로 읽히는 것을 확인했다.
  - 지우기 범위는 `src/main/data-wipe.ts`에 있다. 데이터 폴더(저장 파일, 예비본, 치워 둔 파일, 임시 파일, `sounds/`, Chromium 기록)와 내려받아 둔 업데이트 폴더(`ding-dong-dang-updater`)를 지우고, 자동 시작 등록도 지운다. Mac은 `~/Library`의 Caches, ShipIt, HTTPStorages, savedState, plist도 지운다. `--data-dir`로 띄운 실행은 그 폴더만 지운다.
- 판단: 제거 매크로는 앱 내 업데이트(`${isUpdated}`) 때 자동 시작 등록도 남긴다. 스펙의 "어느 쪽이든"과 17번의 "어느 쪽을 고르든"을 질문의 예/아니요 양쪽으로 읽었다. 체크리스트의 "항상"을 업데이트 때까지로 읽으면 문제가 생긴다. `reconcileAutoStart`는 처음 실행에만 등록하므로, 업데이트할 때마다 자동 시작이 풀리고 설정 화면에 실패로 뜬다.
- 판단: Windows에서는 `app.setAppUserModelId(APP_ID)`를 불러, 자동 시작 등록 값의 이름(Electron 기본값이 AUMID다)을 `app.squadify.dingdongdang`으로 맞췄다. 매크로가 이 이름으로 `Run`과 `StartupApproved\Run`의 값을 지운다. 바로가기의 AUMID(electron-builder가 appId를 넣는다)와도 같아진다.
- 발견과 수정: 처음 만든 Mac 앱은 뜨자마자 SIGTRAP으로 죽었다.
  - 원인: electron-builder가 번들과 Helper 앱의 파일 이름은 NFD로 만들고 `CFBundleName`은 NFC로 둔다. Electron은 `CFBundleName`으로 Helper를 찾아서 한글 이름이 어긋난다.
  - 수정: `mac.extendInfo.CFBundleName`을 NFD로 덮어썼다. 화면에 보이는 `CFBundleDisplayName`은 그대로 NFC이고 보기에는 같다. 설정 시험이 이 값을 지킨다.
- 발견과 수정: 같은 프로세스에서 지운 뒤에도 Chromium이 끝나면서 `Code Cache`와 `Network Persistent State`를 데이터 폴더에 다시 쓰는 경우가 있었다. 패키지 앱에서 한 번 일어났다.
  - 그래서 앱이 끝난 뒤 따로 띄운 셸이 같은 경로를 한 번 더 지운다. Mac은 프로세스가 끝나기를 기다리고, Windows는 3초쯤 기다린다.
  - Windows는 Chromium이 쥔 파일을 앱 안에서 지우지 못할 수 있어 이 단계가 더 필요하다.
  - 고친 뒤 패키지 앱에서 지우기를 여러 번 돌렸고, 2초 뒤에도 폴더가 남지 않았다.
- 에이전트 확인(이 Mac, 마지막 변경 뒤 다시 빌드한 산출물):
  - `codesign --verify --deep --strict`가 `dist/mac-arm64/딩동댕.app`, zip을 푼 앱, dmg 안의 앱에서 모두 통과했다. 서명은 `adhoc,runtime`이고 Identifier는 `app.squadify.dingdongdang`, 아키텍처는 arm64다.
  - 패키지 앱을 `--data-dir`와 다음 분 0초에 시작하는 시간표로 띄웠다. 종 시각(12:17:00)에 숨긴 재생기 창의 `audio`가 재생 중(`paused: false`)이 됐고, 강아지 창도 떴다.
  - `file` 명령이 exe를 `Nullsoft Installer self-extracting archive`로 판정했다.
  - Mac 앱의 표시 이름은 "딩동댕"이고 데이터 폴더는 영문 `ding-dong-dang`이다.
- 사용자 결정 "지금 화면 단추 표시"는 이미 코드에 있어(`app.css`의 `.rail-button[aria-current='page']` 테두리) 건드리지 않았다. 시계판 강아지 결정은 42번 몫이라 하지 않았다.
- 검증: `npm run check` 통과(typecheck, lint, vitest 371개, e2e 83개). 그 전 실행에서 `e2e/bell-screen.spec.ts` 두 개가 `firstWindow()` 직후 "페이지가 닫힘"으로 한 번 실패했다. 단독 실행과 다시 돌린 전체 실행에서는 통과했고, 창 순서는 이번 변경과 무관하다(간헐 실패).
- 확인하지 못한 것: Windows에서의 설치, 바로가기, 설치 뒤 실행, 제거 질문과 선택대로 지우기, Windows에서의 "모든 데이터 지우기"(Chromium이 쥔 파일을 따로 띄운 cmd가 지우는지, 자동 시작 등록 값 이름이 맞는지). 이것들은 구현 뒤 점검 목록(`checklists/post-implementation.md`)의 수동 통합 테스트로 확인한다.
- 알아 둘 것(스펙대로의 결과): Windows 제거에서 "아니요"를 고르고 다시 설치하면 데이터는 남는다. 자동 시작 등록은 지워졌고 처음 실행도 아니어서 저절로 다시 등록되지 않으며, 설정 화면에 "등록하지 못했어요"가 뜬다. 스위치를 다시 켜면 등록된다.

