/** 앱 창의 네 화면. */
export type ScreenId = 'status' | 'timetable' | 'bells' | 'settings';

/** 왼쪽 세로 줄에 위에서부터 놓이는 순서. */
export const SCREENS: readonly {
  /** 화면 구분값. */
  id: ScreenId;
  /** 세로 줄 단추와 화면 읽기에 쓰는 이름. */
  name: string;
  /** 세로 줄의 맨 아래에 따로 붙는지. */
  atEnd?: boolean;
}[] = [
  { id: 'status', name: '현황' },
  { id: 'timetable', name: '시간표' },
  { id: 'bells', name: '종' },
  { id: 'settings', name: '설정', atEnd: true },
];
