# "화면이 꺼지지 않게 하는 스위치" 다른 서비스 문구 레퍼런스

조사일 2026-11-20. 기준: 딩동댕 0.2.2(`main` 8a6ed35). 각 저장소는 조사일 시점의 기본 브랜치(`main`/`master`) 내용이다.
표기: **[원문 확인]** 1차 자료(공식 도움말·소스·로컬라이제이션 파일)를 직접 열어 문구를 확인, **[확인 못 함]** 원문을 열지 못했거나 문구를 확정하지 못함.
2차 자료(블로그·뉴스·Q&A 글)는 근거로 쓰지 않았다. 이 문서는 문구를 추천하지 않고 관찰한 사실과 확인하지 못한 것만 적는다.

## 조사 대상

딩동댕 설정 스위치 "수업 중 화면 켜 두기". 켜면 수업 시간 동안 모니터 화면이 꺼지지 않고(Electron `powerSaveBlocker` `prevent-display-sleep`), 끄면 화면만 OS 설정대로 꺼질 수 있으며 컴퓨터는 깨어 있어 종은 울린다. 앱 창 always on top은 대상이 아니다.

## 결론

- 원문을 확인한 서비스는 **15곳**(OS 4: Windows · macOS · iOS · Android, 유틸리티 1: PowerToys Awake, 영상 1: VLC, 게임 스트리밍 1: Moonlight, 지도·내비 2: Organic Maps · OsmAnd, 만화 리더 1: Mihon, 전자책 리더 1: Readest, 데스크톱 환경 2: GNOME · KDE Plasma, 스마트홈 대시보드 1: Home Assistant 앱, 맥 유틸리티 1: KeepingYouAwake). 15곳보다 표 행이 더 많은 것은 Android·macOS·Windows 등이 한 제품 안에서 여러 항목을 갖기 때문이다.
- 한국어 UI 원문까지 확인한 곳은 **10곳**: macOS, iOS, Android, VLC, Moonlight, Organic Maps, OsmAnd, Mihon, Readest, GNOME(소스 번역 파일). Windows는 한국어 공식 도움말 문구만 확인했고 실제 UI 문구인지는 확인 못 했다(아래 표 각주).
- 스위치를 "켜 둔다" 쪽으로 이름 붙인 곳과 "꺼지는 타이머를 설정한다" 쪽으로 이름 붙인 곳으로 크게 갈린다. 한국어에서 앱 단위 스위치는 "화면 켜짐 유지"가 가장 많이 보였다(§패턴).

## 서비스별 표

「켠/끈」 열은 문구가 스위치를 켠 상태를 서술하는지, 끈 상태를 서술하는지, 시간 선택(타이머)인지를 적었다. 표의 한국어는 없으면 "한국어 없음"이라고 썼다.

### 앱(스위치가 앱 안에 있는 것)

