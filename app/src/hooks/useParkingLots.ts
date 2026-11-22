import { useParkingData } from '@/state/ParkingProvider';

export function useParkingLots() {
  const data = useParkingData();
  return { ...data, loading: data.updatedAt === null && data.refreshing, retry: data.refresh };
}
