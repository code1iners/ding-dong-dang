# 시간표 관리 화면: 바깥 제품은 어떻게 푸는가

조사일 2026-11-18. 대상: "이름 붙인 하루 일정(템플릿)을 만들고 요일에 배정"하거나 "정한 시각에 울리는" 제품의 공식 도움말 · 공식 글 · 소스 코드.
표기: **[사실]** 공식 문서·소스로 확인, **[부분]** 공식 문서가 일부만 말함(빈 곳은 적음), **[확인 못함]** 1차 자료로 확인하지 못함, **[추정]** 근거 없이 추론.

## 결론

참고한 14개 제품의 해법은 다섯 갈래로 모인다. 가장 많은 것은 **템플릿 편집 화면 안에 요일 칩을 두고 여러 요일을 한 번에 켜는 방식**(7곳)이다. 그다음은 **한 요일 내용을 "다른 요일에 복사"하며 대상 요일을 여러 개 고르는 방식**(5곳)이다. **이름은 만들 때 받는 것이 표준**이다(템플릿형 5곳 모두 만들기 첫 단계에 이름 칸이 있다). 지금 딩동댕은 요일을 하나 고른 뒤 모달에서 시간표를 고르는 방식이다. 조사한 제품 가운데 이 방식을 주 경로로 쓰는 곳은 날짜별 예외를 다루는 Minga 달력 하나뿐이다. 방향 후보는 §5에 있다.

## 1. 현황 (저장소)

- 화면: `src/renderer/src/TimetableScreen.tsx`(317줄), `src/renderer/src/TimetablePicker.tsx`(299줄). 계약은 `DESIGN.md`의 "시간표" 절이다.
- 왼쪽 카드: 시간표 선택 단추, 요일 동그라미 일곱, 12시간 시계판. 오른쪽 카드: 교시 줄, 더하기, "되돌리기" · "저장".
- 요일 배정: 동그라미 하나 → 모달 → 시간표 하나. 한 번에 한 요일만 바꿀 수 있다.
- 만들기: 이름 없는 "새 시간표"가 생긴다. 이름은 모달 안 "편집" 모드에서 바꾼다. 모달에 닫기 단추가 없다.
- 사용자가 지적한 문제: 클릭이 많다, 요일을 하나씩만 배정한다, 화면을 오가서 헷갈린다, 모달을 닫을 단추가 없다, 편집이 한 단계 더 깊다, 만들 때 이름을 못 짓는다.
- 앞서 거절된 시안: 목록+편집기, 탭, 별도 요일 표, 머리글 바로 고치기, 다듬은 모달, 시간표×요일 격자.

## 2. 제품별 기록

### 2.1 Cal.com 가용 시간(Availability) — 오픈 소스

- 출처: 소스 코드(main, 2026-11-18 조회) `apps/web/modules/schedules/components/NewScheduleButton.tsx`, `packages/features/schedules/components/ScheduleListItem.tsx`, `packages/features/schedules/components/ScheduleComponent.tsx`, `packages/platform/atoms/availability/AvailabilitySettings.tsx` — https://github.com/calcom/cal.com
- 화면 구조 **[사실]**: 일정 목록(줄마다 이름, "기본" 배지, 요일·시간 요약 문자열) → 줄을 누르면 일정 상세 페이지로 넘어간다. 줄의 메뉴에는 "기본으로 지정", "복제", "지우기"(확인 대화상자)가 있다. 마지막 일정은 지울 수 없다(`requires_at_least_one_schedule`).
- 요일 배정 **[사실]**: 일정 하나가 요일 7줄을 가진다. 요일마다 켜고 끄는 스위치와 시간 구간이 있다. 첫 구간 옆의 복사 단추는 "Copy times to" 팝오버를 연다. 팝오버에는 "Select all"과 요일별 체크박스가 있고 "Cancel" · "Apply"로 끝난다.
- 만들기 · 이름 **[사실]**: "New" 단추 → 대화상자("add_new_schedule")에 이름 칸 하나 → "Continue"를 누르면 새 일정 상세로 바로 이동한다(`router.push`). 이름은 상세 페이지 머리글의 `EditableHeading`으로 그 자리에서 고친다.
- 닫기 · 저장 **[사실]**: 만들기 대화상자에 `DialogClose`가 있다. 상세 페이지는 명시적 "Save"이고, 바뀐 것이 없으면 잠긴다(`disabled={... || !formHasChanges}`).
- 가져올 점: 만들 때 이름 받기, 만든 직후 그 일정으로 바로 이동, 목록 줄의 요일 요약, 체크박스와 "모두 선택"이 있는 여러 요일 복사.
- 맞지 않는 점: Cal.com은 요일마다 시간이 따로 있는 모델이라 "시간표 하나를 여러 요일이 공유"하는 딩동댕과 다르다. 목록과 상세가 다른 페이지인 2단 구조다.

