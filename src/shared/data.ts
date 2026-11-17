// 데이터 폴더의 JSON 파일에 담기는 내용. 메인(저장소)과 화면이 같은 모양을 쓴다.

/** 요일 키. 시간표 배정의 열쇠다. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** 시간표 하나. */
export type Timetable = {
  id: string;
  name: string;
  /** 0~7, DESIGN.md의 시간표 색 순서. */
  color: number;
  /** 수업 시간. 자정부터의 분이다. */
  periods: { start: number; end: number }[];
};

/** 등록한 음원 하나. 파일은 데이터 폴더의 `sounds/` 안에 있다. */
export type RegisteredSound = { id: string; name: string; file: string };

/** 설정 화면의 값. */
export type Settings = {
  dogTheme: string;
  roamingDog: boolean;
  /** 돌아다니는 강아지 키. 64~160. */
  dogHeight: number;
  autoStart: boolean;
  hideOnClose: boolean;
  keepScreenOn: boolean;
  /** 처음 닫을 때 안내를 이미 보여 줬는지. */
  hideNoticeShown: boolean;
};

/** 앱 창의 바깥 크기와 위치. */
export type WindowBounds = { x: number; y: number; width: number; height: number };

/** 현재 형태(버전 1)의 저장 데이터. */
export type Data = {
  version: 1;
  timetables: Timetable[];
  /** 다음 시간표가 받을 색 번호. */
  nextColor: number;
  /** 요일별로 배정한 시간표 id. 배정이 없으면 null. */
  weekdays: Record<Weekday, string | null>;
  /** 오늘만 끄기를 켠 현지 날짜 'YYYY-MM-DD'. */
  bellsOffDate: string | null;
  sounds: RegisteredSound[];
  /** 음원 id → 0~100. 없으면 100이다. */
  soundVolumes: Record<string, number>;
  /** 시작종·끝종으로 고른 음원 id. */
  startBell: string;
  endBell: string;
  /** 전체 음량 0~100. */
  masterVolume: number;
  settings: Settings;
  /** 마지막에 쓴 창의 자리와 크기. 아직 없으면 null. */
  window: WindowBounds | null;
};

/** 처음 설치했을 때 시작종으로 쓰는 내장 음원 id. */
export const DEFAULT_START_BELL = 'westminster-start';
/** 처음 설치했을 때 끝종으로 쓰는 내장 음원 id. */
export const DEFAULT_END_BELL = 'westminster-end';

/** 처음 실행한 빈 상태. 부를 때마다 새 객체를 돌려준다. */
export function emptyData(): Data {
  return {
    version: 1,
    timetables: [],
    nextColor: 0,
    weekdays: { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null },
    bellsOffDate: null,
    sounds: [],
    soundVolumes: {},
    startBell: DEFAULT_START_BELL,
    endBell: DEFAULT_END_BELL,
    masterVolume: 100,
    settings: {
      dogTheme: 'orange-sitting',
      roamingDog: true,
      dogHeight: 96,
      autoStart: true,
      hideOnClose: true,
      keepScreenOn: false,
      hideNoticeShown: false,
    },
    window: null,
  };
}
