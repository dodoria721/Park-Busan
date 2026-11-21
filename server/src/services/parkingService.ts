import { MockParkingRepository } from '@/repositories/mockParkingRepository';
import { SupabaseParkingRepository } from '@/repositories/supabaseParkingRepository';
import { hasSupabaseEnv } from '@/lib/env';
import type { ParkingRepository } from '@/types/parking';

function createRepository(): ParkingRepository {
  return hasSupabaseEnv() ? new SupabaseParkingRepository() : new MockParkingRepository();
}

export class ParkingService {
  constructor(private readonly repository: ParkingRepository = createRepository()) {}
  list() { return this.repository.findAll(); }
  get(id: string) { return this.repository.findById(id); }
}

export const parkingService = new ParkingService();
