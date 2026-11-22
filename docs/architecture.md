# ParkBusan 아키텍처

## 현재 구조

ParkBusan은 `mobile`, `server`, `shared`를 중심으로 구성된 npm workspace 모노레포다.

- `mobile/`: Expo SDK 58, Expo Router, React Native 기반 공식 프론트엔드
- `server/`: Next.js Route Handler 기반 API 및 Provider 조합
- `shared/`: API 타입, 거리·요금 계산, 추천과 표시 규칙
- `supabase/`: 기존 DB 스키마와 Edge Function 자료

별도 Expo 앱이었던 `app/`은 제거했다. 서버의 호환 API와 Provider는 프론트엔드 통합 대상이 아니므로 유지한다.

## 핵심 데이터 흐름

1. 모바일이 `/api/parse`로 자연어를 구조화한다.
2. `/api/places?q=`에서 목적지 후보를 조회하고 사용자가 하나를 선택한다.
3. `/api/recommend`가 주차장 Provider, 거리·요금 계산, 실시간 Provider를 결합한다.
4. 모바일은 서버가 반환한 순위와 계산값을 그대로 표시한다.
5. `/api/parking-lots/[id]`가 상세, 예상 요금, 실시간 상태를 반환한다.
6. `/api/explain`은 같은 서버 계산 결과에 근거해 설명을 만든다.

프론트엔드는 별도 추천 순위나 요금 계산을 구현하지 않는다. Supabase UUID는 주차장 ID로 유지하며 시설공단 코드는 `liveSourceId`로 분리한다.

## 지도

- Web: `mobile/src/components/ResultMap.web.tsx`가 Kakao Maps JavaScript SDK를 사용한다.
- Android/iOS: `mobile/src/components/ResultMap.tsx`가 `react-native-maps`를 사용한다.
- 좌표가 없는 주차장은 지도 마커에서 제외하되 목록과 상세에서 누락 정보로 표시한다.
- Android/iOS에서 카카오 네이티브 SDK를 사용하는 것으로 가정하지 않는다.
- 제거한 레거시 앱의 WebView 지도는 별도 웹 앱 주소와 `react-native-webview` 의존성이 필요하고 현재 네이티브 지도보다 기능적 이점이 없어 이전하지 않았다.

## 60초 자동 갱신

추천 결과와 상세 화면은 다음 규칙으로 갱신한다.

- 화면이 포커스되고 앱 상태가 `active`일 때만 60초 타이머를 유지한다.
- 백그라운드 또는 화면 이탈 시 타이머와 이벤트 구독을 정리한다.
- 백그라운드에서 복귀하면 한 번 즉시 갱신한다.
- 같은 검색 조건의 진행 중 요청은 중복 실행하지 않는다.
- 검색 조건이나 상세 ID가 바뀐 뒤 도착한 이전 응답은 적용하지 않는다.
- 갱신 실패 시 마지막 정상 결과를 유지하고 비차단 경고만 표시한다.
- 서버 실시간 Provider의 최대 30초 캐시보다 긴 주기를 사용한다.

## Provider 선택과 오류 처리

- 주차장 데이터: Supabase 설정이 있으면 실제 Provider, 없으면 개발용 Mock Provider를 선택한다.
- 실시간 데이터: 설정에 따라 부산시설공단 직접 API 또는 Edge Function Provider를 선택한다.
- 실제 Provider를 선택한 뒤 발생한 인증, RLS, 스키마, 네트워크 오류를 Mock 데이터로 숨기지 않는다.
- 매핑되지 않았거나 실시간 미지원인 주차장에는 가짜 잔여 면수를 만들지 않는다.
- 요금·운영시간·좌표가 없으면 `null` 또는 명확한 정보 없음 상태를 유지한다.

## 환경변수 경계

모바일 공개 변수:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_KAKAO_JS_KEY`

서버 전용 변수는 `server/.env.example`을 기준으로 한다. Supabase Secret Key, 카카오 REST 키, 공공데이터 키, OpenAI 키는 모바일 번들에 포함하지 않는다.

## 유지하는 호환 기능

공식 모바일 앱은 핵심 API 계약을 사용하지만 다음 서버 기능도 유지한다.

- `GET /api/parking`
- `GET /api/parking/[id]`
- Edge Function Live Provider
- 부산시설공단 실시간 API 직접 호출
- 30초 Live Provider 캐시
- Supabase UUID와 시설공단 코드 매핑
- 기존 서버 테스트와 데이터 검증 도구
