import { useState } from 'react';

type Props = {
  /** 슬라이더 이름. 화면 읽기에 쓴다. */
  label: string;
  /** 메인이 가진 지금 값. */
  value: number;
  /** 고를 수 있는 범위. 주지 않으면 0~100이다. */
  min?: number;
  max?: number;
  /** 화면 읽기에 읽힐 값의 글. 주지 않으면 "50%"처럼 읽는다. */
  valueText?(value: number): string;
  /** 값이 바뀔 때마다 부른다. 끄는 동안 여러 번 불린다. */
  onChange(value: number): void;
  /** 짧은 슬라이더(목록 줄용)인지. */
  short?: boolean;
};

/** DESIGN.md의 슬라이더. 흰 길에 경계 테두리, 채운 부분은 초록, 손잡이는 흰 원이다. */
export function Slider({ label, value, onChange, short, min = 0, max = 100, valueText = (v) => `${v}%` }: Props) {
  /** 끄는 동안 손에 보이는 값. 메인이 저장하고 돌려주기 전에도 손잡이가 따라오게 하고, 놓으면 메인 값으로 돌아간다. */
  const [held, setHeld] = useState<number | null>(null);
  /** 화면에 그리는 값. */
  const shown = held ?? value;
  /** 채운 부분의 비율(%). */
  const fill = ((shown - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className={`slider${short ? ' slider--short' : ''}`}
      min={min}
      max={max}
      step={1}
      value={shown}
      aria-label={label}
      aria-valuetext={valueText(shown)}
      style={{ '--fill': `${fill}%` } as React.CSSProperties}
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
