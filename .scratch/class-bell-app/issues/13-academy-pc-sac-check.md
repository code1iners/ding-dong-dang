# 학원 PC의 Smart App Control 상태 확인

Type: task
Status: resolved
Blocked by: 

## Question

앱을 설치할 학원 Windows PC에서 Smart App Control이 켜져 있는가? 켜져 있으면 서명 없는 앱은 경고가 아니라 차단되므로 "서명 없이 배포한다"는 전제를 다시 봐야 한다. 배경은 [서명 없는 Electron 앱의 설치 경험과 빌드 방법 조사](02-unsigned-distribution.md)이다.

사용자가 학원 PC에서 확인할 것:

- Windows 보안 > 앱 및 브라우저 컨트롤 > 스마트 앱 컨트롤 설정의 상태(켬, 평가, 끔).
- Windows 버전(설정 > 시스템 > 정보)과 PC 대수.
- 설치된 타사 백신이 있는지.
- 노트북인지 데스크톱인지, 수업 중 화면이 꺼지거나 잠자기에 들어가도록 설정돼 있는지.

## Answer

확인하지 않고 닫는다. 이 티켓은 사람이 학원 PC 앞에서 봐야만 끝나는데, 티켓의 검증은 에이전트가 하는 것만 두고 사람이 하는 확인은 구현을 마친 뒤의 수동 통합 테스트에서만 하기로 했다(2026-11-16 사용자 결정). 네 항목은 [구현 뒤 점검 목록](../checklists/post-implementation.md)으로 옮겼다.

이 티켓을 기다리던 결정은 나쁜 쪽을 가정하고 내린다.

- Smart App Control이 **켜져 있을 수 있다**고 본다. 그 PC에서는 서명 없는 앱이 경고가 아니라 차단되므로, [배포와 설치 방식 결정](11-distribution-decision.md)은 차단된 경우의 안내까지 정해야 한다.
- 타사 백신이 있을 수 있고, 노트북일 수 있으며, 수업 중 화면이 꺼지거나 잠자기에 들어가도록 설정돼 있을 수 있다고 본다. [상주와 신뢰성 정책 결정](07-background-reliability-policy.md)이 이 가정을 쓴다.

남는 위험: 학원 PC에서 Smart App Control이 실제로 켜져 있고 끌 수 없다면 "서명 없이 배포한다"는 전제가 구현 뒤에야 깨진다. 이 위험을 알고 넘긴 것이다.
