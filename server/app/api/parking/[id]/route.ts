import { NextResponse } from 'next/server';
import { parkingService } from '@/src/services/parkingService';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parking = await parkingService.get(id);
    return parking
      ? NextResponse.json({ data: parking }, { headers: { 'Cache-Control': 'no-store' } })
      : NextResponse.json({ error: 'Parking lot not found' }, { status: 404 });
  } catch {
    return NextResponse.json({ error: '주차장 정보를 불러오지 못했습니다. 서버의 Edge Function 연결 설정을 확인하세요.' }, { status: 502 });
  }
}
