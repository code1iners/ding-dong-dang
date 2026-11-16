# Electron 상주와 시각 정확도의 OS별 한계 조사

Type: research
Status: resolved
Blocked by: 

## Question

Electron 앱이 Windows 11과 macOS에서 종을 놓치지 않으려면 무엇이 가능하고 무엇이 불가능한가? 다음을 1차 자료(Electron · Microsoft · Apple 공식 문서)로 확인한다.

- 로그인 시 자동 실행: `app.setLoginItemSettings`의 OS별 동작과 제약(서명 없는 앱, macOS 13 이후 로그인 항목).
- 창을 닫아도 트레이/메뉴 막대에 남아 동작하는 구성과 OS별 차이.
- 창이 숨겨졌거나 백그라운드일 때 타이머 지연(backgroundThrottling, macOS App Nap)과 회피 방법.
- 잠자기 · 화면 잠금 중의 동작, 깨어났을 때 감지하는 방법(`powerMonitor`), 잠자기 방지(`powerSaveBlocker`)의 범위.
- 숨겨진 창 또는 메인 프로세스에서 오디오를 재생할 때의 제약(자동 재생 정책 포함).
- 시스템 시각 변경과 서머타임이 예약 시각에 주는 영향.

## Answer

조사 문서: `research/os-background-reliability` 브랜치(커밋 `1aff53e`)의 `docs/research/os-background-reliability.md`.

확인 방식: 1차 자료(Electron 문서 · 소스 · 이슈, Chromium · libuv 소스, Microsoft Learn, Apple 문서)만 읽었다. 실기기 실험은 하지 않았다.

확인된 사실:

- **Windows 자동 실행**: 서명과 무관하다. `setLoginItemSettings`가 `HKCU\...\Run` 레지스트리에 경로를 쓴다. 로그인 뒤에만 실행되고 사용자가 작업 관리자에서 끌 수 있다.
- **macOS 자동 실행**: 서명 없는 배포와 충돌할 위험이 크다. Electron은 macOS 13+에서 `SMAppService`를 쓰고, 공식 문서가 서명 · 공증되지 않은 앱에서는 조용히 실패할 수 있다고 경고한다. 서명 없는 앱의 등록 실패 이슈(electron#45672)는 "not planned"로 닫혔다. 예외가 나지 않으므로 `getLoginItemSettings().status`로 확인해야 한다.
- **타이머 위치**: 숨겨진 렌더러의 타이머는 1초, 길게는 1분 단위로 묶인다. 메인 프로세스 타이머는 이 스로틀링 대상이 아니므로 스케줄러는 메인 프로세스에 둔다.
- **macOS App Nap**: 프로세스 전체에 적용될 수 있고 Electron에 끄는 API가 없다. `powerSaveBlocker`가 이를 막는다는 것은 추론이다.
- **잠자기**: 잠든 동안에는 종을 울릴 수 없다. `powerSaveBlocker`는 유휴 잠자기만 막고 덮개 닫기 · 수동 잠자기는 막지 못한다. 잠든 PC를 깨우는 Electron API는 없다.
- **Windows Modern Standby**: 화면이 꺼지는 것만으로 앱이 일시 중단될 수 있다. 전원 요청은 AC에서는 무기한, 배터리에서는 5분까지만 막는다.
- **깨어난 직후**: 지나간 종의 타이머가 한꺼번에 실행될 수 있다. 벽시계와 비교해 늦은 종을 버릴지 울릴지 정하는 검사가 필요하다. Windows 11 24H2에서 `suspend` 이벤트가 불안정하다는 보고(electron#47739)가 있어 `resume`에 의존해야 한다.
- **오디오**: 렌더러에서만 낼 수 있다. 창을 닫아도 살아 있는 숨긴 창이 필요하다. Electron의 자동 재생 정책 기본값은 제스처 없이 재생을 허용한다.
- **시각 변경**: 타이머는 시스템 시각 변경을 따라가지 않는다. 짧은 주기로 벽시계를 다시 읽어 비교해야 한다. 한국은 서머타임이 없다.
- **트레이 상주**: `window-all-closed`를 구독하고 `Tray` 참조를 유지하면 된다. `Cmd+Q`와 `app.quit()`은 막히지 않는다.

미확인(실측이 필요한 것): 서명 없는 또는 ad-hoc 서명 앱에서 macOS 로그인 항목 등록이 성공하는 조건과 대안 경로(LaunchAgent, 수동 등록), 트레이 전용 앱의 메인 타이머가 App Nap으로 실제 얼마나 늦는지, 화면 잠금 중의 타이머 · 오디오 동작, 숨긴 창의 오디오 재생과 깨어난 직후 첫 재생, Windows 11 트레이 아이콘의 기본 표시 위치.
