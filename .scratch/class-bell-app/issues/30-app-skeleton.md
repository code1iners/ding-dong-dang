# 30: 앱 뼈대와 검사 도구

**What to build:** 앱을 실행하면 왼쪽 세로 줄(현황, 시간표, 종, 설정)과 빈 네 화면이 있는 창이 뜬다. 이후 티켓이 기댈 검사 도구가 모두 돈다. [스펙](../spec.md)의 "플랫폼과 기술 스택", "모듈 구성"과 루트 `DESIGN.md`를 따른다.

Blocked by: None (can start immediately)

Status: resolved

- [x] Electron 45 계열, TypeScript, React, Vite로 앱이 뜨고 왼쪽 세로 줄의 단추로 네 화면을 오간다. 창은 최소 920×580이고 크기를 바꿀 수 있다.
- [x] `DESIGN.md`의 색, 글자 크기, 모서리, 여백이 CSS 변수로 있고 Jua 글꼴이 앱에 내장되어 있다. OS가 어두운 모드여도 색이 바뀌지 않는다.
- [x] 렌더러는 Node와 파일 시스템에 직접 닿지 않는다(`contextIsolation` 켬, `nodeIntegration` 끔). 메인과의 통로는 "상태 구독"과 "명령" 두 종류다.
- [x] 실행 인자 `--data-dir=<경로>`로 데이터 폴더를 바꿀 수 있다.
- [x] 명령 하나씩으로 타입 검사, 린트, Vitest가 돈다.
- [x] Playwright가 임시 데이터 폴더로 실제 앱을 띄워 네 화면을 오가는 테스트 하나가 통과한다.
- [x] 측정용 폴더 `prototypes/`는 제품 코드의 빌드와 검사 대상에서 빠져 있다.
- [x] 타입 검사, 린트, 전체 자동 테스트가 통과한다.

## Comments

### 2026-11-17 구현 결과 (커밋 5959b5a)

- 구성: electron-vite 6(Vite 8) + React 19 + TypeScript 6.0. TypeScript 7은 typescript-eslint가 아직 지원하지 않아(`<6.1`) 6.0 계열로 두었다. Electron 45 패키지는 설치 때 바이너리를 받지 않아 `postinstall: install-electron`을 넣었다.
- 명령: `npm run typecheck`, `npm run lint`, `npm test`(Vitest, 테스트가 아직 없어 `passWithNoTests`), `npm run test:e2e`(빌드 뒤 Playwright), `npm run check`(넷을 차례로).
- 통로: preload가 `window.dingdong`에 `subscribe`, `command` 둘만 내보낸다. 상태는 지금 `{ appVersion }`뿐이고, 명령은 아직 없어 메인이 모든 명령을 거절한다. 기능 티켓이 `src/shared/bridge.ts`의 `AppState`, `Command`에 더한다.
- 창 크기는 내용 영역 기준(`useContentSize`)으로 최소 920×580이다. 시안이 내용 영역 920×580으로 그려져 있다.
- 기본 데이터 폴더는 OS 앱 데이터 폴더 아래 `ding-dong-dang`이다. Electron 기본값은 표시 이름("딩동댕")을 폴더 이름으로 써서 직접 정했다.
- Jua는 Google Fonts 저장소의 `Jua-Regular.ttf`(SIL OFL 1.1, 라이선스 파일 동봉)를 넣었다.
- 검증: 타입 검사, 린트, Vitest, e2e 5개 통과. e2e는 화면 전환, `--data-dir`, 최소 크기, Node 차단과 두 통로, Jua 내장과 어두운 모드 고정을 보고, 각각 구현을 일부러 깨뜨려 실패하는 것을 확인했다. 실제 창 캡처로 세로 줄 모양과 초점 테두리(아래 띠까지 감쌈)를 눈으로 확인했다.

### 사용자 확인이 필요한 것 (구현은 시안대로 둠)

- 지금 화면의 세로 줄 단추를 시안(`.rb.on`)대로 초록 바탕으로 칠했다. DESIGN.md의 "한 색은 한 가지 뜻으로만 쓴다. 초록은 '수업 · 확인'"과 "선택한 항목은 `글자` 색 3px 테두리를 3px 띄워 그린다", "상태를 색으로만 구분하지 않는다"에 비추면 어긋난다고 볼 수 있다. DESIGN.md는 세로 줄의 지금 화면 표시를 따로 정하지 않았고, 승인된 시안의 모양이라 바꾸지 않았다. 초록을 유지할지, 선택 테두리를 더할지 결정이 필요하다(눈으로 볼 결정이라 시안으로 묻는 것이 맞다).
- DESIGN.md 안에서 "모서리 반지름은 10, 14, 16, 20과 원만 쓴다"와 "작은 단추 반지름 12"가 서로 다르다. 변수에는 12를 `--radius-button-sm`으로 넣었다.
- 화면 오른쪽 여백은 시안(24)이 아니라 DESIGN.md의 "창 가장자리 16"을 따랐다.
