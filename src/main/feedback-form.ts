/**
 * 딩동댕 제보 폼의 주소. 개발자 n8n의 Form Trigger이고, 경로는 공용 규칙 `/form/<저장소 이름>`을 따른다.
 * 배포된 앱마다 이 주소가 들어가므로 호스트와 경로를 바꾸지 않는다(docs/adr/0002-feedback-via-n8n-form.md).
 */
export const FEEDBACK_FORM_URL = 'https://oracle.codeliners.cc/form/ding-dong-dang';

/** 폼 주소에 담을 이 실행의 정보. 폼의 숨김 필드로 들어가며, 채우는 책임은 앱에 있다. */
export type FeedbackContext = {
  /** 앱 버전(`app.getVersion()`). */
  appVersion: string;
  /** `process.platform`. */
  platform: NodeJS.Platform;
  /** OS 버전(`process.getSystemVersion()`). */
  systemVersion: string;
};

/** 사람이 읽는 OS 이름. 배포하는 두 OS 말고는 플랫폼 이름을 그대로 쓴다. */
const OS_NAMES: Partial<Record<NodeJS.Platform, string>> = { darwin: 'macOS', win32: 'Windows' };

/** 폼 쿼리 `os`의 값. 예: `macOS 27.2.0`, `Windows 10.0.26100`. */
export function osLabel(platform: NodeJS.Platform, systemVersion: string): string {
  return `${OS_NAMES[platform] ?? platform} ${systemVersion}`.trim();
}

/** "의견 보내기"가 브라우저로 여는 주소. 쿼리 `version`과 `os`에 이 실행의 정보를 담는다. */
export function feedbackFormUrl({ appVersion, platform, systemVersion }: FeedbackContext): string {
  const url = new URL(FEEDBACK_FORM_URL);
  url.searchParams.set('version', appVersion);
  url.searchParams.set('os', osLabel(platform, systemVersion));
  return url.toString();
}
