import { MockParkingRepository } from '@/repositories/mockParkingRepository';
import type { ParkingRepository } from '@/types/parking';
export class ParkingService { constructor(private readonly repository: ParkingRepository = new MockParkingRepository()) {} list() { return this.repository.findAll(); } get(id: string) { return this.repository.findById(id); } }
export const parkingService = new ParkingService();
