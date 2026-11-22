# SW_Project 분석

분석 기준: `sjun129/SW_Project` 공개 저장소의 `main` 브랜치, 2026-11-02 확인. 원본은 임시 폴더에 복제해 읽기만 했으며 수정하지 않았다. 로컬 작업 공간에는 별도의 SRS/SDD/개발계획서가 없어서 사용자가 제공한 요청문을 확정 범위로 사용했다.

## 실제 구조와 기술

- `app/`: Expo 앱. `src/app/` 아래 Expo Router 화면, `src/ui.tsx`, `src/theme.ts`, `src/store.tsx`, `src/lib/*`로 구성된다.
- `supabase/migrations/`: 임대차, 사진, 리포트, 결제 방어, 실시간 이벤트 관련 마이그레이션이 있다.
- `supabase/functions/vision/`: OpenAI 기반 이미지 분석 Edge Function이 있다.
- `assets/`, `design-refs/`, `logo/`: 기존 서비스 전용 브랜드/화면 자료다.
- Expo SDK 58 (`expo ^58.0.22`), React Native 0.88.1, React 19.3.0, Expo Router 58, TypeScript 6 strict mode를 사용한다.
- `main: expo-router/entry`, `src/app/_layout.tsx`의 `Stack`, `(tabs)/_layout.tsx`의 `Tabs`를 사용한다.
- 앱의 `src/lib/supabase.ts`가 `EXPO_PUBLIC_SUPABASE_URL`과 publishable key로 Supabase 클라이언트를 생성한다. 서버 비밀은 Edge Function 시크릿으로 관리한다.
- 공통 디자인은 `src/theme.ts`, UI는 `src/ui.tsx`, 상태/데모 전환은 `src/store.tsx`에 집중되어 있다.

## 재사용 판단

### 그대로 재사용 가능한 원칙

- `app/tsconfig.json`: `expo/tsconfig.base`, strict 모드, `@/*` 경로 별칭 패턴.
- `app/package.json`: SDK 58에 맞춘 Expo/React/React Native 핵심 버전 조합.
- `app/src/app/_layout.tsx`: Expo Router Stack 기반 화면 구성 방식.
- 공개 앱 환경변수에는 `EXPO_PUBLIC_*`만 사용하고 서버 키를 앱에 두지 않는 원칙.

코드를 복사하기보다 위 설정과 패턴만 ParkBusan 이름/폴더에 맞게 다시 작성했다.

### 일부 수정 후 재사용

- `app/app.json`: Router 플러그인과 managed workflow 설정은 유지하되 기존 브랜드, 카메라, 이미지 선택 권한과 플러그인은 제거했다.
- `app/src/theme.ts`, `app/src/ui.tsx`: StyleSheet 기반 토큰/공통 컴포넌트 접근은 유지하되 ParkBusan 색상과 작은 책임별 컴포넌트로 분리했다.
- `app/src/lib/supabase.ts`: 환경변수 방식은 참고했지만 초기 앱이 DB에 직접 접근하지 않고 API 서버를 호출하도록 변경했다.

### ParkBusan에 필요하지 않음

- 로그인/임대차/촬영/하자 태깅/임대인 확인/리포트/PDF/결제/알림 화면과 상태 관리.
- 카메라, 이미지 선택, 파일 시스템, 알림, 출력, 공유, 암호화, AsyncStorage, 앱 내 Supabase 클라이언트 의존성.
- 기존 `supabase` 임대차 스키마, Storage, Realtime, vision Edge Function.
- 기존 브랜드 이미지, 폰트, 디자인 참조 자료와 HTML 프로토타입.

### 새로 필요한 구조

- 주차장 검색/결과/지도/상세/후속 조건 UI.
- API Controller, 주차장 Repository 인터페이스와 서비스 계층.
- 자연어 파서, 지오코딩/거리, 요금 계산, 추천, 실시간 공급자, 설명 AI를 위한 교체 가능한 서비스 경계.
- 주차장/요금/원천 매핑/적재 실행 DB 테이블과 데이터 적재 도구.

## 호환성 판단

Expo SDK 58은 React Native 0.88, React 19.3, 최소 Node 22.13을 대상으로 한다. 원본의 최신 핵심 버전 조합을 채택하되, 초기 범위에 필요 없는 네이티브 모듈은 설치하지 않았다. 지도 라이브러리는 Expo Go 58 실기기 검증 전까지 도입하지 않고 좌표 기반 골격으로 남겼다.
