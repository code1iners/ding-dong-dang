// 강아지 그리는 방식 실험(버리는 코드). 제품 경로에는 합치지 않고, hook.patch를 임시로 적용해 빌드해서 잰다.
// 두 방식 모두 "지금 동작이 평소(idle) · 이동(move)일 때" 제 그리기를 대신한다. 그 밖의 동작은 기존 방식으로 그린다.
//  - sprite: 동작 한 바퀴(LOOP초)를 초당 60장 PNG 프레임으로 구워 한 장짜리 묶음으로 만들고, CSS steps() 두 개(가로 · 세로 translate)로 넘긴다.
//  - waapi : 매 프레임 JS로 행렬을 계산하는 대신, 한 바퀴를 SAMPLE_HZ로 뽑은 키프레임을 요소마다 Web Animations API(transform)로 넘긴다.
// 구운 값은 시작할 때 페이지 안에서 만든다. 실제로 쓸 때는 미리 만든 PNG 파일을 쓰겠지만, 켜진 뒤의 비용은 같다(PNG를 한 번 디코드해 두고 쓴다).

import type { DogAction } from '../../src/shared/status-view';
import { drawableElements, type DogRig } from '../../src/renderer/src/dog/rig';

export type ProbeMode = 'sprite' | 'waapi';

/** 한 바퀴의 길이(초). 눈 깜빡임(4초)이 딱 맞는 길이다. 다른 부위는 한 바퀴 끝에서 조금 튈 수 있다(실험이라 그대로 둔다). */
const LOOP = 4;
/** 묶음 한 칸의 초당 장수. */
const FPS = 60;
/** 묶음의 가로 칸 수. 240장을 15 × 16으로 놓는다. */
const COLS = 15;
/** waapi 키프레임을 뽑는 초당 횟수. */
const SAMPLE_HZ = 30;
/** 이 실험이 대신하는 동작. */
const HANDLED = new Set<DogAction>(['idle', 'move']);

export type Probe = {
  /** 이 동작을 실험 방식으로 그릴 수 있는지. */
  handles(action: DogAction): boolean;
  /** 이 동작이 준비돼 바로 돌릴 수 있는지. */
  ready(action: DogAction): boolean;
  /** 이 동작을 준비한다(묶음 굽기 · 키프레임 뽑기). */
  prepare(action: DogAction): Promise<void>;
  /** 이 동작을 돌린다. 같은 동작이 이미 돌고 있으면 아무것도 하지 않는다. */
  play(action: DogAction): void;
  /** 돌리던 것을 멈추고 기존 그림을 되살린다. */
  stop(): void;
};

/** `rig`의 그림을 실험 방식으로 그리는 손잡이를 만든다. */
export function createProbe(mode: ProbeMode, rig: DogRig, container: HTMLElement): Probe {
  return mode === 'sprite' ? spriteProbe(rig, container) : waapiProbe(rig);
}

/** 지금 칸에서 그림의 크기(px). */
function sizeOf(container: HTMLElement): { w: number; h: number } {
  // 그림이 칸을 꽉 채우므로 칸의 배치 크기와 같다. 기울임 · 뒤집기와 그림을 숨긴 것에 흔들리지 않는다
  return { w: container.offsetWidth, h: container.offsetHeight };
}

/** 틀 · 기울임이 없는 지금 자세의 SVG를 PNG 한 칸 크기의 이미지로 만든다. 칸은 그림 둘레에 pad를 더 둔다(숨쉬기 · 튀기가 칸 밖으로 나가는 만큼). */
async function frameImage(rig: DogRig, w: number, h: number, pad: number): Promise<HTMLImageElement> {
  const inner = rig.svg.cloneNode(true) as SVGSVGElement;
  inner.setAttribute('x', String(pad));
  inner.setAttribute('y', String(pad));
  inner.setAttribute('width', String(w));
  inner.setAttribute('height', String(h));
  inner.setAttribute('overflow', 'visible');
  inner.removeAttribute('class');
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${w + 2 * pad}" height="${h + 2 * pad}">${new XMLSerializer().serializeToString(inner)}</svg>`;
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
  await img.decode();
  return img;
}