### 2.2 Calendly 가용 시간

- 출처: https://calendly.com/help/how-to-set-your-availability
- 화면 구조 **[사실]**: Availability 화면의 "Schedule" 드롭다운으로 일정을 고르고 바꾼다. 따로 된 목록 화면은 문서에 없다.
- 요일 배정 **[사실]**: List 보기의 "Weekly hours"에서 요일마다 +로 구간을 더하고 x로 지운다. 한 일정 안에서 요일 사이를 복사하는 기능은 문서에 없다 **[확인 못함]**.
- 만들기 · 이름 **[사실]**: 드롭다운의 "+ Create schedule" → "Name the new schedule" → "Create". 이름을 바꾸는 방법은 문서에 없다.
- 저장 **[사실]**: "Your changes are saved automatically." 날짜별 시간만 "Apply"로 끝난다.
- 가져올 점: 드롭다운 안에 "만들기"를 두고 이름을 곧바로 받는 흐름. 요일 배정 같은 가벼운 변경의 자동 저장.
- 맞지 않는 점: 일정과 요일의 관계가 Cal.com과 같아 딩동댕 모델과 다르다.

### 2.3 Minga 종 시간표(Bell Schedule) — 학교용

- 출처: https://support.minga.io/en/articles/13622775-set-up-your-bell-schedule-in-minga
- 화면 구조 **[부분]**: Settings > Bell Schedule에 Schedules · Calendar · Terms 탭이 있다. 목록의 모양은 문서에 없다.
- 요일 배정 **[부분]**: 시간표를 만드는 양식 안 "Applies on"에서 적용 요일을 고른다(칩인지 체크박스인지는 문서에 없다). 특정 날짜는 Calendar 탭에서 날짜를 누르고 "Use schedule" 드롭다운으로 바꾼 뒤 "Update"를 누른다. "Reset to default"로 요일 기본값으로 되돌린다.
- 만들기 · 이름 **[사실]**: 오른쪽 위 "Create schedule" → 같은 양식에서 이름, 학기, 적용 요일, "Add period"로 교시 줄(시작 · 끝 시각)을 넣는다.
- 저장 **[부분]**: "Create"/"Save"로 끝난다. 취소 · 닫기는 문서에 없다.
- 가져올 점: 이름, 요일, 교시를 **한 양식**에서 다룬다. 이 조사에서 딩동댕과 가장 가까운 도메인이다. 요일 기본값과 날짜 예외를 분리한다.
- 맞지 않는 점: 학년 · 학기 같은 학교 개념은 필요 없다.

### 2.4 Intrado(Mitel) SafetySuite Scheduler — 종 일정 템플릿

- 출처: https://discover.intrado.com/pages/SafetySuite/Mitel_Help/en-us/Content/User_Tasks/Scheduler/Bell_Schedule_Tutorial.htm , https://discover.intrado.com/pages/SafetySuite/Mitel_Help/en-us/Content/User_Tasks/Scheduler/Day_Templates.htm
- 화면 구조 **[사실]**: Scheduler > Templates 창에 템플릿 목록(Name 열로 정렬)이 있고 New Template · Edit · Delete · Filter · Scheduling Wizard 아이콘이 있다.
- 요일 배정 **[사실]**: Scheduling Wizard에서 달력과 시작 · 끝 날짜를 고르고 "For each day from Monday through Friday, select a template" 한 뒤 "Apply"를 누른다. 하루만 바꿀 때는 달력에서 그날을 오른쪽 클릭 → "Apply Template".
- 만들기 · 이름 **[사실]**: New Day Template에서 Name을 먼저 적고, Event Time 칸을 +로 늘려 종 시각을 넣는다.
- 저장 **[사실]**: Edit Template 창은 "Save", 마법사와 Apply Template는 "Apply"로 끝난다.
- 가져올 점: "요일 → 템플릿"을 **한 화면에서 일곱 요일 모두** 고르는 배정 화면. 딩동댕의 "요일마다 시간표 하나" 규칙과 그대로 맞는다.
- 맞지 않는 점: 날짜 범위와 달력 생성은 딩동댕에 필요 없다(매주 반복만 한다). 배정이 템플릿 편집과 다른 창에 있다.

