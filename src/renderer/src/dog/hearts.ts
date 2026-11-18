// 강아지를 누르면 떠오르는 하트의 값. 고리 안 강아지와 돌아다니는 강아지가 같이 쓴다. 모양은 styles/hearts.css가 그린다.

/** 한 번 누를 때 떠오르는 하트 수. */
export const HEART_COUNT = 8;
/** 하트 하나가 떠올라 사라지는 시간(ms). CSS의 heart-rise 길이와 같다. */
export const HEART_MS = 800;
/** 하트마다 떠오르기 시작하는 시각을 이 범위(초) 안에서 늦춘다. 늦게 시작한 하트도 누른 뒤 1초 안에 사라진다. */
export const HEART_MAX_DELAY_S = 0.2;
/** 하트 모양(24×24 viewBox). */
export const HEART_PATH =
  'M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.2 0 3.6 1.2 5.3 3.1 1.7-1.9 3.1-3.1 5.3-3.1 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z';

/** a 이상 b 미만의 난수. */
export const randomBetween = (a: number, b: number): number => a + Math.random() * (b - a);
