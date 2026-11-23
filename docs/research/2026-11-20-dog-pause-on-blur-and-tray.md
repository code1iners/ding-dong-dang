# 강아지를 "포커스를 잃을 때 · 닫은 뒤" 멈추는 제안 검토

조사일 2026-11-20. 기준: 딩동댕 0.2.1(`main` 630c6c6), Electron 45.3.3(`node_modules/electron/electron.d.ts` = 공식 API 문서 원본), macOS 27.2 / Apple M5 Pro.
표기: **[사실]** 1차 자료(공식 문서·소스) 또는 저장소 코드로 확인, **[실험]** 이번에 직접 돌려 확인, **[추정]** 근거 없이 추론, **[검증 안 함]**.
2차 자료(블로그·SO)는 쓰지 않았다. 직전 조사: `docs/research/2026-11-20-dog-animation-cpu.md`.

## 결론

### (a) CPU 절감 추정

강아지 창이 계속 그릴 때 약 15%/코어(이번 프로브, 부하 100~260), 멈추면 0.0% 근처다 **[실험]**. 절감량은 "얼마나 자주 멈춰 있느냐"에 비례한다.

| 상태 | 프로브 실측 (코어 1개 기준 %) |
| --- | --- |
| 계속 60번 (현재) | 15.4~15.9 |
| 30번 | 9.1 |
| 10번 | 3.4~3.7 |
| 5번 | 2.2 |
| 그리기 중지(첫 자세 한 장, 타이머 없음) | 0.0 |
| 창을 보였다가 `hide()` + `backgroundThrottling:false`(현재 설정) | 15.0 (멈추지 않음) |
| 창을 보였다가 `hide()` + `backgroundThrottling:true` | 0.0~0.1 |

- **제안 1(포커스 잃으면 멈춤)**: 어떤 정의를 쓰든 "멈춘 시간 비율 × 약 15%"다. 메인 창 blur로 정의하면 사실상 앱을 쓰지 않는 거의 모든 시간이 멈춤이라 절감이 크지만(평소 대부분의 시간 약 15% → 0%), 강아지가 보이는 채 얼어붙는다. 이 비율은 사용 패턴이라 측정하지 못했다 **[검증 안 함]**.
- **제안 2(닫은 뒤 멈춤)**: 닫기 후 강아지 창이 계속 보이므로, 멈추면 "보이는 강아지가 얼어붙음"이고 숨기면 "강아지가 사라짐"이다. 사용자가 앱을 닫은 채 쓰는 시간이 대부분일 것이라 절감 폭은 제안 1과 거의 같다 **[추정]**.
- **정정(직전 문서 §3 `hidden-svgattr60` 12.0%, §1-6)**: 그 실험은 창을 한 번도 `show` 하지 않은 채 `hide()`를 불러 숨김이 아니었다. 제대로 보였다가 숨기면 `backgroundThrottling:false`일 때 15.0%로 계속 그리고, `true`일 때 0.0%로 멈춘다 **[실험]**. 직전 문서의 "hide해도 안 줄어든다"는 결론은 현재 설정(`false`) 아래에서는 맞았지만 근거 실험이 잘못됐다.

### (b) 채택 / 수정 / 비권장

| 제안 | 판정 | 이유 |
| --- | --- | --- |
| 1. 포커스 잃으면 다시 그리지 않기 | **비권장(그대로는)**. "다른 앱이 맨 앞" 신호로 멈추는 것은 제품 목적과 충돌. 대신 **수정안**: 프레임 낮추기 + 입력 없음(idle) 때 멈추기 | 강아지 창은 `focusable:false`라 앱이 포커스를 가진 적이 없다(§2). 메인 창 blur로 정의하면 평소 거의 항상 "잃은 상태"이고, 강아지는 다른 앱을 쓰는 동안 보이는 것이 제품 목적이라 얼어붙은 장식이 된다(§2.3) |
| 2. 닫은 뒤 다시 그리지 않기 | **수정 후 채택**: "닫았다"가 아니라 "창이 안 보인다"(`hide()`, 설정 꺼짐, 가려짐)일 때 렌더러가 멈추게 한다. 닫은 뒤에도 보이는 강아지는 건드리지 않는다 | 닫은 뒤 보이는 강아지를 멈추면 제안 1과 같은 문제. 반면 지금 설정에서는 **숨긴 강아지 창도 15%를 쓴다**(§3). 이것이 가장 확실한 낭비다 |