### 2.5 PowerSchool SMS 종 시간표

- 출처: https://support.powerschool.com/help/sms/843/SchoolUser/Content/Topics/Scheduling/Setting_up_bell_schedule.htm
- 구조 **[사실]**: 이름 붙인 시간표가 따로 있지 않다. 날짜 패턴의 날마다 교시(Add Period / Delete Period, 시작 · 끝 시각, 교시 이름)를 넣는다.
- 요일 배정 **[사실]**: "Copy to other days"로 한 날의 교시를 다른 날에 복사하고, "Copy to other groups"로 다른 그룹에 복사한다.
- 저장 **[부분]**: 명시적 저장 단계가 문서에 없다.
- 가져올 점: 학교 종 시간표에서도 "다른 날로 복사"가 기본 도구다.
- 맞지 않는 점: 날마다 사본이 생겨 한 곳을 고치면 나머지가 따라 바뀌지 않는다. 딩동댕은 시간표 하나를 공유하므로 복사보다 "배정"이 맞다 **[추정]**.

### 2.6 Rachio 물 주기 일정 — 스마트 관개

- 출처: https://support.rachio.com/en_us/creating-editing-duplicating-and-deleting-schedules-r15XepFfbe.md
- 화면 구조 **[사실]**: Schedules 탭에 일정 카드가 있다. 카드의 케밥 메뉴에 Edit · Duplicate · Delete가 있다.
- 요일 배정 **[부분]**: 만들기 단계에서 "Specific days"(요일 지정) · 짝홀수 · 며칠마다 가운데 하나를 고른다. 요일 고르는 부품의 모양은 문서에 없다.
- 만들기 · 이름 **[사실]**: "+ CREATE SCHEDULE" 마법사의 앞 단계에 이름 짓기가 있다. 복제하면 이름을 받고, 기본값은 "[schedule name] copy"다.
- 저장 **[사실]**: "Make sure to hit "Done" or "Save" after making a change." 지우기는 되돌릴 수 없다고 경고한다.
- 가져올 점: 만들 때 이름 받기, 복제 이름의 기본값.
- 맞지 않는 점: 열 단계 마법사는 딩동댕에 너무 길다.

### 2.7 tado° Smart Schedule — 난방

- 출처: https://intercom.help/tado-hc/en/articles/3387209-how-do-i-set-up-my-tado-smart-schedule
- 화면 구조 **[사실]**: 방 화면 오른쪽 위 Smart Schedule 아이콘 → Home · Away 탭.
- 요일 배정 **[사실]**: 요일 묶음 세 가지 가운데 하나를 고른다. 매일 같음, 평일과 주말, 요일마다 따로. 묶음마다 설정이 따로 저장되어 서로 바꿀 수 있다. 하루는 00:00~24:00 막대이고 "Add time block"으로 구간을 더한다.
- 복사 **[사실]**: 하루 왼쪽 아래 복사 아이콘 → 대상 요일의 붙여 넣기 아이콘. "This will replace the existing schedule of the day you pasted to." "the paste action is not reversible."
- 저장 **[확인 못함]**: 문서가 저장 단계를 말하지 않는다.
- 가져올 점: "평일 / 토 / 일" 같은 요일 묶음을 미리 정해 둔 선택지.
- 맞지 않는 점: 묶음이 셋으로 고정되어 딩동댕처럼 시간표 수가 자유로운 경우에는 맞지 않는다. 붙여 넣기를 되돌릴 수 없는 것은 피해야 할 점이다.

### 2.8 Google Nest 온도조절기 일정 (Google Home 앱)

