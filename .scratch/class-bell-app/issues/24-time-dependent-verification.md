# 시각에 의존하는 동작의 자동 검증 방법 결정

Type: grilling
Status: open
Blocked by: 

## Question

에이전트가 실제 시각을 기다리지 않고 다음 동작을 자동으로 검증하려면 스펙에 어떤 구조와 테스트 방식을 요구해야 하는가?

- 종 시각에 종이 울리는 것, 같은 시각의 끝종 · 시작종 중 시작종만 울리는 것.
- 늦은 종 규칙(1분 이내만 울리고 밀린 것 중 최근 하나만 따진다)과 깨어난 직후의 동작.
- 시스템 시각 변경, 자정 넘김(오늘만 끄기 해제, 요일 배정 전환).
- 수업 구간 동안의 잠자기 막기 시작 · 해제.

정책은 [상주와 신뢰성 정책 결정](07-background-reliability-policy.md), [종소리 정책 결정](06-bell-policy.md), [시간표 모델 결정](05-timetable-model.md)에 있다. 사람이 하는 실기기 확인은 `checklists/post-implementation.md`에 따로 있다.
