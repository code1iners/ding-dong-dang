# e2e를 화면 없이(헤드리스) 돌릴 수 있는가

조사일 2026-11-18. 기준: Electron ~45.3.3, @playwright/test 1.65.1, macOS 개발 환경.
표기: **[사실]** 공식 문서·저장소 코드로 확인, **[실험]** 이번에 직접 돌려 확인, **[추정]** 근거 없이 추론, **[검증 안 함]**.

## 결론

**조건부 가능.** Electron에는 공식 헤드리스 모드가 없다. 그러나 이 앱의 e2e는 창을 실제로 화면에 올리지 않아도(`show()`/`showInactive()`를 호출하지 않아도) 전부 통과했다. 단 "창이 보이는지"를 묻는 단언(`isVisible()`)은 가짜 가시성 상태로 받쳐야 한다. 권고는 맨 아래.

## 1. 현황 (저장소)

- d2903f6 **[사실]**: `--data-dir` 실행이면 `ready-to-show`에서 `win.showInactive()`(`src/main/index.ts:227`), `app.dock?.hide()`(`:245`), `showMainWindow`도 `showInactive()`(`:595-606`). `e2e/residency.spec.ts:66,75`의 Dock 단언이 `false`로 바뀜.
- 창 생성은 이미 `show: false` 후 `ready-to-show`에서 표시(`src/main/index.ts:181,227`). 종 재생기 창은 영구히 숨김(`src/main/bell-player.ts:55`), 강아지 창은 `show:false` + `backgroundThrottling:false` + `focusable:false` + `type:'panel'`(`src/main/roaming-dog.ts:62-83`), 그리기 루프에서 `win.showInactive()`(`:257`).
- Playwright 설정은 `playwright.config.ts`(workers 1, 30초). 모든 스펙이 `_electron.launch({ args: [루트, '--data-dir=…'] })`로 띄움(예: `e2e/accessibility.spec.ts:36`).
- 창 표시·포커스·화면에 의존하는 단언 **[사실]**:
  - `isVisible()`: `e2e/residency.spec.ts:35`, `auto-start.spec.ts:37`, `bell-playback.spec.ts:35,113,154`, `roaming-dog.spec.ts:56,119`, `update.spec.ts:236`
  - `isFocused()`/`getFocusedWindow()`와 blur 횟수: `roaming-dog.spec.ts:57,533,545-568` (앱 창이 포커스를 잃지 않는지)
  - `app.dock?.isVisible()`: `residency.spec.ts`, `auto-start.spec.ts:89`
  - 주 모니터 `screen`·창 `getBounds()`: `roaming-dog.spec.ts`(바닥 가운데 배치), `window-bounds.spec.ts`
  - 스크린샷: Playwright `page/locator.screenshot`(`dog.spec.ts`, `update.spec.ts`, `roaming-dog.spec.ts`는 `omitBackground`)
  - 트레이는 `Tray.prototype` 스파이로 확인하며 실제 메뉴바를 보지 않음(`residency.spec.ts:159-208`).

## 2. 공식 자료

- Electron에는 헤드리스 모드가 문서화돼 있지 않고 "Electron은 Chromium 기반이라 디스플레이 드라이버가 필요"하며 CI에서는 Xvfb 같은 가상 디스플레이를 쓰라고 한다 **[사실]** https://www.electronjs.org/docs/latest/tutorial/testing-on-headless-ci (xvfb-maybe가 Linux 헤드리스에서 `xvfb-run`과 같다고 주석으로만 언급).
- `ready-to-show`: "Emitted when the web page has been rendered (while not being shown) and window can be displayed without a visual flash." 즉 표시하지 않아도 그려진다. `paintWhenInitiallyHidden`: "Whether the renderer should be active when `show` is `false` and it has just been created"(기본 동작은 활성, `false`면 `ready-to-show`가 안 옴) **[사실]** https://www.electronjs.org/docs/latest/api/browser-window
- `backgroundThrottling`: "Whether to throttle animations and timers when the page becomes background." Page Visibility API에도 영향 **[사실]** 같은 문서. 이 앱은 강아지 창만 `false`.
- `showInactive()`: "Shows the window but doesn't focus on it." Wayland(Linux) 미지원 **[사실]** 같은 문서.
- 오프스크린 렌더링: `webPreferences.offscreen: true`, `paint` 이벤트로 비트맵을 받음. 창은 항상 프레임 없음. 소프트웨어 모드는 `app.disableHardwareAcceleration()`. 페이지가 유휴면 프레임이 생성되지 않음. 물리 디스플레이가 필요한지는 문서가 말하지 않음 **[사실]** https://www.electronjs.org/docs/latest/tutorial/offscreen-rendering
- macOS `app.setActivationPolicy('regular'|'accessory'|'prohibited')`: accessory는 Dock에 안 보이되 활성화 가능, prohibited는 "may not create windows or be activated" **[사실]** https://www.electronjs.org/docs/latest/api/app (prohibited는 창을 못 만들므로 e2e에는 부적합 **[추정]**).
- Playwright 가시성: "non-empty bounding box and does not have `visibility:hidden` computed style". 창이 화면에 올라와 있는지는 정의에 없음 **[사실]** https://playwright.dev/docs/actionability. 문서는 창의 화면 표시 여부를 따로 말하지 않으므로, 실제 동작은 아래 실험으로 확인.
- 숨김 창에서의 `document.visibilityState`, rAF, 타이머, IntersectionObserver 동작은 이번에 1차 문서로 확인하지 못함 **[검증 안 함]**. 대신 실험으로 앱 동작을 봤다.

