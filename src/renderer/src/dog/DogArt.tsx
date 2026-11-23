import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { framesPerSecond, type DogAction } from '../../../shared/status-view';
import { mountDog, type DogRig } from './rig';
import { themeById } from './themes';

/** OS의 동작 줄이기를 묻는 미디어 쿼리. */
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** OS의 동작 줄이기가 켜져 있는지. 앱이 떠 있는 동안 바꿔도 따라간다. 화면이 없는 서버 렌더(단위 시험)에서는 꺼진 것으로 본다. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => typeof matchMedia === 'function' && matchMedia(REDUCED_MOTION).matches);
  useEffect(function followReducedMotion() {
    /** 동작 줄이기 미디어 쿼리. */
    const query = matchMedia(REDUCED_MOTION);
    /** OS 설정이 바뀌었을 때. */
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * 앱 창이 화면에 보이는지. 숨은 창도 Chromium은 보이는 중으로 보고 타이머를 늦추지 않으므로, 메인이 알려 준 값으로 강아지를 멈춘다.
 * 앱 밖(견본 화면, 단위 시험)에서는 값을 주지 않아 보이는 것으로 본다.
 */
export const WindowShownContext = createContext(true);

type Props = {
  /** 저장된 강아지 테마 id. 모르는 id는 기본 테마다. */
  themeId: string;
  /** 그릴 동작. */
  action: DogAction;
  /** 칸의 크기와 자리를 정하는 클래스. */
  className?: string;
};

/**
 * 창 안의 강아지 그림. 칸을 꽉 채우고 발이 바닥에 닿는다.
 * 동작마다 정한 횟수로 타이머가 다시 그리고, OS의 동작 줄이기가 켜져 있거나 앱 창이 숨어 있으면 그 동작의 첫 자세로 멈춘다.
 */
export function DogArt({ themeId, action, className }: Props) {
  /** 그림을 붙일 칸. */
  const boxRef = useRef<HTMLDivElement>(null);
  /** 붙인 그림. 테마가 바뀌면 새로 붙인다. */
  const [rig, setRig] = useState<DogRig | null>(null);
  /** 동작 줄이기가 켜져 있는지. */
  const reduced = useReducedMotion();
  /** 앱 창이 보이는지. 숨어 있으면 그리지 않는다. */
  const shown = useContext(WindowShownContext);

  useEffect(
    function mountTheme() {
      const box = boxRef.current;
      if (!box) return;
      /** 이 테마로 붙인 그림. */
      const mounted = mountDog(box, themeById(themeId));
      setRig(mounted);
      return () => mounted.remove();
    },
    [themeId],
  );

  useEffect(
    function animate() {
      if (!rig) return;
      /** 이 동작을 시작한 시각(ms). */
      const start = performance.now();
      rig.pose(action, 0);
      if (reduced || !shown) return;
      /** 동작의 그리는 횟수에 맞춘 타이머. */
      const timer = setInterval(() => rig.pose(action, (performance.now() - start) / 1000), 1000 / framesPerSecond(action));
      return () => clearInterval(timer);
    },
    [rig, action, reduced, shown],
  );

  return <div ref={boxRef} className={`dog-art${className ? ` ${className}` : ''}`} data-dog-theme={themeById(themeId).id} data-dog-action={action} data-paused={!shown} />;
}
