import { useEffect, useRef, useState } from 'react';
import { WEEKDAYS, type Timetable } from '../../shared/data';
import { sendCommand } from './command';
import { CreateTimetableModal } from './CreateTimetableModal';
import { Dial } from './Dial';
import { DogArt } from './dog/DogArt';
import { ActionIcon } from './icons';
import { ActiveBadge, DETAIL_BACK_SELECTOR, DETAIL_START_SELECTOR, TimetableDetail, type LeaveGuard } from './TimetableDetail';
import type { ToastApi } from './Toasts';
import { slotSummary, WEEKDAY_SHORT } from './weekdays';

type Props = {
  timetables: Timetable[];
  /** 쓰는 시간표의 id. 없으면 null이다. */
  activeTimetable: string | null;
  /** 빈 상태와 상세 시계판 가운데에 그릴 강아지의 테마 id. */
  dogTheme: string;
  /** 만들었다는 알림과 저장했다는 알림을 띄우고, 고치기 시작하면 종소리 되돌리기 알림을 거둔다. */
  toasts: Pick<ToastApi, 'notify' | 'dismissUndo'>;
  /** 상세의 초안을 두고 다른 화면으로 가거나 창을 닫기 전에 묻는 손잡이를 앱에 등록한다. */
  registerGuard(guard: LeaveGuard | null): void;
  /** 상세에 초안이 생기거나 사라질 때 앱에 알린다. */
  onDirtyChange(dirty: boolean): void;
};

/** 목록 카드에 보이는 시간대 요약의 최대 줄 수. 나머지는 "외 N개"로 줄인다. */
const SUMMARY_LINES = 2;

/** 시간표 id로 목록 카드를 찾는 선택자를 만든다. 상세에서 돌아오면 그 카드로 초점을 돌려준다. */
const cardSelector = (id: string): string => `[data-timetable-id="${CSS.escape(id)}"]`;

/**
 * 목록 카드 하나. 누르면 상세로 들어가는 단추 하나이고, 색 점과 한 줄 이름, 모든 시간대의 요일 동그라미 일곱,
 * 첫 시간대의 작은 시계판, 시간대별 요약 두 줄까지(셋째부터 "외 N개")가 있다.
 */
function TimetableCard({ timetable, active, onOpen }: { timetable: Timetable; active: boolean; onOpen(): void }) {
  /** 어느 시간대에든 든 요일. */
  const days = new Set(timetable.slots.flatMap((slot) => slot.days));
  /** 화면 읽기에 읽어 줄 요일. 동그라미는 모양만 보여 주므로 따로 둔다. */
  const daysText =
    days.size === 0
      ? '요일 없음'
      : WEEKDAYS.filter((d) => days.has(d))
          .map((d) => WEEKDAY_SHORT[d])
          .join(', ');

  return (
    // 이름이 잘려도 마우스를 올리면 전체 이름이 뜨고, 화면 읽기는 잘리지 않은 글자를 읽는다
    <li className="timetable-cards__item">
      <button
        type="button"
        className={`tcard${active ? ' tcard--active' : ''}`}
        title={timetable.name}
        data-timetable-id={timetable.id}
        onClick={onOpen}
      >
        <span className="tcard__top">
          <i className="dot" aria-hidden="true" style={{ background: `var(--timetable-${timetable.color})` }} />
          <span className="tcard__name">{timetable.name}</span>
          {active && <ActiveBadge />}
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
        <span className="tcard__meta">
          {timetable.slots.slice(0, SUMMARY_LINES).map((slot, i) => (
            <span key={i}>{slotSummary(slot)}</span>
          ))}
          {timetable.slots.length > SUMMARY_LINES && <span>외 {timetable.slots.length - SUMMARY_LINES}개</span>}
        </span>
      </button>
    </li>
  );
}

/**
 * 시간표 화면. 카드 목록과 한 시간표의 상세 두 단계다.
 * 목록은 시간표마다 카드 한 장을 격자로 놓고 맨 끝에 "새 시간표" 카드를 둔다. 넘치면 격자 안에서 스크롤한다.
 * 시간표가 하나도 없으면 같은 격자의 첫 칸에 카드 하나 크기의 빈 상태를 보여 준다.
 */
