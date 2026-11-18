import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUTO_START_HELP_URL } from './auto-start';

const readme = readFileSync(join(__dirname, '../../README.md'), 'utf8');

/** GitHub가 제목에서 만드는 앵커. 공백은 하이픈, 소문자, 문장부호는 뺀다. */
const anchorOf = (heading: string) => heading.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-');

describe('README 링크', () => {
  const anchors = [...readme.matchAll(/^#{1,6}\s+(.+)$/gm)].map((m) => anchorOf(m[1] ?? ''));

  it('앱의 "자동 시작 등록 방법" 링크 해시가 README 절 제목과 맞는다', () => {
    const hash = decodeURIComponent(new URL(AUTO_START_HELP_URL).hash.slice(1));
    expect(anchors).toContain(hash);
  });

  it('README 안의 #링크는 모두 존재하는 절을 가리킨다', () => {
    const inner = [...readme.matchAll(/\]\(#([^)]+)\)/g)].map((m) => decodeURIComponent(m[1] ?? ''));
    expect(inner.length).toBeGreaterThan(0);
    for (const a of inner) expect(anchors).toContain(a);
  });

  it('내려받기 링크가 릴리스 고정 주소와 산출물 이름을 쓴다', () => {
    const base = 'https://github.com/code1iners/ding-dong-dang/releases/latest/download/';
    expect(readme).toContain(`${base}DingDongDang-Setup.exe`);
    expect(readme).toContain(`${base}DingDongDang.dmg`);
  });

  it('요구된 절이 모두 있다', () => {
    for (const h of ['내려받기', 'Windows에 설치하기', '차단 화면이 뜨면 (Smart App Control)', 'Mac에 설치하기', '업데이트', '그 밖의 안내', '개발자용']) {
      expect(anchors).toContain(anchorOf(h));
    }
    expect(readme.indexOf('## 개발자용')).toBeGreaterThan(readme.indexOf('## 그 밖의 안내'));
  });
});