| 서비스 | 문구 원문 | 보조 설명 원문 | 켠/끈 | 근거 |
| --- | --- | --- | --- | --- |
| Organic Maps (Android, 지도) | en `Keep the screen on` / ko `화면 켜짐 유지` | en `When enabled, the screen will always be on when displaying the map.` / ko `활성화하면 지도를 표시할 때 화면이 항상 켜져 있습니다.` | 켠 상태. 설명이 켰을 때의 결과와 적용 범위(지도를 표시할 때)를 함께 말함. 끈 상태 설명은 없음 | [1] |
| OsmAnd (Android, 지도·내비) | en `Keep screen on` / ko `화면 켜짐 유지` | 이 항목 자체의 설명은 확인 못 함. 같은 화면의 안내 문구 en `Select screen wake-up options (make sure OsmAnd is in the foreground when the device is being locked):` | 켠 상태. `Timeout after wake-up`(깨운 뒤 화면 꺼짐 시간) 선택지로 쓰이는 문자열이다(`turn_screen_on_power_button_disabled`가 "`'Keep screen on'` under `'Timeout after wake-up'`"을 요구한다고 말함) | [2] |
| Mihon (Android, 만화 리더) | en `Keep screen on` / ko `화면 켜짐 유지` | 없음(스위치 제목만) | 켠 상태. 설정 > 리더(`SettingsReaderScreen`)의 `SwitchPreference` | [3] |
| Readest (전자책 리더, 데스크톱·모바일) | en `Keep Screen Awake` / ko `화면 켜짐 유지` | en `Only while reading` / ko `독서 중에만` | 켠 상태. 설명이 적용 범위만 한정함. 설정 > 제어(Control) 패널의 `Device` 그룹, 스위치 행 | [4] |
| Moonlight (게임 스트리밍 클라이언트, 데스크톱) | en `Keep the display awake while streaming` / ko `스트리밍 중 화면 켜짐 유지` | en `Prevents the screensaver from starting or the display from going to sleep while streaming.` / ko `스트리밍 도중 화면 보호기의 시작 또는 디스플레이 잠자기를 방지합니다.` | 켠 상태(제목) + "방지" 서술(설명). 적용 범위(스트리밍 중)가 제목에 들어 있음. 설정의 `UI Settings` 그룹 체크박스, 설명은 툴팁(`ToolTip`) | [5] |
| VLC (영상, 데스크톱) | en `Disable screensaver` / ko `화면 보호기 끄기` | en `Disable the screensaver during video playback.` / ko `비디오 재생 중에 화면 보호기를 사용하지 않습니다.` 선택지 en `Never` · `When fullscreen` · `Always` / ko `없음` · (전체 화면일 때 번역은 확인 못 함) · `항상` | "화면 보호기를 끈다"는 동작 서술(켜면 화면이 유지되는 쪽). 대상이 화면이 아니라 "화면 보호기". 값은 언제 끌지(`Never`/`When fullscreen`/`Always`) | [6] |
| Home Assistant 공식 앱 (Android, 스마트홈 대시보드) | en `Keep screen on` / ko 파일 못 찾음 | en `Do not lock screen when dashboard is active` | 켠 상태(제목) + 부정 서술(설명, "잠그지 않음"). 적용 범위(대시보드가 활성일 때) 한정 | [7] |
| PowerToys Awake (Windows 유틸리티) | en `Keep screen on` (옆 항목 `Keep awake indefinitely`, `Keep awake for a time interval`, `Keep awake until expiration`, `Keep using the selected power plan`) | en `This setting is only available when keeping the PC awake`. 옆 스위치 `Allow screen to turn off while locked`의 설명: `When off, "Keep screen on" stays in effect while Windows is locked. On Modern Standby systems, Windows may still turn off the display.` | 켠 상태. "PC를 깨워 두는 모드"와 "화면을 켜 둠"을 별도 항목으로 분리하고, 화면 항목은 PC를 깨워 둘 때만 쓸 수 있다고 설명함. 한국어는 이 저장소에 없음 | [8] |
| KeepingYouAwake (macOS 메뉴 막대 유틸리티) | en `Allow the display to sleep`(고급 설정 체크박스) / 한국어 번역이 비어 있음 | 이 체크박스의 설명은 없음. 같은 앱의 상태 문구 en `Your Mac will automatically go to sleep when unused.`, `Afterwards your Mac will automatically go to sleep again when unused.` | **끈 상태**를 이름으로 삼은 "허용" 문구(체크하면 화면이 꺼질 수 있음). 앱의 상태 문구가 끈 후의 결과(자동 잠자기)를 풀어 줌 | [9] |

### OS 설정(시간 선택형·꺼짐 방지형)

