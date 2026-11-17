// 내장 종소리를 샘플로 계산한다. 악보와 음색의 원본은 종소리 청취 시안
// (.scratch/class-bell-app/assets/16-bell-sounds.html)의 SCORES와 TIMBRES.chime이다.
// 시안은 브라우저의 오실레이터로 같은 식을 재생한다: 음마다 배음 여러 개를 8ms 동안 올린 뒤
// 지수로 줄인다. 같은 입력이면 항상 같은 샘플이 나오도록 난수와 시간에 기대지 않는다.

export const SAMPLE_RATE = 44100;
/** 마지막 음이 울리다 사라지는 시간(초). 파일 길이에 더해진다. */
export const RING_SECONDS = 1.6;
/** 파일 끝이 뚝 끊기는 소리가 나지 않게 마지막에 줄이는 시간(초). */
const FADE_OUT_SECONDS = 0.3;

type Note = readonly [pitches: string | null, beats: number];
export interface Score {
  /** 한 박의 길이(초). */
  beat: number;
  /** 시안의 음별 크기 배율. 화음처럼 겹치는 곡이 낮다. */
  gain?: number;
  notes: readonly Note[];
}

const W = (a: string, b: string, c: string, d: string): Note[] => [[a, 1], [b, 1], [c, 1], [d, 2]];

// 키는 시안의 SCORES 키와 같다
export const SCORES: Record<string, Score> = {
  'west-long': { beat: 0.7, notes: [...W('F4', 'A4', 'G4', 'C4'), ...W('F4', 'G4', 'A4', 'F4')] },
  'west-short': { beat: 0.7, notes: [...W('A4', 'F4', 'G4', 'C4'), ...W('C4', 'G4', 'A4', 'F4')] },
  up4: { beat: 0.45, notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 3]] },
  down4: { beat: 0.45, notes: [['C6', 1], ['G5', 1], ['E5', 1], ['C5', 3]] },
  'usb-in': { beat: 0.13, notes: [['E5', 1], ['B5', 2]] },
  'usb-out': { beat: 0.13, notes: [['B5', 1], ['E5', 2]] },
  'penta-up': { beat: 0.38, notes: [['G4', 1], ['A4', 1], ['C5', 1], ['D5', 1], ['E5', 3]] },
  'penta-down': { beat: 0.38, notes: [['E5', 1], ['D5', 1], ['C5', 1], ['A4', 1], ['G4', 3]] },
  'harp-up': { beat: 0.1, notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 1], ['E6', 1], ['G6', 6]] },
  'harp-down': { beat: 0.1, notes: [['G6', 1], ['E6', 1], ['C6', 1], ['G5', 1], ['E5', 1], ['C5', 6]] },
  'chord-up': { beat: 0.75, gain: 0.45, notes: [['C4+E4+G4', 1], ['F4+A4+C5', 1], ['G4+B4+D5', 2.5]] },
  'chord-down': { beat: 0.75, gain: 0.45, notes: [['G4+B4+D5', 1], ['F4+A4+C5', 1], ['C4+E4+G4+C5', 2.5]] },
};

/** 부드러운 차임. 배음마다 [배수, 크기, 감쇠 시간(초)]이고, 소리는 감쇠 시간의 세 배 동안 이어진다. */
const CHIME_PARTS: readonly (readonly [mul: number, amp: number, tau: number])[] = [
  [1, 1, 1.5],
  [2, 0.3, 1.0],
  [3, 0.1, 0.6],
  [4.2, 0.06, 0.4],
];
const ATTACK_SECONDS = 0.008;
/** 지수 감쇠가 닿는 바닥값. 시안의 값을 그대로 쓴다. */
const DECAY_FLOOR = 0.0005;

export function noteFrequency(name: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`알 수 없는 음 이름: ${name}`);
  const semitone = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1] as 'C'];
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 440 * Math.pow(2, (semitone + accidental - 9) / 12 + (Number(m[3]) - 4));
}

/** 악보의 길이(초): 음 길이의 합에 여운을 더하고 소수 첫째 자리로 반올림한다. 확정표의 길이와 같다. */
export function scoreSeconds(score: Score): number {
  const beats = score.notes.reduce((sum, [, b]) => sum + b, 0);
  return Math.round((beats * score.beat + RING_SECONDS) * 10) / 10;
}

/** 악보를 -1~1 범위 밖으로 나갈 수 있는 원래 크기의 샘플로 만든다. 크기 맞춤은 따로 한다. */
export function renderScore(score: Score): Float32Array {
  const total = Math.round(scoreSeconds(score) * SAMPLE_RATE);
  const out = new Float64Array(total);
  const gain = score.gain ?? 1;
  let start = 0;
  for (const [pitches, beats] of score.notes) {
    if (pitches) {
      for (const pitch of pitches.split('+')) {
        addTone(out, noteFrequency(pitch), start, gain);
      }
    }
    start += beats * score.beat;
  }
  applyFadeOut(out);
  return Float32Array.from(out);
}

