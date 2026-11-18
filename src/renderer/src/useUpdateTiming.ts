import type { AppState } from '../../shared/bridge';
import { updateTimingAt, type UpdateTiming } from '../../shared/update';
import { useNow } from './useNow';

/** 업데이트 잠금과 확인 모달의 남은 시간에 쓰는 값. 메인과 같은 판정에 지금 시각을 더했다. */
export type UpdateClock = UpdateTiming & {
  /** 판정한 시각. 매초 바뀐다. */
  now: number;
};

/** 매초 지금 시각으로 업데이트 잠금을 다시 정한다. */
export function useUpdateTiming(state: AppState): UpdateClock {
  /** 지금 시각. 매초 바뀐다. */
  const now = useNow();
  return { ...updateTimingAt(state, state.bellRinging, now), now };
}
