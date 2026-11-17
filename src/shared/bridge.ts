// 메인 프로세스와 렌더러 사이의 통로. 렌더러는 이 두 종류로만 메인에 닿는다.
// - 상태 구독: 메인이 가진 앱 상태를 받아 보고, 바뀔 때마다 다시 받는다.
// - 명령: 렌더러가 메인에 일을 시킨다.

import type { Settings, Timetable, Weekday } from './data';

/** 메인이 렌더러에 보내는 앱 상태. 기능 티켓이 필요한 값을 더한다. */
export type AppState = {
  /** 앱 버전(package.json의 version). */
  appVersion: string;
  /** 저장소가 화면 쪽에 알릴 일. 알림 모양은 화면 티켓이 만든다. */
  storage: StorageNotice;
  /** 설정 화면의 값. 저장된 값과 같다. */
  settings: Settings;
  /** 시간표 목록. 만든 순서다. 저장된 값과 같다. */
  timetables: Timetable[];
  /** 요일별로 배정한 시간표 id. 배정이 없으면 null. 저장된 값과 같다. */
  weekdays: Record<Weekday, string | null>;
  /** 지금 종이 울리는 중인지. 숨긴 창의 재생이 끝나거나 멈추면 false가 된다. */
  bellRinging: boolean;
};

/** 저장소가 화면에 알리는 사실. */
export type StorageNotice = {
  /** 마지막 저장이 실패했는지. 다음 변경에서 다시 쓰는 데 성공하면 false로 돌아온다. */
  saveFailed: boolean;
  /** 저장된 시간표를 읽지 못해 새로 시작했는지. 이번 실행의 시작 때 정해지며, 화면이 한 번만 보여 준다. */
  freshStart: boolean;
  /** 지금까지 저장에 실패한 횟수. 이미 실패 중에 또 실패해도 늘어나서, 화면이 그때마다 알릴 수 있다. */
  saveFailures: number;
};

/** 렌더러가 메인에 보내는 명령. `type`으로 구분하는 합 타입이다. */
export type Command =
  /** "수업 중 화면 켜 두기"를 켜거나 끈다. */
  | { type: 'set-keep-screen-on'; on: boolean }
  /** 새 시간표를 만든다. `assignTo`를 주면 그 요일에 바로 배정한다. */
  | { type: 'create-timetable'; assignTo?: Weekday }
  /** 시간표 이름을 바꾼다. 비게 되는 이름은 거절한다. */
  | { type: 'rename-timetable'; id: string; name: string }
  /** 시간표를 지운다. 쓰던 요일은 없음이 된다. 요일에 배정되지 않았던 시간표는 `restore-timetable`로 되돌릴 수 있다. */
  | { type: 'delete-timetable'; id: string }
  /** 방금 지운 시간표를 원래 자리에 되돌린다. */
  | { type: 'restore-timetable'; id: string }
  /** 요일에 시간표 하나 또는 없음(null)을 배정한다. */
  | { type: 'assign-weekday'; day: Weekday; timetableId: string | null }
  /** "저장된 시간표를 읽지 못해 새로 시작했어요" 알림을 보여 줬음을 알린다. 같은 실행에서 다시 보이지 않게 한다. */
  | { type: 'ack-fresh-start' };

/** preload가 렌더러의 `window.dingdong`으로 내보내는 통로. */
export type DingDongApi = {
  /** 지금 상태를 한 번 바로 받고, 이후 바뀔 때마다 받는다. 돌려받은 함수를 부르면 구독을 끝낸다. */
  subscribe(listener: (state: AppState) => void): () => void;
  /** 메인에 명령을 보낸다. 메인이 거절하면 실패한 Promise가 된다. */
  command(command: Command): Promise<void>;
};

/** 통로가 쓰는 IPC 채널 이름. */
export const CHANNEL = {
  /** 렌더러가 지금 상태를 한 번 묻는 채널. */
  getState: 'state:get',
  /** 메인이 바뀐 상태를 알리는 채널. */
  stateChanged: 'state:changed',
  /** 렌더러가 명령을 보내는 채널. */
  command: 'command',
} as const;