- 출처: https://support.google.com/googlenest/answer/10185085
- 화면 구조 **[사실]**: 온도조절기 → "Schedules" → 요일을 고르고 "Add event". 이벤트마다 이름 붙은 **프리셋**(Comfort, Eco, Sleep)을 고른다. 프리셋을 고치면 "it'll update everywhere it's used in the thermostat schedule."
- 요일 배정 **[사실]**: 이벤트를 넣거나 고칠 때 "다른 요일"도 함께 고를 수 있다. 하루 전체는 화면 아래 "Copy Wednesday schedule" 같은 단추로 복사한 뒤 대상 요일을 누른다.
- 저장 **[사실]**: 더하기 · 고치기 · 복사 모두 "Done" 또는 "Save"로 끝난다.
- 가져올 점: 이름 붙은 프리셋을 여러 곳에서 공유하고, 한 곳을 고치면 모두 바뀌는 모델. 딩동댕의 시간표와 요일 관계가 이와 같다. 복사 단추 이름에 원본 요일을 넣는다.
- 맞지 않는 점: 프리셋은 온도값이라 교시 목록처럼 복잡한 편집기가 없다.

### 2.9 ecobee 일정과 Comfort Settings

- 출처: https://www.ecobee.com/citizen/a-smarter-simpler-way-to-manage-comfort-at-home/ (2026-07-07 공식 글)
- 내용 **[사실]**: 새 앱의 일정은 "a simple, calendar-style view"다. 한 화면에서 활동을 고치고 "copy schedules across multiple days" 할 수 있으며, "fewer taps, less back-and-forth"를 목표로 한다고 밝힌다. "Comfort Settings are now embedded directly in the flow when editing or adding an activity."
- 세부 단계 **[확인 못함]**: 공식 도움말의 현재 단계는 확인하지 못했다. 옛 기기 설명서(제3자 호스팅)에는 복사 → 대상 요일 선택 → 저장 흐름이 있다.
- 가져올 점: 이름 붙은 설정(Comfort Setting)을 따로 관리하는 화면으로 보내지 않고 **일정 편집 흐름 안에 넣었다**는 개편 방향. 딩동댕의 "모달 안 편집 모드" 문제와 같은 종류의 불만을 줄이려는 변경이다 **[추정]**.

### 2.10 Honeywell Home 온도조절기 일정

- 출처: https://docs.honeywellhome.com/x8s-iug/Scheduling.htm
- 구조 **[사실]**: 일정 유형으로 "Grouped Days"(모든 날 같음)와 "Single day"(날마다 다름)를 고른다. 평일 · 주말을 따로 두는 유형도 있다. 하루에 Wake · Away · Home · Sleep 네 구간이 있다.
- 저장 **[확인 못함]**: 일정 편집의 저장 단계는 문서에 없다.
- 가져올 점: tado와 같은 "요일 묶음" 선택지.
- 맞지 않는 점: 구간 수가 넷으로 고정되어 있다.

### 2.11 iPhone 시계 알람

- 출처: https://support.apple.com/guide/iphone/set-an-alarm-iph2909d3a74/ios
- 구조 **[사실]**: 알람 하나의 편집 시트에 시각, "Repeat"("Choose the days of the week you want the alarm to repeat."), "Label"("Give the alarm a name")이 함께 있다.
- 저장 **[사실]**: "Done"으로 끝난다. 취소는 문서에 없다.
- 가져올 점: 이름, 시각, 요일이 **한 시트**에 있다. 만들기와 고치기가 같은 화면이다.
- 맞지 않는 점: 요일 선택이 하위 목록(한 단계 더 들어감)에 있다는 것은 널리 알려져 있으나, 이 문서에서는 확인하지 못했다 **[확인 못함]**.

### 2.12 Android 시계(Google Clock) 알람

- 출처: https://support.google.com/android/answer/2840926?hl=en
- 구조 **[사실]**: 알람 목록에서 알람 블록을 누르면 그 자리에서 편집한다("To edit an alarm, tap an alarm block."). "To name the alarm, tap Alarm name." "To make the alarm repeat, tap the days of the week."
- 저장 **[부분]**: 시각은 "OK"로 확정한다. 다른 항목에 저장 단추가 있는지는 문서에 없다.
- 가져올 점: 목록 줄 안에 **요일 일곱 글자를 그대로 펼쳐 놓고 눌러서 켠다**. 하위 화면이 없다.

