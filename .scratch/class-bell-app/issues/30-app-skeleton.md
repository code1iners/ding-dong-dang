# 30: 앱 뼈대와 검사 도구

**What to build:** 앱을 실행하면 왼쪽 세로 줄(현황, 시간표, 종, 설정)과 빈 네 화면이 있는 창이 뜬다. 이후 티켓이 기댈 검사 도구가 모두 돈다. [스펙](../spec.md)의 "플랫폼과 기술 스택", "모듈 구성"과 루트 `DESIGN.md`를 따른다.

Blocked by: None (can start immediately)

Status: ready-for-agent

- [ ] Electron 45 계열, TypeScript, React, Vite로 앱이 뜨고 왼쪽 세로 줄의 단추로 네 화면을 오간다. 창은 최소 920×580이고 크기를 바꿀 수 있다.
- [ ] `DESIGN.md`의 색, 글자 크기, 모서리, 여백이 CSS 변수로 있고 Jua 글꼴이 앱에 내장되어 있다. OS가 어두운 모드여도 색이 바뀌지 않는다.
- [ ] 렌더러는 Node와 파일 시스템에 직접 닿지 않는다(`contextIsolation` 켬, `nodeIntegration` 끔). 메인과의 통로는 "상태 구독"과 "명령" 두 종류다.
- [ ] 실행 인자 `--data-dir=<경로>`로 데이터 폴더를 바꿀 수 있다.
- [ ] 명령 하나씩으로 타입 검사, 린트, Vitest가 돈다.
- [ ] Playwright가 임시 데이터 폴더로 실제 앱을 띄워 네 화면을 오가는 테스트 하나가 통과한다.
- [ ] 측정용 폴더 `prototypes/`는 제품 코드의 빌드와 검사 대상에서 빠져 있다.
- [ ] 타입 검사, 린트, 전체 자동 테스트가 통과한다.
