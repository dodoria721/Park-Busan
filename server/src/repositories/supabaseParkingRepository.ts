import { createSupabaseAdminClient } from '@/lib/supabase';
import type { LiveStatus, ParkingLot, ParkingRepository } from '@/types/parking';

interface ParkingLotRow {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  is_public: boolean;
  total_spaces: number | null;
  operating_hours: string | null;
  live_status: LiveStatus;
  fee_policies: Array<{
    base_fee_won: number;
  }> | null;
}

const selection = `
  id,
  name,
  address,
  latitude,
  longitude,
  is_public,
  total_spaces,
  operating_hours,
  live_status,
  fee_policies(base_fee_won)
`;

function toParkingLot(row: ParkingLotRow): ParkingLot {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    isPublic: row.is_public,
    totalSpaces: row.total_spaces ?? 0,
    distanceMeters: 0,
    estimatedFeeWon: row.fee_policies?.[0]?.base_fee_won ?? 0,
    operatingHours: row.operating_hours ?? '확인 필요',
    liveStatus: row.live_status,
  };
}

export class SupabaseParkingRepository implements ParkingRepository {
  private readonly client = createSupabaseAdminClient();

  async findAll(): Promise<ParkingLot[]> {
    const { data, error } = await this.client
      .from('parking_lots')
      .select(selection)
      .order('name');

    if (error) throw new Error(`Failed to load parking lots: ${error.message}`);
    return ((data ?? []) as ParkingLotRow[]).map(toParkingLot);
  }

  async findById(id: string): Promise<ParkingLot | null> {
    const { data, error } = await this.client
      .from('parking_lots')
      .select(selection)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load parking lot: ${error.message}`);
    return data ? toParkingLot(data as ParkingLotRow) : null;
  }
}