### 2.13 Samsung 시계 알람

- 출처: https://www.samsung.com/ca/support/mobile-devices/set-and-manage-alarms-on-your-samsung-galaxy
- 구조 **[사실]**: "Add alarm"(+) → 시각 → 반복 요일 선택 → "Save". 이름은 "Alarm name" 칸에서 저장 전에 넣을 수 있다.
- 요일 부품의 모양 **[확인 못함]**.
- 가져올 점: 만드는 화면 하나에 시각, 요일, 이름을 모으고 "Save" 하나로 끝낸다.

### 2.14 Apple 수면 일정(건강 앱 · Apple Watch)

- 출처: https://support.apple.com/guide/iphone/set-up-a-schedule-for-a-sleep-focus-iphaf56dceb4/ios , https://support.apple.com/guide/watch/apd830528336 , https://support.apple.com/108906
- 구조 **[사실]**: "Full Schedule" 아래에 일정이 여럿 있고 "Add a Schedule For Other Days"(옛 iOS 표현)나 "Add Another Schedule"(현재 iOS 표현)로 더한다. 일정마다 요일을 고른다. "Tap a day to add or remove it from your schedule." "The schedule applies only to days shown with solid-color circles." 끝은 "Done"이다.
- 요일 겹침 **[확인 못함]**: 한 요일이 두 일정에 들어갈 수 있는지(딩동댕처럼 요일마다 하나인지)는 공식 문서에서 확인하지 못했다.
- 가져올 점: "일정마다 요일 동그라미를 눌러 켠다"는 모델과 "다른 요일을 위한 일정 추가"라는 문구. 이름 붙은 템플릿이 요일을 나눠 갖는 구조가 딩동댕과 가장 가깝다.
- 맞지 않는 점: 일정에 이름을 짓지 않는다.

### 참고에서 뺀 것

- Primex OneVue 종 시간표: 도움말이 Cloudflare로 막혀 본문을 읽지 못했다. 검색 요약에는 "이름 + 적용 요일 + 날짜 범위, 요일마다 기본 시간표, 날짜 예외 시간표"가 있으나 **[확인 못함]**이라 표에 넣지 않았다.
- iPhone 집중 모드 일정, Windows 시계 알람, Google 캘린더 근무 시간, Google 비즈니스 프로필 영업시간: 공식 문서에서 요일 선택 방식을 확인하지 못했다.

## 3. 비교

| 제품 | 구조 | 요일 배정 방식 | 만들 때 이름 | 저장 | 배정까지 깊이 [추정] |
|---|---|---|---|---|---|
| Cal.com | 목록 → 상세 페이지 | 요일 줄 + 다른 요일로 복사(체크박스, 모두 선택) | 예(대화상자) | 명시적 Save, 변경 없으면 잠김 | 상세 1단 + 팝오버 |
| Calendly | 드롭다운 전환 + 한 화면 | 요일 줄 | 예 | 자동 저장 | 0~1단 |
| Minga | 탭 + 만들기 양식 | 템플릿 양식 안 "Applies on" + 날짜별 예외 | 예(같은 양식) | Create/Save | 양식 1단 |
| Intrado Scheduler | 템플릿 목록 + 마법사 | 요일 → 템플릿을 한 화면에서 모두 고름 | 예 | Save / Apply | 마법사 1단 |
| PowerSchool | 날짜 패턴의 날마다 | 다른 날로 복사 | 해당 없음 | 문서에 없음 | — |
| Rachio | 카드 목록 + 마법사 | 템플릿 안 특정 요일 | 예(마법사) | Done/Save | 마법사 여러 단계 |
| tado | 방 → 일정 | 요일 묶음 3종 + 붙여 넣기 | 해당 없음 | 문서에 없음 | — |
| Google Nest | 요일 → 이벤트 + 프리셋 공유 | 이벤트에서 다른 요일 함께 선택, 하루 복사 | 프리셋 이름 | Done/Save | 1단 |
| ecobee | 달력형 한 화면 | 여러 요일로 복사 | 문서 확인 못함 | 문서 확인 못함 | 한 화면(공식 글) |
| Honeywell Home | 일정 유형 선택 | Grouped / Single day | 해당 없음 | 문서 확인 못함 | — |
| iPhone 알람 | 목록 → 편집 시트 | 템플릿(알람) 안 Repeat | 선택(Label) | Done | 시트 1단 |
| Android 알람 | 목록 줄 펼침 | 줄 안 요일 일곱 글자 | 선택(Alarm name) | 문서에 일부만 | 0단 |
| Samsung 알람 | 목록 → 만들기 화면 | 만들기 화면 안 요일 | 선택(저장 전) | Save | 1단 |
| Apple 수면 일정 | 일정 여럿 → 편집 | 일정 안 요일 동그라미 | 이름 없음 | Done | 1단 |

