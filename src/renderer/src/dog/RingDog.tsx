import { useEffect, useRef, useState } from 'react';
import type { StatusKind } from '../../../shared/bell-decision';
import { PETTED_MS } from '../../../shared/roaming-dog';
import { ringDogAction } from '../../../shared/status-view';
import { DogArt, useReducedMotion } from './DogArt';
import { HEART_COUNT, HEART_MAX_DELAY_S, HEART_MS, HEART_PATH, randomBetween } from './hearts';


/** 떠오르는 하트 하나. 자리는 강아지 칸에 대한 비율이다. */
type Heart = { id: number; left: number; top: number; size: number; delay: number; dx: number };

type Props = {
  /** 저장된 강아지 테마 id. */
  themeId: string;
  /** 지금 현황. 강아지가 평소인지 졸림인지를 정한다. */
  kind: StatusKind;
  /** 지금 종이 울리는 중인지. 울리는 동안은 신남이고, 누르면 종이 멈춘다. */
  ringing: boolean;
};

/** 하트 모양. */
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={HEART_PATH} />
    </svg>
  );
}

/**
 * 현황 고리 안의 강아지. DESIGN.md "현황" 표대로 평소나 졸림이고 종이 울리는 동안은 신남이다.
 * 누르면 2초쯤 신남이 되고 하트 8개가 떠올라 1초 안에 모두 사라진다. 종이 울리는 동안 누르면 종이 멈춘다.
 */
export function RingDog({ themeId, kind, ringing }: Props) {
  /** 누른 뒤 아직 신남인지. */
  const [petted, setPetted] = useState(false);
  /** 떠 있는 하트. */
  const [hearts, setHearts] = useState<Heart[]>([]);
  /** 하트 id를 겹치지 않게 매기는 수. */
  const nextHeart = useRef(0);
  /** 신남을 끝낼 타이머. 다시 누르면 처음부터 2초다. */
  const pettedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** 동작 줄이기가 켜져 있으면 하트가 떠오르지 않고 제자리에서 보였다 사라진다. */
  const reduced = useReducedMotion();

  useEffect(function clearPettedTimerOnLeave() {
    // 화면을 떠나면 남은 타이머를 거둔다
    return () => clearTimeout(pettedTimer.current);
  }, []);

  /** 강아지를 눌렀을 때. 울리는 종을 멈추고, 2초쯤 신남으로 두고, 하트를 띄운다. */
  function pet(): void {
    if (ringing) window.dingdong.command({ type: 'stop-bell' }).catch((error: unknown) => console.error(error));
    setPetted(true);
    clearTimeout(pettedTimer.current);
    pettedTimer.current = setTimeout(() => setPetted(false), PETTED_MS);

    /** 새로 띄울 하트. 강아지 둘레의 무작위 자리에서 떠오른다. */
    const added = Array.from({ length: HEART_COUNT }, (): Heart => ({
      id: nextHeart.current++,
      left: randomBetween(0, 1),
      top: randomBetween(0, 0.7),
      size: randomBetween(14, 28),
      delay: randomBetween(0, HEART_MAX_DELAY_S),
      dx: randomBetween(-18, 18),
    }));
    setHearts((list) => [...list, ...added]);
    /** 지울 하트 id. 늦게 시작한 하트까지 사라진 뒤에 지운다. */
    const ids = new Set(added.map((h) => h.id));
    setTimeout(() => setHearts((list) => list.filter((h) => !ids.has(h.id))), HEART_MS + HEART_MAX_DELAY_S * 1000);
  }

  return (
    <div className="ring-dog">
      <button type="button" className="ring-dog__button" aria-label={ringing ? '종 멈추기' : '강아지'} onClick={pet}>
        <DogArt themeId={themeId} action={ringDogAction(kind, { ringing, petted })} />
      </button>
      <div className={`hearts${reduced ? ' hearts--still' : ''}`} aria-hidden="true">
        {hearts.map((h) => (
          <span
            key={h.id}
            className="heart"
            style={{
              left: `${h.left * 100}%`,
              top: `${h.top * 100}%`,
              width: h.size,
              height: h.size,
              animationDelay: `${h.delay}s`,
              ['--heart-dx' as string]: `${h.dx}px`,
            }}
          >
            <HeartIcon />
          </span>
        ))}
      </div>
    </div>
  );
}
