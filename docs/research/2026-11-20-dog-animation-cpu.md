# 강아지 애니메이션 CPU 비용은 어디서 오는가

조사일 2026-11-20. 기준: 딩동댕 0.2.1(`main` 630c6c6), Electron ~45.3.3, macOS 27.2.1 / Apple M5 Pro, 설치된 /Applications/딩동댕.app.
표기: **[사실]** 1차 자료(공식 문서·소스) 또는 저장소 코드로 확인, **[실험]** 이번에 직접 돌려 확인, **[추정]** 근거 없이 추론, **[검증 안 함]**.
출처가 1차가 아닌 것은 "2차"로 적었다. 이번에 2차 자료는 쓰지 않았다.

## 결론

### (a) 원인 순위

1. **돌아다니는 강아지 창이 초당 60번 화면을 새로 내보내는 것 자체(프레임 제시 비용).** 이 비용은 그림 내용과 거의 무관한 바닥값이다. 같은 투명 패널 창에서 점 하나(2px)만 60Hz로 옮겨도 8.1%, JS 없이 합성기가 도는 CSS 키프레임이어도 5.1%였고, 아무것도 움직이지 않으면 0.0%였다 **[실험]**. 이 앱의 "5% 이하" 기준은 60Hz에서는 이 바닥값 근처라 그림 방식만으로는 달성하기 어렵다 **[추정]**.
2. **그 위에 얹히는 SVG 부위별 `transform` 속성 갱신(렌더러 메인 스레드 스타일·페인트·커밋 + GPU 래스터).** 같은 창에서 SVG 요소마다 `setAttribute('transform')`을 60Hz로 쓰면 12.1 / 12.6 / 16.2%(세 번), 점 하나(8.1%)보다 약 4~8%p 높았다 **[실험]**. 실제 앱 실측(GPU 7.2 + 렌더러 6.5 = 약 14%)과 비슷한 크기다 **[실험]**.
3. **그리기 횟수 자체(60).** 1·2번을 합친 비용이 횟수에 거의 비례한다. 같은 SVG 방식에서 15번 4.1%, 30번 7.3%, 60번 12~16% **[실험]**. 28번 티켓의 횟수별 표도 같은 방향이다 **[사실]** (`.scratch/class-bell-app/issues/28-roaming-dog-window-verification.md` "CPU" 표).
4. **투명 창 합성 자체.** 불투명 창 11.1% 대 투명 창 12.1~16.2%로 차이가 노이즈 안이다 **[실험]**. 지배 원인은 아니다(단, 이번 불투명 실험은 일반 불투명 패널 한 번뿐이라 약한 증거 **[추정]**).
5. **이미지 디코딩 · GIF/APNG 디코딩.** 해당 없음. 강아지는 래스터 이미지가 아니라 인라인 SVG를 DOM 속성으로 움직인다 **[사실]** (`src/renderer/src/dog/rig.ts` `pose()`, `themes.ts`의 `?raw` SVG).
6. **숨김 · 가려짐 때 계속 그리기.** `backgroundThrottling:false`라서 창을 `hide()` 해도 같은 비용(12.0%)을 계속 쓴다 **[실험]**. 앱은 화면 잠금 · 잠자기에서만 멈춘다 **[사실]** (`src/main/roaming-dog.ts` `power`, `paused`). 그러나 강아지 창은 `pop-up-menu` 레벨이라 가려지는 일이 드물어 실사용 비중은 낮다 **[추정]**.

### (b) 권고 순서

사용자가 2026-11-20에 "60 유지, 기준 약 20%"로 결정했다 **[사실]** (`.scratch/timetable-redesign/issues/07-dog-60fps.md` Comments, `spec.md:210`). 그 결정을 뒤집지 않는 것부터 적는다.

