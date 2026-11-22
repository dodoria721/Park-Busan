# ParkBusan

부산 주차장의 실시간 현황을 검색하고 목록·카카오 지도·상세 화면에서 확인하는 Expo 앱과 API 서버입니다. Supabase Edge Function으로 공공데이터를 조회합니다.

## 구성

- `app/`: Expo SDK 58 + Expo Router 모바일 앱
- `server/`: Next.js Route Handlers 기반 API
- `supabase/`: PostgreSQL 스키마 및 로컬 확인용 시드
- `scripts/`: 향후 공공데이터 적재 도구
- `docs/`: 원본 분석 및 아키텍처 결정 기록

## 시작하기

Node.js 22.13 이상을 권장합니다.

```bash
npm install
copy app\.env.example app\.env
copy server\.env.example server\.env.local
npm run dev:server
npm run dev:app
```

`app/.env`에 API 주소가 없을 때만 내장 Mock 데이터를 사용합니다. API 요청 실패 시 오류를 표시하며, 이전 조회가 성공했다면 마지막 데이터를 유지합니다. 실기기에서는 PC와 같은 네트워크에 연결합니다. 개발 중 localhost로 설정된 API 주소는 Expo의 개발 서버 호스트로 자동 보정하며, 실제 배포 시 접근 가능한 API 주소를 명시해야 합니다.

## 앱에서 할 수 있는 일

- 홈에서 조회된 주차장과 주차 가능한 곳의 수를 확인하고 이름·지역명으로 검색합니다.
- 이름·지역명은 공식 주소와 지번 정보까지 검색합니다. `범일역 근처 주차장`처럼 역이나 장소를 기준으로 찾으면 카카오에서 기준 좌표를 확인하고 반경 1km 내 주차장을 직선거리순으로 표시합니다. 주차 가능 필터와 잔여 면수순 정렬도 사용할 수 있습니다.
- 목록의 검색·필터·정렬을 지도 화면에도 유지합니다. 상세에서 지도로 이동하면 선택한 주차장을 그대로 엽니다.
- 상세에서 전체·주차 중·잔여 면수와 갱신 시각, 공식 주소·좌표로 표시한 지도를 확인합니다. 공식 좌표가 없는 항목은 위치 후보를 따로 검색합니다.
- 홈·목록·상세·지도는 `ParkingProvider`의 데이터를 공유합니다. 앱이 활성 상태일 때 60초마다 새로 조회하고, 직접 새로고침할 수도 있습니다. 이는 주기적 API 조회이며 Supabase Realtime 구독은 아닙니다.
- 갱신 실패 시 오류와 마지막 조회 시각을 표시하고 기존 정보를 유지합니다. 최초 조회 실패 시 샘플 데이터로 대체하지 않습니다.

자유로운 자연어 해석, 예산·시간별 요금 계산, 도보·차량 경로 거리, 예약·결제는 구현 범위에 포함되지 않습니다. 주변 검색의 거리는 직선거리이며, 장소가 여러 개면 사용자가 기준 장소를 선택합니다.

## 주차 현황 Edge Function 연결

앱 → 로컬 Next.js API → Supabase `parking-realtime` → 공공데이터 API 순서로 조회합니다. DB 테이블이나 마이그레이션을 실행할 필요가 없습니다.

`server/.env.local`에 다음 값을 설정합니다.

```dotenv
PARKING_REALTIME_URL=https://zgwkzhymtamvnedfqrio.supabase.co/functions/v1/parking-realtime
SUPABASE_PUBLISHABLE_KEY=여기에_default_Publishable_key_입력
```