### (c) 권고 구현 순서와 가장 싼 검증

1. **숨긴 창은 렌더러도 멈추기**(가장 확실, 제품 동작 불변). `win.hide()`하는 경로(`roaming-dog.ts:212-220`)에서 `paused`와 같은 방식으로 `sendView({paused:true})`를 보내거나 숨길 때만 `backgroundThrottling`을 켠다. 검증: 앱을 `roamingDog:false`로 두고 `ps` 누적 CPU 증가를 본다(0이어야 한다).
2. **idle 프레임 낮추기**: `powerMonitor.getSystemIdleTime()` 폴링(예: 5초마다)으로 N분 입력이 없으면 평소·졸림만 5~10번으로. 보이는 채 움직임이 남아 얼어붙어 보이지 않는다. 사용자 결정(60 유지, 기준 약 20%) 변경이 필요하니 확인받는다.
3. 전체화면 앱 위 · 다른 앱이 맨 앞일 때 멈추는 것은 하지 않는다(§2).

가장 싼 검증 실험(이미 이번에 한 것): `prototypes/dog-pause-probe/`의 `hide-svgattr60`(15.0%) 대 `hide-throttle-svgattr60`(0.0%) 대비. 앱 본체에서는 1번을 적용한 빌드에서 `roamingDog:false`일 때 렌더러 pid 누적 CPU가 늘지 않는지 `ps`로 확인하면 끝난다.

## 1. 코드 사실 재확인

- 강아지 창: `transparent`, `focusable:false`, `type:'panel'`(darwin), `alwaysOnTop` `pop-up-menu`, `setVisibleOnAllWorkspaces(...visibleOnFullScreen)`, `backgroundThrottling:false` **[사실]** (`src/main/roaming-dog.ts:55-83`, `:92-94`).
- 닫기는 앱 창만 숨기고 강아지 창은 둔다 **[사실]** (`src/main/index.ts:589-592` `hideMainWindow`, `e2e/roaming-dog.spec.ts:119-122`).
- 그리기: 메인 `setTimeout(update, 1000/framesPerSecond)`(`roaming-dog.ts:259`)와 렌더러 `setInterval(draw, …)`(`dog-window.ts` `schedule()`) **[사실]**. 둘 다 `paused`일 때만 멈춘다. 메인은 `if (!paused) tickTimer = …`, 렌더러는 `if (!view || view.paused) return`(첫 자세를 한 번 그리고 타이머 없음) **[사실]**.
- `paused`의 원인은 `power.locked || power.asleep` 둘뿐이다(`roaming-dog.ts:325-340`) **[사실]**.
- **숨은 강아지도 그린다 [사실, 코드 읽기]**: 설정이 꺼진 채 종이 안 울리면 `update()`가 `hide()`하고 `return`한다(`:236-240`). 이때 `sendView`가 불리지 않아 렌더러의 마지막 `view`(`paused:false`)가 그대로라 `setInterval`이 돈다. `backgroundThrottling:false`라 스로틀도 없다. 프로브로 같은 조건의 비용을 쟀다(§3). 실제 앱에서 이 경로의 CPU는 재지 않았다(이번에 사용자 앱이 실행 중이 아니어서 읽기 전용 관찰도 못 함) **[검증 안 함]**.

## 2. "포커스를 잃음"의 정의

