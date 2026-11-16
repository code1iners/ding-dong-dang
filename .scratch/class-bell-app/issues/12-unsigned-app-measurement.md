# 서명 없는 최소 Electron 앱으로 상주 동작 실측

Type: task
Status: open
Blocked by: 

## Question

조사로 확인하지 못한 상주 동작이 서명 없는 Electron 앱에서 실제로 어떻게 되는가? 트레이 상주 + 메인 프로세스 타이머 + 숨긴 창 오디오만 가진 버리는 최소 앱을 만들어 측정하고 수치와 관찰을 기록한다. 배경은 [Electron 상주와 시각 정확도의 OS별 한계 조사](01-os-background-reliability.md)의 미확인 항목이다.

- macOS: 서명 없는 앱과 ad-hoc 서명 앱에서 로그인 항목 등록(`setLoginItemSettings`)이 성공하는지, 실패하면 대안(사용자 LaunchAgent, 수동 로그인 항목 추가)이 동작하는지.
- macOS: 창을 숨긴 채 오래 둔 뒤 메인 프로세스 타이머가 얼마나 늦는지(App Nap), `powerSaveBlocker`를 켜면 달라지는지.
- 두 OS: 화면 잠금 중과 잠자기에서 깨어난 직후에 종이 울리는지, 숨긴 창에서 오디오가 제스처 없이 재생되는지.
- Windows 11: 사용자의 개인 Windows PC에서 같은 항목과 트레이 아이콘의 기본 표시 위치, 화면이 꺼졌을 때의 동작을 측정한다. 에이전트가 그 PC에 접근할 수 없으므로 사용자가 따라 할 점검 목록을 만들어 전달한다.
