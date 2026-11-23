// 메인 프로세스와 렌더러 사이의 통로. 렌더러는 이 두 종류로만 메인에 닿는다.
// - 상태 구독: 메인이 가진 앱 상태를 받아 보고, 바뀔 때마다 다시 받는다.
// - 명령: 렌더러가 메인에 일을 시킨다.

import type { BellKind } from './bell-decision';
import type { RegisteredSound, Settings, Timetable, TimetableSlot } from './data';
import type { UpdateState } from './update';

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
  /** 쓰는 시간표의 id. 종은 이 시간표만 따른다. 없으면 null. 저장된 값과 같다. */
  activeTimetable: string | null;
  /** 오늘만 끄기를 켠 현지 날짜 'YYYY-MM-DD'. 없으면 null. 오늘 날짜와 같을 때만 꺼진 것이다. 저장된 값과 같다. */
  bellsOffDate: string | null;
  /** 지금 종이 울리는 중인지. 숨긴 창의 재생이 끝나거나 멈추면 false가 된다. */
  bellRinging: boolean;
  /** 등록한 종소리. 등록한 순서다. 내장 음원 열두 개는 `builtin-sounds.ts`에 고정돼 있어 여기에 없다. 저장된 값과 같다. */
  sounds: RegisteredSound[];
  /** 음원 id → 0~100. 없으면 100이다. 저장된 값과 같다. */
  soundVolumes: Record<string, number>;
  /** 시작종으로 고른 음원 id. 저장된 값과 같다. */
  startBell: string;
  /** 끝종으로 고른 음원 id. 저장된 값과 같다. */
  endBell: string;
  /** 전체 음량 0~100. 저장된 값과 같다. */
  masterVolume: number;
  /** 지금 미리 듣는 중인 음원 id. 없으면 null. 종이 울리는 것과는 따로다. */
  previewingSound: string | null;
  /**
   * 앱 창이 화면에 보이는지. 닫아서 숨기거나 최소화하면 false다.
   * 숨은 창도 Chromium은 보이는 중으로 보고 타이머를 늦추지 않아서, 화면은 이 값으로 강아지 그리기를 멈춘다.
   */
  windowShown: boolean;
  /** 처음 닫는 중이라 "딩동댕은 계속 켜져 있어요" 안내를 보여야 하는지. 창을 숨기기 전에 한 번 뜬다. */
  closeNotice: boolean;
  /** OS에 물은 자동 시작 등록 상태. 설정의 "컴퓨터를 켜면 자동 시작" 값이 아니라 실제로 로그인 때 뜨도록 등록돼 있는지다. */
  autoStartRegistered: boolean;
  /** 앱 내 업데이트. 설정 화면의 버전 줄, 왼쪽 설정 단추의 주황 점, 확인 모달이 이 값을 따른다. */
  update: UpdateView;
};

