import { Redirect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Platform, ScrollView, Text } from 'react-native';
import { ParkingMap } from '@/components/ParkingMap';
import { ParkingSyncStatus } from '@/components/ParkingSyncStatus';
import { useParkingLots } from '@/hooks/useParkingLots';

export default function EmbeddedMapScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { items, loading } = useParkingLots();
  if (Platform.OS !== 'web') return <Redirect href="/map" />;
  if (loading) return <ActivityIndicator />;
  const parking = items.find((item) => item.id === id) ?? (id ? null : items[0]);
  return <ScrollView style={{ flex: 1, backgroundColor: '#f5f8fa' }}><ParkingSyncStatus />{parking ? <ParkingMap parking={parking} /> : <Text>주차장 정보를 찾을 수 없습니다.</Text>}</ScrollView>;
}
