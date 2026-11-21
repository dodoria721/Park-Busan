import { NextResponse, type NextRequest } from 'next/server';

// 앱(웹: localhost:8081)에서 API를 부를 수 있도록 CORS를 연다.
// ponytail: 인증·쿠키가 없는 프로토타입이라 기본값 '*'. 배포 시 CORS_ORIGIN으로 앱 출처만 허용.
const CORS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export function proxy(req: NextRequest) {
  if (req.method === 'OPTIONS') return new NextResponse(null, { status: 204, headers: CORS });
  const res = NextResponse.next();
  for (const [k, v] of Object.entries(CORS)) res.headers.set(k, v);
  return res;
}

export const config = { matcher: '/api/:path*' };
