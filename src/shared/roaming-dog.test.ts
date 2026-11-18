import { describe, expect, it } from 'vitest';
import {
  dogWindowBounds,
  holdDog,
  isOverDog,
  moveHeldDog,
  placeDog,
  pressDog,
  releaseDog,
  stepDog,
  summonDog,
  type DogScene,
  type RoamingDog,
} from './roaming-dog';

/** 너비 1000px 모니터의 수업 중 장면. 강아지는 너비 100, 키 96의 걷는 테마다. */
const scene: DogScene = {
  kind: 'in-class',
  bellsOff: false,
  ringing: false,
  reducedMotion: false,
  floor: { left: 0, right: 1000, top: 0, bottom: 900 },
  width: 100,
  height: 96,
  gait: 'walk',
  summoned: false,
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
    const narrow: DogScene = { ...scene, floor: { left: -300, right: 0, top: 0, bottom: 900 } };
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
    const { dog } = run(0, fixed(0), () => ({ ...scene, kind: 'break', floor: { left: 0, right: 400, top: 0, bottom: 900 } }));
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
    expect(summonDog(dog, { ...scene, floor: { left: -200, right: 1000, top: 0, bottom: 900 } }).x).toBe(400);
  });

  it('끌리거나 내려오던 중이었어도 바닥에 내려 손을 놓은 채 나타난다', () => {
    const dragging = draggedTo(300, 300);
    const summoned = summonDog(dragging, scene);
    expect([summoned.x, summoned.y, summoned.hold, summoned.falling]).toEqual([500, 900, null, false]);
  });
});

describe('dogWindowBounds', () => {
  it('키 96, 너비 113 강아지의 창은 281×203이고(검증 티켓 28번), 강아지 발끝이 아래 가운데에서 6px 위에 있다', () => {
    expect(dogWindowBounds({ x: 500, feetY: 900, width: 113, height: 96 })).toEqual({ x: 360, y: 703, width: 281, height: 203 });
  });

  it('키 160 얼굴 테마처럼 키가 큰 강아지는 키를 따라 창이 커진다', () => {
    // 너비는 max(1.6×80+92, 80+120, 240)+8 = 248, 높이는 1.925×160+18 = 326
    expect(dogWindowBounds({ x: 0, feetY: 0, width: 80, height: 160 })).toEqual({ x: -124, y: -320, width: 248, height: 326 });
  });
});

