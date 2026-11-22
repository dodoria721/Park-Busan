# 파크부산(ParkBusan) 프로토타입

부산 공영주차장을 목적지·주차 시간·예산으로 추천하는 모바일 앱의 프로토타입입니다.
요구사항은 `docs/SRS.txt`, `docs/SDD.txt`, `docs/개발계획서.txt`를 따릅니다.

> ⚠️ **모든 주차장·목적지·실시간 데이터는 가상(Mock) 데이터입니다.** 실제 주차장 이름·위치·요금·면수와 다릅니다.
> AI도 기본값은 정규식 규칙으로 동작하는 Mock이며, 실제 LLM이 아닙니다.

## 실행 방법

Node 24 기준입니다.

```bash
npm install            # 루트에서 한 번
npm run dev:server     # API 서버 http://localhost:3000
npm run dev:app        # 앱(웹) http://localhost:8081  (Expo, 다른 터미널에서)
npm run typecheck      # shared·server·mobile 타입 검사
npm test               # 요금 계산·추천·마스킹·조건 추출 단위 테스트 (node:test)
```

- 앱이 부를 서버 주소는 `EXPO_PUBLIC_API_URL`로 지정합니다(기본 `http://localhost:3000`, `mobile/.env.example` 참고).
  Android 에뮬레이터는 `http://10.0.2.2:3000`, 실기기는 PC의 LAN IP를 사용합니다.
- 네이티브(Expo Go 등)는 `npm run start -w mobile`로 띄웁니다. 이번 작업에서는 웹만 확인했습니다.
- 실시간 조회 실패(FR-017)를 시연하려면 서버를 `MOCK_LIVE_FAIL=1`로 실행합니다.

### API 예시

```bash
curl localhost:3000/api/health
curl -X POST localhost:3000/api/parse -H "Content-Type: application/json" \
  --data-binary '{"query":"서면역 근처에서 2시간 주차하고 5천 원 이하"}'
curl "localhost:3000/api/places?q=서면"
curl -X POST localhost:3000/api/recommend -H "Content-Type: application/json" \
  -d '{"destination":{"lat":35.1578,"lng":129.06},"durationMinutes":120,"budget":5000}'
curl "localhost:3000/api/parking-lots/sm-01?minutes=120&lat=35.1578&lng=129.06"
curl -X POST localhost:3000/api/explain -H "Content-Type: application/json" \
  -d '{"lotId":"sm-01","destination":{"lat":35.1578,"lng":129.06},"durationMinutes":120,"budget":5000}'
```

Windows Git Bash에서 한글 JSON을 `-d`로 보내면 인코딩이 깨질 수 있습니다. UTF-8 파일을 만들어 `--data-binary @file.json`으로 보내세요.

오류 응답은 모두 `{ "error": { "code": "...", "message": "..." } }` 형식입니다.

| 엔드포인트 | 설명 |
| --- | --- |
| `GET /api/health` | 상태와 사용 중인 Provider(mock/실제) |
| `POST /api/parse` | `{ query, previous? }` → `{ conditions, changed }`. 개인정보 마스킹 → 추출 → 스키마 검증(실패 시 1회 재시도) → 이전 조건과 병합. 실패 시 502 `AI_PARSE_FAILED`(직접 입력 안내) |
| `GET /api/places?q=` | 목적지 후보 목록 |
| `POST /api/recommend` | `{ destination:{lat,lng}, durationMinutes, budget\|null }` → `{ top, all, needsCheck, excluded, liveWarning }` |
| `GET /api/parking-lots/:id` | 상세. `minutes`, `lat`, `lng`를 주면 예상 요금·거리 포함 |
| `POST /api/explain` | `{ lotId, destination, durationMinutes, budget }` → `{ text, fallback }`. 서버가 다시 계산한 값만 근거로 사용 |

## 구조

```
shared/   요청·응답 타입과 순수 도메인 로직 (앱·서버 공용)
  src/fee.ts          Fee Calculator (COMP-07)
  src/recommend.ts    Recommender (COMP-08), 실시간 유효성 판정
  src/geo.ts          haversine 거리
  src/mask.ts         개인정보 마스킹
  src/format.ts       화면 표시 문구("정보 없음", "확인 불가" 등)
server/   Next.js App Router Route Handlers (API 전용, 화면 없음)
  app/api/*           API Controller (COMP-03)
  lib/providers.ts    Provider 인터페이스와 환경 변수 기반 선택
  lib/mock-data.ts    Mock 주차장 20곳·실시간·목적지 (가상 데이터)
  lib/mock-ai.ts      규칙 기반 Mock AIProvider
  lib/real.ts         Supabase·부산시설공단·카카오·OpenAI 구현 자리 (미검증)
  lib/ai.ts           조건 스키마 검증, 재시도, 설명 근거 검사
  lib/http.ts         표준 오류 응답, 타임아웃, 로그
  proxy.ts            CORS
mobile/   Expo(SDK 58) + Expo Router + TypeScript
  src/app/index.tsx       UI-01 메인/질의, 조건 확인·수정, 직접 입력
  src/app/results.tsx     UI-02 목록, UI-03 지도 전환, UI-05 후속 질의
  src/app/lot/[id].tsx    UI-04 상세, 길찾기
  src/components/ResultMap(.web).tsx  네이티브 react-native-maps / 웹 대체 표시
```

### Provider 선택 (NFR-007~008)

`server/.env.example`의 값이 모두 채워진 Provider만 실제 구현으로 바뀌고, 비어 있으면 Mock으로 동작합니다.
실제 구현(`server/lib/real.ts`)은 외부 서비스에 요청해 본 적이 없는 **미검증 코드**입니다. 비밀 키는 서버 환경 변수에만 두고, 앱에는 `EXPO_PUBLIC_API_URL`만 둡니다.

