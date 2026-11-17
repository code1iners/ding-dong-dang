import { useState } from 'react';

type Props = {
  /** 슬라이더 이름. 화면 읽기에 쓴다. */
  label: string;
  /** 메인이 가진 지금 값(0~100). */
  value: number;
  /** 값이 바뀔 때마다 부른다. 끄는 동안 여러 번 불린다. */
  onChange(value: number): void;
  /** 짧은 슬라이더(목록 줄용)인지. */
  short?: boolean;
};

/** DESIGN.md의 슬라이더 0~100. 흰 길에 경계 테두리, 채운 부분은 초록, 손잡이는 흰 원이다. */
export function Slider({ label, value, onChange, short }: Props) {
  /** 끄는 동안 손에 보이는 값. 메인이 저장하고 돌려주기 전에도 손잡이가 따라오게 하고, 놓으면 메인 값으로 돌아간다. */
  const [held, setHeld] = useState<number | null>(null);
  /** 화면에 그리는 값. */
  const shown = held ?? value;
  return (
    <input
      type="range"
      className={`slider${short ? ' slider--short' : ''}`}
      min={0}
      max={100}
      step={1}
      value={shown}
      aria-label={label}
      aria-valuetext={`${shown}%`}
      style={{ '--fill': `${shown}%` } as React.CSSProperties}
      onChange={(e) => {
        const next = Number(e.target.value);
        setHeld(next);
        onChange(next);
      }}
      onPointerUp={() => setHeld(null)}
      onKeyUp={() => setHeld(null)}
      onBlur={() => setHeld(null)}
    />
  );
}
