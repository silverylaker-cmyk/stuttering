# 말하기 훈련 — 말더듬 유창성 자가훈련 PWA

청소년·성인 말더듬 환자를 위한 **외래 처방형 자가훈련 보조 도구**입니다. 원장이 외래에서 단계를 처방하고, 환자는 집에서 훈련·기록하며, 외래 방문 시 환자 기기 화면으로 리포트를 확인합니다.
Camperdown Program 기반 변형(연장발화 → 자연도 회복 → 일상 전이 → 유지) + CBT(노출 + 인지 재구성).

- 데이터는 **100% 기기 로컬**(IndexedDB). 서버·외부 전송·분석 SDK 없음.
- 최초 로드 이후 완전 오프라인 동작, 홈 화면 설치(PWA).
- 진단·치료 효과를 표방하지 않습니다.

## 개발

```bash
npm install
npm run dev        # 개발 서버
npm test           # Vitest (판정 로직 경계값, 시드 시나리오, 백업 왕복)
npm run build      # 타입체크 + 프로덕션 빌드 (dist/)
npm run seed       # 12주 시드 시나리오 4종 → seed-out/*.json
```

배포: `main` 에 push 하면 GitHub Actions 가 GitHub Pages 로 배포합니다 (`https://silverylaker-cmyk.github.io/stuttering/`).
저장소 Settings › Pages › Source 를 **GitHub Actions** 로 한 번 설정해야 합니다. 다른 경로에 배포할 땐 `BASE_PATH=/ npm run build`.

## 구조

| 경로 | 내용 |
|---|---|
| `src/config/program.ts` | **모든 임상 수치** (단계 기준, 승급·연계·보정 기준, 스트릭, 설문 주기, DAF 등) |
| `src/lib/logic.ts` | 판정 함수: `pctSS` `spm` `adherence` `streak` `calibrationPass` `promotionSuggested` `referralFlag` `dafResponder` `scoreSurvey` `surveyDue` |
| `src/lib/status.ts` | 전체 테이블 → 화면용 파생 상태 |
| `src/db/` | Dexie 스키마(v1), 녹음 보관 규칙, 백업/복원(json · zip) |
| `src/audio/` | 메트로놈(Web Audio 스케줄러), MediaRecorder, DAF 체인 |
| `public/worklets/pitch-shifter.js` | FAF용 AudioWorklet 그래뉼러 피치 시프터 |
| `src/pages/` | 화면 |
| `src/seed/scenarios.ts` | 시드 시나리오 4종 (호전형·정체형·재발형·보정 실패 후 통과형) |
| `content/` | 문장 90 · 주간 평가 주제 26 · 비도움 사고 12 · 노출 템플릿 10 · DAF 지문 2 · 설문 · 안내 문구, `REVIEW.md` 검수 기록 |
| `public/audio/model/{spm}/{sentenceId}.m4a` | 모델 음성 (녹음 후 추가) |
| `public/video/{key}.mp4` | 기법 설명 영상 (v1.1, 추가 시 자동 표시) |

## 마일스톤 현황

| M | 범위 | 상태 |
|---|---|---|
| M1 | 셋업, PWA, Dexie 스키마, 온보딩, PIN, 홈 | ✅ |
| M2 | 일일 기록, 추세 그래프, 스트릭(주 1회 휴식일) | ✅ |
| M3 | 연장발화 훈련기(하이라이트/메트로놈), 문장 세트, 모델 음성 플레이어 | ✅ 코드 (모델 음성 파일 녹음 필요) |
| M4 | 녹음 + 탭 카운터, 주간 평가 녹음(주 1건), 보정 | ✅ |
| M5 | 노출 사다리 + 사고 기록 | ✅ |
| M6 | 4주 설문, 외래 리포트(인쇄), 승급·연계 플래그 | ✅ |
| M7 | 백업/복원 | ✅ (실기기 QA 필요) |
| M8 | DAF/FAF 반응 테스트 + 반응자용 DAF 도구 | ✅ 코드 (유선 이어폰 실기기 확인 필요) |
| M9 | 말더듬 수정법, 기법 영상 슬롯 | ✅ 코드 (영상·시범 음성 필요) |

## 구현 시 정한 해석 (원장 확인 필요)

- **탭 카운터**: 더듬은 음절은 [말더듬]만 누르고, 이 탭도 음절 수에 포함됩니다(음절당 버튼 하나).
- **기저값**: 기저 SR = 시작 후 14일 일일기록 평균, 기저 %SS = 기저·보정 녹음 평균, 기저 설문 = 첫 설문.
- **기저 녹음 3회 = 보정 녹음 3건** (같은 녹음을 원장이 외래에서 독립 평가).
- **연계 플래그의 probe 비교**: 최근 주간 평가 3건 평균 vs 기저.
- **보정 통과**: 원장이 평가한 *최근* 3건 기준(재시도 시 이전 실패는 제외).
- **스트릭**: 하루 훈련 합계 ≥5분(DAF 제외) 또는 주간 평가 녹음. 오늘 아직 안 했으면 어제부터 셈.
- **DAF 테스트**: 세션 1은 지문 A, 세션 2(다른 날)는 지문 B. 지문 음절 수가 정해져 있으므로 말더듬만 셈. 반응자 판정 시 DAF 도구 자동 활성화(원장이 끌 수 있음).
- **하루 훈련 목표 15분**(홈 체크리스트용)은 브리프에 없어 임의로 정했습니다 → `program.ts`.

데모: 설정 › 데모·초기화에서 시나리오를 불러올 수 있습니다(데모 원장 PIN `0000`).
