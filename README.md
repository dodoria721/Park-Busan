# ParkBusan

부산 공영주차장을 목적지, 주차 시간, 예산에 따라 추천하는 npm workspace 모노레포입니다.

## 프로젝트 구조

```text
mobile/   Expo SDK 58 + Expo Router 공식 프론트엔드
server/   Next.js Route Handler 기반 API 서버
shared/   모바일과 서버가 공유하는 타입·요금·거리·추천 로직
docs/     요구사항, 설계 및 개발 문서
supabase/ DB 스키마와 Edge Function 자료
scripts/  데이터 검증 및 운영 보조 도구
```

프론트엔드는 `mobile/` 하나만 사용합니다. 과거 `test` 브랜치의 별도 Expo 앱이었던 `app/`은 기능 검토 후 제거했습니다.

## 실행

Node.js 22.13 이상을 권장합니다.

```bash
npm install
copy mobile\.env.example mobile\.env
copy server\.env.example server\.env.local
npm run dev:server
npm run dev:app
```

- 웹에서 서버는 기본 `http://localhost:3000`, Expo는 `http://localhost:8081`을 사용합니다.
- Android 에뮬레이터의 서버 주소는 일반적으로 `http://10.0.2.2:3000`입니다.
- 실기기는 PC와 같은 네트워크에 연결하고 `EXPO_PUBLIC_API_URL`에 PC의 LAN 주소를 설정합니다.
- 서버 비밀키는 `server/.env.local`에만 두며 모바일의 `EXPO_PUBLIC_*` 변수에 넣지 않습니다.

## 주요 API 계약

| 경로 | 역할 |
| --- | --- |
| `GET /api/health` | 활성 Provider 상태 확인 |
| `POST /api/parse` | 자연어 검색 조건 추출 및 후속 조건 병합 |
| `GET /api/places?q=` | 카카오 장소 후보 검색 |
| `POST /api/recommend` | 거리·요금·실시간 상태 기반 추천 |
| `GET /api/parking-lots/[id]` | 주차장 상세, 예상 요금, 실시간 상태 |
| `POST /api/explain` | 서버 계산 결과에 근거한 추천 설명 |

통합 과정에서 추가된 `GET /api/parking`, `GET /api/parking/[id]` 및 Edge Function 경로도 호환 목적으로 서버에 유지합니다. 공식 모바일 앱은 위 핵심 계약을 사용합니다.

## 프론트엔드 동작

- 자연어 검색, 조건 확인·수정, 목적지 선택, 추천 목록, 지도, 상세, 후속 검색을 제공합니다.
- Web 지도는 `ResultMap.web.tsx`와 Kakao Maps JavaScript SDK를 사용합니다.
- Android/iOS 지도는 `ResultMap.tsx`와 `react-native-maps`를 사용합니다.
- 추천 결과와 상세 정보는 화면이 보이고 앱이 활성 상태일 때만 60초마다 갱신합니다.
- 갱신 중 기존 결과와 검색·필터·지도 선택 상태를 유지합니다. 실패 시 마지막 정상 결과를 보존합니다.
- 동일 요청은 합치고, 검색 조건이 바뀐 뒤 도착한 이전 응답은 적용하지 않습니다.
- 실시간 정보가 없거나 매핑되지 않은 주차장에는 잔여 면수를 생성하지 않습니다.

## Provider와 데이터 안전성

- Supabase, 부산시설공단 실시간 API, 카카오 REST API 설정은 서버 전용입니다.
- 실제 Provider가 선택된 뒤 조회가 실패해도 Mock으로 자동 전환하지 않습니다.
- `ParkingLot.id`는 Supabase UUID를 유지하며 시설공단 코드는 별도 `liveSourceId`로 연결합니다.
- 실시간 Provider 응답은 서버에서 최대 30초 캐시됩니다. 모바일의 60초 갱신 주기는 이 캐시보다 길게 유지합니다.
- 누락된 요금, 좌표, 실시간 값은 임의로 만들지 않습니다.

## 검증 명령

```bash
npm run typecheck
npm test
npm run lint
npm run doctor
npm run build -w server
```

실행 중인 로컬 서버의 호환 API 점검은 `npm run test:api`로 수행할 수 있습니다.

상세 안내는 [로컬 개발](docs/local-development.md), [아키텍처](docs/architecture.md), [원본 분석](docs/source-analysis.md)을 참고하세요.
