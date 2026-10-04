/**
 * content/illustrations.json → docs/IMAGE_PROMPTS.html (이미지 생성 프롬프트 모음)
 *   npm run images:prompts
 */
import { writeFileSync } from 'node:fs';
import data from '../content/illustrations.json';

type Item = { name: string; title: string; where: string; ratio: string; bg?: string; subject: string; ko: string; fallback?: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const size = (ratio: string) => (ratio === '4:3' ? '1024×768 → 앱용 800×600' : '1024×1024 → 앱용 640×640');

export function fullPrompt(i: Item): string {
  const bg = i.bg ? `, solid flat background color ${i.bg}` : '';
  return `${i.subject}. ${data.style.en}${bg}. Aspect ratio ${i.ratio}.`;
}

const items = [...(data.items as Item[]), data.appIcon as Item];

const card = (i: Item, n: number) => `
<article class="item" id="${i.name}">
  <header>
    <span class="num">${n}</span>
    <div class="grow">
      <h2>${esc(i.title)}</h2>
      <p class="meta">${esc(i.where)} · ${i.ratio} · ${size(i.ratio)}</p>
    </div>
    ${i.bg ? `<span class="swatch" style="background:${i.bg}" title="배경 ${i.bg}"></span>` : ''}
  </header>
  <p class="file">저장 파일: <code>${i.name === 'app-icon' ? 'public/icons/ (PNG 192·512)' : `public/illustrations/${i.name}.webp`}</code></p>
  <p class="ko">${esc(i.ko)}</p>
  <div class="prompt">
    <div class="label">프롬프트 (영문)</div>
    <pre>${esc(fullPrompt(i))}</pre>
    <button class="copy" data-copy="${esc(fullPrompt(i))}">복사</button>
  </div>
  <div class="prompt neg">
    <div class="label">네거티브 프롬프트</div>
    <pre>${esc(data.style.negative)}</pre>
    <button class="copy" data-copy="${esc(data.style.negative)}">복사</button>
  </div>
</article>`;

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>일러스트 프롬프트</title>
<style>
:root{--bg:#f6f5f2;--surface:#fff;--text:#1c1d1f;--muted:#5f6368;--line:#e4e1db;--brand:#173b3f;--primary:#d4561e;--soft:#f0eee9;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111416;--surface:#1a1e21;--text:#eceeef;--muted:#9ca3a8;--line:#2f353a;--brand:#0e2427;--primary:#ff8a50;--soft:#23282c;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#111416;--surface:#1a1e21;--text:#eceeef;--muted:#9ca3a8;--line:#2f353a;--brand:#0e2427;--primary:#ff8a50;--soft:#23282c;color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font-family:Pretendard,-apple-system,'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;line-height:1.55;word-break:keep-all}
.hero{background:var(--brand);color:#fff;padding:28px 16px 24px}
.hero h1{margin:0 0 6px;font-size:1.5rem}
.hero p{margin:0;opacity:.85}
main{max-width:860px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:16px}
section.box,.item{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px}
h2{margin:0;font-size:1.1rem}
h3{margin:0 0 8px;font-size:1rem}
ol,ul{margin:0;padding-left:1.2rem}
li{margin:4px 0}
.item header{display:flex;align-items:center;gap:12px}
.grow{flex:1;min-width:0}
.num{width:32px;height:32px;border-radius:10px;background:var(--primary);color:#fff;display:grid;place-items:center;font-weight:800;flex:none}
.meta,.file,.ko{margin:4px 0;color:var(--muted);font-size:.88rem}
.ko{color:var(--text)}
.swatch{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);flex:none}
.prompt{position:relative;margin-top:10px;background:var(--soft);border-radius:12px;padding:10px 12px}
.prompt .label{font-size:.75rem;font-weight:700;color:var(--muted);margin-bottom:4px}
pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.82rem;padding-right:64px}
.copy{position:absolute;top:8px;right:8px;min-height:36px;padding:0 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text);font-weight:700;cursor:pointer}
.copy.done{background:var(--primary);color:#fff;border-color:var(--primary)}
.palette{display:flex;flex-wrap:wrap;gap:8px}
.palette span{display:inline-flex;align-items:center;gap:6px;font-size:.82rem}
.palette i{width:22px;height:22px;border-radius:6px;border:1px solid var(--line)}
code{font-family:ui-monospace,Menlo,monospace;font-size:.85em;background:var(--soft);padding:1px 6px;border-radius:6px}
.toc{display:flex;flex-wrap:wrap;gap:6px}
.toc a{font-size:.82rem;padding:4px 10px;border-radius:999px;background:var(--soft);color:var(--text);text-decoration:none}
.all{margin-top:8px}
@media (max-width:480px){main{padding:12px}}
</style>
</head>
<body>
<div class="hero">
  <h1>말하기 훈련 · 일러스트 프롬프트</h1>
  <p>앱 일러스트 ${data.items.length}장 + 앱 아이콘 1장. 모든 이미지가 같은 스타일이 되도록 공통 스타일을 각 프롬프트에 포함했습니다.</p>
</div>
<main>
  <section class="box">
    <h3>사용 방법</h3>
    <ol>
      <li><b>1번 이미지를 먼저</b> 만들고 마음에 들 때까지 다듬습니다. 이후 이미지는 1번을 <b>스타일 참조 이미지</b>로 함께 넣으면 일관성이 좋아집니다 (ChatGPT 이미지: "이 그림과 같은 스타일로", Midjourney: <code>--sref</code>).</li>
      <li>"프롬프트 (영문)"을 복사해 붙여 넣고, 네거티브 칸이 있는 도구면 네거티브도 넣습니다.</li>
      <li>그림 안에 <b>글자가 생기면 다시 생성</b>하세요 (앱 화면에 따로 제목이 있습니다).</li>
      <li>파일 이름을 표의 이름(예: <code>ex-prolonged.png</code>)으로 저장해 한 폴더에 모은 뒤, 압축해서 Claude 세션에 올려 주시면 변환·배치·배포까지 진행합니다. 직접 하실 때는 <code>npm run images:prepare -- 폴더</code>.</li>
      <li>이미지가 없는 자리는 지금처럼 이모지로 표시되므로 몇 장씩 나눠 올려도 됩니다.</li>
    </ol>
  </section>

  <section class="box">
    <h3>공통 스타일</h3>
    <p class="ko">${esc(data.style.ko)}</p>
    <div class="palette">
      ${['#173B3F 짙은 청록', '#E8743B 따뜻한 주황', '#FFE3D3 복숭아', '#D8EFE9 민트', '#E6E1FB 라벤더', '#FFF0C9 버터', '#F6F5F2 바탕']
        .map((c) => `<span><i style="background:${c.split(' ')[0]}"></i>${c}</span>`)
        .join('')}
    </div>
    <div class="prompt all">
      <div class="label">공통 스타일 (영문, 참고용 · 각 프롬프트에 이미 포함됨)</div>
      <pre>${esc(data.style.en)}</pre>
      <button class="copy" data-copy="${esc(data.style.en)}">복사</button>
    </div>
  </section>

  <nav class="toc" aria-label="목록">${items.map((i, k) => `<a href="#${i.name}">${k + 1}. ${esc(i.title)}</a>`).join('')}</nav>

  ${items.map((i, k) => card(i, k + 1)).join('\n')}
</main>
<script>
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.copy');
  if (!b) return;
  const text = b.dataset.copy;
  try { await navigator.clipboard.writeText(text); }
  catch { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); }
  b.textContent = '복사됨'; b.classList.add('done');
  setTimeout(() => { b.textContent = '복사'; b.classList.remove('done'); }, 1500);
});
</script>
</body>
</html>
`;

writeFileSync(new URL('../docs/IMAGE_PROMPTS.html', import.meta.url), html);
console.log(`${items.length}개 프롬프트 → docs/IMAGE_PROMPTS.html`);