## 3. 직접 실험

방법: `git worktree`(HEAD=d2903f6)에 `node_modules` 심링크, `src/main/index.ts`에 임시 코드만 추가(저장소 원본은 건드리지 않았고 worktree는 삭제함). 환경변수 `DDD_HEADLESS=1`이면 `BrowserWindow.prototype.show/showInactive/hide/isVisible`을 교체: **실제로 창을 화면에 올리지 않고** 메모리상 "보임" 플래그만 유지(`show` · `hide` 이벤트도 발생). Electron `electron-vite build` 후 `npx playwright test`.

| 실험 | 결과 |
|---|---|
| A. `show`/`showInactive`를 단순 no-op (isVisible은 실제값=항상 false) | app-shell, accessibility, timetable, dog, status, period-editing, data-wipe, window-bounds, update 일부 등 **62/72 통과**. 실패 10건은 전부 `isVisible()==true`를 기대하는 단언(auto-start 2, residency 7, update 1) |
| B. 가짜 가시성 플래그 추가 | 위 실패 3개 스펙 17건 **전부 통과** |
| C. bell-screen, bell-playback, roaming-dog (B 방식) | **24/24 통과** (4.7분, 대부분 종 시각을 기다리는 시간) |

합계: 실험 A에서 통과한 62건 + 실험 B 17건 + 실험 C 24건 = 103건 항목이 통과했고, 이 중 A·B의 스펙 일부는 겹쳐 실행했다. 단 같은 가짜 가시성 설정으로 14개 스펙 전체를 한 번에 돌린 일괄 실행은 하지 않았다. 스크린샷 테스트(고리 안 강아지, 강아지 창 `omitBackground`, 모달)도 숨김 상태에서 통과해, 화면에 올리지 않아도 렌더러가 그려진다는 점이 확인됨. 숨김 종 재생기가 원래부터 동작하는 것(`bell-playback`)과도 일치.

**주의(실험의 한계)**:
- 실험은 macOS 데스크톱 로그인 세션 안에서 한 것이다. 창은 화면에 안 올렸지만 Electron 프로세스는 WindowServer에 접속했다. GUI 세션이 없는 SSH/CI macOS에서의 동작은 **[검증 안 함]**.
- 가짜 `isVisible()`로 통과한 단언은 "앱 코드가 `show/hide`를 올바른 때 불렀다"만 증명한다. 실제 창이 화면에 놓였는지·가려졌는지는 증명하지 않는다.
- `roaming-dog` 마지막 테스트(앱 창이 포커스를 잃지 않는다)는 창이 포커스를 가질 일이 없어 **실질 검증력이 떨어진다**(통과가 공허). `type:'panel'`, `setAlwaysOnTop('pop-up-menu')`, 전체 화면 앱 위 표시, 실제 모니터 위치의 시각 확인은 헤드리스로 검증되지 않는다. macOS 트레이 실제 아이콘, Dock 복귀 실물, 동작 줄이기 같은 OS 설정은 `emulateMedia`로 에뮬레이트하는 부분만 검증된다.
- 오프스크린(`offscreen: true`)과 Linux xvfb는 실행하지 않았다 **[검증 안 함]**.

## 4. 선택지 비교

