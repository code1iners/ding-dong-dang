// 돌아다니는 강아지 창의 화면. 메인이 보낸 동작대로 강아지와 낙하산을 그리고, 누름 · 뗌을 메인에 알리고, 메인이 누른 것으로 치면 하트를 띄운다.
// 창을 옮기는 일, 동작을 정하는 일, 클릭 통과는 메인이 한다. 이 화면은 그림만 맡는다.

import { DOG_WINDOW_PAD_BOTTOM } from '../../shared/roaming-dog';
import { framesPerSecond, type DogAction } from '../../shared/status-view';
import type { DogView, DogWindowApi } from '../../shared/dog-window';
import { HEART_COUNT, HEART_MAX_DELAY_S, HEART_MS, HEART_PATH, randomBetween } from './dog/hearts';
import { mountDog, type DogRig } from './dog/rig';
import { floorTheme, themeById, type DogTheme } from './dog/themes';
import './styles/tokens.css';
import './styles/hearts.css';
import './styles/dog-window.css';

/** preload가 내보낸 강아지 창 통로. 이 창에만 있어 앱 창의 전역 타입에는 넣지 않는다. */
const api = (window as unknown as { roamingDog: DogWindowApi }).roamingDog;

/** OS의 동작 줄이기를 묻는 미디어 쿼리. */
const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');

/** 강아지 칸. 누르면 강아지를 누른 것이다. */
const box = document.createElement('div');
box.className = 'roaming-dog';
box.style.bottom = `${DOG_WINDOW_PAD_BOTTOM}px`;
/** 걷는 쪽으로 그림을 돌리고, 끌리거나 내려올 때 기울이는 묶음. */
const flip = document.createElement('div');
flip.className = 'roaming-dog__flip';
/**
 * 낙하산. 테마와 무관한 한 가지 그림(주황 · 크림 줄무늬)이고 돌아다니는 강아지 시안(09번)의 그림을 그대로 쓴다.
 * 강아지 등 뒤에 붙고, 강아지가 기울어도 같이 기울지 않는다. 크기와 자리는 키에 맞춰 mount가 정한다.
 */
const chute = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
chute.setAttribute('class', 'parachute');
chute.setAttribute('viewBox', '0 0 120 110');
chute.setAttribute('aria-hidden', 'true');
chute.innerHTML =
  '<g stroke="#8a5a3c" stroke-width="1.2" fill="none"><path d="M6 46L60 108M34 50L60 108M60 52L60 108M86 50L60 108M114 46L60 108"/></g>' +
  '<path d="M4 46C4 20 30 4 60 4s56 16 56 42c-7-6-21-6-28 0-7-6-21-6-28 0-7-6-21-6-28 0-7-6-21-6-28 0z" fill="#ff9d4d"/>' +
  '<path d="M32 46C34 22 46 6 60 4c14 2 26 18 28 42-7-6-21-6-28 0-7-6-21-6-28 0z" fill="#fff3e0"/>';
box.append(chute, flip);
/** 하트가 떠오르는 층. 창 전체를 덮는다. */
const hearts = document.createElement('div');
hearts.className = 'hearts';
hearts.setAttribute('aria-hidden', 'true');
document.body.append(box, hearts);

/** 지금 붙인 그림과 그 테마 · 키. */
let mounted: { rig: DogRig; theme: DogTheme; themeId: string; height: number } | null = null;
/** 마지막으로 받은 그릴 내용. */
let view: DogView | null = null;
/** 지금 동작을 시작한 시각(ms)과 그 동작. 동작이 바뀌면 처음부터 센다. */
let started: { action: DogAction; at: number } | null = null;
/** 그리기 타이머. */
let drawTimer: ReturnType<typeof setInterval> | undefined;
/** 끄는 동안 기울기를 정하려고 재는 창의 가로 자리와 빠르기. 창은 메인이 옮기고, 화면은 옮겨진 자리만 읽는다. */
const sway = { screenX: window.screenX, at: performance.now(), vx: 0 };

/** 테마와 키에 맞춰 그림을 붙이고, 잰 너비를 메인에 알린다. 화면 바닥에서는 전신 그림이 있으면 그것을 쓴다. */
function mount(themeId: string, height: number): void {
  mounted?.rig.remove();
  /** 화면 바닥에 그릴 테마. */
  const theme = floorTheme(themeById(themeId));
  // 너비는 그림을 잰 뒤에 정한다. 그때까지는 넉넉한 칸에 붙여 그림 비율을 잰다
  box.style.height = `${height}px`;
  box.style.width = `${height * 3}px`;
  // 낙하산은 너비 1.5H이고 줄이 모이는 아래 끝이 발끝에서 0.55H 위(강아지 등)에 온다. 시안 09번의 자리다
  chute.style.width = `${height * 1.5}px`;
  chute.style.height = `${height * 1.375}px`;
  chute.style.bottom = `${height * 0.55}px`;
  /** 붙인 그림. */
  const rig = mountDog(flip, theme);
  mounted = { rig, theme, themeId, height };
  rig.pose('idle', 0);
  report();
}

/** 그림의 비율로 강아지 너비를 정해 칸에 맞추고 메인에 알린다. 아직 재지 못했으면 조금 뒤에 다시 본다. */
function report(): void {
  if (!mounted) return;
  /** 그림이 여백을 잘라 낸 viewBox. 재기 전에는 비어 있다. */
  const crop = mounted.rig.svg.viewBox.baseVal;
  if (!crop || crop.width === 0 || crop.height === 0) {
    mounted.rig.pose('idle', 0);
    setTimeout(report, 100);
    return;
  }
  /** 키에 맞춘 강아지 너비(px). */
  const width = Math.round((mounted.height * crop.width) / crop.height);
  box.style.width = `${width}px`;
  api.reportFigure({ width, gait: mounted.theme.gait, reducedMotion: reducedQuery.matches });
}