| 서비스 | 문구 원문 | 보조 설명 원문 | 켠/끈 | 근거 |
| --- | --- | --- | --- | --- |
| Android 개발자 옵션 | en `Stay awake` / ko `화면 켜짐 상태 유지` | en `Screen will never sleep while charging` / ko `충전하는 동안 화면이 꺼지지 않음` | 켠 상태(제목) + 켰을 때 결과와 조건(충전 중)을 설명 | [10] |
| Android 설정(화면 시선 감지) | en `Screen attention` / ko `화면 시선 감지` | en `Prevents your screen from turning off if you’re looking at it` / ko `화면을 보고 있으면 꺼지지 않습니다.` | 기능 이름은 중립적 명사. 설명이 "꺼지지 않음"을 서술 | [10] |
| Android 설정(디스플레이) | en `Screen timeout` / ko `화면 자동 잠금 시간` | en `After %1$s of inactivity` / ko `%1$s 이상 동작이 없을 때` | 시간 선택형. 한국어는 "꺼짐"이 아니라 "잠금"이라는 단어를 씀 | [10] |
| iOS | ko `디스플레이 및 밝기` > `자동 잠금` / en `Display & Brightness` > `Auto-Lock` | ko `참고: 자동 잠금을 지연하거나 자동 잠금이 되지 않도록 하면 전력 소비가 늘어날 수 있습니다.` / en `Note: Delaying or preventing Auto-Lock may increase power consumption.` 도움말 문서 제목은 ko `iPhone 화면을 더 오래 켜두기` / en `Keep the iPhone display on longer`, 본문 ko `iPhone 화면은 주시하는 동안 켜져 있지만 사용자가 잠시 주시하지 않으면 어두워지고 결국엔 보안을 위해 잠깁니다.` | 시간 선택형(설정 이름은 "자동 잠금"). 도움말 제목은 "켜두기"(켠 상태), 설정 이름은 "자동 잠금"(끄는 동작) | [11] |
| macOS 시스템 설정 > 잠금 화면 | ko `배터리 사용 시 비활성 상태인 경우 디스플레이 끄기`, `전원 어댑터 사용 시 비활성 상태인 경우 디스플레이 끄기` / en `Turn display off on battery when inactive`, `Turn display off on power adapter when inactive` | 항목 옆 설명은 확인 못 함(도움말은 "팝업 메뉴를 클릭한 다음, 옵션을 선택하십시오"까지만) | 끄는 동작 + 시간 선택(팝업 메뉴) | [12] |
| macOS 시스템 설정 > 배터리 > 옵션 | ko `디스플레이가 꺼져 있을 때 전원 어댑터 사용 시 컴퓨터를 자동으로 잠자지 않게 하기` / en `Prevent automatic sleeping on power adapter when the display is off` (데스크톱은 설정 `Energy`에서 `Prevent automatic sleeping when the display is off`) | 도움말 소제목 en `Stop automatic sleeping when the display is off:` / ko `디스플레이가 꺼져 있을 때 자동으로 잠자지 않게 하기:` | "방지" 서술. 화면이 이미 꺼진 상태에서 컴퓨터 잠자기를 막는 항목이라 "화면 유지"가 아니라 "컴퓨터 잠자기 방지" | [12] |
| Windows 11 설정 > 시스템 > 전원 및 배터리 | en `Turn my screen off after` (`Screen, sleep, & hibernate timeouts` 아래) / ko 공식 도움말 문구 `다음 시간 후에 화면 끄기`(소제목 `화면, 절전 & 최대 절전 모드 시간 제한`). 같은 문서에 `다음 시간 후 내 장치를 절전 모드로 전환`(en `Make my device sleep after`) | en `Select how long you want your device to wait before turning the screen off when you're not using your device, both when it's plugged in and when it's on battery power.` | 끄는 동작 + 시간 선택. 한국어 도움말 문서에는 같은 문서 안에서도 `다음 시간 후에 화면 끄기` / `화면 끄 기`처럼 표기가 갈리고 기계번역 투라, 실제 한국어 Windows UI 문구는 **확인 못 함** | [13] |
| GNOME 설정 > 전원 | en `Automatic Screen _Blank`(`_`는 단축키 밑줄) / ko `자동 빈 화면(_B)`. 같은 화면에 en `_Dim Screen` / ko `화면 어둡게(_D)` | en `Turn the screen off after a period of inactivity` / ko `일정 시간 사용하지 않으면 화면을 끕니다`. `_Dim Screen`: en `Reduce screen brightness when the device is inactive` / ko `컴퓨터를 사용하지 않을 때 화면 밝기를 줄입니다` | 스위치 이름은 "자동 빈 화면"(꺼지는 동작을 켬), 설명이 "화면을 끕니다"로 풀어 줌. 스위치를 끄면 어떻게 되는지는 설명하지 않음 | [14] |
| KDE Plasma 배터리·전원 위젯 | en `Manually Block Sleep and Screen Locking`(그룹 제목 `Sleep and Screen Locking after Inactivity`) | en `This will result in higher energy consumption.` 접근성 상태문 `Automatic sleep and screen locking are currently blocked.` / `Sleep and screen locking are automatic after inactivity.` | "차단"(켠 상태) 서술. 끈 상태도 `... are automatic after inactivity.`로 접근성 문구에서 풀어 줌. 한국어는 이번에 확인 못 함 | [15] |

## 패턴

