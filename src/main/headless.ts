/** 헤드리스 실행을 켜는 환경변수. 앱과 e2e 시험이 같은 이름과 규칙을 쓴다. */
export const HEADLESS_ENV = 'DDD_HEADLESS';

/** 환경변수가 헤드리스 실행을 켰는지. */
export function isHeadlessEnv(env: Record<string, string | undefined>): boolean {
  return env[HEADLESS_ENV] === '1';
}

/**
 * 자동 검증 실행을 화면에 보이지 않게 띄울지. `--data-dir` 실행에서 환경변수가 켜졌을 때만 참이다.
 * 실제 앱이 실수로 남은 환경변수 때문에 창을 숨기지 않도록 데이터 폴더를 바꾼 실행으로 한정한다.
 */
export function isHeadlessRun(env: Record<string, string | undefined>, customDataDir: string | null): boolean {
  return customDataDir !== null && isHeadlessEnv(env);
}