### 2.1 각 후보가 실제로 감지하는 것

| 정의 | 쓸 수 있는 API | 실제로 감지하는 것 |
| --- | --- | --- |
| (a) 메인 창 blur | `BrowserWindow` `'blur'` "Emitted when the window loses focus." | 앱 창 하나의 키 창 여부. 앱 창이 숨겨져 있으면(트레이 상주) 이미 항상 포커스 없음. 강아지 창은 무관 **[사실]** (`electron.d.ts:2597-2599`) |
| (b) 다른 앱이 맨 앞 | `app` `'did-resign-active'` "Emitted when the app is no longer active and doesn't have focus … clicking on another application or … App Switcher"(`@platform darwin`) | macOS 앱 단위 활성 여부. 다만 이 앱은 **트레이 상주 · Dock 숨김** 상태(`index.ts:591`)가 일상이라 앱이 활성인 시간이 거의 없다. `focusable:false` 패널은 앱을 활성으로 만들지 않는다 **[사실]** (`electron.d.ts:568-574`; e2e가 앱 창 blur 0회를 단언 `roaming-dog.spec.ts:570-580`) |
| (c) 다른 앱이 전체화면 | 해당 API 없음 | `electron.d.ts`에서 다른 앱의 전체화면을 알려 주는 API를 찾지 못했다(`isFullScreen()`은 자기 창 것). NSWorkspace 알림은 `systemPreferences.subscribeWorkspaceNotification`으로 받을 수 있다고 문서에 있으나(`electron.d.ts:15250-15274`) 전체화면 판정용 알림이 무엇인지는 확인하지 않았다 **[검증 안 함]**. 이 앱은 오히려 전체화면 앱 위에도 뜨도록 만들었다(`visibleOnFullScreen`) **[사실]** |
| (d) 사용자 idle | `powerMonitor.getSystemIdleTime()` "Calculate system idle time in seconds."; `getSystemIdleState(threshold)` → `active/idle/locked/unknown` | 시스템 전체 입력 없음 시간. 이벤트가 아니라 폴링해야 한다. 화면이 꺼지거나 디스플레이만 잠드는 이벤트는 `powerMonitor`에 없다(문서에 `suspend`, `lock-screen`만) **[사실]** (`electron.d.ts:11796-11811`, https://www.electronjs.org/docs/latest/api/power-monitor) |

### 2.2 함정

- **강아지는 포커스를 받은 적이 없다 [사실]**: `focusable:false` + e2e가 "강아지 창 `focused:false`"와 "앱 창 blur 0회"를 단언한다(`roaming-dog.spec.ts:104`, `:570`). 그래서 "포커스를 잃음"은 강아지에게 아무 의미가 없고, 메인 창 blur를 쓰면 **일상적인 상태 거의 전부**가 "잃음"이 된다.
- **e2e 환경**: 자동 검증은 앱 창을 `showInactive()`로 띄워 포커스를 받지 못한다(`index.ts:222`, e2e 주석 "헤드리스 실행에서는 앱 창이 포커스를 받지 못한다" `spec:497-499`). blur/resign 기반 멈춤은 e2e 전체에서 강아지를 영구 정지시켜 걷기·자세 변화 단언을 깬다(§5).

### 2.3 제품 트레이드오프

- 강아지는 돌아다니는 데스크톱 펫이라 다른 앱을 쓰는 동안 보이는 것이 존재 이유다 **[추정: 제품 의도]**. 보이는 채 멈추면 "얼어붙어 보이는" 결함으로 읽힌다(특히 `idle`의 숨쉬기, `walk` 중간 정지). 이 앱은 걷는 강아지의 `hop`/`walk` 모션이 있어 정지 자세가 부자연스러울 수 있다 **[추정]**.
- 종이 울리는 동안은 강아지가 `happy`로 신호를 준다(`roaming-dog.ts:172`, `ringing`). 포커스 기준으로 멈추면 종이 울려도 강아지가 얼어붙는다. 멈춤은 `ringing`·`summoned`에서 풀어야 한다 **[사실: 코드 경로]**.

### 2.4 대안 비교

| 방식 | CPU **[실험]** | 얼어붙어 보임 | 비고 |
| --- | --- | --- | --- |
| 계속 60번(현재) | 15.4~15.9 | 없음 | 사용자 결정 |
| 평소·졸림 30번 | 9.1 | 거의 없음 | 직전 문서의 권고 |
| 평소·졸림 10번 | 3.4~3.7 | 숨쉬기는 계단식이 될 수 있음 **[추정, 눈으로 안 봄]** | idle일 때만 적용하면 눈에 덜 띔 |
| 5번 | 2.2 | 눈에 띔 **[추정]** | |
| 완전 정지(한 장) | 0.0 | 있음 | 잠금·잠자기에는 이미 이렇게 한다 |
| 숨은 창은 정지 | 0.0 | 없음(안 보임) | §3. 제품 동작 불변 |

가장 조심스러운 조합은 "보이는 동안은 지금대로, 숨기면 정지, 오래 입력이 없으면 10번으로 낮춤"이다.

## 3. 숨긴 창에서 합성·타이머가 멈추는가

**실험** **[실험]**: `prototypes/dog-pause-probe/`(`dog-cpu-floor-probe`를 복사해 수정. 앱 소스 무변경). 앱과 같은 투명 panel 창을 `showInactive()`한 뒤 1초 뒤 `hide()`하고, 8초 예열 뒤 12~25초 동안 프로세스 트리 누적 CPU를 쟀다. 5초마다 타이머 · rAF 실행 횟수와 `document.visibilityState`를 파일에 남겼다. 부하 평균은 100~260으로 매우 높았다.

| 모드 | CPU % | visibilityState | 타이머/rAF |
| --- | --- | --- | --- |
| hide + 스로틀 끔 + setInterval 60 | 15.0 | `visible` | 60/초 그대로 |
| hide + 스로틀 끔 + rAF | 23.2 | `visible` | 약 120/초(주사율) |
| hide + 스로틀 켬 + setInterval 60 | 0.0 | `hidden` | 약 1/초로 줄어듦 |
| hide + 스로틀 켬 + rAF | 0.0 | `hidden` | 멈춤 |
| 일반 창(`type` 없음) hide + 스로틀 켬 | 0.0 | `hidden` | 위와 같음 |
| 숨기지 않음, 스로틀 끔 | 15.4~15.9 | `visible` | 60/초 |

- **[사실]** 문서: "If `backgroundThrottling` is disabled, the visibility state will remain `visible` even if the window is minimized, occluded, or hidden."(https://www.electronjs.org/docs/latest/api/browser-window, "Page visibility"). 위 실험이 이를 확인한다.
- **[사실]** 문서: 가시 상태는 hidden/minimized를 따라가고, macOS에서는 완전히 가려지면(occlusion)도 `hidden`이 된다. `show:false`로 만든 창의 초기 상태는 실제로 숨겨져 있어도 `visible`이다.
- **함정 [실험]**: 한 번도 `show`하지 않은 채 `hide()`를 불러서는 상태가 바뀌지 않아 숨김 실험이 무효가 된다(직전 문서가 걸린 지점).
- **[검증 안 함]**: Chromium의 background timer throttling 규칙(1Hz, intensive throttling)과 macOS occlusion 구현은 소스로 확인하지 않았다. 타이머가 약 1/초로 줄어든 것은 이번 실험에서 본 값이다. Chromium 소스 요청은 이번에 시도하지 않았다.
- **이 앱에 주는 뜻**: (1) 현재 `false`라서 `hide()`된 강아지 창(설정 끔, 종 재생 뒤)이 계속 그린다. (2) 이 앱이 `false`로 둔 이유는 "창이 가려지거나 앱이 뒤에 있어도 그리기 횟수를 지킨다"(`roaming-dog.ts:81`)인데, `pop-up-menu` 레벨이라 가려지지 않으므로 `true`로 바꿔도 보이는 동안은 영향이 작을 수 있다. 다만 macOS의 전체화면 앱 위 · 가림 판정이 다른 데서 어긋날 수 있어 `true`로 바꾸는 것은 검증 없이 권하지 않는다 **[추정]**.

## 4. 제안 2(닫은 뒤)의 의미

- "닫기"는 메인 창만 숨기고(`index.ts:589-592`) 강아지 창 상태와 무관하다. 닫기 이벤트에 `paused`를 걸면 강아지 창은 **보이는 채 정지**한다. 숨기지 않은 채 멈추는 것은 사용자에게 "고장난 강아지"다.
- 숨기면 "강아지가 사라진다"는 별개의 제품 결정이다. 사용자가 닫은 뒤에도 강아지를 보고 싶어 한다는 e2e 단언(`spec:96`, 제목 "앱 창을 숨겨도 남는다")이 이 앱의 확정 동작이다 **[사실]**.
- 그래서 제안 2에서 CPU를 확실하게 줄이는 부분은 "닫기"가 아니라 **"실제로 안 보이는 창"** 이다(설정 끔, 종 재생 뒤 `hide()`): 코드 경로 §1, 효과 15% → 0%(§3).

## 5. 구현 경계

### 5.1 `paused`를 거는 자리

- 지금은 `setPower`(`roaming-dog.ts:325-340`)가 `paused`를 바꾸고 `clearTimeout(tickTimer)`, `setHitTesting(false)`, `sendView`를 한다. 재개는 `update()`다. 새 원인(예: idle, 숨김)을 더하려면 `power`에 키를 하나 더하고 `next = Object.values(power).some(Boolean)`처럼 합치면 같은 경로를 쓴다.
- 숨김 경로(`hide()` `:212`)는 `sendView`를 부르지 않아 렌더러가 안 멈춘다. 여기서 `paused:true`를 보내거나(권장) `backgroundThrottling`을 켠 창을 쓴다. 다시 보이는 `showInactive()`(`:257`) 직전에 `paused:false`를 보내야 한다. 현재 `update()`가 `sendView(data)` 뒤 `showInactive()` 순서라 자연스럽다.

### 5.2 재개 때 상태 복구

- 현재 멈춘 동안은 `dog = {...dog, at: now}`로 시각만 넘긴다(`:244-246`) **[사실]**. 그래서 재개 시 걸은 만큼 순간이동하지 않는다.
- `phase.until`과 `pettedUntil`은 절대 시각이라 멈춘 동안 만료된다. `phase`는 `MAX_STEP_MS`보다 많이 늦으면 `start = now`로 새로 시작한다(`src/shared/roaming-dog.ts:139`) **[사실]**. 만료된 `pettedUntil`은 신남이 자연히 끝난다. 큰 문제 없음 **[추정: `stepDog` 전체는 읽지 않았다]**.
- 끌기 중(`dog.hold`)에 숨기는 경로는 `letGo()`로 놓는다(`:214`). 같은 처리를 새 멈춤 원인에도 해야 클릭을 계속 받지 않는다(`setHitTesting(false)`가 이미 `paused` 경로에 있음).
- 렌더러는 `started`(동작 시작 시각)를 `performance.now()` 기준으로 쓴다. 숨긴 동안 `started`는 그대로이므로 재개 후 모션 위상이 점프할 수 있다 **[추정]**. 보이는 자세가 한 번 튀는 정도.
- `ringing`이나 `summoned`(설정 끈 채 종이 울려 나타남)이면 멈춤 원인이 있어도 풀어야 한다 **[사실: §2.3]**.

### 5.3 기존 e2e와 충돌할 지점

| 위치 | 충돌 |
| --- | --- |
| `e2e/roaming-dog.spec.ts:96-122` | 앱 창을 닫은 뒤 `dogWindow().visible === true`. 닫기를 멈춤·숨김 원인으로 걸면 즉시 깨진다. (`paused`만 걸고 창은 둘 경우 `visible`은 유지) |
| `:138` 걷는 테마 단언, `:255` 끌기·낙하 단언, `:466-494` 그리기 정지 단언(`data-paused`, 자세 변화) | 앱 창이 포커스를 받지 못하는 자동 검증에서 blur/resign 기반 `paused`는 처음부터 참이라 "움직이는지" 단언이 모두 깨진다 |
| `:466-494` | `lock-screen`/`suspend` 조합 단언은 `power` 키를 더해도 유지돼야 한다. 새 원인은 따로 두고 `data-paused`가 합산 결과를 내야 한다 |
| `:496-582` 종 · blur 단언 | `test.skip(isHeadlessEnv(...))`로 헤드리스에서 건너뛴다. 포커스 기반 멈춤을 넣으면 "앱 창 blur 0회" 기록과 `app.focus({steal:true})` 순서가 새 이벤트를 흔들 수 있다 |
| 헤드리스 `DDD_HEADLESS=1` (`index.ts:240-245`) | 모든 창을 `setOpacity(0)`로 두므로 투명도 0의 창이 occlusion·visibility로 어떻게 판정되는지 모른다 **[검증 안 함]**. `backgroundThrottling`을 `true`로 바꾸면 헤드리스에서 가시 상태가 `hidden`이 되어 e2e의 타이머가 1Hz로 떨어질 위험이 있다 **[추정]** |
| `dog-window.ts` `schedule()` | `view.paused`만 본다. 렌더러는 새 원인을 몰라도 되게 메인이 `paused`로 합쳐 보내는 편이 e2e 변경이 작다 |

## 6. 이 문서의 한계

- 모든 실험이 부하 평균 100~260의 매우 바쁜 머신이다. 모드당 12~25초 단일 표본이라 몇 %p 차이는 오차로 본다. 다만 0.0% 대 15%, 타이머 60/초 대 약 1/초의 대비는 방향이 분명하다. 부하가 낮을 때 반복이 필요하다.
- 사용자의 /Applications/딩동댕.app은 이번에 실행 중이 아니어서 읽기 전용 관찰도 하지 못했다. 실제 앱의 숨김 경로 CPU는 재지 않았다.
- Chromium 소스(타이머 스로틀 규칙, macOS occlusion)와 Electron C++ 소스는 이번에 읽지 않았다. Electron 공식 문서(`electron.d.ts`와 웹 문서)만 근거다.
- 다른 앱 전체화면 감지, 디스플레이 꺼짐 감지는 확인하지 못했다. Windows는 보지 않았다.
- 프로토타입 `prototypes/dog-pause-probe/`는 버리는 코드이며 커밋하지 않는다.

## 권고

1. 제안 1은 그대로 채택하지 않는다. 메인 창 blur · 앱 활성 여부는 이 앱에서 "항상 포커스 없음"이라 강아지를 영구히 얼린다.
2. 제안 2는 "닫기"가 아니라 "창이 실제로 안 보이는 때"로 바꿔 채택한다. 숨긴 창이 15%를 쓰는 것이 가장 확실한 낭비이고, 제품 동작을 바꾸지 않는다.
3. 더 줄여야 하면 "입력이 오래 없을 때 평소·졸림을 10번으로"를 사용자에게 제안한다. 60 유지 결정과 충돌하므로 확인받는다.
4. 구현할 때는 `paused`를 합쳐서 렌더러에 보내고(`ringing`·`summoned`은 예외), e2e의 닫은 뒤 `visible`·헤드리스 걷기 단언을 먼저 확인한다.
