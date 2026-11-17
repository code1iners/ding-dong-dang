import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

// electron-vite의 기본 위치(src/main, src/preload, src/renderer)만 빌드한다.
// prototypes/는 측정용이라 빌드에 넣지 않는다.
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    plugins: [react()],
  },
});
