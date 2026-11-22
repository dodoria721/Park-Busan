import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { useParkingSearch } from '@/hooks/useParkingSearch';
import { colors } from '@/constants/theme';

export function ParkingSearchStatus({ search, onSelect }: { search: ReturnType<typeof useParkingSearch>; onSelect: (placeId: string) => void }) {
  return <View style={styles.container}>
    {search.loading ? <View style={styles.row}><ActivityIndicator color={colors.primary} /><Text>검색 장소의 위치를 확인하고 있습니다.</Text></View> : null}
    {search.error ? <View><Text accessibilityRole="alert">{search.error}</Text><Pressable accessibilityRole="button" onPress={search.retry}><Text style={styles.link}>지역 검색 다시 시도</Text></Pressable></View> : null}
    {search.needsSelection ? <Text>주변 검색의 기준 장소를 선택해 주세요.</Text> : null}
    {search.places.length > 1 ? search.places.map((place) => <Pressable accessibilityRole="button" key={place.id} style={styles.place} onPress={() => onSelect(place.id)}><Text>{place.name}</Text><Text style={styles.muted}>{place.address}</Text></Pressable>) : null}
    {search.message ? <Text style={styles.link}>{search.message}</Text> : null}
    {search.origin && search.missingLocations > 0 ? <Text style={styles.muted}>좌표를 확인하지 못한 {search.missingLocations}곳은 주변 검색에서 제외했습니다.</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 8 }, row: { flexDirection: 'row', gap: 8 }, place: { padding: 10, borderWidth: 1, borderColor: '#b8cbd3', borderRadius: 10 }, link: { color: colors.primary, lineHeight: 22 }, muted: { color: colors.muted, fontSize: 12 } });
