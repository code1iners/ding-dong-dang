import { ScreenIcon } from './icons';
import { SCREENS, type ScreenId } from './screens';

type Props = {
  /** 지금 보이는 화면. */
  current: ScreenId;
  /** 단추를 눌러 화면을 고를 때 부른다. */
  onSelect(screen: ScreenId): void;
};

/** 왼쪽 세로 줄. 아이콘만 있는 단추라 마우스를 올리면 이름이 뜨고, 같은 이름을 화면 읽기용으로 붙인다. */
export function Rail({ current, onSelect }: Props) {
  return (
    <nav className="rail" aria-label="화면">
      {SCREENS.map(({ id, name, atEnd }) => (
        <button
          key={id}
          type="button"
          className={`rail-button${atEnd ? ' rail-button--end' : ''}`}
          title={name}
          aria-label={name}
          aria-current={id === current ? 'page' : undefined}
          onClick={() => onSelect(id)}
        >
          <ScreenIcon screen={id} />
        </button>
      ))}
    </nav>
  );
}
