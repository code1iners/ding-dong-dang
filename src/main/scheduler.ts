import { decideBell, type BellKind } from '../shared/bell-decision';
import type { Data } from '../shared/data';

/** 잠자기 막기의 종류. system은 방치로 인한 잠자기만, display는 화면 꺼짐까지 막는다. */
export type KeepAwakeMode = 'system' | 'display';

/** 스케줄러가 판정할 때마다 읽는 저장된 값. */
export type SchedulerData = Pick<Data, 'timetables' | 'weekdays' | 'bellsOffDate' | 'settings'>;

/** 스케줄러가 받는 갈아 끼울 수 있는 부품. 실제 앱은 Electron에 닿는 것을, 테스트는 가짜를 끼운다. */
export type SchedulerParts = {
  /** 지금 시각(에포크 ms). */
  now(): number;
  /** 1초마다 tick을 부르기 시작한다. 돌려받은 함수를 부르면 멈춘다. */
  everySecond(tick: () => void): () => void;
  /** PC가 깨어나면 listener를 부른다. 돌려받은 함수를 부르면 듣기를 멈춘다. */
  onWake(listener: () => void): () => void;
  /** 종 재생기. */
  bell: {
    /** 시작종이나 끝종으로 고른 종소리를 한 번 울린다. */
    ring(kind: BellKind): void;
    /** 울리던 종을 멈춘다. */
    stop(): void;
    /** 지금 종이 울리는 중인지. 미리 듣기는 종이 아니라 세지 않는다. */
    isRinging(): boolean;
  };
  /** 잠자기 막기. */
  keepAwake: {
    /** 그 종류로 막기 시작한다. 스케줄러는 걸어 둔 막기를 먼저 푼 뒤에만 다시 부른다. */
    start(mode: KeepAwakeMode): void;
    /** 걸어 둔 막기를 푼다. */
    stop(): void;
  };
  /** 지금 저장된 값. 판정할 때마다 다시 읽어 바뀐 시간표와 배정을 다음 판정부터 쓴다. */
  read(): SchedulerData;
};

/** 돌고 있는 스케줄러의 손잡이. */
export type Scheduler = {
  /** 1초를 기다리지 않고 지금 판정한다. 저장된 값이 바뀌었을 때 부른다. */
  check(): void;
  /** 타이머와 깨어남 듣기를 멈추고 잠자기 막기를 푼다. */
  stop(): void;
};

/** 스케줄러를 시작한다. 시작하자마자 한 번 판정하고, 이후 1초마다와 깨어날 때 판정한다. */
export function startScheduler(parts: SchedulerParts): Scheduler {
  /** 지난번 판정한 시각. 앱을 막 켰으면 null이라 첫 판정은 종을 울리지 않는다. */
  let lastChecked: number | null = null;
  /** 지금 걸어 둔 잠자기 막기. 막지 않고 있으면 null. */
  let awakeMode: KeepAwakeMode | null = null;

  /** 잠자기 막기를 원하는 상태로 맞춘다. 이미 그 상태면 부품을 부르지 않는다. */
  function setKeepAwake(mode: KeepAwakeMode | null): void {
    if (mode === awakeMode) return;
    if (awakeMode !== null) parts.keepAwake.stop();
    if (mode !== null) parts.keepAwake.start(mode);
    awakeMode = mode;
  }

  /** 지금 시각으로 종 판정에 묻고 결과대로 부품을 부른다. */
  function check(): void {
    /** 이번 판정의 시각. */
    const now = parts.now();
    /** 이번 판정에 쓰는 저장된 값. */
    const data = parts.read();
    /** 종 판정 결과. */
    const decision = decideBell({
      timetables: data.timetables,
      weekdays: data.weekdays,
      bellsOffDate: data.bellsOffDate,
      lastChecked,
      now,
    });
    lastChecked = now;

    // 오늘만 끄기를 켜면 울리던 종을 멈춘다
    if (decision.bellsOff && parts.bell.isRinging()) parts.bell.stop();

    if (decision.bell !== 'none') {
      // 울리는 중에 다음 종 시각이 오면 앞의 종을 끊고 새 종을 울린다
      if (parts.bell.isRinging()) parts.bell.stop();
      parts.bell.ring(decision.bell);
    }
    setKeepAwake(decision.keepAwake ? (data.settings.keepScreenOn ? 'display' : 'system') : null);
  }

  /** 1초 타이머를 멈추는 함수. */
  const stopTimer = parts.everySecond(check);
  /** 깨어남 듣기를 멈추는 함수. */
  const stopWake = parts.onWake(check);
  check();
  return {
    check,
    stop() {
      stopTimer();
      stopWake();
      setKeepAwake(null);
    },
  };
}
