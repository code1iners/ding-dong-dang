import { useState } from 'react';
import { clockParts, timeFromEntry, typeEntryDigit } from '../../shared/period-edit';

type Props = {
  /** 화면 읽기용 이름. 어느 교시의 시작인지 끝인지 말한다. */
  label: string;
  /** 자정부터의 분. */
  value: number;
  /** 시각을 다 입력했을 때 부른다. */
  onCommit(minutes: number): void;
};

/** 시각 칸의 글자 하나. 숫자는 폭이 같은 칸에, 쌍점은 좁은 칸에 넣는다(DESIGN.md "글자"). */
type Cell = { char: string; colon: boolean };

/** 'HHMM' 네 글자를 칸으로 나눈다. 모자라면 비워 둔 칸으로 채운다. */
function cellsOf(digits: string): Cell[] {
  const padded = digits.padEnd(4, ' ');
  return [
    { char: padded[0]!, colon: false },
    { char: padded[1]!, colon: false },
    { char: ':', colon: true },
    { char: padded[2]!, colon: false },
    { char: padded[3]!, colon: false },
  ];
}

/**
 * 시각 칸. Jua의 숫자는 폭이 제각각이라 글자를 그대로 쓰면 고칠 때마다 흔들리므로,
 * 숫자마다 같은 폭의 칸을 그려 보여 준다. 실제 입력은 그 위에 투명하게 겹친 글자 칸이 받는다.
 * 숫자 키로 쓰고 Backspace로 지우며, 새로 쓰기 시작하면 이전 값을 비운다. Enter · Tab · 초점을 잃으면 확정한다.
 * 24시 이상 같은 범위 밖 값도 그대로 받아, 검증이 그 줄에 이유를 보여 주게 한다.
 */
export function TimeField({ label, value, onCommit }: Props) {
  /** 지금 치는 중인 숫자 글자. 아직 치지 않았으면 null이다. */
  const [typed, setTyped] = useState<string | null>(null);
  /** 초점이 들어와 있는지. */
  const [focused, setFocused] = useState(false);

  /** 칸에 보이는 'HHMM'. 치는 중이면 친 글자까지다. */
  const digits = typed ?? clockParts(value);

  /** 치던 것을 확정한다. */
  function commit(): void {
    if (typed === null) return;
    const minutes = timeFromEntry(typed);
    setTyped(null);
    if (minutes !== null && minutes !== value) onCommit(minutes);
  }

  return (
    <span className={`time-field${focused ? ' time-field--focused' : ''}`}>
      <span className="time-field__cells" aria-hidden="true">
        {cellsOf(digits).map((cell, i) => (
          <span key={i} className={cell.colon ? 'time-field__colon' : 'time-field__digit'}>
            {cell.char}
          </span>
        ))}
      </span>
      <input
        className="time-field__input"
        aria-label={label}
        inputMode="numeric"
        autoComplete="off"
        value={`${clockParts(value).slice(0, 2)}:${clockParts(value).slice(2)}`}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(event) => {
          if (event.ctrlKey || event.metaKey || event.altKey) return;
          if (/^[0-9]$/.test(event.key)) {
            event.preventDefault();
            setTyped(typeEntryDigit(typed, event.key));
          } else if (event.key === 'Backspace') {
            event.preventDefault();
            setTyped((typed ?? clockParts(value)).slice(0, -1));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          } else if (event.key === 'Escape' && typed !== null) {
            // 치던 것만 버리고 이 줄을 감싼 창은 닫지 않는다
            event.preventDefault();
            event.stopPropagation();
            setTyped(null);
          }
        }}
        // 붙여 넣기나 자동 입력처럼 키를 거치지 않은 글자는 숫자만 뽑아 한 번에 확정한다
        onChange={(event) => {
          const entered = event.target.value.replace(/\D/g, '').slice(0, 4);
          const minutes = timeFromEntry(entered);
          setTyped(null);
          if (minutes !== null && minutes !== value) onCommit(minutes);
        }}
      />
    </span>
  );
}
