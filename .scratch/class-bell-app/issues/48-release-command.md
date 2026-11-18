# 48: 릴리스 명령

**What to build:** 개발 Mac에서 명령 하나로 두 OS의 빌드, Mac 번들 재서명, 업데이트 안내 파일 서명, 자동 검사, GitHub Releases 게시까지 한다. 틀린 산출물은 올리기 전에 멈춘다. [스펙](../spec.md)의 "릴리스 명령"과 `docs/adr/0001-in-app-update-trust.md`를 따른다. 구현 선례는 `~/workspace/work/stardraft`다.

Blocked by: 47

Status: resolved

- [x] 명령이 차례로 한다: 두 OS 빌드, Mac 최상위 번들만 `designated => identifier "app.squadify.dingdongdang"`로 재서명(`mac.requirements`는 쓰지 않음), 재서명 뒤 zip과 dmg 다시 만들기, `latest.yml`과 `latest-mac.yml`의 해시 갱신과 Ed25519 서명(서명 필드는 목록), 자동 검사, 게시.
- [x] 개인 키는 Keychain에서 읽는다. 게시는 이 Mac의 `gh` 로그인을 쓰고, 초안이 아닌 게시 상태에 semver 태그다.
- [x] 올리기 전 자동 검사: Mac 최상위 번들의 지정 요구 조건, 버전 없는 파일 이름, 안내 파일의 해시와 서명. 하나라도 틀리면 올리지 않는다.
- [x] 올리지 않는 모드가 있고, 그 모드로 처음부터 검사까지 통과한다.
- [x] 테스트: 지정 요구 조건이 빠진 번들, 서명이 틀린 안내 파일, 버전이 든 파일 이름에서 검사가 멈춘다.
- [x] 에이전트가 올리지 않는 모드의 산출물에서 `codesign -d -r-`로 지정 요구 조건을, 앱의 검증 함수로 안내 파일의 서명을 확인한다.
- [x] 이 티켓은 실제로 게시하지 않고 GitHub 저장소도 만들지 않는다. 첫 릴리스는 수동 통합 테스트 뒤에 사용자가 따로 요청한다.
- [x] 타입 검사, 린트, 전체 자동 테스트가 통과한다.

## Comments

