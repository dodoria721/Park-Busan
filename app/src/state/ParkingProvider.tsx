import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { getParkingLots } from '@/services/parkingApi';
import type { ParkingLot } from '@/types/parking';

interface ParkingState {
  items: ParkingLot[];
  refreshing: boolean;
  error: string | null;
  updatedAt: string | null;
}
interface ParkingContextValue extends ParkingState { refresh: () => Promise<void>; }
const ParkingContext = createContext<ParkingContextValue | null>(null);

export function ParkingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ParkingState>({ items: [], refreshing: true, error: null, updatedAt: null });
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(false);
  const refresh = useCallback((): Promise<void> => {
    if (inFlight.current) return inFlight.current;
    const task = Promise.resolve().then(async () => {
      if (!mounted.current) return;
      setState((previous) => ({ ...previous, refreshing: true }));
      try {
        const items = await getParkingLots();
        if (mounted.current) setState({ items, refreshing: false, error: null, updatedAt: new Date().toISOString() });
      } catch (reason) {
        if (mounted.current) setState((previous) => ({ ...previous, refreshing: false, error: reason instanceof Error ? reason.message : '주차 현황을 불러오지 못했습니다.' }));
      } finally { inFlight.current = null; }
    });
    inFlight.current = task;
    return task;
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') void refresh(); }, 60000);
    const subscription = AppState.addEventListener('change', (status) => { if (status === 'active') void refresh(); });
    return () => { mounted.current = false; clearInterval(timer); subscription.remove(); };
  }, [refresh]);
  return <ParkingContext.Provider value={{ ...state, refresh }}>{children}</ParkingContext.Provider>;
}

export function useParkingData() {
  const context = useContext(ParkingContext);
  if (!context) throw new Error('ParkingProvider is required');
  return context;
}
