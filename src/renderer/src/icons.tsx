import type { ReactNode } from 'react';
import type { ScreenId } from './screens';

/** 선 굵기 2.4의 외곽선 아이콘 한 벌이 함께 쓰는 선 속성. 색은 currentColor로 받는다(DESIGN.md "아이콘"). */
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** 화면별 세로 줄 아이콘의 도형. */
const PATHS: Record<ScreenId, ReactNode> = {
  status: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  timetable: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M8.5 3v4M15.5 3v4" />
    </>
  ),
  bells: <path d="M12 4a5.5 5.5 0 0 0-5.5 5.5v4L4.5 17h15l-2-3.5v-4A5.5 5.5 0 0 0 12 4zM10 20.5h4" />,
  settings: (
    <>
      <path d="M5 7h9M18 7h1M5 12h2M11 12h8M5 17h7M16 17h3" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="14" cy="17" r="2" />
    </>
  ),
};

/** 화면 하나의 세로 줄 아이콘. 글자 대신 쓰는 장식이라 화면 읽기에서는 숨긴다. */
export function ScreenIcon({ screen }: { screen: ScreenId }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...STROKE}>
      {PATHS[screen]}
    </svg>
  );
}

/** 모달과 알림, 시간표 화면에 쓰는 동작 아이콘의 도형과 선 굵기. 시안의 아이콘 한 벌이다. */
const ACTION_ICONS = {
  pen: { width: 2.4, shape: <path d="M5 19l1-4.5 9.5-9.5 3.5 3.5L9.5 18z" /> },
  bin: { width: 2.4, shape: <path d="M5 7h14M9.5 7V4.5h5V7M7 7l1 12.5h8L17 7" /> },
  x: { width: 3, shape: <path d="M6 6l12 12M18 6L6 18" /> },
  ok: { width: 3.2, shape: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
  bang: {
    width: 3.2,
    shape: (
      <>
        <path d="M12 5v9" />
        <circle cx="12" cy="18.5" r="1" fill="currentColor" />
      </>
    ),
  },
  plus: { width: 3, shape: <path d="M12 5v14M5 12h14" /> },
  down: { width: 3, shape: <path d="M6 9.5l6 6 6-6" /> },
} satisfies Record<string, { width: number; shape: ReactNode }>;

/** 동작 아이콘 이름. */
export type ActionIconName = keyof typeof ACTION_ICONS;

/** 동작 아이콘. 이름은 곁의 단추가 붙이므로 화면 읽기에서는 숨긴다. */
export function ActionIcon({ name }: { name: ActionIconName }) {
  const { width, shape } = ACTION_ICONS[name];
  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" {...STROKE} strokeWidth={width}>
      {shape}
    </svg>
  );
}
