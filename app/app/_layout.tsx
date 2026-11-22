import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ParkingProvider } from '@/state/ParkingProvider';

export default function RootLayout() {
  return (
    <ParkingProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: '#0b4f6c', contentStyle: { backgroundColor: '#f5f8fa' } }}>
        <Stack.Screen name="index" options={{ title: 'ParkBusan', headerShown: false }} />
        <Stack.Screen name="results" options={{ title: '주차장 검색' }} />
        <Stack.Screen name="map" options={{ title: '지도에서 보기' }} />
        <Stack.Screen name="parking/[id]" options={{ title: '주차장 상세' }} />
        <Stack.Screen name="map-embed" options={{ headerShown: false }} />
      </Stack>
    </ParkingProvider>
  );
}
