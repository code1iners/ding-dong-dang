// 메인과 종 재생기(숨긴 창) 사이의 통로. 앱 창의 통로(bridge.ts)와 따로 둔다.
// 숨긴 창의 preload가 이 파일만 가져가게 해, 두 preload가 같은 조각을 나눠 갖지 않게 한다(샌드박스 preload는 한 파일이어야 한다).

/** 메인이 재생기에 보내는 재생 요청. */
export type PlayRequest = {
  /** 요청 번호. 재생기가 상태를 알릴 때 그대로 돌려준다. */
  id: number;
  /** 종소리 파일의 내용. */
  bytes: Uint8Array;
  /** 0~1. */
  volume: number;
};

/** 재생기가 메인에 알리는 재생 상태. */
export type PlayerReport = {
  /** 어느 요청의 상태인지. */
  id: number;
  /** playing은 소리가 나기 시작함, ended는 끝까지 울림, stopped는 멈춤, failed는 재생할 수 없음. */
  phase: 'playing' | 'ended' | 'stopped' | 'failed';
};

/** 숨긴 창의 preload가 `window.bellPlayer`로 내보내는 통로. */
export type BellPlayerApi = {
  /** 재생 요청을 받는다. */
  onPlay(listener: (request: PlayRequest) => void): void;
  /** 멈춤 요청을 받는다. */
  onStop(listener: () => void): void;
  /** 재생 상태를 메인에 알린다. */
  report(report: PlayerReport): void;
};

/** 재생기 통로가 쓰는 IPC 채널 이름. */
export const BELL_CHANNEL = {
  play: 'bell:play',
  stop: 'bell:stop',
  report: 'bell:report',
} as const;
