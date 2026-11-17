import { useEffect, useState } from 'react';

/** 지금 시각(에포크 ms)을 초가 바뀔 때마다 새로 주는 훅. */
export function useNow(): number {
  /** 마지막으로 읽은 시각. */
  const [now, setNow] = useState(() => Date.now());
  // 다음 초 경계에 맞춰 깨어나, 남은 시간이 매초 같은 순간에 바뀌게 한다
  useEffect(function tickEverySecond() {
    /** 다음 갱신을 미룬 타이머. */
    let timer: ReturnType<typeof setTimeout>;
    /** 다음 초 경계에 한 번 깨어나 시각을 갱신하고 다시 미룬다. */
    const schedule = (): void => {
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, 1000 - (Date.now() % 1000));
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return now;
}