/** 끌리거나 내려오는 동안의 기울기(도). 끌 때는 옮겨 가는 반대쪽으로 끌려 기울고, 내려올 때는 천천히 흔들린다(시안 09번). */
function tilt(action: DogAction, t: number): number {
  /** 지금 시각(ms). */
  const now = performance.now();
  /** 앞 그림 뒤 지난 시간(초). */
  const dt = Math.max(0.008, (now - sway.at) / 1000);
  sway.vx = action === 'drag' ? (window.screenX - sway.screenX) / dt : 0;
  sway.screenX = window.screenX;
  sway.at = now;
  if (reducedQuery.matches) return 0;
  if (action === 'drag') return Math.max(-20, Math.min(20, -sway.vx * 0.04));
  if (action === 'fall') return 5 * Math.sin(t * 2.2);
  return 0;
}

/** 지금 동작의 지금 자세를 그린다. */
function draw(): void {
  if (!mounted || !view || !started) return;
  /** 동작을 시작한 뒤의 초. */
  const t = (performance.now() - started.at) / 1000;
  mounted.rig.pose(view.action, t);
  /** 그림이 바라보는 쪽. 옆모습 그림만 있고, 그 그림만 걷는 쪽으로 돌린다. */
  const faces = mounted.theme.faces;
  /** 끌리거나 내려오는 중이면 기울인다. */
  const rotate = tilt(view.action, t);
  flip.style.transform = [rotate ? `rotate(${rotate.toFixed(2)}deg)` : '', faces ? `scaleX(${view.facing * faces})` : ''].join(' ').trim();
}

/**
 * 그리기 타이머를 동작의 그리는 횟수에 맞춘다. 멈춘 동안은 그리지 않는다.
 * 동작 줄이기가 켜져 있으면 평소 · 졸림의 숨쉬기만 움직이고, 신남은 첫 자세로 멈춘 그림이다.
 */
function schedule(): void {
  clearInterval(drawTimer);
  drawTimer = undefined;
  if (!view || view.paused) return;
  draw();
  if (reducedQuery.matches && framesPerSecond(view.action) > 4) return;
  drawTimer = setInterval(draw, 1000 / framesPerSecond(view.action));
}

api.onView((next) => {
  if (!mounted || mounted.themeId !== next.themeId || mounted.height !== next.height) mount(next.themeId, next.height);
  if (started?.action !== next.action) started = { action: next.action, at: performance.now() };
  // 낙하가 시작되면 낙하산을 펴고, 착지하면 접는다. 다시 잡으면 접는 움직임 없이 치운다
  if (next.action === 'fall') chute.dataset.state = 'open';
  else if (view?.action === 'fall' && next.action !== 'drag') chute.dataset.state = 'fold';
  else if (next.action === 'drag') delete chute.dataset.state;
  view = next;
  box.dataset.dogAction = next.action;
  box.dataset.dogTheme = next.themeId;
  box.dataset.paused = String(next.paused);
  schedule();
});

reducedQuery.addEventListener('change', () => {
  report();
  schedule();
});

/** 강아지 둘레의 무작위 자리에 하트를 띄운다. 키에 맞춰 크기, 둘레의 거리, 떠오르는 거리를 늘린다. */
function showHearts(): void {
  if (!mounted) return;
  /** 강아지의 키와 너비(px). */
  const h = mounted.height;
  const w = box.getBoundingClientRect().width;
  /** 강아지 발끝 가운데의 창 안 자리. */
  const feet = { x: window.innerWidth / 2, y: window.innerHeight - DOG_WINDOW_PAD_BOTTOM };
  hearts.classList.toggle('hearts--still', reducedQuery.matches);
  for (let i = 0; i < HEART_COUNT; i++) {
    /** 하트 하나. */
    const heart = document.createElement('span');
    heart.className = 'heart';
    /** 하트 한 변(px). 키 96일 때 14~28이다. */
    const size = (randomBetween(14, 28) * h) / 96;
    heart.style.cssText = [
      `left:${feet.x + randomBetween(-0.8, 0.8) * w}px`,
      `top:${feet.y - randomBetween(0.3, 1.2) * h}px`,
      `width:${size}px`,
      `height:${size}px`,
      // 하트 가운데가 고른 자리에 오게 한다
      `margin:${-size / 2}px 0 0 ${-size / 2}px`,
      `animation-delay:${randomBetween(0, HEART_MAX_DELAY_S)}s`,
      `--heart-dx:${(randomBetween(-18, 18) * h) / 96}px`,
      `--heart-rise:${(-46 * h) / 96}px`,
    ].join(';');
    heart.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${HEART_PATH}"/></svg>`;
    hearts.append(heart);
    setTimeout(() => heart.remove(), HEART_MS + HEART_MAX_DELAY_S * 1000);
  }
}

api.onHearts(showHearts);

// 누름과 뗌만 메인에 알린다. 끌기인지 누르기인지와 끄는 동안의 자리는 메인이 커서 위치로 정한다(28번)
box.addEventListener('pointerdown', (event) => {
  box.setPointerCapture(event.pointerId);
  api.press('down');
});
box.addEventListener('pointerup', (event) => {
  /** 강아지 칸의 화면 상자. 끌지 않고 누른 채 밖으로 나가 손을 떼면 누른 것으로 치지 않는다. */
  const rect = box.getBoundingClientRect();
  /** 손을 뗀 자리가 강아지 칸 안인지. */
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  api.press(inside ? 'up' : 'cancel');
});
box.addEventListener('pointercancel', () => api.press('cancel'));
