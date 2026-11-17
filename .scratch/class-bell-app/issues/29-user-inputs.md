# 29: 구현 전에 사용자에게 받을 것

**What to build:** 구현에 필요한 사용자 개입(계정, 식별자, 권한)을 한 곳에 모아 받는다. 나머지 구현 티켓은 여기서 받은 값을 쓴다. 근거는 [스펙](../spec.md)의 "구현 전에 사용자에게 받을 것"이다.

Blocked by: None (can start immediately)

Status: done

- [x] 공개 GitHub 저장소의 소유자와 이름
- [x] 앱 식별자
- [x] Ed25519 키 쌍 생성 승인
- [x] 릴리스에 쓸 GitHub 인증

## Answer

2026-11-17에 사용자가 대화에서 답했다.

- **저장소**: 소유자는 사용자의 개인 계정 `code1iners`다. 저장소 이름은 사용자가 따로 말하지 않아 이 폴더 이름인 `ding-dong-dang`으로 둔다(에이전트의 가정). 그래서 주소는 `code1iners/ding-dong-dang`이고, 고정 내려받기 주소는 `https://github.com/code1iners/ding-dong-dang/releases/latest/download/<파일 이름>`이다. 저장소는 아직 만들지 않았고 이 작업 폴더에는 원격이 없다. 공개 저장소를 만들고 올리는 것은 밖으로 드러나는 일이라 첫 릴리스를 요청받을 때 사용자에게 확인하고 한다.
- **앱 식별자**: 사용자가 앱의 도메인을 `dingdongdang.squadify.app`으로 쓸 예정이라고 했다(Cloudflare에 `squadify.app` 도메인이 있다). 식별자는 이 도메인을 뒤집은 `app.squadify.dingdongdang`으로 한다(뒤집어 쓴 것은 에이전트의 해석이다). Mac의 지정 요구 조건에 들어가므로 첫 릴리스 뒤에는 바꿀 수 없다.
- **Ed25519 키 쌍**: 에이전트가 만들어도 된다. 개인 키는 개발 Mac의 Keychain과 `/Users/wraith/workspace/keys/ding-dong-dang`에 두고 저장소에는 넣지 않는다. 만드는 일은 [앱 내 업데이트](47-in-app-update.md)에서 한다.
- **GitHub 인증**: 이 Mac의 `gh` 로그인을 그대로 쓴다.
