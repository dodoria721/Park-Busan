import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useParkingLots } from '@/hooks/useParkingLots';
import { useParkingSearch } from '@/hooks/useParkingSearch';
import { ParkingSearchStatus } from '@/components/ParkingSearchStatus';
import { ParkingMap } from '@/components/ParkingMap';
import { ParkingFilters } from '@/components/ParkingFilters';
import { ParkingSyncStatus } from '@/components/ParkingSyncStatus';
import { parkingFilterParams, readParkingFilters } from '@/services/filterParking';
import type { ParkingLot } from '@/types/parking';

export default function MapScreen() {
  const params = useLocalSearchParams<{ id?: string; query?: string; available?: string; sort?: string; placeId?: string }>();
  const filters = readParkingFilters(params);
  const { items, loading } = useParkingLots();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = useRef<FlatList<ParkingLot>>(null);
  const search = useParkingSearch(items, filters);
  const results = search.results;
  const selected = results.find((item) => item.id === (selectedId ?? params.id)) ?? results[0] ?? null;
  return <View style={styles.container}>
    <View style={styles.controls}><ParkingFilters nearby={Boolean(search.origin)} filters={filters} onChange={(next) => router.setParams(parkingFilterParams(next))} /><ParkingSyncStatus /><ParkingSearchStatus search={search} onSelect={(placeId) => router.setParams(parkingFilterParams({ ...filters, placeId }))} /><Text>조회된 주차장 {results.length}곳</Text></View>
    {loading || search.loading ? <ActivityIndicator color={colors.primary} /> : null}
    <FlatList ref={list} data={results} keyExtractor={(item) => item.id} extraData={selected?.id} ListHeaderComponent={selected ? <ParkingMap parking={selected} /> : undefined} ListEmptyComponent={!loading && !search.loading && !search.error && !search.needsSelection ? <Text style={styles.controls}>조회된 주차장이 없습니다. 검색어와 필터를 확인해 주세요.</Text> : undefined} renderItem={({ item }) => (
      <View style={[styles.row, item.id === selected?.id && styles.selected]}>
        <Pressable accessibilityRole="button" style={{ flex: 1 }} accessibilityLabel={item.name + ' 위치 찾기'} onPress={() => { setSelectedId(item.id); list.current?.scrollToOffset({ offset: 0, animated: true }); }}><Text style={styles.name}>{item.name}</Text><Text style={styles.coords}>잔여 {item.availableSpaces ?? '미확인'}면 · 지도에서 위치 찾기</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/parking/[id]', params: { id: item.id } })}><Text style={styles.distance}>상세 보기</Text></Pressable>
      </View>
    )} />
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: colors.background }, controls: { padding: 16, gap: 12 }, selected: { borderWidth: 2, borderColor: colors.primary }, row: { marginHorizontal: 16, marginBottom: 10, padding: 16, borderRadius: 14, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }, name: { color: colors.ink, fontWeight: '700' }, coords: { color: colors.muted, marginTop: 5 }, distance: { color: colors.primary, fontWeight: '800' } });
