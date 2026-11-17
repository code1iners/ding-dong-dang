// 2차원 아핀 행렬. SVG의 matrix(a, b, c, d, e, f)와 같은 순서이고, 점 (x, y)를 (a·x + c·y + e, b·x + d·y + f)로 보낸다.
// DOMMatrix가 없는 Node에서도 시험할 수 있게 직접 둔다.

/** 2차원 아핀 행렬 [a, b, c, d, e, f]. */
export type Mat = readonly [a: number, b: number, c: number, d: number, e: number, f: number];

/** 아무것도 바꾸지 않는 행렬. */
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];

/** 화면 기준 변환 값. 각도는 도이고 시계 방향이 양수, `ty`는 아래가 양수, `sy`는 세로 배율이다. */
export type JointValue = { r?: number; ty?: number; sy?: number };

/** m · n. n을 먼저 적용하고 m을 나중에 적용하는 행렬이다. */
export function multiply(m: Mat, n: Mat): Mat {
  const [a, b, c, d, e, f] = m;
  const [A, B, C, D, E, F] = n;
  return [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
}

/** 역행렬. 강아지 그림의 행렬은 늘 뒤집을 수 있다. */
export function invert(m: Mat): Mat {
  const [a, b, c, d, e, f] = m;
  /** 행렬식. */
  const det = a * d - b * c;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/** 점 하나를 옮긴다. */
export function apply(m: Mat, [x, y]: readonly [number, number]): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * 화면 기준의 관절 `joint`를 중심으로 세로로 늘이고(`sy`), 돌리고(`r`), 마지막에 위아래로 옮기는(`ty`) 행렬.
 * 관절과 결과 모두 그림 전체의 좌표(y가 아래로 커짐)다.
 */
export function jointMove(joint: { x: number; y: number }, { r = 0, ty = 0, sy = 1 }: JointValue): Mat {
  /** 돌리는 각도(라디안). */
  const rad = (r * Math.PI) / 180;
  /** 회전의 코사인과 사인. */
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  /** 관절을 원점으로 옮겼다가 늘이고 돌린 뒤 되돌리고, 마지막에 ty만큼 옮긴다. */
  const around: Mat = multiply([cos, sin, -sin, cos, 0, 0], [1, 0, 0, sy, 0, 0]);
  return multiply([1, 0, 0, 1, joint.x, joint.y + ty], multiply(around, [1, 0, 0, 1, -joint.x, -joint.y]));
}

/**
 * 화면 기준 변환 `m`을 요소의 좌표계로 옮긴다: L = CTM⁻¹ · M · CTM.
 * `ctm`은 요소 좌표 → 그림 전체 좌표 행렬이다. 요소에 L을 덧붙이면 그림 전체에서 M을 건 것과 같아,
 * y축이 뒤집히거나 요소마다 translate가 걸린 그림도 테마마다 손으로 맞출 필요가 없다.
 */
export function toLocal(ctm: Mat, m: Mat): Mat {
  return multiply(invert(ctm), multiply(m, ctm));
}
