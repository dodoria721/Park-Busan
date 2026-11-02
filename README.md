# ParkBusan

부산 공영주차장을 자연어 조건으로 탐색하고 추천 결과를 목록·지도·상세 화면에서 확인하는 서비스의 초기 모노레포입니다.

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

서버 없이 앱만 실행해도 API 요청 실패 시 내장 Mock 데이터로 화면을 확인할 수 있습니다. 실기기에서 로컬 서버를 연결할 때는 `app/.env`의 `EXPO_PUBLIC_API_URL`을 PC의 LAN 주소로 바꾸세요.

## 검증

```bash
npm run typecheck
npm run lint
npm run doctor
npm run test:api
```

`npm run test:api`는 먼저 `npm run dev:server`를 실행한 상태에서 사용합니다.

## 환경변수와 보안

- 앱에는 공개 가능한 `EXPO_PUBLIC_API_URL`만 둡니다.
- `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`는 서버 환경변수로만 관리합니다.
- 실제 `.env`, `.env.local`은 Git에서 제외됩니다.
- 초기 DB 테이블은 RLS를 활성화하고 공개 정책을 만들지 않아 서버 전용 접근을 기본값으로 삼습니다.

자세한 설계와 미구현 범위는 [docs/architecture.md](docs/architecture.md), 원본 분석은 [docs/source-analysis.md](docs/source-analysis.md)를 참고하세요.
