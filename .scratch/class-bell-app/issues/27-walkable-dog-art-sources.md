# 걷는 모션을 만들 수 있는 강아지 그림 소재 추가 조사

Type: research
Status: resolved
Blocked by: 

## Question

뻐드렁니 강아지처럼 네 다리가 따로 그려져 있어 다리를 번갈아 움직이는 걷기를 만들 수 있는 무료 강아지 그림이 더 있는가?

- 조건: 옆모습으로 서 있는 전신, SVG 원본을 받을 수 있음, 네 다리(가능하면 꼬리 · 귀 · 눈도)가 따로 그려진 요소, 외곽선 없는 플랫 그림체, 앱에 내장해 배포할 수 있는 라이선스.
- 이미 본 출처([무료 강아지 일러스트 소재 조사](21-dog-illustration-sources.md), [Unsplash 강아지 일러스트 세트 추가 조사](22-unsplash-dog-illustration-sets.md))에서 놓친 것과 아직 보지 않은 출처를 모두 본다.
- 후보마다 SVG를 실제로 받아 다리가 요소로 나뉘어 있는지 확인한다([강아지 테마 SVG의 부위 구성 확인](23-dog-theme-svg-parts.md)의 방법).
- 걷는 프레임이 이미 그려진 스프라이트 시트나 애니메이션 SVG · Lottie처럼 걷는 모션이 들어 있는 소재도 함께 본다.

[강아지 연출의 범위와 동작 결정](09-roaming-dog-behavior.md)에서 사용자가 요청했다. 그 티켓은 이 조사 결과를 보고 닫는다.

## Answer

조사 문서: `research/walkable-dog-art-sources` 브랜치(커밋 `0ebc547`)의 `docs/research/walkable-dog-art-sources.md`. 내려받은 파일은 시안 폴더 `~/.claude-mukkebi/mockups/ding-dong-dang/assets/walk-cand/`에 있다(불합격 파일도 일부 남아 있고 manifest는 없다).

있다. 옆모습 전신 · SVG · 네 다리가 따로 · 외곽선 없는 플랫 · 재배포 가능의 다섯 조건을 모두 만족하는 그림을 새로 6점 찾았고, 이미 가진 파일 중 1점도 합격이다. 걷는 모션이 이미 들어 있는 플랫 소재는 9점이다.

확인 방법: 요소별 경계 상자를 헤드리스 Chrome으로 뽑고 요소를 하나씩 강조한 접촉 시트를 눈으로 봤다. 그 뒤 합격 7점의 다리 넷과 꼬리에 뻐드렁니 강아지와 같은 걷기 값을 붙여 캡처했고, 일곱 모두 다리가 따로 돌았다: [걷는 강아지 후보](../assets/27-walk-candidates.html)(`~/.claude-mukkebi/mockups/ding-dong-dang/walk-candidates.html`).

합격 후보(요소 번호는 SVG 안에서 그리는 요소의 순서, 0부터):

| 이름 | 출처 | 라이선스 | 파일 | 다리 넷 | 그 밖에 따로인 부위 |
| --- | --- | --- | --- | --- | --- |
| 코기 | openclipart.org/detail/254920 | CC0 | `oc-254920-corgi.svg` | 3+4, 14+15, 16+17, 19+22 | 꼬리 34 · 35, 귀 1 · 2 · 6 · 7, 눈 12 · 13, 머리 9 |
| 바셋 하운드 76651 | publicdomainvectors.org 76651 | CC0 | `pdv-76651-basset-hound-dog.svg` | 26+27, 28+29, 52+53, 54+55 | 꼬리 40 · 41, 귀 33~36, 눈 42~49, 머리 37 · 39 |
| 바셋 하운드 90703 | publicdomainvectors.org 90703 | CC0 | `pdv-90703-basset-hound-dog-vector.svg` | 27+28, 29+30, 33+34, 36+37 | 꼬리 35, 귀 26 · 43, 눈 44 · 46, 머리 38~41 |
| 회색 얼룩 강아지 89664 | publicdomainvectors.org 89664 | CC0 | `pdv-89664-dog-pet-vector-clip-art.svg` | 29, 30, 34, 35 | 꼬리 28, 귀 31 · 36, 눈 38. 머리와 몸은 한 덩어리 |
| 황갈색 강아지 | openclipart.org/detail/168445 | CC0 | `oc-168445-bull-dog-de-gary.svg` | 0, 6, 8, 9 | 꼬리 10, 머리 1, 귀 2 · 3, 눈 11 · 12 |
| 갈색 강아지 | openclipart.org/detail/2702 | CC0 | `oc-2702-dog.svg` | 0, 4, 9, 10 | 꼬리 5, 귀 7, 눈 8, 머리 1 |
| 밥 먹는 강아지(이미 가진 파일) | Unsplash의 Public domain vectors | 퍼블릭 도메인 겸 Unsplash License | `assets/unsplash/publicdomainvectors-standing-side-eating.svg` | 4, 5, 8, 9 | 꼬리 3, 귀 11, 눈 12, 혀 13. 고개 숙인 자세로 고정 |

