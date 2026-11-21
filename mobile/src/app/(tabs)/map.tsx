// Figma 13 지도 탭: 마지막 검색 지역(없으면 서면역) 주변 공영주차장 둘러보기
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Candidate, Place } from '@parkbusan/shared';
import { api, errorMessage } from '../../api';
import { session } from '../../session';
import { Button, Card, Mascot, Notice, s } from '../../ui';
import { color, font, radius, shadow } from '../../theme';
import ResultMap from '../../components/ResultMap';
import LotCard from '../../components/LotCard';

const BROWSE_MINUTES = 120; // 둘러보기용 기준 시간(요금 표시용)

export default function MapTab() {
  const insets = useSafeAreaInsets();
  const [place, setPlace] = useState<Place | null>(null);
  const [items, setItems] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        try {
          const p = session.place ?? (await api.places('서면역')).places[0];
          if (!p || !alive) return;
          const r = await api.recommend({ destination: { lat: p.lat, lng: p.lng, name: p.name }, durationMinutes: BROWSE_MINUTES, budget: null });
          if (!alive) return;
          setPlace(p);
          setItems([...r.all, ...r.needsCheck]);
          setError(null);
        } catch (e) {
          if (alive) setError(errorMessage(e));
        }
      })();
      return () => {
        alive = false;
      };
    }, []),
  );

  const sel = items.find((c) => c.lot.id === selected);

  return (
    <ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 12 }]}>
      <Pressable onPress={() => router.navigate('/')} accessibilityRole="search" style={st.search}>
        <Ionicons name="search" size={20} color={color.primary} />
        <Text style={[font.body15, { color: color.disabled }]}>목적지나 지역을 검색하세요</Text>
      </Pressable>

      {error && <Notice kind="error" text={error} />}

      {place && (
        <>
          <View style={st.areaChip}>
            <Ionicons name="location" size={14} color={color.primary} />
            <Text style={[font.label, { color: color.navy, fontWeight: '700' }]}>{place.name} 주변 2km</Text>
          </View>
          <ResultMap dest={place} items={items} selectedId={selected} onSelect={setSelected} />
          {sel ? (
            <LotCard c={sel} feeLabel="2시간 예상" />
          ) : (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Mascot pose="basic" height={56} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[font.body15, { fontWeight: '700', color: color.navy }]}>이 지역 공영주차장 {items.length}곳</Text>
                <Text style={s.sub}>마커를 누르면 요금과 빈자리를 볼 수 있어요.</Text>
              </View>
            </Card>
          )}
          <Button title="조건 정해서 검색" chevron onPress={() => router.navigate('/')} />
        </>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: color.primary100,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...shadow,
  },
  areaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: color.primary50, borderRadius: radius.full, paddingVertical: 6, paddingHorizontal: 12 },
});