/** 화면에 보내는 앱 내 업데이트 값. */
export type UpdateView = UpdateState & {
  /** 이번 실행이 앱 내 업데이트로 다시 켜진 첫 실행이면 그 버전. 화면이 "<버전>으로 업데이트했어요"를 한 번 알린 뒤 null이 된다. */
  justUpdated: string | null;
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
  /** "수업 중 컴퓨터 화면 켜짐 유지"를 켜거나 끈다. */
  | { type: 'set-keep-screen-on'; on: boolean }
  /** "돌아다니는 강아지"를 켜거나 끈다. 끄면 강아지 창이 숨고, 종이 울리는 동안에만 나타난다. */
  | { type: 'set-roaming-dog'; on: boolean }
  /** 돌아다니는 강아지의 키(px, 64~160의 정수). 하트와 낙하산도 같이 커진다. 고리 안 강아지는 그대로다. */
  | { type: 'set-dog-height'; height: number }
  /** "오늘 종" 스위치. `off`면 오늘 날짜를 끈 날짜로 저장해 울리던 종도 멈추고, 아니면 끈 날짜를 푼다. */
  | { type: 'set-bells-off'; off: boolean }
  /** 받은 이름으로 새 시간표를 만든다. 비게 되는 이름은 거절한다. 결과의 `id`가 만든 시간표다. 첫 시간표는 쓰는 시간표가 된다. */
  | { type: 'create-timetable'; name: string }
  /** 시간표 이름을 바꾼다. 비게 되는 이름은 거절한다. */
  | { type: 'rename-timetable'; id: string; name: string }
  /** 시간표를 지운다. 되돌릴 수 없다. 쓰는 시간표를 지우면 쓰는 시간표가 없어진다. */
  | { type: 'delete-timetable'; id: string }
  /** 쓰는 시간표를 정한다. 목록에 있는 id만 받는다. */
  | { type: 'set-active-timetable'; id: string }
  /** "저장된 시간표를 읽지 못해 새로 시작했어요" 알림을 보여 줬음을 알린다. 같은 실행에서 다시 보이지 않게 한다. */
  | { type: 'ack-fresh-start' }
  /** 시간표의 시간대 목록을 통째로 바꿔 저장한다(상세의 "저장"). 결과의 `ok`가 false면 저장하지 못한 것이다. */
  | { type: 'set-slots'; id: string; slots: TimetableSlot[] }
  /** 저장하지 않은 시간표 편집이 있는지 알린다. 있으면 메인은 창 닫기를 멈추고 렌더러에 묻는다. */
  | { type: 'set-editing-dirty'; dirty: boolean }
  /** 창을 닫는다. 저장하지 않은 편집을 어떻게 할지 정한 뒤에 보낸다. */
  | { type: 'close-window' }
  /** 전체 음량(0~100). */
  | { type: 'set-master-volume'; volume: number }
  /** 음원별 음량(0~100). 내장 음원도 된다. */
  | { type: 'set-sound-volume'; id: string; volume: number }
  /** 시작종이나 끝종으로 쓸 음원을 고른다. */
  | { type: 'set-bell'; kind: BellKind; id: string }
  /** 파일 고르기 창을 열어 종소리를 등록한다. 결과의 `message`가 있으면 거절한 이유다. 고르지 않고 닫으면 `name` 없이 ok다. */
  | { type: 'register-sound' }
  /** 등록한 종소리의 이름을 바꾼다. 비게 되는 이름은 거절한다. */
  | { type: 'rename-sound'; id: string; name: string }
  /** 등록한 종소리를 지운다. 파일은 `restore-sound`로 되돌릴 수 있는 동안 남는다. */
  | { type: 'delete-sound'; id: string }
  /** 방금 지운 종소리를 선택과 함께 되돌린다. */
  | { type: 'restore-sound'; id: string }
  /** 지운 종소리를 더는 되돌릴 수 없게 됐음을 알린다. 복사해 둔 파일을 지운다. */
  | { type: 'discard-removed-sound'; id: string }
  /** 음원을 미리 듣는다. 이미 그 음원을 미리 듣는 중이면 멈춘다. 다른 음원이면 앞의 것을 끊는다. */
  | { type: 'toggle-preview'; id: string }
  /** 강아지 테마를 바꾼다. 있는 테마 id만 받고, 바로 적용하고 저장한다. */
  | { type: 'set-dog-theme'; id: string }
  /** "닫으면 숨기기"를 켜거나 끈다. 끄면 닫기 버튼이 앱을 종료한다. */
  | { type: 'set-hide-on-close'; on: boolean }
  /** 처음 닫을 때 안내의 "창 닫기". 안내를 봤다고 저장하고 창을 숨긴다. */
  | { type: 'confirm-hide' }
  /** 처음 닫을 때 안내를 창 닫기 없이 거둔다(Esc). 창은 그대로 남는다. */
  | { type: 'dismiss-hide-notice' }
  /** "컴퓨터를 켜면 자동 시작"을 켜거나 끈다. 켜면 OS에 등록하고, 끄면 등록을 지운다. */
  | { type: 'set-auto-start'; on: boolean }
  /** 자동 시작 등록에 실패했을 때의 "자동 시작 등록 방법"을 브라우저로 연다. 주소는 메인이 정한다. */
  | { type: 'open-auto-start-help' }
  /** 설정의 "의견 보내기". 앱 버전과 OS를 담은 제보 폼을 브라우저로 연다. 주소는 메인이 정한다. */
  | { type: 'open-feedback-form' }
  /** 울리는 종을 멈춘다. 강아지를 눌렀을 때 보낸다. 울리지 않으면 아무 일도 없다. */
  | { type: 'stop-bell' }
  /** 설정의 "모든 데이터 지우기". 스펙의 지우기 범위를 지우고 앱을 종료한다. 화면이 확인을 받은 뒤에 보낸다. */
  | { type: 'wipe-all-data' }
  /** 버전 줄의 "다시 확인". 바로 새 버전을 확인한다. */
  | { type: 'check-update' }
  /** 확인 모달의 "업데이트". 준비된 새 버전을 설치하고 다시 켠다. 잠금 조건이면 메인도 거절해 결과의 `ok`가 false다. */
  | { type: 'install-update' }
  /** "<버전>으로 업데이트했어요" 알림을 보여 줬음을 알린다. 창을 다시 열어도 반복하지 않게 한다. */
  | { type: 'ack-just-updated' };

/** 명령의 결과. 대부분의 명령은 늘 ok다. */
export type CommandResult = {
  /** 하려던 일이 끝났는지. 저장 명령은 파일에 쓰지 못하면 false다. */
  ok: boolean;
  /** 거절하거나 실패한 이유. 사용자에게 그대로 보여 줄 문장이다. */
  message?: string;
  /** `register-sound`가 등록한 종소리의 이름. */
  name?: string;
  /** `create-timetable`이 만든 시간표의 id. */
  id?: string;
};

/** preload가 렌더러의 `window.dingdong`으로 내보내는 통로. */
export type DingDongApi = {
  /** 지금 상태를 한 번 바로 받고, 이후 바뀔 때마다 받는다. 돌려받은 함수를 부르면 구독을 끝낸다. */
  subscribe(listener: (state: AppState) => void): () => void;
  /** 메인에 명령을 보낸다. 메인이 거절하면 실패한 Promise가 된다. */
  command(command: Command): Promise<CommandResult>;
  /** 저장하지 않은 편집이 있는데 창을 닫으려 할 때마다 부른다. 돌려받은 함수를 부르면 구독을 끝낸다. */
  onCloseRequested(listener: () => void): () => void;
};

/** 통로가 쓰는 IPC 채널 이름. */
export const CHANNEL = {
  /** 렌더러가 지금 상태를 한 번 묻는 채널. */
  getState: 'state:get',
  /** 메인이 바뀐 상태를 알리는 채널. */
  stateChanged: 'state:changed',
  /** 렌더러가 명령을 보내는 채널. */
  command: 'command',
  /** 메인이 창 닫기를 멈추고 렌더러에 알리는 채널. */
  closeRequested: 'window:close-requested',
} as const;
