import type { ParkingLot, ParkingRepository } from '@/src/types/parking';
const data: ParkingLot[] = [
  { id: 'busan-station-1', name: '부산역 선상 공영주차장', address: '부산광역시 동구 중앙대로 206', latitude: 35.1152, longitude: 129.0414, isPublic: true, totalSpaces: 500, distanceMeters: 240, estimatedFeeWon: 4500, operatingHours: '24시간', liveStatus: 'available' },
  { id: 'choryang-1', name: '초량 공영주차장', address: '부산광역시 동구 초량동', latitude: 35.1191, longitude: 129.0384, isPublic: true, totalSpaces: 82, distanceMeters: 620, estimatedFeeWon: 3000, operatingHours: '06:00–23:00', liveStatus: 'unknown' },
  { id: 'inatown-1', name: '이나라 공영주차장', address: '부산광역시 동구 대영로', latitude: 35.1128, longitude: 129.0388, isPublic: true, totalSpaces: 110, distanceMeters: 880, estimatedFeeWon: 4000, operatingHours: '24시간', liveStatus: 'available' }
];
export class MockParkingRepository implements ParkingRepository { async findAll() { return data; } async findById(id: string) { return data.find((item) => item.id === id) ?? null; } }