1. 지금 방식 유지 + 아무 것도 안 해도 되는 것 확인: 이번 실측은 14%(이전 22%)로 결정한 기준 안이다. 다만 부하 28~38 환경이라 절대값은 불확실하다.
2. 비용이 안 드는 방어 추가(횟수는 그대로 60): (i) 다른 창이 강아지 창을 완전히 덮거나 사용자가 일정 시간 입력이 없을 때 멈추기 등 "그릴 필요 없을 때 멈추기" 조건을 더한다. 효과는 실험하지 못했고 사용 패턴에 달렸다 **[검증 안 함]**. (ii) 멈춘 동안은 0.7~1.1%까지 떨어진다 **[사실]**(28번 표, "정지" 행).
3. 수치를 줄이고 싶다면 가장 큰 레버는 횟수다: 평소 · 졸림만 30으로(이 둘이 하루 대부분) 하면 SVG 방식 기준 12~16% → 약 7%로 줄 것으로 본다 **[실험]**. 이는 사용자 결정(전 동작 60)과 충돌하므로 사용자 확인이 필요하다.
4. 그림 방식 교체(CSS 키프레임, 스프라이트, canvas)는 효과가 작거나 반대다(§3). 먼저 §5의 가장 싼 검증 실험으로 확인한 뒤 결정한다.

### (c) 웹 일반론 직답

**아니다. 웹에서 이미지 프레임으로 움직이는 모션이 원래 이만큼 점유하는 것은 아니지만, "60Hz로 화면을 계속 새로 내보내는 것" 자체는 데스크톱에서도 코어 몇 %를 쓴다.** 아주 작은 투명 창에서 점 하나를 60Hz로 옮기는 것만으로 코어의 약 8%가 나왔다(이 머신, 부하 높음) **[실험]**. 비용은 (1) 프레임을 새로 내보내는 횟수, (2) 프레임마다 메인 스레드가 스타일·페인트·커밋을 다시 하는지, (3) 래스터가 다시 필요한지로 나뉜다. 합성기만 도는 transform/opacity 애니메이션은 (2)(3)을 피해 가장 싸지만 (1)은 남는다(§4).

## 1. 이 앱의 코드 경로

