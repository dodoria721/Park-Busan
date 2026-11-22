# ParkBusan 로컬 개발

## 구성

- `mobile/`: Expo SDK 58 공식 앱
- `server/`: Next.js API 서버
- `shared/`: 공통 타입과 도메인 로직

Node.js 22.13 이상을 권장한다.

## 최초 설정

```powershell
npm install
Copy-Item mobile\.env.example mobile\.env
Copy-Item server\.env.example server\.env.local
```

실제 값은 로컬 환경 파일에만 입력한다. `.env`, `.env.local`과 비밀키는 커밋하지 않는다.

## 실행

서로 다른 터미널에서 실행한다.

```powershell
npm run dev:server
npm run dev:app
```

`npm run dev:app`은 유일한 공식 프론트엔드인 `mobile/`을 실행한다.

모바일 공개 환경변수:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_KAKAO_JS_KEY=카카오_JavaScript_키
```

- Android 에뮬레이터에서는 API 호스트로 보통 `10.0.2.2`를 사용한다.
- Expo Go 실기기에서는 PC와 같은 네트워크에 연결하고 PC의 LAN IP를 사용한다.
- 환경변수를 바꾼 뒤 Expo와 서버를 재시작한다.
- REST 키, Admin 키, Supabase Secret Key는 `EXPO_PUBLIC_*`에 넣지 않는다.

## 지도 확인

Web은 Kakao Maps JavaScript SDK를 사용한다. 카카오 개발자 설정에서 개발 주소(기본 `http://localhost:8081`)를 JavaScript SDK 허용 도메인으로 등록한다.

```powershell
npm run web -w mobile
```

Android/iOS는 `react-native-maps`를 사용한다. WebView 지도나 별도 웹 지도 배포 주소는 필요하지 않다. 좌표가 없는 항목은 목록에서는 유지되지만 지도 마커에서는 제외된다.

## 자동 갱신 확인

추천 결과와 상세는 화면 포커스 및 앱 활성 상태에서 60초마다 갱신된다.

- 검색 조건, 목록/지도 전환, 필터, 선택 상태는 갱신 때문에 초기화되지 않는다.
- 앱이 백그라운드로 이동하면 타이머가 멈춘다.
- 복귀 시 한 번 즉시 갱신한다.
- 네트워크 오류가 나면 마지막 정상 결과를 유지한다.
- 실시간 미지원 주차장에는 잔여 면수를 표시하지 않는다.

## 검증

```powershell
npx tsc -p shared/tsconfig.json --noEmit
npx tsc -p server/tsconfig.json --noEmit
npx tsc -p mobile/tsconfig.json --noEmit
npm test
npm run lint
npm run doctor
npm run build -w server
```

번들 검증:

```powershell
npx expo export --platform web --output-dir ..\dist-mobile-web
npx expo export --platform android --output-dir ..\dist-mobile-android
```

실행 중인 서버의 호환 API는 `npm run test:api`로 확인한다.

## 보안

- 서버 비밀값은 `server/.env.local`에서만 관리한다.
- 모바일에는 공개 가능한 API 서버 주소와 Kakao JavaScript 키만 둔다.
- 실제 Supabase 조회 실패는 Mock으로 대체하지 않는다.
- 로컬 검증은 읽기 전용으로 수행하며 DB migration, seed, 배포를 별도 승인 없이 실행하지 않는다.
