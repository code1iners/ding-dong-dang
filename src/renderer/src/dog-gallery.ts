// 강아지 견본: 테마마다 여섯 동작을 몇 개의 시각에서 멈춰 그린다.
// 칸마다 그림이 그려졌는지(움직이는 요소의 행렬이 유한한지, 그림이 칸 안에 보이는지)를 data-ok로 남긴다.

import type { DogAction } from '../../shared/status-view';
import { drawableElements, mountDog } from './dog/rig';
import { DOG_THEMES, floorTheme } from './dog/themes';

/** 그릴 동작. */
const ACTIONS: DogAction[] = ['idle', 'happy', 'sleepy', 'move', 'drag', 'fall'];
/** 멈춰 볼 시각(초). 크게 움직인 자세와 반대쪽 자세, 눈을 깜빡이는 순간(3.8초)이 들도록 고른다. */
const TIMES = [0, 0.11, 0.33, 0.61, 3.8];
/** 칸 한 변(px). 돌아다니는 강아지의 기본 키이고, 주소의 `?cell=`로 키워 이음새를 자세히 볼 수 있다. */
const CELL = Number(new URLSearchParams(location.search).get('cell')) || 96;

document.body.style.cssText = 'margin:0;padding:12px;background:#CFE3F8;font:12px sans-serif;color:#4A4048';

/** 견본에 올릴 그림: 테마마다 고리 안 그림, 그리고 전신 그림이 따로 있으면 화면 바닥용 그림. */
const SHEETS = DOG_THEMES.flatMap((theme) => [
  { id: theme.id, theme },
  ...(theme.floor ? [{ id: `${theme.id}-floor`, theme: floorTheme(theme) }] : []),
]);

for (const { id, theme } of SHEETS) {
  /** 테마 이름 줄. */
  const title = document.createElement('h2');
  title.textContent = id;
  title.style.cssText = 'font-size:14px;margin:8px 0 4px';
  document.body.append(title);
  for (const action of ACTIONS) {
    /** 동작 하나의 줄. */
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px';
    /** 줄 앞의 동작 이름. */
    const label = document.createElement('span');
    label.textContent = action;
    label.style.cssText = 'width:52px';
    row.append(label);
    document.body.append(row);
    for (const t of TIMES) {
      /** 한 시각의 자세를 그리는 칸. */
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.theme = id;
      cell.dataset.action = action;
      cell.dataset.t = String(t);
      cell.style.cssText = `width:${CELL}px;height:${CELL}px;background:#fff;border-radius:8px;padding:16px`;
      row.append(cell);
      /** 칸에 붙인 그림. */
      const rig = mountDog(cell, theme);
      rig.svg.style.overflow = 'visible';
      rig.pose(action, t);
      /** 그림의 화면 상자. 칸 안에 보여야 한다. */
      const box = rig.svg.getBoundingClientRect();
      /** 움직인 요소의 행렬 값이 모두 유한한지. */
      const finite = drawableElements(rig.svg).every((el) => {
        const m = el.getScreenCTM();
        return m !== null && [m.a, m.b, m.c, m.d, m.e, m.f].every(Number.isFinite);
      });
      cell.dataset.ok = String(finite && box.width > 0 && box.height > 0);
    }
  }
}
document.body.dataset.ready = 'true';
