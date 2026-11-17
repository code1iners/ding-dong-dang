# 39: 앱 아이콘과 트레이 아이콘

**What to build:** 발바닥 종 아이콘이 코드로 그린 SVG 원본 하나에서 앱 아이콘과 트레이 · 메뉴 막대 아이콘으로 뽑힌다. 원본 결정은 [앱 아이콘 시안 비교와 확정](19-app-icon-selection.md), 규격은 [앱 아이콘 레퍼런스와 규격 조사](18-app-icon-references.md)다. 시안은 `prototype/design-mockups` 브랜치의 `app-icons.html`에 있다.

Blocked by: 30

Status: resolved

- [x] SVG 원본에서 다음이 스크립트로 뽑힌다: 1024px 정사각형 앱 아이콘(틀과 그림자 없음), Windows 둥근 타일 `.ico`(16 · 20 · 24 · 32 · 40 · 48 · 64 · 256), macOS 메뉴 막대 템플릿 이미지 두 벌(켜짐, 빗금, 각 1배 · 2배, 검정 + 알파), Windows 트레이 색 아이콘 두 벌(켜짐은 노란 종에 갈색 발바닥, 꺼짐은 회색에 빗금).
- [x] 테스트가 산출물의 존재, 크기, `.ico` 안의 크기 구성, 템플릿 이미지에 색이 없는 것을 확인한다.
- [x] 에이전트가 산출물을 16px과 큰 크기에서 눈으로 보고 켜짐과 빗금이 구분되는지 확인해 결과를 티켓에 적는다.
- [x] 타입 검사, 린트, 전체 자동 테스트가 통과한다.

## Comments

- 2026-11-17: 산출물은 `resources/icons/`에 있고 `npm run icons`로 다시 만든다. SVG 원본은 `scripts/icon-art.mts`(코드)이고 `resources/icons/source/`에 SVG도 남긴다. 래스터라이저를 따로 설치하지 않고 Electron 오프스크린 창으로 그린다(`scripts/icon-raster.mjs`). 다시 돌려도 같은 바이트가 나온다.
- 파일: `app-icon.png`(1024, macOS 원본), `app-icon.ico`(둥근 타일 8크기), `trayTemplate[@2x].png` · `trayOffTemplate[@2x].png`(16 · 32, 검정 + 알파), `tray-win.ico` · `tray-win-off.ico`(16 · 20 · 24 · 32, 켜짐은 노란 종에 갈색 발바닥, 꺼짐은 회색 + 빗금).
- 눈으로 확인: 16px과 큰 크기를 최근접 확대 시트로 밝은 · 어두운 바탕에 올려 봤다. 템플릿과 Windows 트레이 모두 빗금 유무로 켜짐과 꺼짐이 16px에서도 구분된다. 발바닥은 16px에서 구멍 몇 개로 뭉개지지만 종 실루엣은 알아볼 수 있다. Windows 꺼짐(회색 + 빗금)의 빗금은 어두운 바탕에서 대비가 낮은 편이다. 실제 트레이에서의 모습은 `checklists/post-implementation.md`에서 확인한다(트레이 연결은 40번).
- 검증: typecheck · lint · vitest 228개 · e2e 52개 통과.
