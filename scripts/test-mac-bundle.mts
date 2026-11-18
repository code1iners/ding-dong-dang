// 테스트 전용: 실제 codesign으로 검사할 작은 앱 번들을 만든다. 제품 코드는 이 파일을 쓰지 않는다.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 실행 파일 하나짜리 앱 번들을 만들고 electron-builder처럼 ad-hoc 서명한다.
 * 이 상태의 지정 요구 조건은 빌드마다 바뀌는 cdhash다.
 */
export function makeAdHocBundle(dir: string, identifier: string, name = 'Test'): string {
  /** 번들 경로. */
  const app = join(dir, `${name}.app`);
  mkdirSync(join(app, 'Contents', 'MacOS'), { recursive: true });
  copyFileSync('/usr/bin/true', join(app, 'Contents', 'MacOS', 'test'));
  writeFileSync(
    join(app, 'Contents', 'Info.plist'),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>${identifier}</string>
<key>CFBundleExecutable</key><string>test</string>
<key>CFBundlePackageType</key><string>APPL</string>
</dict></plist>
`,
  );
  execFileSync('codesign', ['--force', '--sign', '-', app], { stdio: 'ignore' });
  return app;
}
