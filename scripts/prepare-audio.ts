/**
 * 녹음 원본(wav/m4a/mp3 등)을 앱용 m4a(AAC 64kbps 모노)로 변환하고 길이를 검사한다.
 *
 *   npm run audio:prepare -- <원본 폴더>
 *
 * 원본 폴더 구조 (파일 이름 = 문장 ID):
 *   raw/70/L1-01.wav, raw/120/L1-01.wav, … raw/pullout.wav
 *
 * 처리: 앞뒤 무음 제거 → 음량 정규화(-16 LUFS) → 앞뒤 0.3초 여백 → AAC 64kbps 모노
 * 결과: public/audio/model/{spm}/{id}.m4a, 목표 길이와 ±15% 이상 차이 나면 경고
 * 필요: ffmpeg, ffprobe (macOS: brew install ffmpeg / Windows: winget install ffmpeg)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { modelTargets } from './model-audio-checklist';

const src = process.argv[2];
if (!src) {
  console.error('사용법: npm run audio:prepare -- <원본 폴더>');
  process.exit(1);
}
const OUT = 'public/audio/model';
const PAD = 0.3;
const TOLERANCE = 0.15;
const FILTER = [
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05',
  'areverse',
  // loudnorm 은 내부적으로 192kHz 로 올리므로 앞뒤로 44.1kHz 고정 (안 하면 패딩 단계에서 멈춤)
  'aresample=44100',
  'loudnorm=I=-16:TP=-1.5:LRA=11',
  'aresample=44100',
  `apad=pad_dur=${PAD}`,
  `adelay=${PAD * 1000}`,
].join(',');

const duration = (f: string) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim());

function convert(input: string, output: string) {
  mkdirSync(join(output, '..'), { recursive: true });
  execFileSync('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-i', input, '-af', FILTER, '-ac', '1', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', output]);
}

const targets = new Map(modelTargets().map((t) => [`${t.spm}/${t.id}`, t]));
let ok = 0;
const warn: string[] = [];

for (const dir of readdirSync(src, { withFileTypes: true })) {
  if (dir.isFile()) {
    // pullout.wav 처럼 폴더 밖의 시범 음성
    const name = basename(dir.name, extname(dir.name));
    convert(join(src, dir.name), join(OUT, `${name}.m4a`));
    console.log(`✓ ${name}.m4a`);
    continue;
  }
  for (const f of readdirSync(join(src, dir.name))) {
    const id = basename(f, extname(f));
    const key = `${dir.name}/${id}`;
    const out = join(OUT, dir.name, `${id}.m4a`);
    convert(join(src, dir.name, f), out);
    const t = targets.get(key);
    const speech = duration(out) - PAD * 2;
    if (t) {
      const diff = (speech - t.targetSec) / t.targetSec;
      if (Math.abs(diff) > TOLERANCE)
        warn.push(`${key}: ${speech.toFixed(1)}초 (목표 ${t.targetSec}초, ${diff > 0 ? '+' : ''}${Math.round(diff * 100)}%) — 실제 ${Math.round((t.syllables / speech) * 60)} SPM`);
    } else warn.push(`${key}: 체크리스트에 없는 파일`);
    ok++;
  }
}

const missing = [...targets.values()].filter((t) => !existsSync(t.file));
console.log(`\n변환 ${ok}개 · 누락 ${missing.length}개 / ${targets.size}개`);
if (warn.length) console.log(`\n⚠ 속도 확인 필요 (±${TOLERANCE * 100}% 초과)\n${warn.join('\n')}`);
if (missing.length) console.log(`\n누락:\n${missing.map((m) => m.file).join('\n')}`);
