import { router } from 'expo-router';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { SearchForm } from '@/components/SearchForm';
import { colors } from '@/constants/theme';

export default function SearchScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>BUSAN PUBLIC PARKING</Text>
        <Text style={styles.title}>어디에 주차할까요?</Text>
        <Text style={styles.description}>목적지, 주차 시간, 예산을 자연어로 입력해 보세요.</Text>
        <SearchForm onSubmit={(query) => router.push({ pathname: '/results', params: { query } })} />
        <View style={styles.note}><Text style={styles.noteText}>예: 부산역 근처에서 3시간, 5천 원 이하 공영주차장</Text></View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 14 },
  eyebrow: { color: colors.primary, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '800' },
  description: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  note: { backgroundColor: colors.surface, padding: 14, borderRadius: 12 },
  noteText: { color: colors.muted, lineHeight: 20 },
});
