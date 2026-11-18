import { ScreenIcon } from './icons';
import { SCREENS, type ScreenId } from './screens';

type Props = {
  /** 지금 보이는 화면. */
  current: ScreenId;
  /** 단추를 눌러 화면을 고를 때 부른다. */
  onSelect(screen: ScreenId): void;
  /** 새 버전이 준비됐는지. 설정 단추에 주황 점을 붙이고 이름에도 알린다. */
  updateReady: boolean;
};

/** 왼쪽 세로 줄. 아이콘만 있는 단추라 마우스를 올리면 이름이 뜨고, 같은 이름을 화면 읽기용으로 붙인다. */
export function Rail({ current, onSelect, updateReady }: Props) {
  return (
    <nav className="rail" aria-label="화면">
      {SCREENS.map(({ id, name, atEnd }) => {
        /** 이 단추에 주황 점을 붙이는지. */
        const dotted = id === 'settings' && updateReady;
        return (
          <button
            key={id}
            type="button"
            className={`rail-button${atEnd ? ' rail-button--end' : ''}`}
            title={dotted ? `${name} · 새 버전이 있어요` : name}
            aria-label={dotted ? `${name}, 새 버전이 있어요` : name}
            aria-current={id === current ? 'page' : undefined}
            onClick={() => onSelect(id)}
          >
            <ScreenIcon screen={id} />
            {dotted && <span className="rail-button__dot" aria-hidden="true" />}
          </button>
        );
      })}
    </nav>
  );
}