## 요구사항 대응표

| 요구사항 | 구현 위치 |
| --- | --- |
| FR-001 자연어 입력 | `mobile/src/app/index.tsx` |
| FR-002 조건 추출 | `server/app/api/parse`, `server/lib/ai.ts`, `server/lib/mock-ai.ts` |
| FR-003 조건 확인·수정 | `mobile/src/app/index.tsx` (분석 결과를 폼에 채움) |
| FR-004 목적지 검색·선택 | `server/app/api/places`, `mobile/src/ui.tsx` `PlacePicker` |
| FR-005 반경 2km | `shared/src/recommend.ts` (`RADIUS_M`) |
| FR-006 목록 표시 | `mobile/src/app/results.tsx` |
| FR-007 상세 | `server/app/api/parking-lots/[id]`, `mobile/src/app/lot/[id].tsx` |
| FR-008 요금 계산 | `shared/src/fee.ts` |
| FR-009 예산 필터·계산 불가 구분 | `shared/src/recommend.ts` (`needsCheck`) |
| FR-010 실시간 면수·갱신 시각 | `shared/src/recommend.ts` `toLiveView`, `shared/src/format.ts` |
| FR-011 누락 표시 | `shared/src/format.ts`, 상세·목록 화면 |
| FR-012 추천 정렬 | `shared/src/recommend.ts` (거리 → 요금 → ID, 상위 5개) |
| FR-013 추천 이유 | `server/app/api/explain`, `server/lib/ai.ts` `explainWithFallback` |
| FR-014 지도 마커 | `mobile/src/components/ResultMap.tsx`, `ResultMap.web.tsx` |
| FR-015 길찾기 | `mobile/src/app/lot/[id].tsx` (카카오맵 앱 → 웹 URL) |
| FR-016 결과 없음 | `mobile/src/app/results.tsx` |
| FR-017 실시간 API 오류 | `server/lib/providers.ts` `fetchLive`(1.5초 제한), `liveWarning` |
| FR-018 AI 오류 → 직접 입력 | `server/app/api/parse`, `mobile/src/app/index.tsx` |
| FR-019 후속 질의 | `server/app/api/parse`(`previous` 병합), `mobile/src/app/results.tsx` |
| NFR-004 키 비노출 | 서버 환경 변수, `.env.example`만 제공 |
| NFR-005 3탭 이내 | 결과 카드 1탭 → 상세 |
| NFR-007~008 Provider 분리 | `server/lib/providers.ts` |
| AI-REQ-01 근거 기반 설명 | `server/lib/ai.ts` `isGrounded`(사실에 없는 숫자가 있으면 정형 문구) |
| AI-REQ-03 마스킹 | `shared/src/mask.ts`, `extractWithRetry`에서 AI 호출 전 적용 |
| AI-REQ-05 다단계 파이프라인 | parse → places → recommend → explain 분리 |
| AI-REQ-07 스키마 검증·1회 재시도 | `server/lib/ai.ts` `validateConditions`, `extractWithRetry` |

테스트: `shared/src/*.test.ts`(요금·추천 경계값, 마스킹), `server/lib/ai.test.ts`(조건 추출, 재시도, 근거 검사).

## Mock 데이터에 넣은 예외 사례

`server/lib/mock-data.ts`에 서면 8곳, 남포동 6곳, 해운대 6곳이 있습니다.

- 요금 누락(`sm-04`, `np-06`, `hd-06`), 추가요금 누락(`np-04`), 무료(`sm-06`, `hd-05`)
- 실시간 미제공(`sm-03`, `sm-06`, `np-03`, `np-06`, `hd-03`), 응답 누락 → 확인 불가(`hd-06`)
- 유효한 만차(`sm-02`, `hd-02`), 5분 넘은 정보(`sm-05`, `np-05`), 갱신 시각 없음(`sm-07`)
- 반경 밖(`sm-08`, 서면역 기준), 주변 주차장이 없는 목적지(`태종대`)
- 목적지 후보가 2개인 질의: `서면`, `해운대`

## 범위 제외

- 안내판 이미지 해석(VLM/OCR)
- 관리자 화면·인증
- 실제 데이터 적재 스크립트(COMP-12)
- 예약·결제
- APK 빌드, 서버·앱 배포
- 실시간 조회 TTL 30초 캐시(코드에 `ponytail:` 주석으로 표시)
- 실제 외부 API 연동 검증(Supabase·부산시설공단·카카오·OpenAI 코드는 미검증)

## ?? ?? ?? (2026-11-22)

GitHub main? `mobile`?`shared`?`server` ??? ?? ?? `app`? ?? ?????.

- `npm run dev:app`: main? ? `mobile` ? ?
- `npm run dev:legacy-app`: ?? ?? `app` (?? ??, ??? ?? ??, ??? ??)
- `npm run dev:server`: ? ?? ?? ???? ?? (3000? ??)
- `npm test`, `npm run test:search`, `npm run typecheck`, `npm run lint`: ?? ??
- `npm run test:api`: ?? ?? ??? ?? ?? API ??

?? `/api/parking`, `/api/parking/:id`? ????, `/api/places`? ? ?? `q`? ?? ?? `query`? ?? ?????.
`/api/health`? ? Provider ??? ?? ?? API? `dataSource`? ?? ?????.
? ?? API? ??? ??? Provider? ????, `/api/parking-lots`? ??? ?? `/api/parking`? Edge Function ??? ?? ?????.
?? ?? ?? ??? [?? ?? ??](docs/local-development.md), [?? ??](docs/architecture.md)? ?????.
?? ?? ? ?? ??? ??? ??? ?? ?? Expo ??? ?????.
