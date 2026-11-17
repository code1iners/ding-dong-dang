# 46: 설치 파일과 데이터 지우기

**What to build:** 개발 Mac에서 Windows 설치 파일과 Mac dmg가 만들어진다. Windows에서 앱을 제거할 때 데이터를 지울지 묻고, 설정 화면의 "모든 데이터 지우기"로 흔적을 전부 지운다. [스펙](../spec.md)의 "배포와 설치"를 따른다. 근거는 [배포와 설치 방식 결정](11-distribution-decision.md), [서명 없는 빌드 산출물의 설치 실측](14-unsigned-build-install-measurement.md), [저장 방식과 백업 결정](17-storage-and-backup.md)의 검증 절이다. 저장소 주소와 앱 식별자는 [구현 전에 사용자에게 받을 것](29-user-inputs.md)에 있다.

Blocked by: 29, 40

Status: ready-for-agent

- [ ] 명령 하나로 이 Mac에서 `DingDongDang-Setup.exe`(NSIS 원클릭, 사용자별 설치, x64, 베타 NSIS 툴셋 `1.2.1`), `DingDongDang.dmg`, `DingDongDang-mac.zip`(Apple Silicon, ad-hoc 서명)이 만들어진다. 파일 이름에 버전과 공백이 없다.
- [ ] 앱 식별자는 `app.squadify.dingdongdang`, 표시 이름은 "딩동댕"이고 데이터 폴더 이름은 영문이다. 앱 아이콘이 [앱 아이콘과 트레이 아이콘](39-app-and-tray-icons.md)의 산출물이다.
- [ ] Windows 설치 파일은 바탕 화면과 시작 메뉴에 바로가기를 만들고 설치가 끝나면 앱을 띄우게 설정되어 있다.
- [ ] Windows 제거 때 "저장한 시간표와 종소리도 지울까요?"를 묻는 매크로가 들어 있다(기본 "아니요", 앱 내 업데이트가 옛 버전을 걷어 낼 때는 건너뜀, 자동 시작 등록은 항상 지움, `.nsh`는 UTF-8 BOM).
- [ ] 설정 화면 맨 아래 "모든 데이터" 줄의 단추가 확인 모달(기본 초점 "취소")을 거쳐 스펙의 지우기 범위를 지우고 앱을 종료한다.
- [ ] 실제 앱 테스트: "모든 데이터 지우기" 뒤에 임시 데이터 폴더에 저장 파일, 예비본, `sounds/`가 남지 않고 앱이 종료된다.
- [ ] 에이전트가 확인한다: Mac 앱의 `codesign --verify --deep --strict`가 통과한다, 만들어진 Mac 앱을 이 Mac에서 띄우면 종 재생이 시작된다, exe가 NSIS 설치 파일로 판정된다. Windows에서의 설치와 제거는 확인하지 않는다.
- [ ] 타입 검사, 린트, 전체 자동 테스트가 통과한다.
