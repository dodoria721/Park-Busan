import { MockParkingRepository } from '@/src/repositories/mockParkingRepository';
import { SupabaseParkingRepository } from '@/src/repositories/supabaseParkingRepository';
import { getParkingDataSource } from '@/src/lib/env';
import { RealtimeParkingRepository } from '@/src/repositories/realtimeParkingRepository';
import type { ParkingRepository } from '@/src/types/parking';
import { enrichParkingLocation } from './parkingLocations';

function createRepository(): ParkingRepository {
  const source = getParkingDataSource();
  if (source === 'edge-function') return new RealtimeParkingRepository();
  return source === 'supabase' ? new SupabaseParkingRepository() : new MockParkingRepository();
}

export class ParkingService {
  constructor(private readonly repository: ParkingRepository = createRepository()) {}
  async list() { return (await this.repository.findAll()).map(enrichParkingLocation); }
  async get(id: string) { const parking = await this.repository.findById(id); return parking ? enrichParkingLocation(parking) : null; }
}

export const parkingService = new ParkingService();