## 4. 되풀이되는 패턴

1. **템플릿이 요일을 가진다(템플릿 편집 화면 안 요일 칩)** — Minga, Rachio, iPhone · Android · Samsung 알람, Apple 수면 일정, Nest 이벤트의 "다른 요일" (7곳). 여러 요일을 한 화면에서 한 번에 켠다. 딩동댕처럼 "요일마다 하나" 규칙이 있을 때 다른 템플릿이 가진 요일을 켜면 어떻게 되는지는 어느 문서도 설명하지 않았다.
2. **한 요일을 다른 여러 요일로 복사** — Cal.com, PowerSchool, tado, Nest, ecobee (5곳, Calendly는 일정 사이 복사만 있다). 요일마다 시간이 따로 있는 모델에서 쓴다.
3. **요일 → 템플릿을 한 화면에서 모두 고르는 배정 화면** — Intrado 마법사, Minga 달력(날짜별) (2곳). 딩동댕의 데이터 모델과 정확히 같지만 드물다.
4. **요일 묶음 선택지(매일 / 평일+주말 / 요일마다)** — tado, Honeywell (2곳).
5. **만들 때 이름 받기** — Cal.com, Calendly, Minga, Intrado, Rachio(마법사, 복제할 때도 기본 이름 "[이름] copy") (템플릿형 5곳 모두). 이름을 나중에 짓게 하는 제품은 찾지 못했다. 이름을 고치는 곳은 확인된 범위에서 상세 화면 머리글(Cal.com)이나 같은 편집 화면(Rachio, 알람)이다. 별도 "편집 모드"를 둔 곳은 없었다.
6. **저장 모델은 섞여 있다** — 일정 내용은 명시적 Save가 다수(Cal.com, Rachio, Nest, Intrado, Samsung)다. Calendly만 자동 저장이다. 작은 선택(복사 대상 고르기)은 팝오버 안 "Apply/Cancel"로 끝낸다(Cal.com).

## 5. 딩동댕 방향 후보

DESIGN.md 제약: 창 최소 920×580, 왼쪽 세로 줄 80, 흰 카드, Jua, 화면 제목 · 설명 · 도움말 없음, 아이콘만 쓰는 것과 글자로 쓰는 것의 구분, 교시 편집은 명시적 저장, 모달 폭 380 · Esc로 닫기, 배정된 시간표 지우기는 확인 모달.

**A. 시간표 편집 카드 머리에 "이름 + 요일 칩 일곱"** (패턴 1: Minga, Apple 수면 일정, 알람 3종, Nest)
오른쪽 카드 맨 위에 시간표 이름과 요일 칩을 두고, 칩을 누르면 그 요일이 이 시간표로 옮겨 온다. 다른 시간표가 가진 요일은 그 시간표 색으로 보이게 하고, 옮기면 "'평일반'에서 토요일을 옮겼어요"와 "되돌리기" 알림을 띄운다. 요일 배정은 칩을 누르는 즉시 반영하고, 교시는 지금처럼 "저장"으로 저장한다. 장점: 여러 요일을 한 화면에서 몇 번 눌러 배정하고, 모달이 필요 없다. 위험: 요일 칩 일곱이 이미 왼쪽 카드에도 있어 같은 정보가 두 번 보일 수 있다. 왼쪽 요일 동그라미의 역할을 다시 정해야 한다. 거절된 "머리글 바로 고치기" 시안과 겹치는지 확인이 필요하다.

