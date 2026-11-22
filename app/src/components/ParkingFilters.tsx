import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FollowUpInput } from './FollowUpInput';
import type { ParkingFilters as Filters } from '@/services/filterParking';
import { colors } from '@/constants/theme';

export function ParkingFilters({ filters, onChange, nearby = false }: { filters: Filters; onChange: (value: Filters) => void; nearby?: boolean }) {
  return <View style={styles.container}>
    <FollowUpInput key={filters.query} initialValue={filters.query} onSubmit={(query) => onChange({ ...filters, query, placeId: undefined })} />
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: filters.available }} style={[styles.chip, filters.available && styles.active]} onPress={() => onChange({ ...filters, available: !filters.available })}><Text>주차 가능한 곳만</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: filters.sort === 'spaces' }} style={[styles.chip, filters.sort === 'spaces' && styles.active]} onPress={() => onChange({ ...filters, sort: filters.sort === 'spaces' ? 'name' : 'spaces' })}><Text>{filters.sort === 'spaces' ? '잔여 면수순' : nearby ? '가까운 순' : '이름순'}</Text></Pressable>
      {filters.query ? <Pressable accessibilityRole="button" style={styles.chip} onPress={() => onChange({ ...filters, query: '', placeId: undefined })}><Text>검색 초기화</Text></Pressable> : null}
    </View>
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 10 }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { borderWidth: 1, borderColor: '#b8cbd3', borderRadius: 20, padding: 10, backgroundColor: colors.surface }, active: { backgroundColor: '#d9edf2', borderColor: colors.primary } });
