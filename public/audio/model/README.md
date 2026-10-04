# 모델 음성

경로: `public/audio/model/{spm}/{sentenceId}.m4a` — 자세한 방법은 `docs/MODEL_AUDIO_GUIDE.md`

- SPM 단계: `70`, `120`, `150`, `180`
- `sentenceId`: `content/sentences.json` 의 `id` (예: `L1-01`)
- 형식: AAC 64kbps, 모노 권장
- 초기 수량: 4단계 × 난이도별 10문장 × 3난이도 = 120파일 (각 난이도의 01–10번 문장)

파일이 없으면 앱은 "모델 음성 준비 중"으로 표시하고 하이라이트·메트로놈 훈련만 진행한다.
`npm run build` 시 이 폴더의 m4a 는 모두 오프라인 캐시에 포함된다.
