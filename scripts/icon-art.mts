// 발바닥 종 아이콘의 SVG 원본. 앱 아이콘과 트레이 아이콘이 모두 이 파일의 도형에서 나온다.
// 도형과 색은 확정한 시안(app-icons.html의 "발바닥 종")과 같다. 좌표는 100×100 격자 기준이다.

export const COLOR = {
  orange: '#F2A33C',
  brown: '#C9772A',
  cream: '#FFE9C9',
  yellow: '#F7C843',
  gold: '#D9961C',
  white: '#FFFFFF',
} as const;

const BELL =
  'M50 14C31 14 24 32 24 50V60Q24 69 15 75Q13 79 18 79H82Q87 79 85 75Q76 69 76 60V50C76 32 69 14 50 14Z';

// 발바닥: 큰 볼록살 하나와 발가락 넷
const PAD = { cx: 50, cy: 59, rx: 12, ry: 9.5 };
const TOES = [
  { cx: 33.5, cy: 46, r: 5.2 },
  { cx: 44, cy: 37, r: 5.4 },
  { cx: 56, cy: 37, r: 5.4 },
  { cx: 66.5, cy: 46, r: 5.2 },
];
// 방울 아래에 보이는 추(시안의 "종 아래 크림색 추")
const CLAPPER = { cx: 50, cy: 83, r: 8 };

// 트레이 기호만 시안에서 방울을 조금 키운 추를 쓴다(작은 크기에서 떨어져 보이게)
const GLYPH_CLAPPER = { cx: 50, cy: 86, r: 9 };
const GLYPH_TOES = [
  { cx: 32, cy: 46, r: 6 },
  { cx: 44, cy: 35, r: 6 },
  { cx: 56, cy: 35, r: 6 },
  { cx: 68, cy: 46, r: 6 },
];
const GLYPH_PAD = { cx: 50, cy: 60, rx: 13, ry: 10 };

const SLASH = 'M12 10L90 92';
const GLYPH_VIEWBOX = '-4 -4 108 108';

const pawShapes = (fill: string, pad = PAD, toes = TOES) =>
  `<ellipse cx="${pad.cx}" cy="${pad.cy}" rx="${pad.rx}" ry="${pad.ry}" fill="${fill}"/>` +
  toes.map((t) => `<circle cx="${t.cx}" cy="${t.cy}" r="${t.r}" fill="${fill}"/>`).join('');

// 둥근 사각형 틀 안에 들어갈 그림. 틀에 닿지 않게 중심에서 조금 줄인다.
const appArt = () =>
  `<g transform="translate(50 52) scale(.9) translate(-50 -52)">` +
  `<circle cx="${CLAPPER.cx}" cy="${CLAPPER.cy}" r="${CLAPPER.r}" fill="${COLOR.cream}"/>` +
  `<path d="${BELL}" fill="${COLOR.white}"/>` +
  pawShapes(COLOR.orange) +
  `</g>`;

const svg = (viewBox: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${body}</svg>\n`;

/** macOS 앱 아이콘 원본. 정사각형을 꽉 채우고, 둥근 틀과 그림자는 시스템이 씌운다. */
export function appIconSvg(): string {
  return svg('0 0 100 100', `<rect width="100" height="100" fill="${COLOR.orange}"/>${appArt()}`);
}

/** Windows 앱 아이콘 원본. Windows에는 틀이 없어 모서리를 둥글게 그려 넣는다. */
export function appTileSvg(): string {
  return svg('0 0 100 100', `<rect width="100" height="100" rx="22" fill="${COLOR.orange}"/>${appArt()}`);
}

// 트레이 기호의 모양을 마스크로 뚫는다: 흰색은 남기고 검정은 투명하게 만든다.
// 빗금은 기호 위에 선을 긋되, 선 둘레를 한 번 더 넓게 비워 기호와 떨어져 보이게 한다.
function glyphBody(options: { slash: boolean; bell: string; paw: string; clapper: string; slashColor: string }): string {
  const holes = pawShapes('#000', GLYPH_PAD, GLYPH_TOES);
  const gap = options.slash
    ? `<path d="${SLASH}" stroke="#000" stroke-width="22" stroke-linecap="round" fill="none"/>`
    : '';
  const mask = `<mask id="m" maskUnits="userSpaceOnUse" x="-4" y="-4" width="108" height="108">` +
    `<rect x="-4" y="-4" width="108" height="108" fill="#fff"/>${options.paw === 'hole' ? holes : ''}${gap}</mask>`;
  const shape =
    `<circle cx="${GLYPH_CLAPPER.cx}" cy="${GLYPH_CLAPPER.cy}" r="${GLYPH_CLAPPER.r}" fill="${options.clapper}"/>` +
    `<path d="${BELL}" fill="${options.bell}"/>`;
  const paw = options.paw === 'hole' ? '' : pawShapes(options.paw, GLYPH_PAD, GLYPH_TOES);
  const slash = options.slash
    ? `<path d="${SLASH}" stroke="${options.slashColor}" stroke-width="12" stroke-linecap="round" fill="none"/>`
    : '';
  return `${mask}<g mask="url(#m)">${shape}${paw}</g>${slash}`;
}

/** macOS 메뉴 막대 템플릿 이미지. 검정 + 알파만 쓰고, 발바닥은 뚫려 있다. */
export function macTraySvg(state: 'on' | 'slash'): string {
  return svg(
    GLYPH_VIEWBOX,
    glyphBody({ slash: state === 'slash', bell: '#000', paw: 'hole', clapper: '#000', slashColor: '#000' }),
  );
}

/** Windows 트레이 색 아이콘. 켜짐은 노란 종에 갈색 발바닥, 꺼짐은 회색에 빗금이다. */
export function winTraySvg(state: 'on' | 'off'): string {
  if (state === 'on') {
    return svg(
      GLYPH_VIEWBOX,
      glyphBody({ slash: false, bell: COLOR.yellow, paw: COLOR.brown, clapper: COLOR.gold, slashColor: '' }),
    );
  }
  return svg(
    GLYPH_VIEWBOX,
    glyphBody({ slash: true, bell: '#A8A8A8', paw: '#6E6E6E', clapper: '#8A8A8A', slashColor: '#7A7A7A' }),
  );
}
