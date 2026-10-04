/**
 * 생성한 일러스트(png/jpg/webp)를 앱용 webp 로 변환해 public/illustrations/ 에 넣는다.
 *   npm run images:prepare -- <폴더>
 * 파일 이름 = content/illustrations.json 의 name (예: ex-prolonged.png)
 * 4:3 → 800×600, 1:1 → 640×640 (가운데 기준 잘라 맞춤), 품질 82
 * 필요: ffmpeg (libwebp)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import data from '../content/illustrations.json';

const src = process.argv[2];
if (!src) {
  console.error('사용법: npm run images:prepare -- <폴더>');
  process.exit(1);
}
const OUT = 'public/illustrations';
mkdirSync(OUT, { recursive: true });
const byName = new Map(data.items.map((i) => [i.name, i]));

for (const f of readdirSync(src)) {
  if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
  const name = basename(f, extname(f));
  const item = byName.get(name);
  if (!item) {
    console.log(`⚠ ${f}: 등록되지 않은 이름 (content/illustrations.json 확인)`);
    continue;
  }
  const [w, h] = item.ratio === '4:3' ? [800, 600] : [640, 640];
  const out = join(OUT, `${name}.webp`);
  execFileSync('ffmpeg', [
    '-nostdin', '-y', '-v', 'error', '-i', join(src, f),
    '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
    '-c:v', 'libwebp', '-quality', '82', '-frames:v', '1', out,
  ]);
  console.log(`✓ ${out} (${Math.round(statSync(out).size / 1024)}KB)`);
}

const missing = data.items.filter((i) => !existsSync(join(OUT, `${i.name}.webp`)));
console.log(`\n${data.items.length - missing.length}/${data.items.length}개 준비됨${missing.length ? ` · 남은 것: ${missing.map((m) => m.name).join(', ')}` : ''}`);
