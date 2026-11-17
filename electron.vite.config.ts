import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

// electron-vite의 기본 위치(src/main, src/preload, src/renderer)만 빌드한다.
// prototypes/는 측정용이라 빌드에 넣지 않는다.
// preload는 앱 창과 종 재생기(숨긴 창) 두 개, renderer는 거기에 강아지 견본을 더한 세 개다.
export default defineConfig({
  main: {},
  preload: {
    build: {
      rolldownOptions: {
        input: { index: resolve('src/preload/index.ts'), bell: resolve('src/preload/bell.ts') },
      },
    },
  },
  renderer: {
    plugins: [react()],
    build: {
      rolldownOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          bell: resolve('src/renderer/bell.html'),
          // 실제 앱 테스트가 강아지 그림을 테마 × 동작으로 재고 캡처하는 견본. 앱은 열지 않는다
          'dog-gallery': resolve('src/renderer/dog-gallery.html'),
        },
      },
    },
  },
});
