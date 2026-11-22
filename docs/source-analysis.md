# 원본 및 레거시 프론트엔드 분석

## SW_Project 참고 범위

초기 구조 설계 당시 `sjun129/SW_Project`의 Expo Router 구성, TypeScript strict 설정, 공용 테마와 컴포넌트 분리 원칙을 참고했다. 여기서 언급하는 `SW_Project/app/`은 참고 저장소의 경로이며 현재 ParkBusan의 로컬 `app/`을 뜻하지 않는다.

ParkBusan에 필요하지 않은 인증, 결제, 리포트, 이미지 분석, Storage·Realtime 기능은 복사하지 않았다. 서버 비밀키를 모바일에 두지 않고 모바일이 Next.js API를 호출하는 구조를 유지했다.

## test 브랜치의 레거시 app 분석

통합 커밋 `5316c4a571e817df8646362a373816744e26c2fb`에 포함된 별도 Expo 앱은 다음 기능을 가지고 있었다.

- `/api/parking` 목록 조회와 프론트엔드 검색·정렬
- Context 기반 목록 공유
- 60초 주기 갱신과 마지막 정상 데이터 유지
- Web Kakao 지도와 네이티브 WebView 지도
- 별도 Repository/Service 및 주차장 타입

## 이전 판단

### mobile로 이전

- 60초 자동 갱신의 유용한 동작
  - 활성 화면에서만 실행
  - 백그라운드 중지 및 복귀 즉시 갱신
  - 중복 요청 방지
  - 이전 응답 경합 방지
  - 실패 시 마지막 정상 결과 유지

이 기능은 기존 `mobile/src/api.ts`와 `/api/recommend`, `/api/parking-lots/[id]` 계약 위에 다시 구현했다.

### 이전하지 않음

- 별도 Repository/Service: 현재 API 모듈과 역할이 중복되고 타입 체계를 이원화한다.
- 클라이언트 추천·요금·거리 정렬: `shared/`와 서버의 책임을 중복하고 서버 API 계약과 충돌한다.
- Mock과 실제 응답 혼용: 연결 실패를 숨길 수 있어 사용하지 않는다.
- WebView 지도: `react-native-maps`보다 기능상 이점이 없고 별도 웹 앱 주소와 의존성이 필요하다.
- 레거시 화면·디자인 시스템: 공식 `mobile/`의 검색, 결과, 지도, 상세 흐름과 중복된다.

## 최종 결정

공식 프론트엔드는 `mobile/` 하나다. 레거시 `app/`은 가치 있는 갱신 동작을 이식한 뒤 제거했으며, 호환을 위해 추가된 서버 API와 Provider는 그대로 유지한다.
