import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { FollowUpInput } from '@/components/FollowUpInput';
import { ParkingCard } from '@/components/ParkingCard';
import { colors } from '@/constants/theme';
import { getParkingLots } from '@/services/parkingApi';
import type { ParkingLot } from '@/types/parking';

export default function ResultsScreen() {
  const { query = '' } = useLocalSearchParams<{ query?: string }>();
  const [items, setItems] = useState<ParkingLot[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { getParkingLots().then(setItems).finally(() => setLoading(false)); }, []);
  if (loading) return <ActivityIndicator style={styles.center} color={colors.primary} />;
  return (
    <View style={styles.container}>
      <Text style={styles.query}>“{query || '부산 공영주차장'}” 검색 결과</Text>
      <FollowUpInput initialValue={query} onSubmit={(next) => router.setParams({ query: next })} />
      <Pressable style={styles.mapButton} onPress={() => router.push('/map')}><Text style={styles.mapButtonText}>지도에서 {items.length}곳 보기</Text></Pressable>
      <FlatList data={items} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <ParkingCard parking={item} onPress={() => router.push(`/parking/${item.id}`)} />} ListEmptyComponent={<Text>조건에 맞는 주차장이 없습니다.</Text>} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: colors.background, gap: 12 }, center: { flex: 1 },
  query: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  mapButton: { padding: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' },
  mapButtonText: { color: 'white', fontWeight: '800' }, list: { gap: 12, paddingBottom: 24 },
});