- **단어**. 한국어 UI에서 화면을 가리키는 단어는 앱 스위치와 Android·GNOME에서 `화면`이 압도적이었다. `디스플레이`는 macOS(`디스플레이 끄기`, `디스플레이가 꺼져 있을 때…`), iOS 설정 이름(`디스플레이 및 밝기`), Moonlight 설명문(`디스플레이 잠자기`)에 나왔다. `모니터`는 확인한 한국어 문구에 없었다(KeepingYouAwake 프랑스어 번역에 `moniteur`, 중국어에 `显示器`가 있는 정도).
- **켠 상태 이름의 한국어 표현**. 앱 안 스위치 6곳의 한국어가 같은 구조였다. `화면 켜짐 유지`(Organic Maps, OsmAnd, Mihon, Readest), `화면 켜짐 상태 유지`(Android 개발자 옵션), `스트리밍 중 화면 켜짐 유지`(Moonlight). 영어는 `Keep screen on`(OsmAnd, Mihon, Home Assistant, PowerToys), `Keep the screen on`(Organic Maps), `Keep Screen Awake`(Readest), `Keep the display awake while streaming`(Moonlight), `Stay awake`(Android).
- **"꺼지지 않게/방지" 표현은 보조 설명에 나옴**. `꺼지지 않음`(Android 개발자 옵션 설명), `꺼지지 않습니다`(Android 화면 시선 감지 설명), `방지합니다`(Moonlight 설명), `Prevents ...`(영어), `Do not lock screen ...`(Home Assistant). 제목은 "유지/Keep", 설명은 "방지/Prevent"로 나뉜 곳이 많다. 제목 자체가 "방지/Block/Disable"인 곳은 macOS 배터리 옵션, KDE, VLC였다.
- **적용 범위를 문구에 넣는 방식**. 스위치가 화면을 언제 켜 두는지를 이름이나 설명에 직접 쓴 곳이 많았다: `스트리밍 중`(Moonlight 제목), `지도를 표시할 때`(Organic Maps 설명), `독서 중에만`(Readest 설명), `when dashboard is active`(Home Assistant 설명), `충전하는 동안`(Android 개발자 옵션 설명), `during video playback`(VLC 설명). 이번에 확인한 앱 스위치 문구 중 "앱 창" 같은 대상 이름을 목적어로 쓴 곳은 없었고, 모두 "무슨 활동을 하는 동안"으로 범위를 말했다.
- **끈 상태를 풀어 주는 곳**. 스위치를 끈 뒤에 일어나는 일을 설명으로 적은 곳은 거의 없었다. KeepingYouAwake가 상태 문구로 `Your Mac will automatically go to sleep when unused.`를, KDE가 접근성 상태문으로 `Sleep and screen locking are automatic after inactivity.`를, PowerToys가 인접 스위치 설명으로 `When off, "Keep screen on" stays in effect while Windows is locked.`를 적었다. GNOME은 켠 쪽 결과(`화면을 끕니다`)만 설명한다. 나머지 앱은 켠 상태만 서술했다.
- **끄는 쪽을 이름으로 삼은 곳(OS)**. Windows `Turn my screen off after`, macOS `디스플레이 끄기`, iOS `자동 잠금`, Android `화면 자동 잠금 시간`, GNOME `자동 빈 화면`은 "꺼지기까지 시간"을 고르는 타이머형이다. KeepingYouAwake `Allow the display to sleep`는 끈 상태를 "허용" 문구로 쓴 유일한 스위치였다.
- **"잠금"이 섞이는 한국어**. Android는 `Screen timeout`을 `화면 자동 잠금 시간`으로, iOS는 `Auto-Lock`을 `자동 잠금`으로 옮겨, "화면이 꺼짐"과 "잠김"을 같은 말로 쓴다. 딩동댕 앱의 "화면 켜 두기"가 잠금 화면 설정으로 읽힐 수 있는지는 이번 조사로 알 수 없다.
- **컴퓨터 잠자기 vs 화면 꺼짐을 분리해 보여 주는 곳**. Windows는 `Turn my screen off after`와 `Make my device sleep after`를 별도 항목으로 둔다. PowerToys는 `Keep awake indefinitely`(PC)와 `Keep screen on`(화면)을 분리한다. macOS는 `디스플레이 끄기`(잠금 화면)와 `자동으로 잠자지 않게 하기`(배터리 옵션)를 다른 화면에 둔다. KDE는 `Sleep and Screen Locking`을 한 스위치에 묶는다.

