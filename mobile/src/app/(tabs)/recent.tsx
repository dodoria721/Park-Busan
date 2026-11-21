// Figma 14 최근 탭: 검색 기록(앱 메모리) 다시 열기
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatMinutes } from '@parkbusan/shared';
import { errorMessage } from '../../api';
import { runRecommend, session, type HistoryItem } from '../../session';
import { Card, Mascot, Notice, Searching, s } from '../../ui';
import { color, font, radius } from '../../theme';

const hhmm = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export default function RecentTab() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<HistoryItem[]>(session.history);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => setItems([...session.history]), []));

  async function rerun(h: HistoryItem) {
    setBusy(true);
    setError(null);
    try {
      await runRecommend(h.conditions, h.place);
      router.push('/results');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (busy) return <Searching />;

  return (
    <ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 12 }]}>
      <View style={st.header}>
        <Text style={[font.title, { color: color.navy }]}>최근</Text>
        {items.length > 0 && (
          <Pressable
            onPress={() => {
              session.history = [];
              setItems([]);
            }}
            accessibilityRole="button"
          >
            <Text style={[font.label, { color: color.sub }]}>전체 삭제</Text>
          </Pressable>
        )}
      </View>

      {error && <Notice kind="error" text={error} />}

      {items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 40 }}>
          <Mascot pose="basic" height={130} />
          <Text style={[font.heading, { color: color.navy }]}>아직 검색 기록이 없어요</Text>
          <Text style={s.sub}>홈에서 주차장을 찾으면 여기에 모여요.</Text>
        </View>
      ) : (
        items.map((h) => (
          <Card key={`${h.place.id}-${h.at}`} onPress={() => rerun(h)} style={st.row}>
            <View style={st.icon}>
              <Ionicons name="time-outline" size={20} color={color.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[font.heading, { color: color.navy }]} numberOfLines={1}>
                {h.place.name}
              </Text>
              <Text style={s.sub} numberOfLines={2}>
                {formatMinutes(h.conditions.durationMinutes!)} ·{' '}
                {h.conditions.budget == null ? '예산 제한 없음' : `${h.conditions.budget.toLocaleString('ko-KR')}원 이하`} · {hhmm(h.at)}
              </Text>
            </View>
            <View style={st.again}>
              <Text style={[font.caption, { color: color.surface, fontWeight: '700' }]}>다시 검색</Text>
            </View>
          </Card>
        ))
      )}

      <View style={[s.inline, { justifyContent: 'center' }]}>
        <Ionicons name="lock-closed-outline" size={13} color={color.disabled} />
        <Text style={[s.sub, { color: color.disabled }]}>기록은 이 기기의 앱 실행 중에만 보관돼요</Text>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: color.primary50, alignItems: 'center', justifyContent: 'center' },
  again: { backgroundColor: color.primary, borderRadius: radius.full, paddingVertical: 7, paddingHorizontal: 12 },
});
