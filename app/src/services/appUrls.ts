import Constants from 'expo-constants';
import { Platform } from 'react-native';

export function getApiUrl(): string | undefined {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configured) return undefined;
  const url = new URL(configured);
  // A phone's localhost is not the development PC.
  if (__DEV__ && ['localhost', '127.0.0.1'].includes(url.hostname)) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') url.hostname = window.location.hostname;
    else {
      const host = Constants.expoConfig?.hostUri;
      if (host) url.hostname = new URL(`http://${host}`).hostname;
    }
  }
  return url.toString().replace(/\/$/, '');
}

export function getMapWebUrl(): string | undefined {
  const configured = process.env.EXPO_PUBLIC_MAP_WEB_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri;
  return __DEV__ && host ? `http://${host}` : undefined;
}
