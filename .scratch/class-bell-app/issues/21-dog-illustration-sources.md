# 무료 강아지 일러스트 소재 조사

Type: research
Status: resolved
Blocked by: 

## Question

앱에 내장해 배포할 수 있는 무료 강아지 일러스트는 어디서 구할 수 있고, 그중 정해진 화면 방향(외곽선 없는 단색 면의 플랫 벡터, 귀여운 2등신)에 쓸 만한 것은 무엇인가?

- Unsplash를 포함한 무료 이미지 · 일러스트 · 게임 에셋 제공 사이트별로, 강아지 그림의 유무와 라이선스(앱 내장 배포, 수정, 출처 표기 조건).
- 한 캐릭터로 표정이나 자세(평소, 신남, 졸림, 걷기, 앉기, 잠자기)가 여러 개 묶여 있는 소재가 있는지.
- 쓸 만한 후보는 실제 파일을 내려받아 비교 시안에 넣을 수 있게 한다.
- AI 이미지 생성은 조사 대상이 아니다.

## Answer

조사 문서: `research/dog-illustration-sources` 브랜치(커밋 `0ed222a`)의 `docs/research/dog-illustration-sources.md`. 내려받은 후보 파일 40개와 `manifest.json`은 시안 폴더 `~/.claude-mukkebi/mockups/ding-dong-dang/assets/cand/`에 있다.

핵심 결론: 한 캐릭터로 평소 · 신남 · 졸림 · 걷기 · 앉기가 모두 묶여 있고, 외곽선 없는 플랫이며, 라이선스가 분명한 소재는 찾지 못했다. 세 조건 중 둘까지만 맞는 소재가 있어서, 무엇을 고르든 졸림과 걷기는 따로 채워야 한다.

쓸 만한 후보:

- **Noto Emoji 강아지** (Apache-2.0): 외곽선 없는 플랫이고 얼굴과 전신이 같은 그림체다. 표정은 하나다. 움직이는 판은 CC BY 4.0이라 출처 표기가 필요하다.
- **Openclipart** (CC0): 그림체가 조건에 가까운 정면 전신과 코기 얼굴이 있고 단순한 도형이라 고치기 쉽다. 작품마다 작가가 다르고 걷는 옆모습은 시바견 8프레임뿐이다.
- **LottieFiles "Pancake" 시바견** (Lottie Simple License): 한 캐릭터의 움직이는 표정이 여럿 있는 유일한 소재다. 갈색 외곽선이 있고 졸림 · 걷기가 없으며 원본에는 계정이 필요해 보인다.
- **Game Art 2D 강아지 스프라이트** (CC0): 8동작 74프레임이 한 캐릭터로 있지만 굵은 외곽선의 게임 그림체다.
- **Unsplash**: 사진 위주지만 일러스트 구역이 있다. 퍼그 9컷이 자세를 가장 많이 갖췄으나 걷기가 없고 검은 외곽선이다.

권하지 않는 곳: Storyset · Freepik(약관상 배포 금지, 표기 필수), Vecteezy(재배포 금지), Icons8 · Ouch(무료 등급은 파생 금지, 링크 필수). Kenney에는 강아지가 없고 itch.io 무료 소재는 대부분 픽셀 아트다.

미확인: SVG Repo · Flaticon · OpenGameArt(접속 거부로 판단 보류), Unsplash · Pixabay의 벡터 원본 제공 여부와 일부 작품의 AI 생성 여부, LottieFiles 원본 내려받기 조건, 내려받은 SVG의 Electron 표시. 라이선스 해석은 약관 문장을 읽은 판단이다.