- **강아지 창** **[사실]**: `src/main/roaming-dog.ts:55-83`. 투명(`transparent:true`), `type:'panel'`, `alwaysOnTop` `pop-up-menu`, `backgroundThrottling:false`, 클릭 통과. 창 크기는 `dogWindowBounds`(`src/shared/roaming-dog.ts:286-293`)로 키 96이면 약 260x215 정도다(가로 `max(1.6w+92, …)`, 세로 `1.925h+12+패딩`).
- **그리기 루프** **[사실]**: `src/renderer/src/dog-window.ts`의 `schedule()`이 `setInterval(draw, 1000/framesPerSecond(action))`. `framesPerSecond`는 모든 동작에서 60(`src/shared/status-view.ts:56-61`). `rAF`를 쓰지 않고 `setInterval`이다. 주사율 정렬이 없다(디스플레이는 이 머신에서 100Hz / 61Hz 혼재, `system_profiler`) **[추정: 정렬이 없어 프레임이 고르지 않을 수 있음]**.
- **한 프레임이 하는 일** **[사실]**: `draw()` → `rig.pose(action,t)`(`src/renderer/src/dog/rig.ts:166-196`)가 부위에 속한 모든 SVG 요소에 대해 행렬 곱 후 `el.setAttribute('transform', …)`. 추가로 `flip.style.transform`(좌우 반전 · 기울기). SVG 하위 요소의 transform은 DOM 속성 변경이라 매 프레임 스타일 무효화 → 페인트 → 래스터로 간다 **[추정]**(아래 실험 결과가 이를 지지).
- **평소 · 졸림도 매 프레임** **[사실]**: 숨쉬기 등 미세한 움직임도 60번 그린다(`status-view.ts`, `dog-window.ts schedule()`의 "동작 줄이기에서만" 예외가 있을 뿐).
- **메인 프로세스** **[사실]**: `update()`가 `1000/framesPerSecond(...)` 간격 `setTimeout`으로 판정 · 창 이동 · `sendView`(IPC)를 돈다(`roaming-dog.ts:~257`). 메인 CPU는 2.7% 안팎(기존 프로토타입 측정).
- **창 안 강아지(고리 안)** **[사실]**: `src/renderer/src/dog/DogArt.tsx`가 `setInterval(rig.pose, 1000/60)`. 앱 창 렌더러는 `backgroundThrottling` 기본값(true)이라 가려지면 타이머가 줄어드는 쪽이다(Electron 문서: "Whether to throttle animations and timers when the page becomes background", https://www.electronjs.org/docs/latest/api/browser-window **[사실]**). 앱 창이 보이는지에 따라 달라지는지는 실측하지 않았다 **[검증 안 함]**.

## 2. 지금 실행 중인 앱의 실측과 한계

방법: `ps`/`top`만으로 읽었고 앱을 건드리지 않았다.

- **[실험]** /Applications/딩동댕.app 메인 pid 29504(가동 약 20분)의 자식: gpu-process 29505(누적 CPU 1:38.59, 평균 약 8%), 렌더러 3개 29509(누적 19.96초 ≈ 1.7%), 29511(0.08초), 29512(75.89초 ≈ 6.3%), 메인 2.49초. `top`으로 본 순간값은 GPU 5.8~6.4%, 29512가 6.1%.
- 29512가 강아지 창 렌더러라는 것은 **[추정]**이다. 근거는 "가장 CPU를 쓰는 렌더러이고 나머지 둘은 앱 창(보통 숨김·가림)과 종 재생기(영구 숨김, `src/main/bell-player.ts:55`)로 보이는 것"뿐이다. CGWindowList로 창을 pid에 매핑하려 했으나 화면 기록 권한 때문인지 아무 창도 나오지 않았다 **[검증 안 함]**. 확인법은 §5.
- 이전 600초 측정 평균 22.07%, 방금 30초 측정 약 14%는 모두 **[실험]**이고 부하 평균이 28~42(이번 실험 중에도 40~57)로 높아 절대값이 흔들린다. 같은 방식의 프로토타입에서도 "고리 안만 20.9 / 돌아다니는 창만 12.8 / 둘 다 20.1"이라 두 창이 합산되지 않았다 **[실험]**(`prototypes/dog-render-probe/README.md`). 두 창이 같은 GPU 프로세스를 공유해 서로 가려지는 것으로 본다 **[추정]**.

## 3. 이번에 한 실험: 투명 패널 창의 바닥값

**목적**: 비용이 "그림 방식"인지 "60Hz로 창을 갱신하는 것 자체"인지 가린다.

**방법** **[실험]**: `prototypes/dog-cpu-floor-probe/`(버리는 코드, 저장소 제품 코드와 무관, 커밋하지 않음). 앱처럼 `transparent:true, type:'panel', frame:false, focusable:false, alwaysOnTop pop-up-menu, backgroundThrottling:false`인 260x215 창을 화면 바닥에 `showInactive`로 띄우고 beagle.svg(실제 테마 그림)를 넣는다. 예열 8초 뒤 25초 동안 프로세스 트리 누적 CPU 시간 차이로 코어 하나 기준 %를 낸다(`ps time`, `prototypes/dog-render-probe/measure.mjs`와 같은 방식). 실행: `python3 prototypes/dog-cpu-floor-probe/run.py 8 25 <모드...>`(저장소의 electron 바이너리 사용). 사용자 앱은 건드리지 않았다.

| 모드 | 하는 일 | 합계 % | GPU | 렌더러 |
| --- | --- | --- | --- | --- |
| static | 움직임 없음 | 0.0 | 0 | 0 |
| empty60 | 투명 창에서 2px 점 하나 `transform`, `setInterval` 60 | 8.1 | 4.5 | 3.6 |
| cssanim60 | JS 없음, 한 장짜리 CSS `@keyframes`(transform) + `will-change` | 5.1 | 3.2 | 1.9 |
| cssbox60 | 그림 통째 `style.transform`을 JS `setTimeout` 60으로 | 7.3 | 3.4 | 3.9 |
| canvas60 | 한 번 만든 비트맵을 canvas `drawImage` 60 | 10.4 | 6.2 | 4.2 |
| svgattr60 | 현재 방식: 요소마다 `setAttribute('transform')`, `setInterval` 60 | 12.1 / 12.6 / 16.2 (3회) | 6.5~8.9 | 5.5~7.3 |
| svgattr30 | 위와 같고 30 | 7.3 | 4.3 | 3.0 |
| svgattr15 | 위와 같고 15 | 4.1 | 2.6 | 1.5 |
| opaque-svgattr60 | 불투명(흰 바탕) 창, svgattr60 | 11.1 | 6.1 | 5.0 |
| hidden-svgattr60 | 창을 `hide()`한 뒤 svgattr60 | 12.0 | 6.6 | 5.4 |

읽는 법과 한계:

- 바닥값: 아무것도 안 그리면 0, 점 하나를 60Hz로 옮기면 8%. 따라서 "60Hz로 투명 창을 계속 갱신"이 비용의 큰 몫이다. JS 없이 합성기가 도는 경우도 5%라 완전히 피하지는 못한다.
- SVG 방식은 그 위에 +4~8%p. 앱 실측(약 14%)과 같은 크기라, 한 창의 SVG 60Hz가 앱 비용의 대부분을 설명한다.
- 횟수는 거의 비례(15 → 4.1, 30 → 7.3, 60 → 12~16).
- 투명 대 불투명은 구분되지 않는다(노이즈 안). 숨김(hide) + 스로틀링 끔은 비용이 안 줄었다.
- **한계**: 부하 평균 40~57의 머신에서 모드마다 한 번씩(svgattr60만 세 번) 쟀다. svgattr60 세 번이 12.1~16.2로 흔들려 3~4%p 차이는 오차로 본다. 실제 앱의 24개 요소 부위 행렬 계산이 아니라 단순 rotate이다. 화면 품질은 보지 않았다. 숨김 실험의 `hide()`는 1초 뒤에 호출했다. 이 창은 실제 앱의 IPC·메인 루프·히트 판정이 없다.

## 4. 웹 일반론: 방식별 비용 구조

- **프레임 파이프라인** **[사실]**: Chromium cc에서 메인 스레드의 변경은 "commit"으로 컴포지터 스레드에 넘어가고(commit은 "blocking the main thread and copying data over"), 타일은 TileManager가 래스터하고, "draw"는 화면에 그릴 compositor frame(quad · render pass)을 만드는 일이다(https://chromium.googlesource.com/chromium/src/+/main/docs/how_cc_works.md). 투명 창이든 아니든 프레임마다 GPU 프로세스가 제시 작업을 한다 **[추정: 이 문서가 직접 말하지는 않음, 실험 §3이 근거]**.
- **합성기만 도는 애니메이션** **[사실]**: Blink는 "compatible animations"을 레이어로 승격해 메인 스레드 밖에서 돌릴 수 있다(https://chromium.googlesource.com/chromium/src/+/main/cc/animation/README.md). web.dev는 애니메이션을 `opacity`와 `transform`으로 제한해 "compositing stage"에 머물게 하라고 하고, layout·paint를 건드리면 부드러움을 유지하기 어렵다고 한다(https://web.dev/articles/animations-guide). MDN(명세 요약, 1차에 가까움)은 CSS 애니메이션과 rAF가 둘 다 메인 스레드이면 성능이 거의 같고, 레이어로 승격된 `transform` 애니메이션만 메인 스레드 밖에서 돈다고 한다(https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/CSS_JavaScript_animation_performance). 이번 실험에서 `cssanim60`(5.1%)이 JS로 같은 일을 한 `cssbox60`(7.3%)보다 낮았다 **[실험]**.
- **SVG 하위 요소에는 합성기 애니메이션이 안 먹는다** **[추정]**: 이전 프로토타입에서 SVG 요소마다 Web Animations(transform)를 건 방식이 4배 나빴다 **[실험]**(`prototypes/dog-render-probe/README.md`: 84.6 / 42.6 / 81.8%). 1차 자료로 "SVG 하위 요소는 레이어로 승격되지 않는다"는 문장은 확인하지 못했다 **[검증 안 함]**. 합성기 애니메이션을 쓰려면 부위를 HTML 요소(레이어)로 만들어야 할 것이다 **[추정]**.
- **스프라이트시트 + CSS `steps()`**: `steps()`는 시간 구간을 같은 길이로 나누는 함수다 **[사실]**(https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/steps). `background-position`은 transform·opacity가 아니므로 메인 스레드 페인트를 건드린다 **[추정: web.dev 가이드의 "layout/paint 트리거 피하라" 문장에서 추론]**. `translate`로 큰 묶음을 옮기는 방식은 이 앱에서 이득이 없었다(둘 다 20.1 → 20.0) **[실험]**(`dog-render-probe/README.md`).
- **canvas `drawImage`**: MDN은 반복되는 그림은 오프스크린 캔버스에 미리 그리고, `drawImage`에서 크기를 키우거나 줄이지 말고, 투명이 필요 없으면 `alpha:false`, 애니메이션은 `setInterval`보다 rAF를 쓰라고 한다 **[사실]**(https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas). 이번 canvas60은 10.4%로 CSS 방식보다 높았다 **[실험]**(투명 바탕 + 매 프레임 `clearRect`/`drawImage`, 최적화 없는 순진한 구현이라 한계 있음).
- **rAF**: 주사율에 맞춰 호출되고 백그라운드에서 멈춘다(MDN 같은 문서). 이 앱은 의도적으로 쓰지 않고 `setInterval`을 쓴다(`status-view.ts:54` 주석, 주사율 120일 때 25%였던 28번 측정 때문) **[사실]**.
- **GIF/APNG/WebP 애니메이션**: HTML 명세는 사용자 에이전트가 이미지 안의 애니메이션을 "should honour"하라고만 하고 프레임 타이밍·렌더 비용은 정하지 않는다 **[사실]**(https://html.spec.whatwg.org/multipage/images.html#images-processing-model). web.dev의 GIF 문서는 파일 크기(3.7MB → 551KB)만 말하고 CPU·디코딩 비용은 말하지 않는다 **[사실]**(https://web.dev/articles/replace-gifs-with-videos). Chromium의 애니메이션 이미지 디코딩 비용 구조(프레임별 디코딩 · 캐시)는 소스 확인을 시도했으나 요청이 429로 막혀 확인하지 못했다 **[검증 안 함]**. 이 앱은 해당 방식을 쓰지 않으므로 우선순위가 낮다.
- **투명 창 합성(Electron/macOS)**: Electron 문서에는 `transparent`의 CPU 영향이 없다. `transparent`는 "Whether to enable background transparency for the guest page"이고 macOS에서 투명 창이 시각 잔상을 남길 수 있다는 `invalidateShadow()` 주의만 있다(https://www.electronjs.org/docs/latest/api/browser-window) **[사실]**. 투명이 비용을 더하는지는 이번 실험에서 구분되지 않았다 **[실험]**. 창 크기는 비용에 영향을 줄 수 있으나 변수를 바꿔 보지 않았다 **[검증 안 함]**.
- **`backgroundThrottling`**: false이면 "frames will be drawn and swapped for the whole window"(백그라운드 상태에서도 가시 상태 유지) **[사실]**. 이 앱이 강아지 창에서 끈 이유와 일치한다. 대가는 창이 보이지 않을 때도 그린다는 점이고 이번 `hidden` 실험으로 확인했다 **[실험]**. macOS에서 가시 상태는 "window occlusion state"를 따라간다(같은 문서) **[사실]**.

## 5. 줄이는 방법 후보

모두 강아지 창 기준이다. 예상 효과는 §3의 수치에서 뽑았고 실제 앱에 적용해 재지 않았다 **[추정]**. 사용자 결정(60 유지)과 충돌하는 것은 표시했다.

| 후보 | 예상 효과 | 부작용 · 비고 |
| --- | --- | --- |
| 평소 · 졸림만 30번(또는 15번) | 12~16% → 약 7%(30), 약 4%(15) **[실험]** | 사용자 결정과 충돌. 숨쉬기 같은 미세한 움직임이라 눈에 덜 띌 수 있으나 안 봤다 |
| 합성기 애니메이션(CSS `@keyframes`, 부위를 HTML 레이어로) | 한 장 통째는 5.1%까지 **[실험]**. 부위별 레이어는 **[검증 안 함]** | 부위 수만큼 레이어 · GPU 메모리. 동작이 시간으로 정해진 반복(걷기 · 숨쉬기)일 때만 가능. 끌기 · 낙하는 JS 필요. SVG 하위 요소에 걸면 4배 나빴다 |
| 스프라이트시트 + `steps()` | 이득 없음(20.0 vs 20.1) **[실험]** | 묶음 PNG 1.2~2.3MB, 메모리 증가 |
| canvas | 이번 순진한 구현은 오히려 높음(10.4%) **[실험]** | 벡터 선명도 · 해상도 관리 필요 |
| SVG transform 갱신 줄이기(값이 안 변한 요소는 쓰지 않기, 요소 합치기) | 렌더러 +4~8%p 중 일부 **[추정]** | 평소에 모든 부위가 계속 움직이면 이득이 작다 |
| 보이지 않을 때 · 사용자가 안 볼 때 멈추기(전체 화면 앱 · 잠금 외에 화면 꺼짐, 오래 입력 없음) | 멈추면 0.7~1.1% **[사실]**(28번 표) | 판정 조건이 필요. 화면만 꺼지는 이벤트는 `powerMonitor`에 없다 **[사실]**(28번 티켓) |
| `backgroundThrottling` 켜기 | 가려지면 타이머 감소 **[추정]** | 이 앱은 가려지기 어렵고 끄는 이유(걷기 끊김)가 있다 |
| 투명 창을 불투명으로 | 차이 안 보임 **[실험]** | 강아지 배경이 필요해 쓸 수 없음 |
| 창 크기 줄이기 | **[검증 안 함]** | 하트 · 낙하산 여백 때문에 현재 크기 |

**가장 싼 검증 실험(남은 불확실성)**

1. 강아지 창 렌더러 확인: 앱 실행 때 `--remote-debugging-port`를 줄 수 없으므로 별도 인스턴스(`--data-dir` 임시)를 띄우고 `ps` 프로세스 이름 대신 CDP로 `target` 목록을 읽어 pid를 매핑한다. 또는 설정에서 돌아다니는 강아지만 껐다 켜서 `ps` 누적 CPU가 달라지는 것을 본다(기존 앱을 건드리므로 사용자 허락 필요).
2. 창 가림 · 프레임 변경 효과: `prototypes/dog-cpu-floor-probe`에 `svgattr60`을 15/30/60으로 두고 각 5분 반복(부하가 낮을 때)해 분산을 줄인다.
3. 합성기 부위 레이어의 비용: 부위 서너 개를 HTML `<div>`로 만들어 `@keyframes`를 건 모드를 추가해 5.1%(한 장)와 12%(SVG) 사이 어디인지 본다.

## 6. 이 문서의 한계

- 모든 측정이 부하 평균 28~57인 머신이고, 모드당 25초 단일 표본이다. 순위(바닥값 > SVG 추가분)는 방향이 일관되지만 몇 %p 차이는 오차일 수 있다.
- Chromium 소스에서 GIF/APNG 디코딩과 SVG 합성 승격 규칙은 요청 제한(429)으로 확인하지 못했다.
- 사용자 앱의 강아지 창 renderer pid 매핑은 추정이다.
- Windows는 보지 않았다.

## 권고

1. 지금은 60 유지(사용자 결정) 그대로 두고, 이번 실측 14%는 기준 약 20% 안임을 기록한다.
2. 줄여야 한다면 그림 방식 교체보다 **횟수**(평소 · 졸림을 30으로)와 **멈추기 조건**이 가장 값싸고 효과가 확인된 수단이다.
3. 합성기 애니메이션은 이론상 가장 낮지만(5%대) 부위별 HTML 레이어로 다시 만들어야 하므로, §5의 3번 실험으로 이득을 먼저 확인한 뒤에만 착수한다.
4. 스프라이트시트 · canvas · 투명 창 제거는 근거상 권하지 않는다.