| 선택지 | 화면 | 깨질 위험 | 구현 비용 | 비고 |
|---|---|---|---|---|
| (a) `show:false` 유지 + 가짜 가시성 | 전혀 안 뜸(창 프로세스는 존재) | `isVisible`·`dock.isVisible` 단언은 가짜 플래그에 의존. 포커스/blur 단언(`roaming-dog.spec.ts:533~`)은 공허해짐. 강아지 창 실제 배치·`panel` 레벨 검증 불가 | 낮음: 메인에 헤드리스 플래그 약 10줄(테스트 전용 분기는 `customDataDir`처럼 이미 쓰는 패턴), 또는 `e2e`에서 `electron.launch`의 `env`로 켬 | 실험 B로 96건 통과 **[실험]** |
| (b) offscreen rendering | 안 뜸 | 창이 프레임 없음 고정, 수업 창 크기 · 최소 크기(`minWidth` 등) · 제목 표시줄 · `useContentSize` 의미가 달라짐(추정). 페이지가 유휴면 프레임 없음 → 스크린샷/rAF 타이밍 영향. 투명 강아지 창 · `panel` · 캡처 방식 변경 | 높음: 프로덕션과 다른 렌더 경로를 테스트하게 됨 | 실험 안 함 **[검증 안 함]**. 이 앱에는 권하지 않음 |
| (c) Linux xvfb (CI) | 가상 디스플레이 | macOS 전용 동작(Dock, `panel`, 트레이, `showInactive` Wayland 제한)이 달라 `process.platform === 'darwin'` 분기는 건너뜀. 자동 시작 · 트레이 · 소리(오디오 장치 없음) 의존 테스트 위험 | 중간: CI 워크플로 + `xvfb-run -a npx playwright test`. Linux 빌드 대상이 아니면 얻는 것이 적음 | 문서 근거 **[사실]**, 실행은 **[검증 안 함]**. 이 앱은 Windows/macOS 대상(README) → 실사용 플랫폼과 달라 가치 낮음 **[추정]** |
| (d) 현행 `showInactive()` + Dock 숨김 | 창은 뜨지만 포커스를 안 뺏음 | 거의 없음: 실제 창을 검증함 | 이미 적용 | 창이 화면에 보이긴 함. 다른 창을 가릴 수는 있음 |

## 5. 권고

**(d)를 기본으로 유지하고, 선택적으로 (a)를 "빠른 헤드리스 모드"로 추가**한다. 이유: (a)는 비용이 낮고 96건 통과했으나, 창 표시·포커스·배치처럼 이 앱의 핵심 위험(상주, 강아지 창, 종 시점의 포커스)을 검증력 약하게 만든다. 따라서 환경변수(예: `DDD_E2E_HIDDEN=1`)로만 켜고, 릴리스 전 확인과 전체 `npm run check`는 (d)로 돌리는 것이 안전하다. 먼저 구현한다면 순서: (1) 가짜 가시성은 `customDataDir` 분기와 같은 곳(메인 창 생성 직전)에 두고 테스트 전용임을 주석으로 남긴다. (2) 포커스 단언이 공허해지는 `roaming-dog` 마지막 테스트는 헤드리스 모드에서 건너뛴다. (3) GUI 세션 없는 macOS에서 되는지 별도로 검증한다. 구현은 사용자 승인 후.

## 6. 후속 실험과 채택: 투명 창 방식 (2026-11-18)

(a)의 가짜 가시성은 창 상태를 가짜로 만든다는 약점이 있어, 창을 진짜로 두고 눈에만 안 보이게 하는 방식을 따로 실험했다.

- 방법: `DDD_HEADLESS=1`이면 `browser-window-created`마다 `win.setOpacity(0)`, `win.setIgnoreMouseEvents(true)`만 적용. `show`/`isVisible`은 바꾸지 않음. 임시 worktree에서 전체 e2e 실행.
- 결과 **[실험]**: 96건 중 95건 통과(7.2분). 실패 1건은 `roaming-dog.spec.ts`의 "앱 창은 포커스를 잃지 않는다" 단언(기준 시점의 포커스 창이 `null`). 앞서 (a)에서 실패하던 `isVisible()` 단언들은 진짜 창 상태로 모두 통과.
- 채택: `src/main/headless.ts`의 `isHeadlessRun`(`--data-dir` 실행이면서 `DDD_HEADLESS=1`)이 참일 때 위 두 설정을 적용한다. 실제 앱에는 영향이 없다. `npm run test:e2e:headless`로 실행하고, 포커스 단언이 성립하지 않는 위 테스트 1건은 이 모드에서 건너뛴다. 구현 후 일반 실행 96건, 헤드리스 실행 95건 통과 + 1건 건너뜀.
- 남은 한계: 화면에 실제로 안 보이는지는 사용자 눈 확인이 필요하다. GUI 세션 없는 macOS(SSH · CI)에서는 검증하지 않았다. `setOpacity`와 `type: 'panel'` 강아지 창의 조합은 e2e가 통과했지만 실제 투명도 적용은 눈으로 확인하지 못했다.
