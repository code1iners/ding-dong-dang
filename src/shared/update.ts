// 앱 내 업데이트의 화면 쪽 값. 메인이 상태를 만들고, 설정 화면이 버전 줄 · 주황 점 · 확인 모달을 그린다.
import { decideBell, firstBellOnLaterDays, type BellDecision, type BellDecisionInput } from './bell-decision';

/** 앱 내 업데이트의 상태. */
export type UpdateStatus =
  /** 확인하지 않는 실행이다. `--data-dir`로 띄운 자동 검증 실행과 패키징하지 않은 개발 실행. */
  | { kind: 'off' }
  /** 보일 것이 없다. 아직 확인하지 않았거나, 받은 파일이 검증에 실패해 버렸다. */
  | { kind: 'idle' }
  /** 새 버전을 확인하고 있다. */
  | { kind: 'checking' }
  /** 새 버전을 묻지 않고 내려받아 검증하고 있다. 화면에는 드러내지 않는다. */
  | { kind: 'downloading'; version: string }
  /** 지금 버전이 최신이다. */
  | { kind: 'up-to-date' }
  /** 확인하거나 내려받지 못했다(인터넷 등). 설정 화면의 버전 줄에만 알린다. */
  | { kind: 'check-failed' }
  /** 내려받아 서명까지 확인했다. 사용자가 승인하면 설치한다. */
  | { kind: 'ready'; version: string }
  /** 승인을 받아 설치를 맡겼다. 앱이 곧 꺼졌다가 새 버전으로 다시 켜진다. */
  | { kind: 'installing'; version: string };

/** 메인의 앱 내 업데이트 상태 전체. */
export type UpdateState = {
  /** 지금 상태. */
  status: UpdateStatus;
  /** 이번 실행에서 설치를 맡겼다가 앱 안에서 설치하지 못한 횟수. 늘 때마다 화면이 알린다. */
  installFailures: number;
};

/** 잠금을 정하는 값. */
export type UpdateLockInput = {
  /** 오늘 남은 종 가운데 가장 가까운 것의 시각(에포크 ms). 없거나 오늘 종을 껐으면 null. */
  nextBellAt: number | null;
  /** 지금 종이 울리는 중인지. */
  ringing: boolean;
  /** 지금 시각(에포크 ms). */
  now: number;
};

/** 다음 종까지 이보다 덜 남았으면 "업데이트" 단추를 잠근다. 다시 켜지는 동안 종을 놓치지 않게 한다. */
export const UPDATE_LOCK_MS = 2 * 60 * 1000;

/** 잠긴 "업데이트" 단추 옆에 쓰는 이유. */
export const UPDATE_LOCKED_TEXT = '종이 울린 뒤에 할 수 있어요';

/** "업데이트" 단추를 잠글지. 종이 울리는 중이거나 다음 종까지 2분이 안 남았으면 잠근다. 화면과 메인이 같이 쓴다. */
export function updateLocked({ nextBellAt, ringing, now }: UpdateLockInput): boolean {
  return ringing || (nextBellAt !== null && nextBellAt - now < UPDATE_LOCK_MS);
}

/** 확인 모달에 쓰는 다음 종까지 남은 시간. 분 아래는 버린다. 한 시간이 넘으면 "1시간 12분"처럼 쓴다. */
export function untilNextBellText(nextBellAt: number | null, now: number): string {
  if (nextBellAt === null) return '오늘은 남은 종이 없어요.';
  /** 남은 분. 초는 버린다. */
  const minutes = Math.max(0, Math.floor((nextBellAt - now) / 60_000));
  /** 시간 자리. */
  const hours = Math.floor(minutes / 60);
  /** 시간을 빼고 남은 분. */
  const rest = minutes % 60;
  /** 남은 시간 글. */
  const span = hours === 0 ? `${rest}분` : rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
  return `다음 종까지 ${span} 남았어요.`;
}

/** 잠금과 확인 모달에 쓰는 다음 종 시각. 오늘 남은 종이 없거나 오늘 종을 껐으면 울릴 종이 없으니 null이다. */
export function upcomingBellAt({ bellsOff, status }: BellDecision): number | null {
  return bellsOff ? null : (status.nextBell?.at ?? null);
}

/** 받침이 있는 소리로 읽히는 끝 숫자. 영 · 삼 · 육은 "으로", 일 · 칠(ㄹ 받침)과 받침 없는 숫자는 "로"가 붙는다. */
const EURO_DIGITS = new Set(['0', '3', '6']);

/** 버전에 "으로/로"를 붙인다. 조사는 버전의 끝 숫자를 읽는 소리에 맞춘다("1.3.0으로", "0.2.1로"). */
export function versionTo(version: string): string {
  return `${version}${EURO_DIGITS.has(version.at(-1) ?? '') ? '으로' : '로'}`;
}

/** 업데이트 뒤 다시 켜졌을 때의 알림 문장. */
export function justUpdatedText(version: string): string {
  return `${versionTo(version)} 업데이트했어요`;
}

/** 업데이트 잠금과 확인 모달에 쓰는 지금 값. */
export type UpdateTiming = {
  /** "업데이트"를 잠가야 하는지. 종이 울리는 중이거나 다음 종까지 2분이 안 남았다. */
  locked: boolean;
  /** 오늘 남은 가장 가까운 종의 시각. 없거나 오늘 종을 껐으면 null. */
  nextBellAt: number | null;
};

/** 시간표와 지금 시각으로 업데이트 잠금을 정한다. 화면의 단추와 메인의 설치 명령이 같은 판정을 쓴다. */
export function updateTimingAt(
  schedule: Pick<BellDecisionInput, 'timetables' | 'weekdays' | 'bellsOffDate'>,
  ringing: boolean,
  now: number,
): UpdateTiming {
  /** 다음 종의 시각. */
  const input = { ...schedule, lastChecked: null, now };
  const nextBellAt = upcomingBellAt(decideBell(input));
  // 오늘 남은 종이 없거나 오늘 종을 껐어도 자정 너머 다음 날의 첫 종은 울리니, 잠금만 그 종까지 본다
  const lockBellAt = nextBellAt ?? firstBellOnLaterDays(input);
  return { locked: updateLocked({ nextBellAt: lockBellAt, ringing, now }), nextBellAt };
}

/** 준비된(또는 설치를 맡긴) 새 버전. 주황 점, "업데이트" 단추, 확인 모달이 이 버전이 있을 때만 나온다. */
export function readyVersion(status: UpdateStatus): string | null {
  return status.kind === 'ready' || status.kind === 'installing' ? status.version : null;
}
