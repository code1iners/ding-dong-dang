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
