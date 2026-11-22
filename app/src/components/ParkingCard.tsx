import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import type { ParkingLot } from '@/types/parking';

export function ParkingCard({ parking, onPress }: { parking: ParkingLot; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.top}><Text style={styles.name}>{parking.name}</Text><Text style={styles.distance}>{parking.distanceMeters === null ? '거리 정보 없음' : `직선 ${parking.distanceMeters}m`}</Text></View>
      <Text style={styles.address}>{parking.address ?? '주소 정보 없음'}</Text>
      <View style={styles.meta}><Text style={styles.fee}>{parking.estimatedFeeWon === null ? '요금 정보 없음' : `예상 ${parking.estimatedFeeWon.toLocaleString()}원`}</Text><Text style={parking.liveStatus === 'available' ? styles.available : styles.unknown}>{parking.liveStatus === 'available' ? '주차 가능' : parking.liveStatus === 'full' ? '만차' : '현황 확인 불가'}</Text></View>
      <Text style={styles.address}>잔여 {parking.availableSpaces ?? '미확인'} / 전체 {parking.totalSpaces ?? '미확인'}면</Text>
      {parking.lastUpdated ? <Text style={styles.address}>현황 기준: {parking.lastUpdated}</Text> : null}
    </Pressable>
  );
}
const styles = StyleSheet.create({ card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8 }, top: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, name: { color: colors.ink, fontSize: 17, fontWeight: '800', flex: 1 }, distance: { color: colors.primary, fontWeight: '800' }, address: { color: colors.muted }, meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }, fee: { color: colors.ink, fontWeight: '700' }, available: { color: '#16804b', fontWeight: '700' }, unknown: { color: '#8b6b16', fontWeight: '700' } });
