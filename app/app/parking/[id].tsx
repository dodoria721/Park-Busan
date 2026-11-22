import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useParkingLots } from '@/hooks/useParkingLots';
import { ParkingSyncStatus } from '@/components/ParkingSyncStatus';
import { ParkingMap } from '@/components/ParkingMap';

export default function ParkingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { items, loading } = useParkingLots();
  const parking = items.find((item) => item.id === id);
  if (loading) return <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />;
  if (!parking) return <View style={styles.container}><ParkingSyncStatus /><Text>주차장 정보를 찾을 수 없습니다.</Text><Pressable accessibilityRole="button" onPress={() => router.replace('/results')}><Text>전체 주차장 보기</Text></Pressable></View>;
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.badge}>{parking.liveStatus === 'available' ? '주차 가능' : parking.liveStatus === 'full' ? '만차' : '현황 확인 불가'} · 주차장 코드 {parking.id}</Text>
    <Text style={styles.title}>{parking.name}</Text>
    <ParkingSyncStatus />
    <View style={styles.card}>
      <Detail label="잔여 면수" value={parking.availableSpaces == null ? '정보 없음' : parking.availableSpaces + '면'} />
      <Detail label="주차 중" value={parking.occupiedSpaces == null ? '정보 없음' : parking.occupiedSpaces + '면'} />
      <Detail label="총 면수" value={parking.totalSpaces === null ? '정보 없음' : parking.totalSpaces + '면'} />
      <Detail label="주소" value={parking.address ?? '정보 없음'} />
      <Detail label="예상 요금" value={parking.estimatedFeeWon === null ? '정보 없음' : parking.estimatedFeeWon.toLocaleString() + '원'} />
      <Detail label="운영 시간" value={parking.operatingHours ?? '정보 없음'} />
    </View>
    {parking.lastUpdated ? <Text style={styles.notice}>현황 기준: {parking.lastUpdated}</Text> : null}
    <Text style={styles.notice}>주차 현황은 제공 기관의 갱신 시점에 따라 실제와 차이가 있을 수 있습니다.</Text>
    <Text style={styles.section}>카카오 지도에서 위치 확인</Text>
    <ParkingMap parking={parking} />
    <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.push({ pathname: '/map', params: { id: parking.id } })}><Text style={styles.buttonText}>다른 주차장과 지도에서 비교</Text></Pressable>
  </ScrollView>;
}
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 20, backgroundColor: colors.background, gap: 14, maxWidth: 1000, width: '100%', alignSelf: 'center' }, badge: { color: colors.primary, fontWeight: '800' }, title: { color: colors.ink, fontSize: 27, fontWeight: '800' }, section: { color: colors.ink, fontSize: 20, fontWeight: '700' }, card: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, gap: 16 }, detail: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 }, label: { color: colors.muted }, value: { color: colors.ink, fontWeight: '700', flexShrink: 1 }, notice: { color: colors.muted, lineHeight: 21 }, button: { padding: 16, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center' }, buttonText: { color: 'white', fontWeight: '700' } });
