import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { mockParkingLots } from '@/constants/mockParking';

export default function ParkingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const parking = mockParkingLots.find((item) => item.id === id);
  if (!parking) return <View style={styles.container}><Text>주차장 정보를 찾을 수 없습니다.</Text></View>;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.badge}>{parking.isPublic ? '공영' : '민영'} · {parking.liveStatus === 'available' ? '주차 가능' : '현황 확인 불가'}</Text>
      <Text style={styles.title}>{parking.name}</Text><Text style={styles.address}>{parking.address}</Text>
      <View style={styles.card}><Detail label="직선 거리" value={`${parking.distanceMeters}m`} /><Detail label="총 면수" value={`${parking.totalSpaces}면`} /><Detail label="예상 요금" value={`${parking.estimatedFeeWon.toLocaleString()}원`} /><Detail label="운영 시간" value={parking.operatingHours} /></View>
      <Text style={styles.notice}>요금과 실시간 현황은 현재 Mock 값입니다. 실제 정책 연동 전 현장 정보를 확인하세요.</Text>
    </ScrollView>
  );
}
function Detail({ label, value }: { label: string; value: string }) { return <View style={styles.detail}><Text style={styles.label}>{label}</Text><Text style={styles.value}>{value}</Text></View>; }
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: colors.background, gap: 12 }, badge: { color: colors.primary, fontWeight: '800' }, title: { color: colors.ink, fontSize: 27, fontWeight: '800' }, address: { color: colors.muted, fontSize: 16 }, card: { backgroundColor: colors.surface, borderRadius: 16, padding: 18, marginTop: 8, gap: 16 }, detail: { flexDirection: 'row', justifyContent: 'space-between' }, label: { color: colors.muted }, value: { color: colors.ink, fontWeight: '700' }, notice: { color: colors.muted, lineHeight: 21 },
});
