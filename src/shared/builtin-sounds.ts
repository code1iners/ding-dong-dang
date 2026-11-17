// 내장 음원 열두 개의 고정 목록. 음원 id는 저장 파일에 남으므로 바꾸지 않는다.
// 길이는 스펙 확정표(issues/16)의 값이고, 악보는 scripts/bell-synth.ts에 있다.

export type BellKind = 'start' | 'end';

export interface BuiltinSound {
  id: string;
  /** 화면에 보이는 이름. 짝 이름 + "시작" 또는 "끝". */
  name: string;
  /** resources/sounds/builtin/ 아래의 파일 이름. */
  file: string;
  pair: string;
  kind: BellKind;
  /** 확정표의 길이(초). 마지막 음이 사라지는 여운 1.6초를 포함한다. */
  seconds: number;
}

const PAIRS = [
  { key: 'westminster', pair: '웨스트민스터', seconds: 8.6 },
  { key: 'four-note', pair: '딩동댕동', seconds: 4.3 },
  { key: 'tiring', pair: '띠링', seconds: 2.0 },
  { key: 'five-note', pair: '다섯 음', seconds: 4.3 },
  { key: 'arpeggio', pair: '아르페지오', seconds: 2.7 },
  { key: 'chord', pair: '화음', seconds: 5.0 },
] as const;

const KIND_LABEL: Record<BellKind, string> = { start: '시작', end: '끝' };

export const BUILTIN_SOUNDS: readonly BuiltinSound[] = PAIRS.flatMap(({ key, pair, seconds }) =>
  (['start', 'end'] as const).map((kind) => ({
    id: `${key}-${kind}`,
    name: `${pair} ${KIND_LABEL[kind]}`,
    file: `${key}-${kind}.wav`,
    pair,
    kind,
    seconds,
  })),
);
