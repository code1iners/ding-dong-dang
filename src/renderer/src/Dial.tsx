import { arcOf, periodRanks } from '../../shared/period-edit';
import type { Period } from '../../shared/timetable-validation';

type Props = {
  /** 호로 그릴 수업 시간. 줄 순서가 아니라 시작 시각 순서로 교시 번호를 매긴다. */
  periods: readonly Period[];
  /** 시간표 색 번호. 배정이 없으면 null이라 호가 없다. */
  color: number | null;
};

/** 시계판 한 변과 중심, 호의 반지름과 두께(시안 값). */
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 128;
const TRACK_WIDTH = 36;
/** 시각 숫자를 놓는 안쪽 반지름. */
const NUMBER_RADIUS = 92;

/** 12시간 시계판. 12가 위에 있고, 수업 시간이 교시 번호가 붙은 호로 나온다. 오전과 오후는 같은 자리에 겹쳐 그린다. */
export function Dial({ periods, color }: Props) {
  /** 줄마다의 교시 번호. */
  const ranks = periodRanks(periods);
  /** 시각 숫자 열두 개. 12가 맨 위다. */
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <svg className="dial" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="12시간 시계판">
      <circle cx={CENTER} cy={CENTER} r={RADIUS} className="dial__track" strokeWidth={TRACK_WIDTH} />
      {periods.map((period, i) => {
        const arc = arcOf(period, RADIUS);
        if (!arc || color === null) return null;
        return (
          <g key={i}>
            {arc.full ? (
              <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke={`var(--timetable-${color})`} strokeWidth={TRACK_WIDTH} />
            ) : (
            <path
              d={`M${CENTER + arc.from.x} ${CENTER + arc.from.y}A${RADIUS} ${RADIUS} 0 ${arc.large ? 1 : 0} 1 ${CENTER + arc.to.x} ${CENTER + arc.to.y}`}
              fill="none"
              stroke={`var(--timetable-${color})`}
              strokeWidth={TRACK_WIDTH}
            />
            )}
            <text className="dial__period" x={CENTER + arc.mid.x} y={CENTER + arc.mid.y + 6} textAnchor="middle">
              {ranks[i]}
            </text>
          </g>
        );
      })}
      {hours.map((hour, i) => {
        const angle = (i / 12) * 2 * Math.PI;
        return (
          <text
            key={hour}
            className="dial__hour"
            x={CENTER + NUMBER_RADIUS * Math.sin(angle)}
            y={CENTER - NUMBER_RADIUS * Math.cos(angle) + 6}
            textAnchor="middle"
          >
            {hour}
          </text>
        );
      })}
    </svg>
  );
}