export function TimetableScreen({ timetables, activeTimetable, dogTheme, toasts, registerGuard, onDirtyChange }: Props) {
  const { notify } = toasts;
  /** 상세로 연 시간표 id. 목록이면 null이다. */
  const [openId, setOpenId] = useState<string | null>(null);
  /** 이름 받는 창이 떠 있는지. */
  const [creating, setCreating] = useState(false);
  /** 화면이 바뀐 뒤 초점을 둘 요소의 선택자. 그 요소가 그려지면 초점을 주고 비운다. */
  const focusAfter = useRef<string | null>(null);

  /** 상세로 연 시간표. 만든 직후 메인의 새 상태가 아직 오지 않았으면 잠깐 없다. */
  const shown = openId === null ? undefined : timetables.find((t) => t.id === openId);
  /** 목록 카드에 "쓰는 중"을 드러낼지. 시간표가 하나뿐이면 쓰는 시간표라는 개념을 숨긴다. */
  const showActive = timetables.length > 1;
  /** 상세 위 줄에 쓰는 시간표 동작을 보여 줄지. 하나뿐이어도 쓰는 시간표가 없으면 종을 되살릴 "이 시간표 쓰기"가 있어야 한다. */
  const showActiveInDetail = showActive || activeTimetable === null;

  // 목록과 상세를 오간 뒤, 새로 그려진 요소에 초점을 준다. 만든 시간표가 아직 상태에 없으면 올 때까지 기다린다
  useEffect(function focusAfterMove() {
    if (!focusAfter.current) return;
    /** 초점을 받을 요소. 아직 그려지지 않았으면 다음 그리기에서 다시 찾는다. */
    const target = document.querySelector<HTMLElement>(focusAfter.current);
    if (!target) return;
    target.focus();
    focusAfter.current = null;
  });

  /** 상세를 연다. 어디에 초점을 둘지 함께 받는다. */
  function open(id: string, focus: string): void {
    focusAfter.current = focus;
    setOpenId(id);
  }

  /** 받은 이름으로 시간표를 만들고 알린 뒤 그 상세로 들어간다. */
  async function create(name: string): Promise<void> {
    /** 메인의 결과. 명령이 거절되면 id가 없다. */
    const result = await sendCommand({ type: 'create-timetable', name });
    // 메인이 명령을 받지 못했으면 창을 열어 둔 채 알린다. 파일에 쓰지 못한 것은 메모리에는 만들어져 있고, 저장 실패 알림은 App이 따로 띄운다
    if (!result.id) {
      notify({ key: 'timetable-create-failed', kind: 'failure', text: '시간표를 만들지 못했어요. 다시 만들어 주세요.' });
      return;
    }
    notify({
      key: 'timetable-created',
      kind: 'success',
      text: `'${name}' 시간표를 만들었어요`,
    });
    setCreating(false);
    open(result.id, DETAIL_START_SELECTOR);
  }

  /** 이름 받는 창. 닫으면 Modal이 초점을 누른 단추로 돌려준다. */
  const modal = creating && <CreateTimetableModal onCreate={create} onClose={() => setCreating(false)} />;

  if (openId !== null) {
    return (
      <>
        {shown && (
          <TimetableDetail
            timetable={shown}
            isActive={shown.id === activeTimetable}
            showActive={showActiveInDetail}
            isOnly={timetables.length === 1}
            dogTheme={dogTheme}
            toasts={toasts}
            registerGuard={registerGuard}
            onDirtyChange={onDirtyChange}
            onBack={() => {
              focusAfter.current = cardSelector(shown.id);
              setOpenId(null);
            }}
            onDeleted={(name) => {
              notify({
                key: 'timetable-deleted',
                kind: 'success',
                text: `'${name}' 시간표를 지웠어요`,
              });
              // 지운 카드는 없으므로 목록의 첫 카드(남은 것이 없으면 "시간표 만들기")에 초점을 둔다
              focusAfter.current = '.timetable-cards button';
              setOpenId(null);
            }}
          />
        )}
        {modal}
      </>
    );
  }

  if (timetables.length === 0) {
    return (
      <div className="timetable-cards">
        <section className="tcard timetable-empty" aria-label="시간표 없음">
          <DogArt themeId={dogTheme} action="idle" className="timetable-empty__dog" />
          <p className="timetable-empty__message">시간표를 만들어 주세요</p>
          <button type="button" className="button" onClick={() => setCreating(true)}>
            <ActionIcon name="plus" />
            시간표 만들기
          </button>
        </section>
        {modal}
      </div>
    );
  }
  return (
    <>
      <ul className="timetable-cards" aria-label="시간표 목록">
        {timetables.map((t) => (
          <TimetableCard
            key={t.id}
            timetable={t}
            active={showActive && t.id === activeTimetable}
            onOpen={() => open(t.id, DETAIL_BACK_SELECTOR)}
          />
        ))}
        <li className="timetable-cards__item">
          <button type="button" className="tcard tcard--new" onClick={() => setCreating(true)}>
            <ActionIcon name="plus" />새 시간표
          </button>
        </li>
      </ul>
      {modal}
    </>
  );
}