function addTone(out: Float64Array, freq: number, startSeconds: number, gain: number): void {
  const first = Math.round(startSeconds * SAMPLE_RATE);
  for (const [mul, amp, tau] of CHIME_PARTS) {
    const peak = amp * gain;
    const end = tau * 3;
    const w = 2 * Math.PI * freq * mul;
    const last = Math.min(out.length, first + Math.ceil(end * SAMPLE_RATE));
    for (let i = first; i < last; i++) {
      const t = (i - first) / SAMPLE_RATE;
      const env =
        t < ATTACK_SECONDS
          ? (t / ATTACK_SECONDS) * peak
          : peak * Math.pow(DECAY_FLOOR / peak, (t - ATTACK_SECONDS) / (end - ATTACK_SECONDS));
      out[i] = (out[i] ?? 0) + env * Math.sin(w * t);
    }
  }
}

function applyFadeOut(samples: Float64Array): void {
  const n = Math.min(samples.length, Math.round(FADE_OUT_SECONDS * SAMPLE_RATE));
  for (let k = 0; k < n; k++) {
    const i = samples.length - n + k;
    samples[i] = (samples[i] ?? 0) * (0.5 + 0.5 * Math.cos((Math.PI * (k + 1)) / n));
  }
}

export function peakOf(samples: ArrayLike<number>): number {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i] ?? 0));
  return peak;
}

/** 파일 전체의 RMS. 무음 구간도 포함한다. */
export function rmsOf(samples: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += (samples[i] ?? 0) ** 2;
  return Math.sqrt(sum / Math.max(1, samples.length));
}

/** 16비트 모노 PCM WAV 바이트. */
export function encodeWav(samples: Float32Array): Uint8Array {
  const dataBytes = samples.length * 2;
  const buf = new DataView(new ArrayBuffer(44 + dataBytes));
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) buf.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  buf.setUint32(4, 36 + dataBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true); // PCM
  buf.setUint16(22, 1, true); // 모노
  buf.setUint32(24, SAMPLE_RATE, true);
  buf.setUint32(28, SAMPLE_RATE * 2, true);
  buf.setUint16(32, 2, true);
  buf.setUint16(34, 16, true);
  ascii(36, 'data');
  buf.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] ?? 0));
    buf.setInt16(44 + i * 2, Math.round(v * 32767), true);
  }
  return new Uint8Array(buf.buffer);
}

export interface Wav {
  sampleRate: number;
  samples: Float32Array;
}

export function decodeWav(bytes: Uint8Array): Wav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE' || tag(36) !== 'data') throw new Error('지원하지 않는 WAV 형식');
  const n = view.getUint32(40, true) / 2;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = view.getInt16(44 + i * 2, true) / 32767;
  return { sampleRate: view.getUint32(24, true), samples };
}

/** 파일 전체 RMS를 이 값으로 맞춘다(약 -17.7 dBFS). 화음 차임이 최대값 한도 안에서 낼 수 있는 가장 큰 크기보다 작게 잡았다. */
export const TARGET_RMS = 0.13;
/** 레벨을 맞춘 뒤에도 넘지 않아야 하는 최대값. 1에 닿으면 찌그러지므로 여유를 둔다. */
export const PEAK_CEILING = 0.95;

/** 내장 음원 id → 악보 키. id는 src/shared/builtin-sounds.ts와 같다. */
export const SCORE_KEY_BY_ID: Record<string, string> = {
  'westminster-start': 'west-long',
  'westminster-end': 'west-short',
  'four-note-start': 'up4',
  'four-note-end': 'down4',
  'tiring-start': 'usb-in',
  'tiring-end': 'usb-out',
  'five-note-start': 'penta-up',
  'five-note-end': 'penta-down',
  'arpeggio-start': 'harp-up',
  'arpeggio-end': 'harp-down',
  'chord-start': 'chord-up',
  'chord-end': 'chord-down',
};

/** 소리의 모양은 그대로 두고 크기만 곱해 RMS를 맞춘다. 한도를 넘으면 음을 바꾸지 않고 멈춰 알린다. */
export function levelToTarget(samples: Float32Array, id: string): Float32Array {
  const factor = TARGET_RMS / rmsOf(samples);
  const leveled = samples.map((v) => v * factor);
  const peak = peakOf(leveled);
  if (peak > PEAK_CEILING) {
    throw new Error(`${id}: RMS ${TARGET_RMS}로 맞추면 최대값이 ${peak.toFixed(3)}로 한도 ${PEAK_CEILING}를 넘는다`);
  }
  return leveled;
}

export function renderBuiltinSound(id: string): Uint8Array {
  const key = SCORE_KEY_BY_ID[id];
  const score = key ? SCORES[key] : undefined;
  if (!score) throw new Error(`악보가 없는 음원 id: ${id}`);
  return encodeWav(levelToTarget(renderScore(score), id));
}
