import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { mockParkingLots } from '@/constants/mockParking';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}><Text style={styles.pin}>●</Text><Text style={styles.title}>지도 연동 준비 영역</Text><Text style={styles.caption}>Expo Go 호환 지도 라이브러리 검증 후 좌표를 마커로 표시합니다.</Text></View>
      <FlatList data={mockParkingLots} keyExtractor={(item) => item.id} renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/parking/${item.id}`)}><View><Text style={styles.name}>{item.name}</Text><Text style={styles.coords}>{item.latitude}, {item.longitude}</Text></View><Text style={styles.distance}>{item.distanceMeters}m</Text></Pressable>
      )} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background }, mapPlaceholder: { minHeight: 290, margin: 16, padding: 28, borderRadius: 20, backgroundColor: '#d9edf2', alignItems: 'center', justifyContent: 'center', gap: 10 },
  pin: { color: colors.accent, fontSize: 36 }, title: { color: colors.ink, fontSize: 20, fontWeight: '800' }, caption: { color: colors.muted, textAlign: 'center', lineHeight: 20 },
  row: { marginHorizontal: 16, marginBottom: 10, padding: 16, borderRadius: 14, backgroundColor: colors.surface, flexDirection: 'row', justifyContent: 'space-between' }, name: { color: colors.ink, fontWeight: '700' }, coords: { color: colors.muted, marginTop: 5 }, distance: { color: colors.primary, fontWeight: '800' },
});
