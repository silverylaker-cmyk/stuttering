# 콘텐츠 검수 기록

출시 전 언어재활사 1회 검수 대상: 문장 세트, 모델 음성, 단계 기준.

| 항목 | 파일 | 검수일 | 검수자 | 결과 | 수정 사항 |
|---|---|---|---|---|---|
| 낭독 문장 세트 (90) | `content/sentences.json` | | | 미검수 | |
| 주간 평가 주제 (26) | `content/probeTopics.json` | | | 미검수 | |
| 비도움 사고 예시 (12) | `content/thoughtPresets.json` | | | 미검수 | |
| 노출 사다리 템플릿 (10) | `content/exposureTemplates.json` | | | 미검수 | |
| 4주 설문 (8문항) | `content/survey.json` | | | 브리프 4.6 확정본 | |
| DAF 테스트 지문 (2) | `content/dafPassages.json` | | | 미검수 | |
| 화면 큐·안내 카드 | `content/guides.json` | | | 미검수 | |
| 모델 음성 (120 + Pull-out 시범) | `public/audio/model/` | | | 녹음 전 | |
| 기법 설명 영상 (8) | `public/video/` | | | 제작 전 | |
| 단계 기준 수치 | `src/config/program.ts` | | | 미검수 | |

## 메모
- 문장은 모두 자체 작성 초안이다. 문장을 고친 뒤 `npm run content:syllables` 로 음절 수를 다시 계산한다.
