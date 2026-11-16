# 서명 없는 Electron 앱의 설치 경험과 빌드 방법 조사

Type: research
Status: resolved
Blocked by: 

## Question

코드 서명과 공증 없이 Electron 앱을 소수에게 직접 나눠 줄 때, Windows 11과 현재 macOS에서 사용자가 실제로 겪는 절차는 무엇인가?

- Windows 11: SmartScreen 경고의 모습과 통과 절차, 설치 형식(NSIS, MSI, portable)별 차이.
- macOS: Gatekeeper가 미공증 앱을 다루는 방식(최근 macOS의 '시스템 설정에서 열기' 절차), Apple Silicon에서 필요한 ad-hoc 서명, 격리 속성.
- 빌드 도구(electron-builder, Electron Forge)의 현재 상태와 차이, macOS에서 Windows 설치 파일을 만들 수 있는지 또는 CI가 필요한지.
- 서명 없이 쓸 수 없게 되는 기능(자동 실행, 알림 등)이 있는지.

## Answer

조사 문서: `research/unsigned-distribution` 브랜치(커밋 `dd3fa41`)의 `docs/research/unsigned-distribution.md`.

확인 방식: 공식 문서와 배포된 npm 패키지 소스만 읽었다. 실기기 설치와 빌드는 하지 않았다.

확인된 사실:

- **Windows SmartScreen**: 서명 없는 파일은 "Windows protected your PC" 경고가 뜨고 "More info" > "Run anyway"로 통과한다. 평판이 버전마다 0에서 시작하므로 소수 배포에서는 새 버전마다 경고가 반복된다.
- **Smart App Control**: 강제 모드면 서명 없는 코드는 경고가 아니라 차단된다. 앱별 예외가 없고, 방법은 SAC를 끄거나 신뢰되는 CA 인증서로 서명하는 것뿐이다.
- **Windows 설치 형식**: SmartScreen과 SAC가 형식별로 다르게 반응한다는 1차 자료는 없다. electron-builder의 기본은 NSIS(사용자별 설치)이고 Squirrel.Windows는 deprecated다.
- **macOS Gatekeeper**: macOS 15부터 Control-클릭 우회가 없어졌다. 열기 시도 > 시스템 설정 > 개인정보 보호 및 보안 > Open Anyway(시도 후 약 1시간만 표시) > 암호 입력 순서다. 한 번 통과하면 예외로 저장된다.
- **Apple Silicon**: 모든 실행 코드에 서명이 필요하고 ad-hoc으로 충분하다. ad-hoc은 Gatekeeper를 통과하지 못하므로 위 절차는 그대로 남는다. electron-builder는 ad-hoc을 자동 적용하지 않아 identity를 `"-"`로 명시해야 한다.
- **빌드 도구**: electron-builder 26.18.0과 Electron Forge 8.0.1 모두 유지되고 있다. electron-builder는 Mac에서 Wine을 거쳐 NSIS를 만든다. 문서가 보장하는 경로는 GitHub Actions의 OS별 러너다. `electron.build/docs/`는 미출시 v27 기준이라 안정판은 `electron.build/v26/docs/`를 봐야 한다.
- **제약 기능**: macOS에서 서명이 없으면 OS 알림은 실패하고 로그인 자동 실행은 조용히 실패할 수 있다. Windows는 둘 다 서명을 요구하지 않는다. 종 알림은 OS 알림이 아닌 앱 창 안의 표시와 소리로 설계하는 쪽이 맞다.

미확인(실측이 필요한 것): 빌드 산출물이 macOS에서 "확인할 수 없음"(통과 가능)과 "손상됨" 중 어느 경고를 받는지, ad-hoc 서명 앱이 다른 Mac에서 열리는지(electron-builder 문서와 Apple 릴리스 노트가 충돌), Apple Silicon 개발 PC에서 Windows NSIS 빌드가 실제로 되는지, 학원 PC의 SAC 상태, 한국어 OS의 정확한 경고 문구, 타사 백신 반응.
