import { decideBell, type StatusKind } from '../../shared/bell-decision';
import type { AppState } from '../../shared/bridge';
import { formatRemaining, pawStates, remainingFraction, type PawState } from '../../shared/status-view';
import { ActionIcon } from './icons';
import { Switch } from './Switch';
import { useNow } from './useNow';

type Props = {
  /** 메인에서 받은 앱 상태. */
  state: Pick<AppState, 'timetables' | 'weekdays' | 'bellsOffDate'>;
  /** "시간표 만들기"를 눌러 시간표 화면으로 갈 때 부른다. */
  onMakeTimetable(): void;
};

/** 고리의 시안 값. 시계판 한 변과 중심, 고리의 반지름과 두께. */
const SIZE = 320;
const CENTER = SIZE / 2;
const RING_RADIUS = 120;
const RING_WIDTH = 40;
/** 고리 바깥의 흰 테두리 반지름과 안쪽 흰 원 반지름. 강아지가 들어갈 안쪽 원은 고리 안쪽 가장자리에 맞닿는다. */
const DISC_OUTER = RING_RADIUS + RING_WIDTH / 2 + 12;
const DISC_INNER = RING_RADIUS - RING_WIDTH / 2;
/** 고리 둘레. 줄어든 정도를 dasharray로 그린다. */
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** 상태별 고리 색. 수업 중 초록, 쉬는 시간 주황이고 그 밖에는 고리가 비어 색이 없다. */
const RING_COLOR: Partial<Record<StatusKind, string>> = {
  'in-class': 'var(--color-green)',
  break: 'var(--color-orange)',
};

/** 발바닥 도장 상태의 화면 읽기용 이름. */
const PAW_NAME: Record<PawState, string> = { done: '끝남', current: '지금', left: '남음' };

/** 발바닥 모양. 색과 채움은 CSS가 상태별로 정한다. */
function PawIcon() {
  return (
    <svg viewBox="-1 -1 26 26" aria-hidden="true">
      <ellipse cx="12" cy="16" rx="6" ry="5" />
      <circle cx="5" cy="10" r="2.6" />
      <circle cx="9.5" cy="5.5" r="2.6" />
      <circle cx="14.5" cy="5.5" r="2.6" />
      <circle cx="19" cy="10" r="2.6" />
    </svg>
  );
}

/** 남은 시간. Jua의 숫자는 폭이 제각각이라 자리마다 같은 폭의 칸에 넣어 매초 흔들리지 않게 한다. */
function Digits({ text }: { text: string }) {
  return (
    <span className="digits" aria-hidden="true">
      {[...text].map((char, i) => (
        <span key={i} className={char === ':' ? 'digits__colon' : 'digits__digit'}>
          {char}
        </span>
      ))}
    </span>
  );
}

/** 현황 화면. 지금 구간의 남은 시간을 고리와 숫자로, 오늘 교시를 발바닥 도장으로 보여 주고 "오늘 종" 스위치를 둔다. */
export function StatusScreen({ state, onMakeTimetable }: Props) {
  /** 지금 시각. 초마다 바뀐다. */
  const now = useNow();
  /** 지금의 현황과 오늘만 끄기 여부. 지난번 확인 시각은 없어 종은 판정하지 않는다. */
  const { status, bellsOff } = decideBell({ ...state, lastChecked: null, now });
  /** 다음 종까지 남은 시간(ms). 다음 종이 없으면 null. */
  const untilBell = status.nextBell ? status.nextBell.at - now : null;
  /** 고리가 채워진 비율. */
  const fraction = remainingFraction(status.segment, now);
  /** 고리의 색. 고리가 비어 있는 상태에서는 쓰이지 않는다. */
  const color = RING_COLOR[status.kind];
  /** 오늘 교시마다의 도장 상태. */
  const paws = pawStates(status);
  /** 남은 시간 문장. 수업 중은 끝종까지, 나머지는 시작종까지다. 수업이 이어져 다음 종이 시작종이어도 DESIGN.md 표대로 수업 중은 끝종이다. */
  const remainingText = untilBell === null ? null : formatRemaining(untilBell);
  /** 남은 시간 아래의 이름. */
  const caption = status.kind === 'in-class' ? '끝종까지' : '시작종까지';

  return (
    <div className="status">
      {/* 시안대로 시간표가 하나도 없을 때는 끌 종이 없어 스위치를 두지 않는다 */}
      {status.kind !== 'no-timetables' && (
        <div className="status__switch">
          <ActionIcon name="bell" />
          <span id="status-bells-today">오늘 종</span>
          <Switch
            on={!bellsOff}
            labelledBy="status-bells-today"
            onChange={(on) => void window.dingdong.command({ type: 'set-bells-off', off: !on })}
          />
        </div>
      )}
      <svg className="ring" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" data-fraction={fraction.toFixed(4)}>
        <circle cx={CENTER} cy={CENTER} r={DISC_OUTER} className="ring__disc" />
        <circle cx={CENTER} cy={CENTER} r={RING_RADIUS} className="ring__track" strokeWidth={RING_WIDTH} />
        {color && fraction > 0 && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RING_RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={RING_WIDTH}
            strokeDasharray={`${CIRCUMFERENCE * fraction} ${CIRCUMFERENCE}`}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}
        <circle cx={CENTER} cy={CENTER} r={DISC_INNER} className="ring__disc" />
        {/* 고리 안 강아지의 자리. 그림은 강아지 그리기 티켓이 채운다 */}
      </svg>

      {status.kind === 'no-timetables' && (
        <>
          <p className="status__message">시간표를 만들어 주세요</p>
          <button type="button" className="button" onClick={onMakeTimetable}>
            시간표 만들기
          </button>
        </>
      )}
      {status.kind === 'no-class-day' && <p className="status__message">오늘은 수업이 없어요</p>}
      {status.kind === 'after-last' && <p className="status__message">오늘 수업 끝</p>}
      {remainingText !== null && (
        <>
          <div className="status__time" role="timer" aria-label={`${caption} ${remainingText}`}>
            <Digits text={remainingText} />
          </div>
          <p className="status__caption">{caption}</p>
        </>
      )}

      {paws.length > 0 && (
        <ul className="paws" aria-label="오늘 교시">
          {paws.map((paw, i) => (
            <li
              key={i}
              className={`paw paw--${paw}`}
              title={`${i + 1}교시 · ${PAW_NAME[paw]}`}
              aria-label={`${i + 1}교시 · ${PAW_NAME[paw]}`}
            >
              <PawIcon />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
