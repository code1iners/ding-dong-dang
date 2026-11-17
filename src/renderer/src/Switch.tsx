type Props = {
  /** 켜져 있는지. */
  on: boolean;
  /** 스위치 이름을 가진 요소의 id. 이름은 켜졌을 때의 상태를 말한다(DESIGN.md "글"). */
  labelledBy: string;
  /** 스위치 곁의 설명(실패 이유 등)을 가진 요소의 id. 화면 읽기가 이름 다음에 읽는다. */
  describedBy?: string;
  /** 누르면 바뀔 값으로 부른다. */
  onChange(on: boolean): void;
};

/** DESIGN.md의 스위치. 켜짐과 꺼짐을 색과 손잡이 위치로 함께 보여 준다. */
export function Switch({ on, labelledBy, describedBy, onChange }: Props) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={() => onChange(!on)}
    />
  );
}
