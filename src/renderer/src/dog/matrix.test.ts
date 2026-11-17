import { describe, expect, it } from 'vitest';
import { apply, jointMove, toLocal, type Mat } from './matrix';

/** 기본 테마처럼 y축이 뒤집히고 옮겨진 요소 좌표계(요소 → 그림 좌표). */
const FLIPPED: Mat = [1.3333333, 0, 0, -1.3333333, 706, 1600 - 840];

/** 두 점이 거의 같은지. */
function expectNear(actual: [number, number], expected: [number, number]) {
  expect(actual[0]).toBeCloseTo(expected[0], 6);
  expect(actual[1]).toBeCloseTo(expected[1], 6);
}

describe('jointMove: 화면 기준의 관절과 변환', () => {
  it('관절을 중심으로 시계 방향 90도 돌리면 관절 오른쪽 점이 관절 아래로 간다', () => {
    const m = jointMove({ x: 10, y: 20 }, { r: 90 });
    expectNear(apply(m, [10, 20]), [10, 20]);
    expectNear(apply(m, [11, 20]), [10, 21]);
  });

  it('세로 늘이기는 관절의 높이를 지키고, 올리기(ty)는 위(음수 y)로 옮긴다', () => {
    expectNear(apply(jointMove({ x: 0, y: 100 }, { sy: 0.5 }), [3, 0]), [3, 50]);
    expectNear(apply(jointMove({ x: 0, y: 0 }, { ty: -6 }), [1, 1]), [1, -5]);
  });
});

describe('toLocal: L = CTM⁻¹ · M · CTM', () => {
  it('요소 좌표계에 L을 건 뒤 CTM으로 보낸 점은, 화면에서 M을 건 점과 같다(뒤집힌 좌표계에서도)', () => {
    /** 화면 기준 변환: 관절 (750, 700)을 중심으로 30도. */
    const m = jointMove({ x: 750, y: 700 }, { r: 30, sy: 0.9 });
    const local = toLocal(FLIPPED, m);
    for (const p of [
      [0, 0],
      [77.955, 102.855],
      [-40, 12],
    ] as [number, number][]) {
      expectNear(apply(FLIPPED, apply(local, p)), apply(m, apply(FLIPPED, p)));
    }
  });

  it('관절에 놓인 요소 점은 돌려도 제자리다', () => {
    /** 요소 좌표 (0, 0)이 그림에서 놓이는 곳. */
    const joint = apply(FLIPPED, [0, 0]);
    const local = toLocal(FLIPPED, jointMove({ x: joint[0], y: joint[1] }, { r: 25 }));
    expectNear(apply(local, [0, 0]), [0, 0]);
  });
});