- 2026-11-18 (에이전트): 구현했다. 명령은 `npm run release`(게시)와 `npm run release -- --no-publish`(올리지 않는 모드)다. 알 수 없는 인수가 오면 멈춰서 오타로 게시 모드가 되지 않는다.
  - 차례(`scripts/release.mts`):
    1. Keychain에서 개인 키를 읽고, 짝인 공개 키가 `src/main/update-public-keys.ts`에 있는지 빌드 전에 본다.
    2. 게시 모드에서만 게시 전 확인을 한다. 작업 트리가 깨끗하고, `gh`가 로그인되어 있고, 저장소가 있고, 같은 태그의 릴리스가 없고, 지금 커밋이 GitHub에 있어야 한다.
    3. `dist/`를 비우고 `npm run dist`로 두 OS를 빌드한다.
    4. 안내 파일의 해시를 고치고 서명한다.
    5. 자동 검사를 한다.
    6. `gh release create v<버전> … --target <커밋> --latest`로 게시한다(`--draft` 없음). 게시한 뒤에는 초안이 아닌지, 사전 릴리스가 아닌지, 올라간 파일이 다섯인지 다시 읽어 확인한다.
  - 재서명(`scripts/mac-signature.mts`): 티켓의 "재서명 뒤 zip과 dmg 다시 만들기"는 선례 stardraft와 같은 방식으로 했다. 빌드 설정의 `afterSign` 훅이 electron-builder의 ad-hoc 서명 뒤, dmg와 zip을 만들기 전에 최상위 번들만 `--deep` 없이 `designated => identifier "app.squadify.dingdongdang"`로 다시 서명한다. `mac.requirements`는 쓰지 않는다. 그래서 dmg와 zip은 처음부터 재서명한 번들로 묶이고, 빌드한 번들을 다시 풀어 묶을 필요가 없다. 훅은 재서명 뒤 바로 검사해, 틀리면 dmg와 zip을 만들기 전에 빌드를 멈춘다.
  - 해시 갱신과 서명(`scripts/release-check.mts`의 `signUpdateInfo`): 안내 파일의 모든 파일 항목에 대해 sha512와 크기를 실제 파일로 다시 계산해 고쳐 쓰고, `dingDongDangSignatures` 목록에 개인 키마다 서명을 하나씩 넣는다.
    - 실제 빌드의 `latest-mac.yml`에는 zip과 dmg 두 항목이 있어 둘 다 서명한다. 처음에는 "zip 항목 하나"만 허용하는 검사였는데, 실제 산출물에서 멈춰서 규칙을 바꿨다. 지금 규칙은 "항목이 모두 올리는 파일이고, 그중에 업데이트 파일(zip·exe)이 있다"이다.
  - 자동 검사(`checkRelease`): 아래 중 하나라도 틀리면 거부한다.
    - 파일 이름: 다섯 파일이 버전과 공백이 없는 이름으로 있고, 안내 파일의 url과 path에 버전이 없다.
    - 안내 파일: 버전, 크기, sha512, 맨 위 sha512가 맞다.
    - 서명: 모든 서명이 앱의 공개 키 목록으로 검증되고, 목록의 키마다 서명이 있다.
    - Mac 번들: zip을 `ditto`로 풀고 dmg를 읽기 전용으로 붙여, 그 안의 최상위 번들이 `codesign --verify --deep --strict`를 통과하고 지정 요구 조건이 정확히 맞다.
  - `.blockmap`은 올리지 않는다. 앱이 차등 다운로드를 끄기 때문이다(`src/main/update-feed.ts`).
  - `js-yaml`(electron-builder · electron-updater와 같은 4.3.2)과 `@types/js-yaml`을 devDependency로 더했다.
- 테스트: 실제 `codesign` · `ditto` · `hdiutil`로 만든 작은 시험 번들을 쓴다(macOS에서만 돈다).
  - `scripts/mac-signature.test.mts`: ad-hoc 서명만 한 번들, 다른 식별자로 서명한 번들, 서명 뒤 바뀐 번들에서 멈추고, 재서명한 번들은 통과한다.
  - `scripts/build-config.test.mts`: 빌드 설정의 `afterSign`이 번들을 앱 식별자로 재서명하고, `mac.requirements`는 없다.
  - `scripts/release-check.test.mts`: 멈추는 경우는 아래와 같다.
    - 지정 요구 조건이 빠진 zip과 dmg
    - 모르는 키로 서명한 안내 파일과 서명이 없는 안내 파일
    - 서명 뒤 바꿔치기한 파일
    - 키를 바꾸는 동안 서명 하나가 빠진 경우
    - 버전이 든 파일 이름
    - 업데이트 파일 항목이 없거나 올리지 않는 파일을 가리키는 안내 파일
    - 앱 버전과 다른 안내 파일
  - 올바른 산출물은 통과하고, 그 안내 파일을 앱의 `verifyDownloadedUpdate`도 받아들인다. 검사 조건마다 일부러 빼 보는 변이로 테스트가 빨개지는 것을 확인했다.
- 에이전트 확인(이 Mac, 리뷰를 반영한 마지막 코드):
  - `npm run release -- --no-publish`가 처음부터 검사까지 종료 코드 0으로 통과했다.
  - 산출물을 따로 확인했다.
    - `codesign -d -r-`: zip을 푼 번들, dmg 안의 번들, `dist/mac-arm64`의 번들 모두 `designated => identifier "app.squadify.dingdongdang"`이다. 중첩 Helper 앱은 cdhash 그대로다.
    - 앱의 `verifyDownloadedUpdate`(지금 버전 0.0.9로 가정): `latest-mac.yml`+zip과 `latest.yml`+exe가 통과하고, 안내의 버전을 바꾸면 `signature-mismatch`로 거절한다.
    - 재서명한 번들을 `--data-dir` 임시 폴더로 띄우니 살아 있었다. 이 실행은 로그인 항목을 건드리지 않는 부품을 쓴다.
  - 게시 경로는 실제로 돌리지 않았다(티켓 지시). `gh`가 로그인되어 있는 것과, 릴리스가 없을 때 `gh release view`가 `release not found`를 내는 것은 읽기 전용 조회로 확인했다. 저장소가 없어도 같은 문구가 나오므로, 저장소가 있는지를 먼저 본다.