function spriteProbe(rig: DogRig, container: HTMLElement): Probe {
  /** 동작마다 구운 묶음의 이미지 주소와 칸 크기. */
  const sheets = new Map<string, { url: string; w: number; h: number; pad: number; rows: number }>();
  /** 굽는 중인 일. */
  const baking = new Map<string, Promise<void>>();
  /** 지금 돌리는 칸. */
  let strip: HTMLElement | null = null;
  let wrap: HTMLElement | null = null;
  let playing: DogAction | null = null;

  const keyOf = (action: DogAction): string => {
    const { w, h } = sizeOf(container);
    return `${action}:${w}x${h}`;
  };

  async function bake(action: DogAction): Promise<void> {
    const { w, h } = sizeOf(container);
    const pad = Math.round(Math.max(w, h) * 0.3);
    const cw = w + 2 * pad;
    const ch = h + 2 * pad;
    const frames = LOOP * FPS;
    const rows = Math.ceil(frames / COLS);
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement('canvas');
    canvas.width = COLS * cw * scale;
    canvas.height = rows * ch * scale;
    const ctx = canvas.getContext('2d')!;
    for (let f = 0; f < frames; f++) {
      rig.pose(action, f / FPS);
      const img = await frameImage(rig, w, h, pad);
      ctx.drawImage(img, (f % COLS) * cw * scale, Math.floor(f / COLS) * ch * scale, cw * scale, ch * scale);
    }
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), 'image/png'));
    console.log(`[probe] sprite ${action} ${w}x${h} cell ${cw}x${ch} scale ${scale} sheet ${canvas.width}x${canvas.height} png ${blob.size} bytes`);
    sheets.set(`${action}:${w}x${h}`, { url: URL.createObjectURL(blob), w: cw, h: ch, pad, rows });
  }

  return {
    handles: (a) => HANDLED.has(a),
    ready: (a) => sheets.has(keyOf(a)),
    prepare(a) {
      const key = keyOf(a);
      if (!baking.has(key)) baking.set(key, bake(a));
      return baking.get(key)!;
    },
    play(action) {
      if (playing === action && strip?.isConnected) return;
      this.stop();
      const sheet = sheets.get(keyOf(action));
      if (!sheet) return;
      rig.svg.style.display = 'none';
      wrap = document.createElement('div');
      Object.assign(wrap.style, { position: 'absolute', left: `${-sheet.pad}px`, bottom: `${-sheet.pad}px`, width: `${sheet.w}px`, height: `${sheet.h}px`, overflow: 'hidden', pointerEvents: 'none' });
      strip = document.createElement('div');
      Object.assign(strip.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: `${COLS * sheet.w}px`,
        height: `${sheet.rows * sheet.h}px`,
        background: `url(${sheet.url}) 0 0 / 100% 100% no-repeat`,
        willChange: 'transform, translate',
      });
      wrap.append(strip);
      // 그림 칸 기준으로 자리를 잡으려고 칸이 위치 기준이 되게 한다
      if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
      container.append(wrap);
      const rowMs = (COLS / FPS) * 1000;
      strip.animate([{ translate: '0 0' }, { translate: `${-COLS * sheet.w}px 0` }], { duration: rowMs, iterations: Infinity, easing: `steps(${COLS})` });
      strip.animate([{ transform: 'translateY(0)' }, { transform: `translateY(${-sheet.rows * sheet.h}px)` }], { duration: rowMs * sheet.rows, iterations: Infinity, easing: `steps(${sheet.rows})` });
      playing = action;
    },
    stop() {
      wrap?.remove();
      wrap = null;
      strip = null;
      playing = null;
      rig.svg.style.display = '';
    },
  };
}

function waapiProbe(rig: DogRig): Probe {
  /** 동작마다 요소별 키프레임. */
  const tracks = new Map<DogAction, string[][]>();
  /** 지금 돌리는 애니메이션. */
  let running: Animation[] = [];
  let playing: DogAction | null = null;

  function build(action: DogAction): void {
    const els = drawableElements(rig.svg);
    const samples: string[][] = els.map(() => []);
    const n = LOOP * SAMPLE_HZ;
    for (let i = 0; i <= n; i++) {
      rig.pose(action, i / SAMPLE_HZ);
      els.forEach((el, k) => {
        const m = (el as SVGGraphicsElement).transform.baseVal.consolidate()?.matrix;
        samples[k]!.push(m ? `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})` : 'none');
      });
    }
    tracks.set(action, samples);
  }

  return {
    handles: (a) => HANDLED.has(a),
    ready: (a) => tracks.has(a),
    async prepare(a) {
      if (!tracks.has(a)) build(a);
    },
    play(action) {
      if (playing === action && running.length > 0) return;
      this.stop();
      const samples = tracks.get(action);
      if (!samples) return;
      const els = drawableElements(rig.svg);
      els.forEach((el, k) => {
        // 움직임이 전혀 없는 요소는 애니메이션을 만들지 않는다
        const frames = samples[k]!;
        if (frames.every((v) => v === frames[0])) {
          if (frames[0] !== 'none') (el as SVGElement).style.transform = frames[0]!;
          return;
        }
        running.push((el as SVGElement).animate(frames.map((transform) => ({ transform })), { duration: LOOP * 1000, iterations: Infinity, easing: 'linear' }));
      });
      playing = action;
    },
    stop() {
      for (const a of running) a.cancel();
      running = [];
      playing = null;
      for (const el of drawableElements(rig.svg)) (el as SVGElement).style.transform = '';
    },
  };
}