describe('isOverDog', () => {
  const dog = { x: 500, feetY: 900, width: 100, height: 96 };
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

/** 바닥(500, 900)에 선 강아지를 발끝에서 40px 위를 눌러 잡은 상태. */
function held(at = 0, onScene: DogScene = scene): RoamingDog {
  return holdDog(placeDog(onScene, at, fixed(0.5)), { x: 500, y: 860 });
}

describe('끌기', () => {
  it('누른 채 5px 넘게 움직이면 끌려가기가 되고, 누른 자리를 커서 밑에 둔 채 따라온다', () => {
    // 5px 안의 흔들림은 끌기가 아니다
    const still = moveHeldDog(held(), scene, { x: 503, y: 857 }, 0).dog;
    expect([still.x, still.y]).toEqual([500, 900]);
    // 넘으면 그때부터 커서를 따라온다
    const started = moveHeldDog(still, scene, { x: 510, y: 860 }, 10).dog;
    const dragged = moveHeldDog(started, scene, { x: 700, y: 400 }, 20).dog;
    // 누른 자리는 발끝에서 40px 위다
    expect([started.x, started.y]).toEqual([510, 900]);
    expect([dragged.x, dragged.y]).toEqual([700, 440]);
    expect(stepDog(dragged, scene, 30, fixed(0)).action).toBe('drag');
  });

  it('주 모니터 밖으로 나가지 않는다: 좌우는 바닥과 같은 범위, 위로는 머리가 위 끝에 닿을 때까지, 아래로는 바닥까지', () => {
    const start = moveHeldDog(held(), scene, { x: 510, y: 860 }, 0).dog;
    /** 커서를 그 자리로 옮겼을 때의 발끝. */
    const feet = (x: number, y: number) => {
      const { dog } = moveHeldDog(start, scene, { x, y }, 10);
      return [dog.x, dog.y];
    };
    // 누른 자리는 발끝에서 40px 위다. 끝에서 반 너비 + 여백(58), 위 끝에서 키(96)까지만 간다
    expect(feet(-500, -500)).toEqual([58, 96]);
    expect(feet(5000, 300)).toEqual([942, 340]);
    expect(feet(500, 5000)).toEqual([500, 900]);
  });

  it('종이 울리는 중에 끌기 시작하면 종을 멈추라고 하고, 끄는 중에는 다시 말하지 않는다', () => {
    const ringing = { ...scene, ringing: true };
    const first = moveHeldDog(held(0, ringing), ringing, { x: 520, y: 860 }, 0);
    expect(first.stopBell).toBe(true);
    expect(moveHeldDog(first.dog, ringing, { x: 600, y: 700 }, 10).stopBell).toBe(false);
    // 울리지 않을 때 끌기 시작하면 멈출 것이 없다
    expect(moveHeldDog(held(), scene, { x: 520, y: 860 }, 0).stopBell).toBe(false);
  });

  it('설정이 꺼진 채 종 때문에 나타난 강아지는 끌 수 없다', () => {
    const summoned = { ...scene, ringing: true, summoned: true };
    const { dog, stopBell } = moveHeldDog(held(0, summoned), summoned, { x: 800, y: 500 }, 0);
    expect([dog.x, dog.y]).toEqual([500, 900]);
    expect(stopBell).toBe(false);
    expect(stepDog(dog, summoned, 10, fixed(0)).action).toBe('happy');
  });
});

/** 강아지를 잡아 그 자리(발끝)까지 끌어 올린 상태. */
function draggedTo(x: number, y: number, onScene: DogScene = scene, at = 0): RoamingDog {
  const started = moveHeldDog(held(at, onScene), onScene, { x: 510, y: 860 }, at).dog;
  return moveHeldDog(started, onScene, { x, y: y - 40 }, at).dog;
}

/** 초당 24번 판정하며 착지할 때까지 흘려, 착지한 시각(초)을 낸다. 30초 안에 착지하지 않으면 null. */
function landingTime(dog: RoamingDog, sceneAt: (t: number) => DogScene = () => scene, from = 0) {
  let d = dog;
  /** 내려오는 동안의 발끝 x와 y. */
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 1; i <= 30 * 24; i++) {
    const t = from + i / 24;
    d = stepDog(d, sceneAt(t), t * 1000, fixed(0));
    if (d.action !== 'fall') return { t: i / 24, dog: d, xs, ys };
    xs.push(d.x);
    ys.push(d.y);
  }
  return null;
}

describe('놓기와 낙하', () => {
  it('놓으면 그 자리에서 낙하가 되고, 화면 맨 위에서 바닥까지 수직으로 7~8초에 내려와 착지한다', () => {
    // 머리가 위 끝에 닿은 자리(발끝 96)에서 놓는다
    const { dog, petted } = releaseDog(draggedTo(300, 96), scene, 0, true);
    expect(petted).toBe(false);
    expect(stepDog(dog, scene, 0, fixed(0)).action).toBe('fall');
    const landed = landingTime(dog)!;
    expect(landed.t).toBeGreaterThanOrEqual(7);
    expect(landed.t).toBeLessThanOrEqual(8);
    // 옆으로 흐르지 않고, 계속 내려오기만 한다
    expect(new Set(landed.xs)).toEqual(new Set([300]));
    expect(landed.dog.y).toBe(900);
    expect(landed.ys.every((y, i) => i === 0 || y > landed.ys[i - 1]!)).toBe(true);
  });

  it('바닥에서 끌다 놓으면 낙하 없이 그대로 바닥에 놓인다', () => {
    const { dog } = releaseDog(draggedTo(300, 898), scene, 0, true);
    expect(dog.y).toBe(900);
    expect(stepDog(dog, { ...scene, kind: 'break' }, 10, fixed(0)).action).toBe('sleepy');
  });

  it('끌려가는 중과 내려오는 중에는 구간이 바뀌거나 종이 울려도 그 동작을 끝내고, 착지한 뒤 새 상태가 된다', () => {
    // 끄는 동안 쉬는 시간이 되고 종이 울린다
    const ringingBreak = { ...scene, kind: 'break', ringing: true } as const;
    const dragging = draggedTo(300, 500);
    expect(stepDog(dragging, ringingBreak, 1000, fixed(0)).action).toBe('drag');
    // 놓은 뒤 내려오는 동안도 낙하이고, 착지하자 종이 울리는 중이라 신남이다
    const { dog } = releaseDog(dragging, ringingBreak, 1000, true);
    const landed = landingTime(dog, () => ringingBreak, 1)!;
    // 발끝 500에서 바닥 900까지는 400 ÷ (804 ÷ 7.5)초 ≈ 3.7초다
    expect(landed.t).toBeCloseTo(3.7, 0);
    expect(landed.dog.action).toBe('happy');
    // 종이 그쳤으면 쉬는 시간의 졸림이다
    expect(landingTime(dog, () => ({ ...scene, kind: 'break' }), 1)!.dog.action).toBe('sleepy');
  });

  it('내려오는 강아지를 눌러도 종이 멈추고 하트가 나오며, 낙하는 그대로 이어진다', () => {
    const ringing = { ...scene, ringing: true };
    const falling = stepDog(releaseDog(draggedTo(300, 300), ringing, 0, true).dog, ringing, 500, fixed(0));
    // 내려오는 자리를 눌렀다 움직이지 않고 뗀다
    const pressed = releaseDog(holdDog(falling, { x: falling.x, y: falling.y - 40 }), ringing, 600, true);
    expect(pressed.stopBell).toBe(true);
    expect(pressed.petted).toBe(true);
    expect(stepDog(pressed.dog, ringing, 700, fixed(0)).action).toBe('fall');
    expect(stepDog(pressed.dog, ringing, 700, fixed(0)).y).toBeGreaterThan(falling.y);
  });

  it('내려오는 강아지를 다시 잡으면 낙하를 멈추고 다시 끌려간다', () => {
    const falling = stepDog(releaseDog(draggedTo(300, 300), scene, 0, true).dog, scene, 500, fixed(0));
    const grabbed = moveHeldDog(holdDog(falling, { x: 300, y: 300 }), scene, { x: 320, y: 300 }, 600).dog;
    const dragged = moveHeldDog(grabbed, scene, { x: 420, y: 200 }, 700).dog;
    expect(stepDog(dragged, scene, 800, fixed(0)).action).toBe('drag');
    // 누른 자리(300, 300)가 커서 밑에 온다
    expect([dragged.x, dragged.y]).toEqual([falling.x + 120, falling.y - 100]);
  });

  it('동작 줄이기 때는 놓으면 낙하산 없이 바로 바닥에 놓인다', () => {
    const reduced = { ...scene, reducedMotion: true };
    const { dog } = releaseDog(draggedTo(300, 300, reduced), reduced, 0, true);
    expect([dog.x, dog.y]).toEqual([300, 900]);
    expect(stepDog(dog, reduced, 10, fixed(0)).action).toBe('idle');
  });

  it('끌지 않고 강아지 위에서 떼면 누른 것이고, 강아지 밖에서 떼면 아무 일도 없다', () => {
    const ringing = { ...scene, ringing: true };
    const onDog = releaseDog(held(0, ringing), ringing, 0, true);
    expect([onDog.petted, onDog.stopBell]).toEqual([true, true]);
    const outside = releaseDog(held(0, ringing), ringing, 0, false);
    expect([outside.petted, outside.stopBell, outside.dog.hold]).toEqual([false, false, null]);
    expect(stepDog(outside.dog, { ...scene, kind: 'break' }, 10, fixed(0)).action).toBe('sleepy');
  });

  it('끌던 중에는 강아지 밖에서 손을 떼도(화면 끝에서 멈춘 채) 놓은 것이다', () => {
    const { dog } = releaseDog(draggedTo(942, 300), scene, 0, false);
    expect(dog.hold).toBeNull();
    expect(stepDog(dog, scene, 10, fixed(0)).action).toBe('fall');
  });

  it('누르고 있는 동안은 걷거나 내려오지 않아, 누른 강아지가 커서 밑에서 빠져나가지 않는다', () => {
    // 걷는 강아지를 누른 채 1초
    const walking = run(1, fixed(0)).dog;
    const heldWalking = holdDog(walking, { x: walking.x, y: 860 });
    const after = run(1, fixed(0), () => scene, heldWalking, 1).dog;
    expect(after.x).toBe(walking.x);
    // 내려오는 강아지를 누른 채 1초: 낙하 중이지만 그 자리에 멈춰 있다
    const falling = stepDog(releaseDog(draggedTo(300, 300), scene, 0, true).dog, scene, 500, fixed(0));
    const heldFalling = holdDog(falling, { x: 300, y: falling.y - 40 });
    const later = run(1, fixed(0), () => scene, heldFalling, 0.5);
    expect(later.dog.y).toBe(falling.y);
    expect(later.dog.action).toBe('fall');
    // 떼면 누른 것이고, 다시 내려온다
    const pressed = releaseDog(later.dog, scene, 1600, true);
    expect(pressed.petted).toBe(true);
    expect(stepDog(pressed.dog, scene, 1700, fixed(0)).y).toBeGreaterThan(falling.y);
  });
});
