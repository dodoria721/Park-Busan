import { mockParkingLots } from '@/constants/mockParking';
import type { ParkingLot } from '@/types/parking';
const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
export async function getParkingLots(): Promise<ParkingLot[]> {
  if (!API_URL) return mockParkingLots;
  try {
    const response = await fetch(`${API_URL}/api/parking`);
    if (!response.ok) throw new Error(`Parking API responded ${response.status}`);
    const body = (await response.json()) as { data: ParkingLot[] };
    return body.data;
  } catch (error) {
    console.warn('Parking API unavailable; using mock data.', error);
    return mockParkingLots;
  }
}
