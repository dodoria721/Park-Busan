# 초기 아키텍처

## 책임 경계

- Search UI: `app/app/index.tsx`, `app/src/components/SearchForm.tsx`
- Result & Map UI: `app/app/results.tsx`, `app/app/map.tsx`, `ParkingCard.tsx`
- Follow-up UI: `FollowUpInput.tsx`; 현재 문자열 유지/변경만 제공하며 AI 파싱은 후속 작업이다.
- API Controller: `server/src/app/api/**/route.ts`
- Parking Repository: `server/src/types/parking.ts` 인터페이스와 `MockParkingRepository`; 이후 Supabase 구현으로 교체한다.
- Service boundary: `ParkingService`; Geo/Fee/Recommender/Live Provider를 여기에 조합할 수 있다.
- AI Parser / Explanation AI: 실제 호출을 구현하지 않는다. 서버 전용 `OPENAI_API_KEY` 환경변수 자리만 제공한다.
- Error & Log: 현재 HTTP 상태와 콘솔 경고만 사용한다. 공통 구조화 로깅은 배포 플랫폼 확정 후 추가한다.
- Data Import Utility: `scripts/` 계약과 `import_runs`, `source_mappings` 테이블을 준비했다.

## 데이터 흐름

1. 사용자가 자연어 조건을 입력한다.
2. 앱은 결과 화면으로 조건을 전달하고 API를 호출한다.
3. API 미설정/실패 시 앱의 Mock 데이터로 화면을 계속 확인한다.
4. 서버 API는 Repository 인터페이스를 통해 Mock 데이터를 반환한다.
5. Supabase 연결 단계에서 Repository만 교체하며 서비스/API 응답 형태는 유지한다.

## 의도적인 제한

- 지도 화면은 실제 지도 SDK 대신 좌표와 연동 지점을 표시한다.
- 거리/요금/가용 상태는 예시 값이며 추천 알고리즘을 의미하지 않는다.
- 앱에서 Supabase에 직접 접근하지 않는다. 네 테이블은 RLS를 켜고 공개 정책을 만들지 않았다.
- 인증, 관리자, 예약/결제, 이미지 분석은 구조와 의존성 모두 추가하지 않았다.
