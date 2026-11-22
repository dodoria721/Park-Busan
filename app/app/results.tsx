import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { ParkingFilters } from '@/components/ParkingFilters';
import { ParkingSyncStatus } from '@/components/ParkingSyncStatus';
import { ParkingCard } from '@/components/ParkingCard';
import { colors } from '@/constants/theme';
import { useParkingLots } from '@/hooks/useParkingLots';
import { useParkingSearch } from '@/hooks/useParkingSearch';
import { ParkingSearchStatus } from '@/components/ParkingSearchStatus';
import { parkingFilterParams, readParkingFilters } from '@/services/filterParking';

export default function ResultsScreen() {
  const params = useLocalSearchParams<{ query?: string; available?: string; sort?: string; placeId?: string }>();
  const filters = readParkingFilters(params);
  const { items, loading } = useParkingLots();
  const search = useParkingSearch(items, filters);
  const results = search.results;
  return <View style={styles.container}>
    <Text style={styles.query}>{filters.query ? '“' + filters.query + '” 검색 결과' : '부산 주차장 전체'}</Text>
    <ParkingFilters nearby={Boolean(search.origin)} filters={filters} onChange={(next) => router.setParams(parkingFilterParams(next))} />
    <ParkingSyncStatus /><ParkingSearchStatus search={search} onSelect={(placeId) => router.setParams(parkingFilterParams({ ...filters, placeId }))} />
    <View style={styles.summary}><Text>조회된 주차장 {results.length}곳 / 전체 {items.length}곳</Text><Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/map', params: parkingFilterParams(filters) })}><Text style={styles.link}>지도 화면 보기</Text></Pressable></View>
    {loading || search.loading ? <ActivityIndicator color={colors.primary} /> : null}
    <FlatList data={results} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={({ item }) => <ParkingCard parking={item} onPress={() => router.push({ pathname: '/parking/[id]', params: { id: item.id } })} />} ListEmptyComponent={!loading && !search.loading && !search.error && !search.needsSelection ? <Text>조회된 주차장이 없습니다. 검색어와 필터를 확인해 주세요.</Text> : undefined} />
  </View>;
}
const styles = StyleSheet.create({ container: { flex: 1, padding: 16, backgroundColor: colors.background, gap: 12, maxWidth: 1000, width: '100%', alignSelf: 'center' }, query: { color: colors.ink, fontSize: 20, fontWeight: '700' }, summary: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }, link: { color: colors.primary, fontWeight: '800' }, list: { gap: 12, paddingBottom: 24 } });
