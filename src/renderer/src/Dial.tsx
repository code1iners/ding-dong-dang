import { arcOf, periodRanks } from '../../shared/period-edit';
import type { Period } from '../../shared/data';
import { DogArt } from './dog/DogArt';

type Props = {
  /** 호로 그릴 수업 시간. 줄 순서가 아니라 시작 시각 순서로 교시 번호를 매긴다. */
  periods: readonly Period[];
  /** 시간표 색 번호. null이면 호가 없다. */
  color: number | null;
} & (
  | {
      /** 목록 카드의 작은 시계판. 시각 숫자, 교시 번호, 가운데 강아지 없이 호만 그리고, 화면 읽기에서는 숨긴다. */
      compact: true;
      dogTheme?: never;
    }
  | {
      compact?: false;
      /** 가운데에 그릴 강아지의 테마 id. */
      dogTheme: string;
    }
);

/** 시계판 한 변과 중심, 호의 반지름과 두께(시안 값). */
const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 128;
const TRACK_WIDTH = 36;
/** 시각 숫자를 놓는 안쪽 반지름. */
const NUMBER_RADIUS = 92;
/** 가운데 강아지 칸의 한 변과 왼쪽 위(시안 값). 숫자 안쪽에 들어가고 발이 가운데보다 조금 아래에 온다. */
const DOG_SIZE = 80;
const DOG_X = 120;
const DOG_Y = 118;

/** 12시간 시계판. 12가 위에 있고, 수업 시간이 교시 번호가 붙은 호로 나온다. 오전과 오후는 같은 자리에 겹쳐 그린다. */
export function Dial({ periods, color, dogTheme, compact = false }: Props) {
  /** 줄마다의 교시 번호. */
  const ranks = periodRanks(periods);
  /** 시각 숫자 열두 개. 12가 맨 위다. */
  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  return (
    <svg
      className={compact ? 'dial dial--compact' : 'dial'}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      {...(compact ? { 'aria-hidden': true } : { role: 'img', 'aria-label': '12시간 시계판' })}
    >
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
            {!compact && (
              <text className="dial__period" x={CENTER + arc.mid.x} y={CENTER + arc.mid.y + 6} textAnchor="middle">
                {ranks[i]}
              </text>
            )}
          </g>
        );
      })}
      {!compact &&
        hours.map((hour, i) => {
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
      {/* 시안대로 시계판 가운데에 강아지(평소)를 둔다. 누르는 동작은 없다 */}
      {dogTheme !== undefined && (
        <foreignObject x={DOG_X} y={DOG_Y} width={DOG_SIZE} height={DOG_SIZE}>
          <DogArt themeId={dogTheme} action="idle" className="dial__dog" />
        </foreignObject>
      )}
    </svg>
  );
}
