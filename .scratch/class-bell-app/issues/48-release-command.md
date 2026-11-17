# 48: 릴리스 명령

**What to build:** 개발 Mac에서 명령 하나로 두 OS의 빌드, Mac 번들 재서명, 업데이트 안내 파일 서명, 자동 검사, GitHub Releases 게시까지 한다. 틀린 산출물은 올리기 전에 멈춘다. [스펙](../spec.md)의 "릴리스 명령"과 `docs/adr/0001-in-app-update-trust.md`를 따른다. 구현 선례는 `~/workspace/work/stardraft`다.

Blocked by: 47

Status: ready-for-agent

- [ ] 명령이 차례로 한다: 두 OS 빌드, Mac 최상위 번들만 `designated => identifier "app.squadify.dingdongdang"`로 재서명(`mac.requirements`는 쓰지 않음), 재서명 뒤 zip과 dmg 다시 만들기, `latest.yml`과 `latest-mac.yml`의 해시 갱신과 Ed25519 서명(서명 필드는 목록), 자동 검사, 게시.
- [ ] 개인 키는 Keychain에서 읽는다. 게시는 이 Mac의 `gh` 로그인을 쓰고, 초안이 아닌 게시 상태에 semver 태그다.
- [ ] 올리기 전 자동 검사: Mac 최상위 번들의 지정 요구 조건, 버전 없는 파일 이름, 안내 파일의 해시와 서명. 하나라도 틀리면 올리지 않는다.
- [ ] 올리지 않는 모드가 있고, 그 모드로 처음부터 검사까지 통과한다.
- [ ] 테스트: 지정 요구 조건이 빠진 번들, 서명이 틀린 안내 파일, 버전이 든 파일 이름에서 검사가 멈춘다.
- [ ] 에이전트가 올리지 않는 모드의 산출물에서 `codesign -d -r-`로 지정 요구 조건을, 앱의 검증 함수로 안내 파일의 서명을 확인한다.
- [ ] 이 티켓은 실제로 게시하지 않고 GitHub 저장소도 만들지 않는다. 첫 릴리스는 수동 통합 테스트 뒤에 사용자가 따로 요청한다.
- [ ] 타입 검사, 린트, 전체 자동 테스트가 통과한다.
