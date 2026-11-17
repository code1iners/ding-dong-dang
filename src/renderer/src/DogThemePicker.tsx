import { useRef, type KeyboardEvent } from 'react';
import { DOG_THEME_INFOS } from '../../shared/dog-themes';
import { DogArt } from './dog/DogArt';
import { themeById } from './dog/themes';

type Props = {
  /** 저장된 강아지 테마 id. */
  themeId: string;
};

/**
 * 설정 맨 위의 강아지 테마 고르기. 테마 일곱 개가 이름 없이 그림만 나란히 있고 평소 동작으로 움직인다.
 * 누르면 바로 적용하고 저장한다. 이름은 화면에 쓰지 않고 단추의 접근성 이름으로만 둔다.
 * 선택 하나짜리 묶음이라 화살표 키로 옮기고, 초점은 고른 테마에만 머문다(탭은 묶음을 한 번에 지나간다).
 */
export function DogThemePicker({ themeId }: Props) {
  /** 지금 고른 테마 id. 모르는 id는 기본 테마로 본다. */
  const current = themeById(themeId).id;
  /** 단추들. 화살표 키로 초점을 옮길 때 쓴다. */
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  /** 테마를 고른다. */
  const choose = (id: string) => void window.dingdong.command({ type: 'set-dog-theme', id });

  /** 화살표 키로 이웃 테마를 고른다. 끝에서는 반대편 끝으로 돈다. */
  const onKeyDown = (event: KeyboardEvent, index: number) => {
    /** 옮길 칸 수. 화살표가 아니면 0이다. */
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    /** 옮겨 갈 칸. */
    const next = (index + step + DOG_THEME_INFOS.length) % DOG_THEME_INFOS.length;
    buttons.current[next]?.focus();
    choose(DOG_THEME_INFOS[next]!.id);
  };

  return (
    <div className="theme-row" role="radiogroup" aria-label="강아지 테마">
      {DOG_THEME_INFOS.map((info, index) => (
        <button
          key={info.id}
          ref={(el) => {
            buttons.current[index] = el;
          }}
          type="button"
          role="radio"
          className="theme-option"
          aria-checked={info.id === current}
          aria-label={info.name}
          tabIndex={info.id === current ? 0 : -1}
          data-dog-theme-option={info.id}
          onClick={() => choose(info.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          <DogArt themeId={info.id} action="idle" className="theme-option__dog" />
        </button>
      ))}
    </div>
  );
}
