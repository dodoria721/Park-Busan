export type LiveStatus = 'available' | 'full' | 'unknown';
export interface ParkingLot { id: string; name: string; address: string; latitude: number; longitude: number; isPublic: boolean; totalSpaces: number; distanceMeters: number; estimatedFeeWon: number; operatingHours: string; liveStatus: LiveStatus; }
