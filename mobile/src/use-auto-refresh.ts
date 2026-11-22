import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createActiveRefreshTimer } from './refresh';

/**
 * Starts a 60-second refresh only while the screen is focused and the app is
 * active. Returning from the background triggers one immediate refresh.
 */
export function useAutoRefresh(refresh: () => Promise<unknown>, intervalMs = 60_000) {
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      let previous = AppState.currentState;
      const timer = createActiveRefreshTimer(() => refreshRef.current(), intervalMs);
      timer.setActive(previous === 'active');

      const subscription = AppState.addEventListener('change', (state) => {
        const resumed = state === 'active' && previous !== 'active';
        previous = state;
        timer.setActive(state === 'active', resumed);
      });

      return () => {
        subscription.remove();
        timer.dispose();
      };
    }, [intervalMs]),
  );
}