후보별로 알아 둘 것:

- publicdomainvectors 3점은 사이트가 AI · EPS만 내주어 EPS의 그리기 연산을 path로 옮기는 스크립트로 변환한 것이다. 사이트 표시 글자가 path 20여 개로 들어 있어 쓸 때 지워야 한다.
- 코기는 몸은 옆, 얼굴은 정면인 반측면이고 그림자가 있다. 회색 얼룩 강아지는 얼룩이 몸과 뒷다리에 걸친 한 path라 다리를 움직여도 얼룩이 따라가지 않고, 배경 원이 있다. 황갈색 강아지에는 머리카락 굵기의 가는 선이 있다.
- 뻐드렁니 강아지의 원본 페이지는 publicdomainvectors.org 85587이다.

조건을 일부만 만족하는 것: Emoji One 1.x 강아지(구조는 합격, CC BY-SA 4.0이라 표기와 같은 라이선스 공개가 필요), Openclipart 346480(구조는 합격, 모든 도형에 가는 검은 선).

걷는 모션이 이미 들어 있는 소재(모두 외곽선 없는 플랫):

- CSS-Only Walking Dog(GitHub, MIT): HTML + CSS이고 다리 넷 · 꼬리 · 귀 · 머리에 keyframes가 있다.
- LottieFiles 무료 6점(Lottie Simple License): Dog walking(muhammet dikmen), running dog(Devil Prado), DOG WALK(Summer kc), Dog walking(Syed Asim Ali Shah), Jackie, Long Dog. 표기 의무는 없지만 라이선스 고지를 함께 넣어야 하고 고친 파일도 같은 조건이다. Lottie 재생기가 필요하다.
- Noto 애니메이션 안내견(CC BY 4.0, 표기 필요): 하네스가 깨끗이 빠지는지 미확인.
- OpenGameArt Dog Walk sprite(CC0): PNG 10프레임이고 해상도가 낮다.

탈락: publicdomainvectors의 비글 · 블러드하운드 · 푸들 등(가까운 쪽 다리가 몸과 한 path), Openclipart 골든 리트리버 등(굵은 외곽선 또는 몸과 다리가 한 path), 이모지 세트의 강아지 · 푸들 · 안내견(다리가 몸과 합쳐짐), SVG Repo(대부분 단색 아이콘), unDraw(사람 장면의 일부).

확인하지 못한 것:

- 걷기 값은 뻐드렁니 강아지의 것을 그대로 붙였다. 움직임이 자연스러운지, 다리를 돌릴 때 빈 곳이 드러나는지는 정지 캡처 한 장으로만 봤다.
- FreeSVG(목록만 받음), Wikimedia Commons의 분류 훑기(429), SVG Repo 일부 쪽, CodePen · Pixabay · Flaticon(403), Unsplash 검색 20건 이후, GitHub 검색 일부, Rive · Kenney는 보지 못했다.
- Openclipart의 CC0와 Noto 애니메이션의 CC BY 4.0은 앞선 조사 내용을 옮겼고 이번에 약관을 다시 읽지 않았다.
