import { useEffect, useState } from 'react';
import type { AppState } from '../../shared/bridge';

/** 메인이 가진 앱 상태를 구독한다. 처음 상태를 받기 전에는 null이다. */
export function useAppState(): AppState | null {
  /** 마지막으로 받은 앱 상태. */
  const [state, setState] = useState<AppState | null>(null);
  // 창이 떠 있는 동안 메인의 상태 변경을 받고, 사라질 때 구독을 끝낸다
  useEffect(function subscribeAppState() {
    return window.dingdong.subscribe(setState);
  }, []);
  return state;
}
