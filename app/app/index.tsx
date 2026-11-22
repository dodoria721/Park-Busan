import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SearchForm } from '@/components/SearchForm';
import { ParkingSyncStatus } from '@/components/ParkingSyncStatus';
import { colors } from '@/constants/theme';
import { useParkingLots } from '@/hooks/useParkingLots';

export default function SearchScreen() {
  const { items } = useParkingLots();
  const available = items.filter((item) => item.liveStatus === 'available').length;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.eyebrow}>PARK BUSAN</Text>
    <Text style={styles.title}>{'부산 주차장,\n현황부터 위치까지'}</Text>
    <Text style={styles.description}>주차장 이름이나 지역명으로 검색하고, 잔여 면수와 카카오 지도에서 위치를 확인하세요.</Text>
    <View style={styles.stats}><View><Text style={styles.count}>{items.length}곳</Text><Text>조회된 주차장</Text></View><View><Text style={styles.count}>{available}곳</Text><Text>주차 가능</Text></View></View>
    <SearchForm onSubmit={(query) => router.push({ pathname: '/results', params: { query } })} />
    <View style={styles.row}>{['삼락', '해운대', '장산'].map((query) => <Pressable key={query} accessibilityRole="button" style={styles.chip} onPress={() => router.push({ pathname: '/results', params: { query } })}><Text>{query}</Text></Pressable>)}</View>
    <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/results')}><Text style={styles.action}>전체 주차장 보기</Text></Pressable>
    <Pressable accessibilityRole="button" style={styles.secondary} onPress={() => router.push('/map')}><Text style={styles.action}>카카오 지도에서 찾기</Text></Pressable>
    <ParkingSyncStatus />
    <Text style={styles.description}>현황은 제공 기관의 갱신 시각을 기준으로 합니다. 주변 검색은 반경 1km의 직선거리 기준입니다. 요금·시간 조건 검색은 준비 중입니다.</Text>
  </ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, container: { flexGrow: 1, padding: 24, paddingTop: 40, gap: 18, maxWidth: 760, width: '100%', alignSelf: 'center' }, eyebrow: { color: colors.primary, fontWeight: '800', letterSpacing: 2 }, title: { color: colors.ink, fontSize: 32, fontWeight: '800', lineHeight: 44 }, description: { color: colors.muted, lineHeight: 22 }, stats: { flexDirection: 'row', gap: 48, padding: 20, backgroundColor: '#d9edf2', borderRadius: 16 }, count: { color: colors.primary, fontSize: 26, fontWeight: '800', marginBottom: 6 }, row: { flexDirection: 'row', gap: 8 }, chip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: '#e1edf1' }, secondary: { padding: 15, borderWidth: 1, borderColor: colors.primary, borderRadius: 12, alignItems: 'center' }, action: { color: colors.primary, fontWeight: '700' } });
