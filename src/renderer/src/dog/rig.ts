// 강아지 그리기: 테마의 그림을 붙이고, 부위 표와 동작 표로 부위를 움직인다.
// 모든 테마가 같은 식(L = CTM⁻¹ · M · CTM) 하나로 움직이고, 테마마다 따로 맞춘 코드가 없다.

import type { DogAction } from '../../../shared/status-view';
import { apply, IDENTITY, invert, jointMove, multiply, toLocal, type Mat } from './matrix';
import { moveOf } from './moves';
import type { DogTheme, PartName } from './themes';

/** 그리는 요소의 태그. 이 순서로 센 번호가 부위 표의 요소 번호다. */
const DRAWABLE = 'path, circle, ellipse, rect, polygon, polyline, line';
/** 안의 모양을 그리지 않는 묶음. */
const NOT_DRAWN = new Set(['defs', 'clipPath', 'mask', 'pattern', 'symbol', 'marker']);

/** 그림 전체 좌표의 상자. */
type Box = { left: number; top: number; right: number; bottom: number };

/** 움직이는 요소 하나와, 그 요소가 든 부위마다의 관절. */
type Rigged = {
  /** 움직이는 요소. */
  el: SVGGraphicsElement;
  /** 원본에 있던 transform. 그 뒤에 움직임을 덧붙인다. */
  own: string;
  /** 요소 좌표 → 그림 전체 좌표. */
  ctm: Mat;
  /** 이 요소가 든 부위와 그 관절. 부위 표 순서(바깥부터)다. */
  joints: { part: PartName; x: number; y: number }[];
};

/** 붙인 강아지 그림 하나. */
export type DogRig = {
  /** 붙인 그림. */
  svg: SVGSVGElement;
  /** 동작 `action`을 시작하고 `t`초 지난 자세로 그린다. */
  pose(action: DogAction, t: number): void;
  /** 그림을 떼어 낸다. */
  remove(): void;
};

/** 요소가 그리지 않는 묶음 안에 있는지. */
function insideNotDrawn(el: Element, root: Element): boolean {
  for (let node = el.parentElement; node && node !== root; node = node.parentElement) {
    if (NOT_DRAWN.has(node.localName)) return true;
  }
  return false;
}

/** DOMMatrix를 Mat으로. */
function matOf(m: DOMMatrix | null): Mat | null {
  return m ? [m.a, m.b, m.c, m.d, m.e, m.f] : null;
}

/** 요소의 상자를 그림 전체 좌표로. 돌아간 요소도 감싸도록 네 모서리를 옮겨 잰다. */
function boxOf(el: SVGGraphicsElement, ctm: Mat): Box {
  const b = el.getBBox();
  const corners = [
    apply(ctm, [b.x, b.y]),
    apply(ctm, [b.x + b.width, b.y]),
    apply(ctm, [b.x, b.y + b.height]),
    apply(ctm, [b.x + b.width, b.y + b.height]),
  ];
  return {
    left: Math.min(...corners.map((p) => p[0])),
    top: Math.min(...corners.map((p) => p[1])),
    right: Math.max(...corners.map((p) => p[0])),
    bottom: Math.max(...corners.map((p) => p[1])),
  };
}

/** 상자 여럿을 감싸는 상자. */
function union(boxes: Box[]): Box {
  return {
    left: Math.min(...boxes.map((b) => b.left)),
    top: Math.min(...boxes.map((b) => b.top)),
    right: Math.max(...boxes.map((b) => b.right)),
    bottom: Math.max(...boxes.map((b) => b.bottom)),
  };
}

/** 그림의 그리는 요소를 부위 표의 번호 순서로 고른다. */
export function drawableElements(svg: SVGSVGElement): SVGGraphicsElement[] {
  return [...svg.querySelectorAll<SVGGraphicsElement>(DRAWABLE)].filter((el) => !insideNotDrawn(el, svg));
}

/**
 * 테마의 그림을 `container` 안에 붙인다. 그림은 칸을 꽉 채우되 비율을 지키고 발이 칸 바닥에 닿는다.
 * 관절과 요소 좌표계는 붙인 뒤 한 번 잰다. 크기가 바뀌어도 그림 좌표로 재 두어 다시 잴 필요가 없다.
 */
