# 학원 PC의 Smart App Control 상태 확인

Type: task
Status: open
Blocked by: 

## Question

앱을 설치할 학원 Windows PC에서 Smart App Control이 켜져 있는가? 켜져 있으면 서명 없는 앱은 경고가 아니라 차단되므로 "서명 없이 배포한다"는 전제를 다시 봐야 한다. 배경은 [서명 없는 Electron 앱의 설치 경험과 빌드 방법 조사](02-unsigned-distribution.md)이다.

사용자가 학원 PC에서 확인할 것:

- Windows 보안 > 앱 및 브라우저 컨트롤 > 스마트 앱 컨트롤 설정의 상태(켬, 평가, 끔).
- Windows 버전(설정 > 시스템 > 정보)과 PC 대수.
- 설치된 타사 백신이 있는지.
- 노트북인지 데스크톱인지, 수업 중 화면이 꺼지거나 잠자기에 들어가도록 설정돼 있는지.
