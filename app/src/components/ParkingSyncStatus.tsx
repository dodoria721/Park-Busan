import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useParkingLots } from '@/hooks/useParkingLots';
import { getApiUrl } from '@/services/appUrls';
import { colors } from '@/constants/theme';

export function ParkingSyncStatus() {
  const { updatedAt, refreshing, error, retry } = useParkingLots();
  return <View style={styles.container}>
    <View style={styles.row}><Text style={styles.text}>{getApiUrl() ? '실시간 주차 현황 · 60초마다 갱신' : '샘플 주차 현황'}</Text><Pressable accessibilityRole="button" disabled={refreshing} onPress={() => void retry()}><Text style={styles.button}>{refreshing ? '갱신 중…' : '현황 새로고침'}</Text></Pressable></View>
    {updatedAt ? <Text style={styles.text}>마지막 조회: {new Date(updatedAt).toLocaleTimeString('ko-KR')}</Text> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}{updatedAt ? ' 마지막으로 조회한 정보를 표시합니다.' : ''}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ container: { gap: 6, padding: 12, borderRadius: 12, backgroundColor: '#eaf2f5' }, row: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }, text: { color: colors.muted, fontSize: 12 }, button: { color: colors.primary, fontWeight: '700' }, error: { color: '#a52b28', lineHeight: 20 } });