export function mountDog(container: Element, theme: DogTheme): DogRig {
  /** 그림 원본을 읽은 SVG. 파일 그대로이며 그 안의 스크립트는 없다(직접 고른 그림만 쓴다). */
  const parsed = new DOMParser().parseFromString(theme.art, 'image/svg+xml').documentElement;
  /** 이 문서로 들여온 그림. */
  const svg = document.importNode(parsed, true) as unknown as SVGSVGElement;
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.removeAttribute('id');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add('dog-art__svg');
  container.append(svg);

  /** 번호 순서의 그리는 요소. */
  const elements = drawableElements(svg);
  for (const i of theme.hidden) elements[i]?.setAttribute('display', 'none');

  /** 잰 결과. 아직 화면에 그려지지 않아 잴 수 없으면 null이고, 다음 그리기에서 다시 잰다. */
  let rigged: Rigged[] | null = null;
  /** ty 한 단위(키 96px 강아지의 1px)가 그림 좌표로 얼마인지. */
  let unit = 1;

  /** 그림을 잰다: 요소마다 그림 좌표계, 부위마다 관절, 그리고 빈 여백을 잘라 낸 viewBox. */
  function measure(): Rigged[] | null {
    // 아무 변환이 없는 빈 묶음의 CTM이 곧 그림 전체 좌표 → 화면이다. viewBox가 어떻게 걸리든 상관없다
    /** 그림 전체 좌표를 재는 빈 묶음. */
    const probe = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    svg.append(probe);
    /** 그림 전체 좌표 → 화면. */
    const root = matOf(probe.getScreenCTM());
    probe.remove();
    if (!root) return null;
    /** 화면 → 그림 전체 좌표. */
    const fromScreen = invert(root);

    /** 요소 번호 → 그림 좌표계 행렬과 상자. */
    const measured = new Map<number, { ctm: Mat; box: Box }>();
    for (const [i, el] of elements.entries()) {
      if (theme.hidden.includes(i)) continue;
      /** 요소 좌표 → 화면. */
      const screen = matOf(el.getScreenCTM());
      if (!screen) return null;
      /** 요소 좌표 → 그림 전체 좌표. */
      const ctm = multiply(fromScreen, screen);
      measured.set(i, { ctm, box: boxOf(el, ctm) });
    }
    if (measured.size === 0) return null;

    // 그림의 빈 여백을 잘라 강아지가 칸을 채우고 발이 바닥에 닿게 한다
    /** 보이는 요소를 모두 감싼 상자. */
    const crop = union([...measured.values()].map((m) => m.box));
    svg.setAttribute('viewBox', [crop.left, crop.top, crop.right - crop.left, crop.bottom - crop.top].join(' '));
    unit = (crop.bottom - crop.top) / 96;

    /** 요소 번호 → 움직일 요소. */
    const byIndex = new Map<number, Rigged>();
    for (const part of theme.parts) {
      /** 이 부위에서 보이는 요소. */
      const present = part.elements.filter((i) => measured.has(i));
      if (present.length === 0) continue;
      /** 부위 전체의 상자. 요소 둘로 된 귀처럼 묶음의 상자에서 관절 하나를 잡아야 어긋나지 않는다. */
      const group = union(present.map((i) => measured.get(i)!.box));
      for (const i of present) {
        const { ctm, box } = measured.get(i)!;
        /** 관절을 잴 상자. 관절이 없으면 요소마다 자기 가운데다. */
        const b = part.joint ? group : box;
        const [fx, fy] = part.joint ?? [0.5, 0.5];
        /** 이 번호의 요소. */
        const el = elements[i]!;
        /** 이미 다른 부위로 잡아 둔 같은 요소가 있으면 거기에 관절을 더한다. */
        const item = byIndex.get(i) ?? { el, own: el.getAttribute('transform') ?? '', ctm, joints: [] };
        item.joints.push({ part: part.name, x: b.left + (b.right - b.left) * fx, y: b.top + (b.bottom - b.top) * fy });
        byIndex.set(i, item);
      }
    }
    return [...byIndex.values()];
  }

  return {
    svg,
    pose(action, t) {
      rigged ??= measure();
      if (!rigged) return;
      /** 이 동작의 부위별 움직임. */
      const move = moveOf(action, theme.gait);
      for (const item of rigged) {
        // 바깥 부위부터 곱해, 몸이 움직인 뒤에 꼬리 · 귀가 몸에 붙은 관절에서 움직이게 한다
        /** 이 요소에 덧붙일 움직임. 요소 좌표계의 행렬이다. */
        let local = IDENTITY;
        for (const joint of item.joints) {
          /** 이 부위의 움직임 함수. 이 동작에서 움직이지 않는 부위면 없다. */
          const partMove = move[joint.part];
          if (!partMove) continue;
          /** 지금 시각의 화면 기준 변환 값. */
          const v = partMove(t);
          local = multiply(local, toLocal(item.ctm, jointMove(joint, { ...v, ty: (v.ty ?? 0) * unit })));
        }
        /** 원본 transform 뒤에 덧붙일 움직임. 움직임이 없으면 원본 그대로 둔다. */
        const extra = local === IDENTITY ? '' : ` matrix(${local.map((n) => n.toFixed(5)).join(',')})`;
        /** 요소에 쓸 transform. */
        const value = (item.own + extra).trim();
        if (value) item.el.setAttribute('transform', value);
        else item.el.removeAttribute('transform');
      }
    },
    remove() {
      svg.remove();
    },
  };
}