**B. 만들기 = 이름 칸 하나짜리 모달, 고치기 = 그 자리** (패턴 5: Cal.com, Calendly, Minga, Intrado)
"시간표 만들기"를 누르면 이름 칸 하나와 "만들기" · "취소"가 있는 모달(폭 380)이 뜬다. 만든 뒤 그 시간표를 바로 고른 상태로 둔다(Cal.com의 바로 이동). 시간표 선택 창에서는 "편집" 모드를 없애고, 줄마다 이름 바꾸기 · 지우기 아이콘을 둔다(DESIGN.md의 아이콘만 쓰는 부품 규칙과 맞다). 모달에 닫기 아이콘을 넣는다. 장점: 지적된 문제 셋(이름 못 지음, 한 단계 더 깊음, 닫기 없음)을 지금 배치를 그대로 두고 고친다. 비용이 가장 적다. 한계: "요일을 하나씩만 배정"하는 문제는 남는다. A나 D와 함께 써야 한다.

**C. 요일 동그라미에서 "다른 요일에도" 팝오버** (패턴 2: Cal.com "Copy times to", Nest "Copy Wednesday schedule")
요일 동그라미를 눌러 시간표를 고르는 곳에 "이 시간표를 쓸 요일" 체크 일곱("모두 선택" 없이 평일 묶음 정도)을 함께 두고 "적용" · "취소"로 끝낸다. 장점: 지금 화면 구조를 거의 그대로 둔다. 위험: 여전히 모달이나 팝오버를 한 번 거친다. 동그라미 → 시간표 → 요일 체크라는 3단계가 되어 "클릭이 많다"는 불만을 다 풀지 못할 수 있다 **[추정]**.

**D. 요일 묶음으로 시작하기** (패턴 4: tado, Honeywell)
첫 시간표를 만들 때나 시간표가 하나뿐일 때 "매일 같음 / 평일 · 토 · 일 따로 / 요일마다" 가운데 하나를 고르게 해 요일 배정을 한 번에 끝낸다. 장점: 흔한 학원 운영 형태(평일반 + 토요반)를 한 번에 맞춘다. 위험: 시간표가 넷 이상(평일반, 토요 실습반, 자격증 대비반, 방학 특강)이면 묶음이 맞지 않는다. 방학 특강처럼 기간이 바뀌는 경우는 묶음으로 풀리지 않는다.

**E. 일곱 요일 줄에서 요일마다 시간표 드롭다운** (패턴 3: Intrado 마법사)
요일 동그라미 자리를 "월 [평일반 ▾] · 화 [평일반 ▾] …" 일곱 줄로 바꾼다. 데이터 모델과 일대일로 맞는다. 위험: 거절된 "별도 요일 표" · "격자" 시안과 거의 같다. 바깥 근거도 2곳뿐이라 다시 내기 어렵다.

권하는 순서 **[추정]**: B는 어떤 방향과도 함께 쓸 수 있고 비용이 낮으니 먼저 한다. 요일 배정은 근거가 가장 많은 A를 시안으로 확인한다.

## 6. 사용자에게 물을 것

1. 머릿속 그림이 "이 시간표는 월~금에 쓴다"(시간표가 요일을 가짐, A)인가, "월요일은 평일반이다"(요일이 시간표를 가짐, 지금 · C · E)인가?
2. 이미 다른 시간표가 쓰는 요일을 고르면, 말없이 옮기고 "되돌리기"를 보여 줄까, 먼저 묻는 모달을 띄울까?
3. 요일 배정은 누르는 즉시 반영하고 교시만 "저장"으로 남겨도 되는가? (Calendly는 모두 자동, Cal.com은 모두 명시 저장)
4. 시간표는 보통 몇 개인가? 둘 셋이면 D의 묶음으로 충분하고, 넷 이상이면 A가 맞다.
5. 방학 특강처럼 일정 기간만 쓰는 시간표가 있는가? 있다면 Minga · Intrado처럼 "요일 기본값 + 날짜 예외"가 필요하다. 지금 글로서리의 요일 배정 정의 밖이다.
6. A의 요일 칩은 거절된 "머리글 바로 고치기" 시안과 무엇이 같고 무엇이 달랐는가? 시안으로 확인한다.
