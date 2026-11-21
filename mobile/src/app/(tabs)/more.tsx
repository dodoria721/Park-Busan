// Figma 15 더보기 탭: 이용 안내·개인정보·정보. 아직 없는 기능은 "준비 중"으로 표시한다.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { session } from '../../session';
import { Mascot, s } from '../../ui';
import { color, font, radius, shadow } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;
type Row = { icon: IconName; label: string; value?: string; onPress?: () => void };

export default function MoreTab() {
  const insets = useSafeAreaInsets();
  const [guide, setGuide] = useState(false);
  const [count, setCount] = useState(session.history.length);
  useFocusEffect(useCallback(() => setCount(session.history.length), []));

  const groups: [string, Row[]][] = [
    [
      '검색 도구',
      [
        { icon: 'camera-outline', label: '안내판 사진으로 찾기', value: '준비 중' },
        { icon: 'navigate-outline', label: '길찾기 앱', value: '카카오맵' },
      ],
    ],
    [
      '권한 · 개인정보',
      [
        { icon: 'location-outline', label: '위치 권한', value: '사용 안 함' },
        {
          icon: 'trash-outline',
          label: '검색 기록 삭제',
          value: count ? `${count}건` : '기록 없음',
          onPress: () => {
            session.history = [];
            setCount(0);
          },
        },
      ],
    ],
    [
      '정보 · 운영',
      [
        { icon: 'server-outline', label: '데이터 출처', value: '가상(Mock) 데이터' },
        { icon: 'shield-checkmark-outline', label: '관리자 로그인', value: '준비 중' },
      ],
    ],
  ];

  return (
    <ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 12 }]}>
      <Text style={[font.title, { color: color.navy }]}>더보기</Text>

      <Pressable onPress={() => setGuide(!guide)} accessibilityRole="button" style={st.banner}>
        <View style={st.tile}>
          <Mascot pose="wink" height={50} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[font.body15, { color: color.surface, fontWeight: '700' }]}>파크부산 이용 가이드</Text>
          <Text style={[font.caption, { color: '#DCE8FD' }]}>말로 묻고, 비교하고, 바로 길안내까지</Text>
        </View>
        <Ionicons name={guide ? 'chevron-up' : 'chevron-down'} size={20} color={color.surface} />
      </Pressable>
      {guide && (
        <View style={st.group}>
          {['① 홈에서 "서면역 2시간 5천 원 이하"처럼 말하듯 적어요.', '② AI가 이해한 조건을 확인·수정하고 검색해요.', '③ 반경 2km 공영주차장을 거리순으로 비교해요.', '④ 상세에서 카카오맵 길찾기로 바로 출발해요.'].map(
            (t) => (
              <Text key={t} style={[font.body, { color: color.text, paddingVertical: 4 }]}>
                {t}
              </Text>
            ),
          )}
        </View>
      )}

      {groups.map(([title, rows]) => (
        <View key={title} style={{ gap: 6 }}>
          <Text style={s.section}>{title}</Text>
          <View style={st.group}>
            {rows.map((r, i) => (
              <Pressable
                key={r.label}
                onPress={r.onPress}
                disabled={!r.onPress}
                accessibilityRole={r.onPress ? 'button' : undefined}
                style={[st.row, i < rows.length - 1 && st.divider]}
              >
                <View style={st.icon}>
                  <Ionicons name={r.icon} size={18} color={color.primary} />
                </View>
                <Text style={[font.body15, { flex: 1, color: color.text }]}>{r.label}</Text>
                {r.value && <Text style={[font.caption, { color: r.value === '준비 중' ? color.disabled : color.sub }]}>{r.value}</Text>}
                {r.onPress && <Ionicons name="chevron-forward" size={16} color={color.disabled} />}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.primary, borderRadius: radius.card, padding: 14, ...shadow, shadowColor: color.primary, shadowOpacity: 0.25 },
  tile: { width: 56, height: 56, borderRadius: 18, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  group: { backgroundColor: color.surface, borderRadius: radius.card, borderWidth: 1.5, borderColor: color.primary100, paddingHorizontal: 16, paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: color.line },
  icon: { width: 34, height: 34, borderRadius: 11, backgroundColor: color.primary50, alignItems: 'center', justifyContent: 'center' },
});
