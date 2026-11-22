import { mockParkingLots } from '@/constants/mockParking';
import type { ParkingLot } from '@/types/parking';
import { getApiUrl } from './appUrls';
const API_URL = getApiUrl();
export async function getParkingLots(): Promise<ParkingLot[]> {
  if (!API_URL) return mockParkingLots;
  try {
    const response = await fetch(`${API_URL}/api/parking`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Parking API responded ${response.status}`);
    const body = (await response.json()) as { data: ParkingLot[] };
    return body.data;
  } catch {
    throw new Error('주차 현황을 불러오지 못했습니다. API 주소와 서버 연결을 확인해 주세요.');
  }
}

export async function getParkingLot(id: string): Promise<ParkingLot | null> {
  if (!API_URL) return mockParkingLots.find((parking) => parking.id === id) ?? null;
  try {
    const response = await fetch(`${API_URL}/api/parking/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(20000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Parking API responded ${response.status}`);
    const body = await response.json() as { data: ParkingLot };
    return body.data;
  } catch {
    throw new Error('주차장 정보를 불러오지 못했습니다. API 주소와 서버 연결을 확인해 주세요.');
  }
}