## 확인하지 못한 것

| 항목 | 이유 |
| --- | --- |
| Windows 11 실제 한국어 UI 문구 | 한국어 공식 도움말은 열었으나 번역투가 거칠고 문서 안에서 표기가 갈린다. 한국어 Windows 로컬라이제이션 리소스는 공개 소스가 아니라 열지 못했다. 표에는 도움말 문구로만 적었다 |
| PowerToys Awake 한국어 | 저장소 `Strings/`에는 `en-us`만 있고 `ko-kr/Resources.resw`는 404였다(번역은 저장소 밖에서 관리되는 듯하나 확인하지 않음) |
| KeepingYouAwake `Allow the display to sleep` 한국어 | `Localizable.xcstrings`·`ko.xliff`에 ko 번역이 없다. 실제 한국어 UI에서 어떻게 보이는지는 실행해 보지 않아 모름 |
| Home Assistant 앱 한국어 | `values-ko/strings.xml`이 저장소에 없었다(번역은 외부 플랫폼 관리로 추정, 확인하지 않음) |
| KDE Plasma 한국어 | 한국어 `po`를 찾지 못했다. 영어 소스(`i18n(...)`)만 확인 |
| OsmAnd `Keep screen on` 항목의 보조 설명·화면 경로 | 문자열 파일과 다른 문자열의 참조로 위치를 추정했을 뿐 화면 코드는 열지 않았다 |
| VLC `When fullscreen` 한국어 | `ko.po`에서 해당 msgid를 찾지 못했다 |
| macOS `잠금 화면` 옵션 옆 설명문 | 도움말에는 항목 이름만 있고 UI 설명 문구는 없다. 실제 시스템 설정 화면은 열어 보지 않았다 |
| Fully Kiosk Browser `Keep Screen On` | 공식 문서 사이트가 동적 렌더링이라 문구를 열지 못했다 |
| Kodi, Mealie | 한국어 번역 파일/경로가 404이거나 해당 설정 문자열을 특정하지 못해 제외 |
| Amphetamine, Caffeine, Chrome 확장·Wake Lock API UI, Samsung One UI, 영상 스트리밍·강의 앱(YouTube 등), 한국 서비스 앱 | 이번에 시도하지 않음 또는 1차 자료(소스·로컬라이제이션 파일)를 열 수 없는 비공개 앱이라 제외 |

## 보조 참고(10곳 수에 넣지 않음)

- **mpv**: UI가 아니라 설정 옵션이다. `--stop-screensaver=<yes|no|always>` "Turns off the screensaver (or screen blanker and similar mechanisms) at startup and turns it on again on exit". 소스 [16].

## 근거