함수는 `withSupabase({ auth: ["publishable", "secret"] })`로 `apikey` 헤더를 검증합니다. 새 Publishable key를 사용하는 이 방식은 함수의 플랫폼 `Verify JWT`가 꺼져 있어야 합니다. 인증은 함수의 `withSupabase`가 담당합니다. [Supabase 인증 문서](https://supabase.com/docs/guides/functions/auth)를 참고하세요. `DATA_GO_KR_API_KEY`는 Supabase 함수의 Secrets에 유지합니다.

PC 웹에서 확인할 때는 `app/.env`에 `EXPO_PUBLIC_API_URL=http://localhost:3000`을 설정합니다. 휴대폰 Expo Go에서는 localhost 대신 PC의 LAN IP를 사용하고 같은 네트워크에 연결합니다. 환경변수를 바꾼 뒤 서버와 Expo를 재시작하세요.

`npm run dev:server` 실행 후 `npm run test:api`로 실제 목록과 첫 주차장 코드의 상세 조회를 확인할 수 있습니다. `/api/health`의 `dataSource: "edge-function"`은 설정된 데이터 소스만 의미하며 실제 연결 성공은 목록 조회로 확인합니다. 이후 `npm run dev:app`으로 앱을 실행합니다.

목록·상세·지도는 공유된 목록 응답을 사용합니다. 함수가 반환하는 주차장 코드, 이름, 전체·주차 중·잔여 면수와 갱신 시각을 표시합니다. 주소·좌표는 부산시설공단 공식 위치 자료와 유일한 동일 이름으로 매칭해 보강합니다. 요금·운영 시간은 임의로 채우지 않습니다. 함수의 목록 응답은 현재 첫 페이지 최대 100건이므로 검색·상세도 이 목록으로 제한됩니다. 서버의 단건 API는 별도로 `?code=주차장코드`로 함수를 호출합니다.

## 지역·주변 검색 설정

`server/.env.local`에 `KAKAO_REST_API_KEY=카카오_REST_API_키`를 설정합니다. JavaScript 키와 다른 키이며 서버에만 보관합니다. 호출 허용 IP를 제한했다면 API 서버의 공인 송신 IP를 등록합니다. `/api/places?query=범일역`이 정상 응답하는지 확인할 수 있습니다.

이름·주소 일치 검색과 장소 기반 검색을 구분합니다. `범일`은 공식 주소의 `범일로`와 일치하고, `범일역`·`범일역 근처 주차장`은 실제 역 좌표를 조회해 공식 주차장 좌표와 거리를 계산합니다. 이름이 유사한 역보다 정확한 역명을 우선하며, 불명확한 여러 장소 중 하나를 임의 선택하지 않습니다. 좌표 미확인 항목은 주변 검색에서 제외하고 개수를 표시합니다. 장소 조회 실패는 오류로 표시하고 재시도할 수 있습니다. 기준 장소 선택과 필터는 지도 화면으로 전달됩니다.

위치 자료는 `server/src/data/parking-locations.json`에 출처 URL과 수집 시각을 함께 저장합니다. [부산시설공단 공식 목록](https://bsparking.bisco.or.kr/api/parking/realtime/list)에서 2026-11-22 기준 유효 좌표 50건을 확인했고, 현재 실시간 48개 항목 중 47곳과 연결됩니다. 나머지 `예비` 항목에는 좌표를 만들지 않습니다. 위치 자료 갱신은 `npm run sync:locations`로 수행합니다. 실시간 잔여 면수는 계속 Supabase 함수에서 조회합니다.

`PARKING_REALTIME_URL`이 있으면 Edge Function을 우선 사용하고, 없으면 기존 Supabase DB 설정, 그마저 없으면 서버 Mock 데이터를 사용합니다. Edge Function 호출 실패 시 Mock으로 대체하지 않습니다.

## 검증

### 카카오 지도와 모바일 앱

`app/.env`에 `EXPO_PUBLIC_KAKAO_MAP_KEY=카카오_JavaScript_키`를 추가하고 Expo를 재시작합니다. 카카오 개발자 앱에서 카카오맵 사용을 설정하고 해당 키의 JavaScript SDK 도메인에 `http://localhost:8081`을 등록합니다. REST API 키나 Admin 키를 넣지 않습니다. 설정 방법은 [카카오 지도 가이드](https://apis.map.kakao.com/web/guide/)를 참고하세요.

```bash
npm run start --workspace @park-busan/app -- --web --port 8081
```

`http://localhost:8081/map`에서 실제 카카오 지도와 주차 현황 목록을 확인합니다. 주차장 이름을 누르면 공식 좌표의 마커를 표시합니다. 검색어를 직접 수정해 다른 위치 후보를 찾아 지도를 이동하거나 카카오맵을 열 수도 있습니다. `상세 보기`는 해당 주차장의 실시간 현황 화면으로 이동합니다.

공식 위치 정보는 동일 이름이 유일한 경우에만 연결합니다. 카카오 장소 검색으로 찾은 대체 후보를 검증 없이 주차장 위치로 저장하지 않습니다.

Android·iOS 앱에서는 `react-native-webview`로 웹 앱의 `/map-embed?id=주차장코드`를 표시합니다. Expo 개발 중에는 Expo 서버 주소를 자동 사용합니다. 휴대폰에서 접근하는 **PC의 LAN 주소와 포트**(예: `http://192.168.0.142:8081`)도 카카오 JavaScript SDK 도메인에 등록해야 합니다. localhost 등록만으로는 다른 도메인의 지도를 허용하지 않습니다.

직접 주소를 지정하거나 배포할 때는 `app/.env`에 다음 설정을 추가합니다.

```dotenv
EXPO_PUBLIC_API_URL=https://접근가능한_API_서버
EXPO_PUBLIC_MAP_WEB_URL=https://배포한_웹_앱
```

모바일 지도는 웹 앱도 실행 또는 배포되어 있어야 동작합니다. 배포 시 HTTPS 주소를 사용하고 카카오 도메인에도 등록합니다. 지도 로드 실패 시 앱 안에서 다시 시도할 수 있습니다. `카카오맵에서 보기`는 외부 카카오맵을 엽니다.

### 기본 검사

```bash
npm run typecheck
npm run lint
npm run doctor
npm run test:api
npm run test:search
```

`npm run test:api`는 먼저 `npm run dev:server`를 실행한 상태에서 사용합니다.

## 환경변수와 보안

- 앱에는 공개 가능한 API URL, 지도 웹 URL, 카카오 JavaScript 키만 둡니다.
- `OPENAI_API_KEY`, `SUPABASE_SECRET_KEY`, `KAKAO_REST_API_KEY`는 서버 환경변수로만 관리합니다.
- Supabase 프로젝트 URL과 Secret Key는 Vercel의 서버 환경변수로 설정합니다.
- 실제 `.env`, `.env.local`은 Git에서 제외됩니다.
- 초기 DB 테이블은 RLS를 활성화하고 공개 정책을 만들지 않아 서버 전용 접근을 기본값으로 삼습니다.

자세한 설계와 미구현 범위는 [docs/architecture.md](docs/architecture.md), 원본 분석은 [docs/source-analysis.md](docs/source-analysis.md)를 참고하세요.
