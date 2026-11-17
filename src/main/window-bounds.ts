import type { WindowBounds } from '../shared/data';

/** 저장한 창이 연결된 모니터 안에 이만큼은 걸쳐 있어야 사용자가 잡아 옮길 수 있다고 본다. */
const MIN_VISIBLE = { width: 100, height: 50 };

/**
 * 저장해 둔 창 자리가 지금 연결된 모니터 안이면 그대로, 아니면 null(기본 위치로 연다)을 돌려준다.
 * 모니터를 뺐거나 해상도가 바뀐 뒤 창이 화면 밖에 열려 찾을 수 없게 되는 일을 막는다.
 */
export function usableBounds(saved: WindowBounds | null, workAreas: readonly WindowBounds[]): WindowBounds | null {
  if (!saved) return null;
  const visible = workAreas.some((area) => {
    /** 창과 모니터가 겹치는 가로·세로 길이. */
    const overlapW = Math.min(saved.x + saved.width, area.x + area.width) - Math.max(saved.x, area.x);
    const overlapH = Math.min(saved.y + saved.height, area.y + area.height) - Math.max(saved.y, area.y);
    return overlapW >= MIN_VISIBLE.width && overlapH >= MIN_VISIBLE.height;
  });
  return visible ? saved : null;
}