[1] Organic Maps — https://github.com/organicmaps/organicmaps/blob/master/data/strings/strings.txt (`[enable_keep_screen_on]` 37142행 이하, ko 37173행. 설명 `[enable_keep_screen_on_description]` 37199행 이하, ko 37231행. `tags = android-app`)
[2] OsmAnd — https://github.com/osmandapp/OsmAnd/blob/master/OsmAnd/res/values/strings.xml (`keep_screen_on` 3093행, `turn_screen_on_power_button_disabled` 3098행, `turn_screen_on_descr` 3101행, `wake_time` 3569행) · https://github.com/osmandapp/OsmAnd/blob/master/OsmAnd/res/values-ko/strings.xml (`keep_screen_on` 2486행)
[3] Mihon — https://github.com/mihonapp/mihon/blob/main/i18n/src/commonMain/moko-resources/base/strings.xml (`pref_keep_screen_on` 442행) · https://github.com/mihonapp/mihon/blob/main/i18n/src/commonMain/moko-resources/ko/strings.xml (103행) · https://github.com/mihonapp/mihon/blob/main/app/src/main/java/eu/kanade/presentation/more/settings/screen/SettingsReaderScreen.kt (110~113행)
[4] Readest — https://github.com/readest/readest/blob/main/apps/readest-app/src/components/settings/ControlPanel.tsx (`Keep Screen Awake` 788~791행, 그룹 `Device` 727행) · https://github.com/readest/readest/blob/main/apps/readest-app/public/locales/ko/translation.json (138행, `Only while reading` 1808행)
[5] Moonlight — https://github.com/moonlight-stream/moonlight-qt/blob/master/app/gui/SettingsView.qml (`keepAwakeCheck` 1294~1296행, `UI Settings` 1015행) · https://github.com/moonlight-stream/moonlight-qt/blob/master/app/languages/qml_ko.ts (1081~1087행)
[6] VLC — https://github.com/videolan/vlc/blob/master/src/libvlc-module.c (`SS_TEXT`/`SS_LONGTEXT`/`screensaver_texts` 427~433행, `disable-screensaver` 1702행) · https://github.com/videolan/vlc/blob/master/po/ko.po (2200~2206행)
[7] Home Assistant Companion(Android) — https://github.com/home-assistant/android/blob/master/app/src/main/res/xml/preferences.xml (57~61행) · https://github.com/home-assistant/android/blob/master/common/src/main/res/values/strings.xml (`keep_screen_on_def` 388행, `keep_screen_on` 389행)
[8] PowerToys — https://github.com/microsoft/PowerToys/blob/main/src/settings-ui/Settings.UI/Strings/en-us/Resources.resw (`Awake_DisplaySettingsCard.Header` 등 2604~2627행)
[9] KeepingYouAwake — https://github.com/newmarcel/KeepingYouAwake/blob/main/KeepingYouAwake/KYALocalizedStrings.m (`KYA_L10N_ALLOW_DISPLAY_SLEEP` 53행) · https://github.com/newmarcel/KeepingYouAwake/blob/main/KeepingYouAwake/Settings/KYAAdvancedSettingsViewController/KYAAdvancedSettingsViewController.m (54행) · https://github.com/newmarcel/KeepingYouAwake/blob/main/KeepingYouAwake/Localizable.xcstrings · https://github.com/newmarcel/KeepingYouAwake/blob/main/Localizations/KeepingYouAwake/ko.xcloc/Localized%20Contents/ko.xliff
[10] Android(AOSP) — 개발자 옵션 https://github.com/aosp-mirror/platform_frameworks_base/blob/main/packages/SettingsLib/res/values/strings.xml (`keep_screen_on` 658행, `_summary` 660행), 한국어 같은 경로 `values-ko/strings.xml`(282~283행). 설정 앱 https://github.com/aosp-mirror/platform_packages_apps_settings/blob/main/res/values/strings.xml (`adaptive_sleep_title` 2926행, `adaptive_sleep_description` 2934행, `screen_timeout` 3061행), 한국어 `res/values-ko/strings.xml`(1269행, 1273행, 1329행). 개발자 옵션 항목 키는 `res/xml/development_settings.xml` 64~66행
[11] Apple iOS — https://support.apple.com/ko-kr/guide/iphone/iph7117338a8/ios · https://support.apple.com/guide/iphone/keep-the-iphone-display-on-longer-iph7117338a8/ios
[12] Apple macOS — https://support.apple.com/guide/mac-help/set-sleep-and-wake-settings-mchle41a6ccd/mac · https://support.apple.com/ko-kr/guide/mac-help/mchle41a6ccd/mac
[13] Microsoft Windows 11 — https://support.microsoft.com/en-us/windows/how-to-adjust-power-and-sleep-settings-26f623b5-4fcc-4194-863d-b824e5ea7679 · https://support.microsoft.com/ko-kr/windows/how-to-adjust-power-and-sleep-settings-26f623b5-4fcc-4194-863d-b824e5ea7679 (둘 다 `.../windows/experience/power-battery/power-settings-in-windows-11`로 리다이렉트됨)
[14] GNOME — https://gitlab.gnome.org/GNOME/gnome-control-center/-/blob/main/panels/power/cc-power-panel.blp (`Automatic Screen _Blank` 205~206행, `_Dim Screen` 188~189행) · https://gitlab.gnome.org/GNOME/gnome-control-center/-/blob/main/po/ko.po (4955~4985행 부근)
[15] KDE Plasma(powerdevil) — https://github.com/KDE/powerdevil/blob/master/applets/batterymonitor/InhibitionItem.qml (그룹 제목, `Manually Block Sleep and Screen Locking` 스위치, 에너지 소비 문구, 접근성 상태문) · https://github.com/KDE/powerdevil/blob/master/applets/batterymonitor/main.qml (76행, 169~171행)
[16] mpv — https://github.com/mpv-player/mpv/blob/master/DOCS/man/options.rst (3829행)
