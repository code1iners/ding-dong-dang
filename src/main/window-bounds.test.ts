import { describe, expect, it } from 'vitest';
import { usableBounds } from './window-bounds';

/** 1920×1080 모니터 하나. */
const screen = { x: 0, y: 0, width: 1920, height: 1080 };
/** 오른쪽에 붙은 둘째 모니터. */
const second = { x: 1920, y: 0, width: 1920, height: 1080 };

describe('usableBounds', () => {
  it('저장한 자리가 없으면 기본 위치로 연다', () => {
    expect(usableBounds(null, [screen])).toBeNull();
  });

  it('연결된 모니터 안이면 저장한 자리 그대로 연다', () => {
    const saved = { x: 100, y: 80, width: 1000, height: 640 };
    expect(usableBounds(saved, [screen])).toEqual(saved);
  });

  it('둘째 모니터에 있던 창은 그 모니터가 연결돼 있을 때만 쓴다', () => {
    const saved = { x: 2100, y: 100, width: 1000, height: 640 };
    expect(usableBounds(saved, [screen, second])).toEqual(saved);
    expect(usableBounds(saved, [screen])).toBeNull();
  });

  it('모니터 밖이거나 가장자리에 조금만 걸쳐 있으면 기본 위치로 연다', () => {
    expect(usableBounds({ x: -30000, y: 0, width: 1000, height: 640 }, [screen])).toBeNull();
    expect(usableBounds({ x: 1900, y: 100, width: 1000, height: 640 }, [screen])).toBeNull();
  });
});
