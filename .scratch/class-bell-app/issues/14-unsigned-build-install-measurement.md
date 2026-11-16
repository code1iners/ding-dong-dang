# 서명 없는 빌드 산출물의 설치 실측

Type: task
Status: resolved
Blocked by: 12

## Question

서명 없는 설치 파일을 실제로 만들어 다른 기기에 옮겼을 때 설치와 첫 실행이 되는가? [서명 없는 최소 Electron 앱으로 상주 동작 실측](12-unsigned-app-measurement.md)에서 만든 최소 앱을 그대로 써서 측정하고 관찰을 기록한다. 배경은 [서명 없는 Electron 앱의 설치 경험과 빌드 방법 조사](02-unsigned-distribution.md)의 미확인 항목이다.

- Apple Silicon 개발 PC에서 electron-builder로 Windows NSIS 설치 파일이 만들어지는지. 안 되면 GitHub Actions 러너로 만든다.
- macOS: ad-hoc 서명 빌드를 내려받은 것처럼 격리 속성이 붙은 상태에서 열 때 "확인할 수 없음"과 "손상됨" 중 어느 경고가 뜨는지, Open Anyway 절차로 열리는지. 에이전트가 이 Mac에서 확인한다. 다른 Mac에서의 확인은 구현 뒤 수동 통합 테스트로 넘긴다.
- Windows 11: 설치 파일 실행 시 SmartScreen 경고 문구와 통과 절차, Smart App Control 차단 화면의 확인은 이 티켓에서 하지 않는다. 구현을 마친 뒤 수동 통합 테스트에서 한다(2026-11-16 사용자 결정, [서명 없는 최소 Electron 앱으로 상주 동작 실측](12-unsigned-app-measurement.md)).

## Answer

측정 환경: macOS 27.2.1 arm64(Rosetta 없음), electron-builder 26.18.0, Electron 45.3.3. 측정용 앱 `prototypes/bell-probe/`에 `builder.json`을 더해 만들었다. 2026-11-16 에이전트가 이 Mac에서 잰 것이다.

### Windows NSIS 설치 파일 빌드

- **기본 설정으로는 실패한다.** electron-builder가 내려받는 기본 NSIS 툴셋(`nsis-3.0.4.1`)의 `makensis`가 x86_64 전용이라 Rosetta가 없는 Apple Silicon에서 `spawn Unknown system error -86`으로 멈춘다. 앱 폴더(`win-unpacked`)까지는 만들어지고 설치 파일 단계에서 실패한다.
- **`toolsets.nsis: "1.2.1"`(베타 툴셋, makensis 3.12)을 지정하면 Wine과 Rosetta 없이 성공한다.** 약 18초에 `BellProbe Setup 0.0.1.exe`(121MB, `file` 판정: Nullsoft Installer self-extracting archive)가 나왔다. 설정은 `oneClick: true`, `perMachine: false`(사용자별 설치)다.
- 그래서 GitHub Actions 러너는 필요하지 않았다. 다만 이 툴셋은 electron-builder가 베타로 표시한 것이고, 대안은 Rosetta 설치 또는 Windows 러너다. 어느 경로를 쓸지는 [배포와 설치 방식 결정](11-distribution-decision.md)에서 정한다.
- 만들어진 설치 파일을 Windows에서 실행해 보지는 못했다(구현 뒤 확인).

### macOS ad-hoc 서명 빌드와 격리 속성

- `mac.identity: "-"`로 dmg와 zip이 만들어지고(약 38초) 앱의 `codesign --verify --deep --strict`가 통과한다. 서명 플래그는 `adhoc,runtime`이고 electron-builder가 `disable-library-validation`과 `allow-unsigned-executable-memory` 권한을 기본으로 넣는다. 격리 속성이 없는 상태에서는 실행되어 종이 재생됐다(`ok: true`).
- 격리 속성(`com.apple.quarantine`, 플래그 `0083`)을 붙여 열면 **"손상됨"이 아니라 "확인할 수 없음" 쪽 경고**가 뜬다. 문구는 "'BellProbe'을(를) 열지 않음 / Apple은 'BellProbe'에 사용자의 Mac에 손상을 입히거나 사용자의 개인정보에 침입할 수 있는 악성 코드가 없음을 확인할 수 없습니다."이고 버튼은 "휴지통으로 이동"과 "완료"뿐이다. 이 대화상자에서 바로 여는 길은 없다. [캡처](../assets/14-gatekeeper-adhoc-dialog.png). 앱은 실행되지 않았다.
- `spctl --assess`는 앱을 `rejected`, dmg를 `rejected (no usable signature)`로 답한다. 시스템 로그에서는 서명 검사 자체는 통과(`GK evaluateScanResult: 0`)한 뒤 프롬프트(유형 6)가 떴다.
- 비교: electron-packager가 만든 재서명 안 한 앱(`adhoc,linker-signed`, 봉인된 리소스 없음)은 같은 조건에서 다른 유형의 프롬프트(유형 1)가 떴다. 화면이 잠겨 있어 그 문구는 보지 못했다. 서명 검증이 실패하는 빌드라 "손상됨" 쪽일 가능성이 높지만 확인한 것은 아니다. 실제 앱은 어차피 ad-hoc으로 다시 서명한 빌드만 내보낸다.
- 격리 속성은 `xattr`로 직접 붙였다. 브라우저로 실제 내려받은 경우와 같은 속성이지만 내려받기 자체를 거친 것은 아니다.

### 하지 못한 것

- **Open Anyway 절차로 실제로 열리는지**: 시스템 설정의 버튼을 누르고 암호를 넣어야 해서 에이전트가 할 수 없다(측정 때 화면도 잠겨 있었다). 구현 뒤 수동 통합 테스트로 넘겼다.
- Windows에서의 설치와 실행, 다른 Mac에서의 확인은 처음부터 구현 뒤로 넘긴 항목이다.

### 마감 점검

- 항목 1 (Apple Silicon에서 NSIS 빌드): 완료. 기본 툴셋 실패, 베타 툴셋 성공.
- 항목 2 (macOS 경고 종류와 Open Anyway): 경고 종류는 완료. Open Anyway는 사람의 암호 입력이 필요해 제외하고 [구현 뒤 점검 목록](../checklists/post-implementation.md)으로 넘겼다.
- 항목 3 (Windows 11): 티켓에서 이미 제외.
