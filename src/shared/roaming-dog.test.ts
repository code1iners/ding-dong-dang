import { describe, expect, it } from 'vitest';
import { dogWindowBounds, isOverDog, placeDog, pressDog, stepDog, summonDog, type DogScene, type RoamingDog } from './roaming-dog';

/** 너비 1000px 모니터의 수업 중 장면. 강아지는 너비 100, 키 96의 걷는 테마다. */
const scene: DogScene = {
  kind: 'in-class',
  bellsOff: false,
  ringing: false,
  reducedMotion: false,
  floor: { left: 0, right: 1000 },
  width: 100,
  height: 96,
  gait: 'walk',
};

/** 늘 같은 값을 내는 난수. */
const fixed = (v: number) => () => v;

describe('placeDog', () => {
  it('바닥의 무작위 위치에 놓고, 강아지가 좌우 끝을 넘지 않는다', () => {
    // 끝에서 강아지 반 너비(50)와 여백(8)만큼 안쪽이 놓일 수 있는 범위다
    expect(placeDog(scene, 0, fixed(0)).x).toBe(58);
    expect(placeDog(scene, 0, fixed(0.5)).x).toBe(500);
    expect(placeDog(scene, 0, fixed(0.999999)).x).toBeCloseTo(942, 2);
  });
});

/** 한 번 판정한 결과. */
type Frame = { t: number; action: RoamingDog['action']; x: number };

/** 초당 24번 판정하며 `from`초부터 `seconds`초 동안 흘려 본다. 장면은 시각(초)마다 바꿀 수 있다. */
function run(
  seconds: number,
  random: () => number,
  sceneAt: (t: number) => DogScene = () => scene,
  start = placeDog(scene, 0, fixed(0.5)),
  from = 0,
) {
  const frames: Frame[] = [];
  let dog = start;
  for (let i = 0; i <= seconds * 24; i++) {
    const t = from + i / 24;
    dog = stepDog(dog, sceneAt(t), t * 1000, random);
    frames.push({ t, action: dog.action, x: dog.x });
  }
  return { frames, dog, at: (t: number) => frames[Math.round((t - from) * 24)]! };
}

/** 동작이 이어진 구간들. [동작, 시작 초, 끝 초]. */
function spans(frames: Frame[]): [RoamingDog['action'], number, number][] {
  const out: [RoamingDog['action'], number, number][] = [];
  for (const f of frames) {
    const last = out[out.length - 1];
    if (last && last[0] === f.action) last[2] = f.t;
    else out.push([f.action, f.t, f.t]);
  }
  return out;
}

describe('stepDog: 수업 중', () => {
  it('걷기 5초(난수가 가장 작을 때)와 멈춰 쉬기 10초를 되풀이하고, 쉴 때는 평소다', () => {
    const { frames } = run(31, fixed(0));
    expect(spans(frames).map(([a, s, e]) => [a, Math.round(s), Math.round(e)])).toEqual([
      ['move', 0, 5],
      ['idle', 5, 15],
      ['move', 15, 20],
      ['idle', 20, 30],
      ['move', 30, 31],
    ]);
  });

  it('난수가 가장 클 때는 걷기 10초와 쉬기 20초다', () => {
    const { frames } = run(31, fixed(0.999999));
    expect(spans(frames).map(([a, s, e]) => [a, Math.round(s), Math.round(e)])).toEqual([
      ['move', 0, 10],
      ['idle', 10, 30],
      ['move', 30, 31],
    ]);
  });

  it('걷는 동안 키 96 강아지가 초당 45px 움직이고, 쉬는 동안은 제자리다', () => {
    // 난수 0이면 왼쪽으로 걷는다
    const { at } = run(12, fixed(0));
    expect(at(1).x).toBeCloseTo(500 - 45, 0);
    expect(at(4.5).x).toBeCloseTo(500 - 45 * 4.5, 0);
    expect(at(6).x).toBe(at(12).x);
  });
});

describe('stepDog: 화면 끝', () => {
  it('걷다가 좌우 끝에 닿으면 돌아서고, 강아지가 주 모니터 밖으로 나가지 않는다', () => {
    // 너비 300 모니터에서 10초 걷는다. 끝에서 반 너비 + 여백(58)까지만 갈 수 있다
    const narrow: DogScene = { ...scene, floor: { left: -300, right: 0 } };
    const { frames } = run(10, fixed(0.999999), () => narrow, placeDog(narrow, 0, fixed(0.5)));
    const xs = frames.map((f) => f.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-300 + 58);
    expect(Math.max(...xs)).toBeLessThanOrEqual(0 - 58);
    // 오른쪽으로 걷다가 오른쪽 끝에서 돌아서고, 왼쪽 끝에서 다시 돌아섰다
    expect(Math.max(...xs)).toBeCloseTo(-58, 0);
    expect(Math.min(...xs)).toBeCloseTo(-242, 0);
    expect(xs[xs.length - 1]).toBeGreaterThan(-242 + 45);
  });

  it('모니터가 줄어 강아지가 밖에 있게 되면 안으로 들인다', () => {
    const { dog } = run(0, fixed(0), () => ({ ...scene, kind: 'break', floor: { left: 0, right: 400 } }));
    expect(dog.x).toBe(400 - 58);
  });
});

