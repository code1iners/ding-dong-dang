# 서명 없는 빌드 산출물의 설치 실측

Type: task
Status: open
Blocked by: 12

## Question

서명 없는 설치 파일을 실제로 만들어 다른 기기에 옮겼을 때 설치와 첫 실행이 되는가? [서명 없는 최소 Electron 앱으로 상주 동작 실측](12-unsigned-app-measurement.md)에서 만든 최소 앱을 그대로 써서 측정하고 관찰을 기록한다. 배경은 [서명 없는 Electron 앱의 설치 경험과 빌드 방법 조사](02-unsigned-distribution.md)의 미확인 항목이다.

- Apple Silicon 개발 PC에서 electron-builder로 Windows NSIS 설치 파일이 만들어지는지. 안 되면 GitHub Actions 러너로 만든다.
- macOS: ad-hoc 서명 빌드를 내려받은 것처럼 격리 속성이 붙은 상태에서 열 때 "확인할 수 없음"과 "손상됨" 중 어느 경고가 뜨는지, Open Anyway 절차로 열리는지. 다른 Mac이 있으면 거기서도 확인한다.
- Windows 11: 사용자의 개인 Windows PC에서 설치 파일 실행 시 SmartScreen 경고의 한국어 문구와 통과 절차, 설치 후 실행 여부를 확인한다. 그 PC의 Smart App Control 상태를 먼저 기록하고, 켤 수 있으면 켠 상태에서 차단 화면의 모습과 문구도 기록한다. 사용자가 따라 할 점검 목록을 만들어 전달한다.
