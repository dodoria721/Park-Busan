import { NextResponse } from 'next/server';
import { parkingService } from '@/src/services/parkingService';
export async function GET() {
  try {
    return NextResponse.json({ data: await parkingService.list() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: '주차 현황을 불러오지 못했습니다. 서버의 Edge Function 연결 설정을 확인하세요.' }, { status: 502 });
  }
}