describe('stepDog: 구간과 종', () => {
  it.each(['break', 'before-first', 'after-last', 'no-class-day', 'no-timetables'] as const)('%s에는 제자리에서 졸림이다', (kind) => {
    const { frames } = run(30, fixed(0), () => ({ ...scene, kind }));
    expect(new Set(frames.map((f) => f.action))).toEqual(new Set(['sleepy']));
    expect(new Set(frames.map((f) => f.x))).toEqual(new Set([500]));
  });

  it('오늘만 끄기 중에는 수업 중이어도 제자리에서 졸림이다', () => {
    const { frames } = run(30, fixed(0), () => ({ ...scene, bellsOff: true }));
    expect(new Set(frames.map((f) => f.action))).toEqual(new Set(['sleepy']));
    expect(new Set(frames.map((f) => f.x))).toEqual(new Set([500]));
  });

  it('종이 울리는 동안은 걷다가도 제자리에서 신남이고, 그친 뒤 다시 걷는다', () => {
    const { frames, at } = run(6, fixed(0), (t) => ({ ...scene, ringing: t >= 1 && t < 3 }));
    expect(spans(frames).map(([a, s, e]) => [a, Math.round(s), Math.round(e)])).toEqual([
      ['move', 0, 1],
      ['happy', 1, 3],
      ['move', 3, 5],
      ['idle', 5, 6],
    ]);
    expect(at(1.5).x).toBe(at(2.9).x);
  });

  it('쉬는 시간에도 종이 울리는 동안은 신남이다', () => {
    const { frames } = run(2, fixed(0), () => ({ ...scene, kind: 'break', ringing: true }));
    expect(new Set(frames.map((f) => f.action))).toEqual(new Set(['happy']));
  });

  it('수업이 끝났다 다시 시작하면 걷기부터 새로 한다', () => {
    const { frames } = run(8, fixed(0), (t) => ({ ...scene, kind: t >= 2 && t < 4 ? 'break' : 'in-class' }));
    expect(spans(frames).map(([a, s, e]) => [a, Math.round(s), Math.round(e)])).toEqual([
      ['move', 0, 2],
      ['sleepy', 2, 4],
      ['move', 4, 8],
    ]);
  });
});

describe('pressDog', () => {
  it('누르면 2초 동안 제자리에서 신남이고, 그 뒤 원래 동작으로 돌아온다', () => {
    const sleepy = { ...scene, kind: 'break' } as const;
    const before = run(1, fixed(0), () => sleepy).dog;
    const { frames } = run(3, fixed(0), () => sleepy, pressDog(before, 1000), 1);
    expect(spans(frames).map(([a, s, e]) => [a, Math.round(s), Math.round(e)])).toEqual([
      ['happy', 1, 3],
      ['sleepy', 3, 4],
    ]);
    expect(new Set(frames.map((f) => f.x))).toEqual(new Set([500]));
  });

  it('걷다가 눌러도 신남 동안은 제자리이고, 그 뒤 하던 걷기를 잇는다', () => {
    const walking = run(1, fixed(0)).dog;
    const { at } = run(3, fixed(0), () => scene, pressDog(walking, 1000), 1);
    expect(at(1.1).action).toBe('happy');
    expect(at(2.9).x).toBe(walking.x);
    expect(at(3.5).action).toBe('move');
    expect(at(3.5).x).toBeLessThan(walking.x);
  });
});

describe('stepDog: 동작 줄이기', () => {
  it('수업 중에도 이동하지 않고 제자리에서 평소(숨쉬기)다', () => {
    const { frames } = run(40, fixed(0), () => ({ ...scene, reducedMotion: true }));
    expect(new Set(frames.map((f) => f.action))).toEqual(new Set(['idle']));
    expect(new Set(frames.map((f) => f.x))).toEqual(new Set([500]));
  });
});

describe('summonDog', () => {
  it('설정이 꺼진 채 종이 울릴 때는 바닥 가운데에 나타난다', () => {
    const dog = placeDog(scene, 0, fixed(0));
    expect(summonDog(dog, { ...scene, floor: { left: -200, right: 1000 } }).x).toBe(400);
  });
});

describe('dogWindowBounds', () => {
  it('키 96, 너비 113 강아지의 창은 281×203이고(검증 티켓 28번), 강아지 발끝이 아래 가운데에서 6px 위에 있다', () => {
    expect(dogWindowBounds({ x: 500, floorY: 900, width: 113, height: 96 })).toEqual({ x: 360, y: 703, width: 281, height: 203 });
  });

  it('키 160 얼굴 테마처럼 키가 큰 강아지는 키를 따라 창이 커진다', () => {
    // 너비는 max(1.6×80+92, 80+120, 240)+8 = 248, 높이는 1.925×160+18 = 326
    expect(dogWindowBounds({ x: 0, floorY: 0, width: 80, height: 160 })).toEqual({ x: -124, y: -320, width: 248, height: 326 });
  });
});

describe('isOverDog', () => {
  const dog = { x: 500, floorY: 900, width: 100, height: 96 };
  it('커서가 강아지 네모 안에 있을 때만 참이다', () => {
    expect(isOverDog({ x: 500, y: 850 }, dog)).toBe(true);
    expect(isOverDog({ x: 450, y: 804 }, dog)).toBe(true);
    expect(isOverDog({ x: 449, y: 850 }, dog)).toBe(false);
    expect(isOverDog({ x: 500, y: 803 }, dog)).toBe(false);
    expect(isOverDog({ x: 500, y: 901 }, dog)).toBe(false);
  });
});

describe('stepDog: 오래 멈췄다 다시 판정할 때', () => {
  it('밀린 걷기 · 쉬기 차례를 몰아서 넘기지 않고, 그때부터 새 차례를 한 번만 시작한다', () => {
    const walking = run(1, fixed(0)).dog;
    // 잠금 등으로 100초 동안 판정하지 않았다가 다시 판정한다
    const { frames } = run(4, fixed(0), () => scene, walking, 101);
    expect(spans(frames).map(([a]) => a)).toEqual(['idle']);
  });
});