- 판단: 스펙에 없는 게시 전 확인(깨끗한 작업 트리, push된 커밋, 태그 중복, 저장소 존재)과 게시 뒤 상태 재확인을 더했다. 빌드에 몇 분이 걸리고, 잘못 게시하면 설치된 PC의 업데이트 경로를 망가뜨리기 때문이다(스펙 85번 이야기).
- 검증: 리뷰를 반영한 마지막 변경 뒤 `npm run check`가 통과했다(typecheck, lint, vitest 438개, e2e 89개).
- 커밋 뒤 깨끗한 작업 트리에서 게시 모드(`npm run release`)를 돌려 보았다. 저장소가 아직 없어 "게시 전 확인" 단계에서 "GitHub 저장소 code1iners/ding-dong-dang를 찾지 못했습니다"로 멈췄고, 빌드와 업로드는 하지 않았다. 첫 실제 게시는 사용자가 저장소를 만들고 push한 뒤 따로 요청할 때 한다.
- 2026-11-18 (에이전트, 티켓 정리): 항목별 완료 근거를 대조했다. 근거는 모두 리뷰를 반영한 마지막 코드(`6c507ea`)에서 얻었다. 그 뒤 `b93cedb`는 티켓 파일만 고쳤다.
  1. 차례: `scripts/release.mts`의 단계 순서대로다. 재서명은 빌드 설정의 `afterSign`(`scripts/mac-signature.mts`)이 dmg·zip을 만들기 전에 한다. 해시 갱신과 서명은 `signUpdateInfo`가 한다. 올리지 않는 모드의 실행 기록에서 빌드 → 해시 갱신·서명 → 검사가 차례로 통과했다. 게시 단계는 7번 항목에 따라 실행하지 않았다. 코드에서 `--draft` 없이 `--latest`와 `v<semver>` 태그로 부르는 것을 확인했다.
  2. Keychain과 gh: 올리지 않는 모드가 Keychain에서 키를 읽고 공개 키 목록과 짝인지 확인했다. 게시 모드를 돌리니 `gh` 로그인 확인을 지나 저장소가 없는 곳에서 빌드 전에 멈췄다.
  3. 자동 검사: `checkRelease`가 지정 요구 조건(zip·dmg 안 번들), 버전 없는 파일 이름, 안내 파일의 해시와 서명을 본다. 틀리면 예외가 나서 게시 단계까지 가지 않는다. 테스트와 변이로 확인했다.
  4. 올리지 않는 모드: `npm run release -- --no-publish`가 처음부터 검사까지 종료 코드 0으로 통과했다.
  5. 테스트: `scripts/release-check.test.mts`와 `scripts/mac-signature.test.mts`가 지정 요구 조건이 빠진 번들, 서명이 틀린 안내 파일, 버전이 든 파일 이름에서 멈추는 것을 본다.
  6. 에이전트 확인: 산출물을 `codesign -d -r-`와 앱의 `verifyDownloadedUpdate`로 확인했다(위 기록).
  7. 게시하지 않음: 게시하지 않았고 저장소도 만들지 않았다.
  8. 검사: 마지막 코드 변경 뒤 `npm run check`가 통과했다(vitest 438개, e2e 89개).
  - 판정: 완료 8, 비필수 제외 0, 미완료 0. 실제 GitHub 게시, 그리고 그렇게 게시한 릴리스를 받은 앱의 업데이트·재실행은 이 티켓 범위 밖이다. 사용자가 첫 릴리스를 따로 요청한 뒤 수동 통합 테스트에서 본다.
