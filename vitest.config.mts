import { defineConfig } from 'vitest/config';

// 단위 · 모듈 테스트는 src/ 아래의 *.test.ts(x)와 scripts/ 아래의 *.test.mts만 돈다. 실제 앱 테스트(e2e/)와 prototypes/는 뺀다.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mts'],
    // 순수 함수와 저장소 테스트가 아직 없는 뼈대 단계에서도 명령이 성공하게 둔다
    passWithNoTests: true,
  },
});
