/// <reference types="vite/client" />
import type { DingDongApi } from '../../shared/bridge';

declare global {
  interface Window {
    /** preload가 내보낸 메인과의 통로. 상태 구독과 명령만 있다. */
    dingdong: DingDongApi;
  }
}
