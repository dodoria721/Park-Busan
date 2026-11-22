# ParkBusan 아키텍처

## 현재 구현

- Expo Router 화면: 홈(`/`), 검색(`/results`), 지도(`/map`), 상세(`/parking/[id]`), 모바일용 지도 페이지(`/map-embed`).
- `ParkingProvider`가 API 목록을 공유한다. 초기 로드, 앱 활성화, 활성 중 60초 간격, 수동 새로고침에 조회한다. 중복 요청은 합치고 갱신 실패 시 이전 데이터를 유지한다.
- `useParkingSearch`가 이름·공식 도로명/지번 주소 검색과 장소 기준 검색을 구분한다. 역명·근처 표현 또는 문자 일치 없음은 `/api/places`로 기준 장소를 확인한다. `filterParking`은 좌표가 확인된 항목에 Haversine 직선거리 1km 필터를 적용하고 가까운 순 또는 잔여 면수순으로 정렬한다. 검색어·필터·선택 장소 ID는 URL 파라미터로 지도 이동에도 전달한다.
- 상세는 공유 목록의 주차장 코드를 사용하므로 화면 사이에 같은 조회 결과를 표시한다. 다음 갱신 성공 시 모든 화면이 함께 업데이트된다.
- 웹 지도는 공식 위치 정보가 있으면 그 좌표에 마커를 표시한다. 미확인 위치는 Kakao Web SDK의 services로 후보를 검색하며 후보를 확정 위치로 저장하지 않는다.
- 네이티브 지도는 `react-native-webview`로 웹 앱의 `/map-embed`를 연다. JavaScript SDK의 허용 도메인과 휴대폰에서 접근 가능한 웹 앱 주소가 필요하다. 네이티브 Kakao SDK를 추가한 방식은 아니다.

## 데이터 흐름

1. 앱의 `getParkingLots`가 Next.js `/api/parking`을 호출한다.
2. `ParkingService`가 설정에 따라 Repository를 선택한다.
3. 함수 URL이 설정되면 `RealtimeParkingRepository`가 서버의 Publishable key를 `apikey` 헤더에 넣어 Supabase Edge Function을 GET 호출한다.
4. 함수가 공공데이터 API를 호출하고 주차장 코드, 이름, 전체·주차 중·잔여 면수와 갱신 시각을 반환한다.
5. Repository는 앱 모델로 변환한다. `ParkingService`가 부산시설공단 공식 위치 snapshot의 유일한 동일 이름을 매칭해 주소·좌표·검색용 지번·출처·수집 시각을 보강한다. 이름의 숫자·방향은 보존하고 모호한 매칭은 제외한다. 요금·운영 시간은 null을 유지한다. 잔여 면수 0은 만차, null은 확인 불가다.
6. `ParkingProvider`는 성공 응답과 조회 시각을 저장한다. 주변 검색의 거리는 원본 데이터를 수정하지 않고 검색 결과 복사본에 계산한다.

`/api/places`는 서버 전용 REST API 키로 카카오 장소·주소 검색을 호출한다. 역은 지하철 카테고리에서 정확한 역명 일치를 우선하고, 지역·주소는 주소 검색을 먼저 수행한다. 결과는 부산 지역에 한정하고 후보가 여러 개면 앱에서 선택한다. 웹·모바일은 같은 API를 사용하며, 클라이언트는 장소 결과를 10분간 캐시한다. 실패를 좌표 없음이나 검색 결과 없음으로 숨기지 않는다.

위치 snapshot은 `npm run sync:locations`로 공개 공식 목록에서 갱신한다. 좌표 범위·필수 항목·건수를 검증한 뒤 기록하며 불완전한 응답으로 기존 자료를 덮어쓰지 않는다. 2026-11-22 확인 시 위치 50건, 실시간 목록 48개 중 위치 연결 47곳이고 `예비`는 미확인 상태다.

함수 URL이 없을 때 기존 Supabase DB 환경변수가 있으면 DB Repository, 없으면 Mock Repository를 사용한다. 함수 호출 오류를 Mock으로 숨기지 않는다. 앱의 API 주소가 아예 없을 때만 앱 자체 Mock을 사용한다. DB 적재 또는 Supabase Realtime 구독은 수행하지 않는다.

## 설정과 오류 처리

- 서버: `PARKING_REALTIME_URL`, `SUPABASE_PUBLISHABLE_KEY`, `KAKAO_REST_API_KEY`. DB 직접 조회용 Secret key와 OpenAI key도 서버 전용이다.
- 앱: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_KAKAO_MAP_KEY`, 선택적인 `EXPO_PUBLIC_MAP_WEB_URL`.
- 개발 중 localhost API는 Expo 호스트 또는 브라우저의 호스트로 보정해 휴대폰에서 PC 서버에 연결할 수 있게 한다. 배포 시 실제 접근 가능한 URL을 지정한다.
- API는 외부 오류 본문이나 인증 키를 앱에 전달하지 않는다. 화면은 갱신 실패를 표시하며 이전 정보의 조회 시각을 유지한다.
- SDK 로드 실패, 위치 후보 없음, 위치 검색 실패, WebView 로드 실패는 각각 화면에 표시한다.

## 남은 범위와 검증 한계

- 목록은 현재 함수의 첫 페이지 최대 100건이다. 앱 검색과 상세도 반환된 목록에 한정된다.
- 자유로운 자연어 파싱, 요금·시간 조건, 도보·차량 경로 거리, 공공데이터 DB 적재는 미구현이다. 장소 기준 반경과 정렬은 직선거리로 계산한다. 위치 자료 갱신은 명시적인 수집 스크립트로 수행한다.
- 인증, 관리자, 예약·결제, 이미지 분석은 추가하지 않았다.
- SQL 스키마와 예시 seed는 준비되어 있지만 실행하거나 기존 DB를 변경하지 않는다.
- 타입·코드 검사, 검색 로직 테스트, 실제 API 조회, 브라우저 통합 테스트와 Android·iOS·웹 번들 생성으로 검증한다. 네이티브 WebView의 기기별 실행은 별도 실기기 확인이 필요하다.
