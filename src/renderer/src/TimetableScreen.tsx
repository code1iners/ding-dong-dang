import { WEEKDAYS, type Timetable } from '../../shared/data';
import { Dial } from './Dial';
import { DogArt } from './dog/DogArt';
import { WEEKDAY_SHORT } from './weekdays';

type Props = {
  timetables: Timetable[];
  /** 시계판이 없는 빈 상태에 그릴 강아지의 테마 id. */
  dogTheme: string;
};

/** 목록 카드 하나. 색 점과 한 줄 이름, 모든 시간대의 요일 동그라미 일곱, 첫 시간대의 작은 시계판이 있다. */
function TimetableCard({ timetable }: { timetable: Timetable }) {
  /** 어느 시간대에든 든 요일. */
  const days = new Set(timetable.slots.flatMap((slot) => slot.days));
  /** 화면 읽기에 읽어 줄 요일. 동그라미는 모양만 보여 주므로 따로 둔다. */
  const daysText = days.size === 0 ? '요일 없음' : WEEKDAYS.filter((d) => days.has(d)).map((d) => WEEKDAY_SHORT[d]).join(', ');

  return (
    // 이름이 잘려도 마우스를 올리면 전체 이름이 뜨고, 화면 읽기는 잘리지 않은 글자를 읽는다
    <li className="tcard" title={timetable.name}>
      <span className="tcard__top">
        <i className="dot" aria-hidden="true" style={{ background: `var(--timetable-${timetable.color})` }} />
        <span className="tcard__name">{timetable.name}</span>
      </span>
      <span className="sr-only">요일 {daysText}</span>
      <span className="mini-days" aria-hidden="true">
        {WEEKDAYS.map((d) => (
          <span
            key={d}
            className={`mini-day${days.has(d) ? ' mini-day--on' : ''}`}
            style={days.has(d) ? { background: `var(--timetable-${timetable.color})` } : undefined}
          >
            {WEEKDAY_SHORT[d]}
          </span>
        ))}
      </span>
      <span className="tcard__body">
        <Dial periods={timetable.slots[0]?.periods ?? []} color={timetable.color} compact />
      </span>
    </li>
  );
}

/**
 * 시간표 화면의 목록. 시간표마다 카드 한 장을 격자로 놓고, 넘치면 격자 안에서 스크롤한다.
 * 시간표가 하나도 없으면 같은 격자의 첫 칸에 카드 하나 크기의 빈 상태를 보여 준다.
 */
export function TimetableScreen({ timetables, dogTheme }: Props) {
  if (timetables.length === 0) {
    return (
      <div className="timetable-cards">
        <section className="tcard timetable-empty" aria-label="시간표 없음">
          <DogArt themeId={dogTheme} action="idle" className="timetable-empty__dog" />
          <p className="timetable-empty__message">시간표를 만들어 주세요</p>
        </section>
      </div>
    );
  }
  return (
    <ul className="timetable-cards" aria-label="시간표 목록">
      {timetables.map((t) => (
        <TimetableCard key={t.id} timetable={t} />
      ))}
    </ul>
  );
}
