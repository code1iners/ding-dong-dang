# 서명 없는 앱의 앱 내 업데이트 가능성 조사

Type: research
Status: resolved
Blocked by: 

## Question

설정 화면에서 업데이트를 확인하고, 내려받아 설치한 뒤 다시 실행하는 기능을 서명 없는 앱에서 만들 수 있는가? [배포와 설치 방식 결정](11-distribution-decision.md)에서 사용자가 요청했다.

- Windows: 서명 없는 NSIS 설치(원클릭, 사용자별)에서 electron-updater가 GitHub Releases의 새 버전을 내려받아 설치하고 다시 실행할 수 있는가. 서명 검증을 어떻게 다루는가. 앱이 내려받은 설치 파일에 SmartScreen이나 Smart App Control이 반응하는가.
- macOS: ad-hoc 서명 앱(Apple Silicon)에서 electron-updater(Squirrel.Mac)가 동작하는가. 동작하지 않으면 대안(직접 내려받아 앱 번들을 바꾸는 방식, dmg를 내려받아 열어 주는 방식)과 각각의 Gatekeeper 동작(앱이 내려받은 파일에 격리 속성이 붙는지, "그래도 열기"를 다시 거치는지).
- GitHub Releases를 업데이트 서버로 쓸 때의 조건(공개 저장소 여부, 배포 전용 저장소 분리, 필요한 산출물 `latest.yml` · `latest-mac.yml` · zip, 요청 한도).
- 버전과 무관하게 항상 최신 설치 파일을 가리키는 고정 내려받기 주소를 만들 수 있는가(외부 사이트의 내려받기 버튼용).

## Answer

조사 문서: `research/unsigned-in-app-update` 브랜치(커밋 `9c5501a`)의 `docs/research/unsigned-in-app-update.md`.

확인 방식: npm 패키지 소스(electron-updater 6.8.11, app-builder-lib 26.18.0), Electron 45.3.3 문서와 거기 고정된 Squirrel.Mac 소스, Apple · Microsoft · GitHub 공식 문서를 읽었다. 업데이트 과정 자체는 실행하지 않았다. 직접 돌린 것은 이 Mac의 `codesign` 측정과 GitHub 주소에 대한 `curl`뿐이다.

- **Windows**: 서명이 없어도 electron-updater의 내려받기 → 설치 → 재실행을 막는 분기가 없다(소스). `app-update.yml`에 `publisherName`이 없으면 서명 검증을 건너뛰고 `latest.yml`의 `sha512` 대조만 남는다. `publisherName`을 직접 넣으면 업데이트가 거부되므로 넣지 않는다. 앱이 받은 설치 파일에 Mark of the Web이 붙는지, SmartScreen이 반응하는지, 전체 흐름이 끝까지 도는지는 미확인이다.
- **macOS**: 기본 ad-hoc 서명으로는 electron-updater의 MacUpdater(Squirrel.Mac)가 동작하지 않는다. Squirrel.Mac은 새 번들이 실행 중인 앱의 지정 요구 조건을 만족하는지 검사하는데 ad-hoc 서명의 요구 조건은 빌드마다 다른 `cdhash`다(Apple TN3127, 이 Mac에서 `codesign`으로 실패 확인). Electron 앱으로 재현하지는 않았다.
- **macOS 우회 가능성(미확인)**: 지정 요구 조건을 `identifier`로 직접 정해 서명하면 ad-hoc끼리도 검사를 통과했다(`codesign` 실측). electron-builder에 `mac.requirements` 옵션이 있으나 ad-hoc에 적용되는지, 설치까지 끝나는지는 확인하지 않았다.
- **macOS 권고**: 앱이 dmg를 직접 내려받아 `sha512`를 대조한 뒤 열어 주고, 사용자가 끌어다 놓아 덮어쓰고 다시 실행한다. 실패해도 처음 설치와 같은 절차로 떨어진다. 앱이 받은 파일에 격리 속성이 붙는지, 덮어쓴 뒤 "그래도 열기"를 다시 거치는지는 미확인이다.
- **GitHub Releases**: 릴리스 저장소는 공개여야 한다. 필요한 산출물은 `latest.yml` + exe(+blockmap), `latest-mac.yml` + zip + dmg다. electron-builder는 초안 릴리스를 만들므로 게시해야 앱이 새 버전을 본다. 태그는 semver다. 공개 저장소용 제공자는 한도가 있는 REST API가 아니라 `github.com` 웹 주소를 쓴다.
- **고정 내려받기 주소**: `releases/latest/download/<파일명>`을 쓸 수 있다(`curl`로 302 확인). 조건은 파일명에서 버전과 공백을 빼고(`artifactName` 지정), 릴리스가 초안 · 프리릴리스가 아니며, 저장소가 공개인 것이다.

실측으로 넘길 것은 조사 문서 6절에 있다.
