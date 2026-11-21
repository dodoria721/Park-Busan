// Figma BottomNav: 홈 · 지도 · (새 검색) · 최근 · 더보기
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { color, shadow } from '../../theme';

type IconName = keyof typeof Ionicons.glyphMap;
const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: '홈', icon: 'home' },
  map: { label: '지도', icon: 'map' },
  recent: { label: '최근', icon: 'time' },
  more: { label: '더보기', icon: 'grid' },
};

function BottomNav({ state, navigateToTab, insets }: BottomTabBarProps) {
  const key = (name: string) => state.routes.find((r) => r.name === name)!.key;
  const item = (name: string) => {
    const on = state.routes[state.index].name === name;
    const t = TABS[name];
    return (
      <Pressable
        key={name}
        onPress={() => navigateToTab(key(name))}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={t.label}
        style={st.tab}
      >
        <Ionicons name={on ? t.icon : (`${t.icon}-outline` as IconName)} size={24} color={on ? color.primary : color.disabled} />
        <Text style={[st.label, { color: on ? color.primary : color.disabled, fontWeight: on ? '700' : '500' }]}>{t.label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={[st.bar, { paddingBottom: 10 + insets.bottom }]}>
      {item('index')}
      {item('map')}
      {/* 새 검색: 홈의 입력창으로 돌아간다 */}
      <Pressable onPress={() => navigateToTab(key('index'))} accessibilityRole="button" accessibilityLabel="새 검색" style={st.tab}>
        <View style={st.fab}>
          <Ionicons name="search" size={26} color={color.surface} />
        </View>
        <Text style={[st.label, { color: color.primary, fontWeight: '700' }]}>새 검색</Text>
      </Pressable>
      {item('recent')}
      {item('more')}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <BottomNav {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: color.bg } }}>
      <Tabs.Screen name="index" options={{ title: '홈' }} />
      <Tabs.Screen name="map" options={{ title: '지도' }} />
      <Tabs.Screen name="recent" options={{ title: '최근' }} />
      <Tabs.Screen name="more" options={{ title: '더보기' }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 8,
    ...shadow,
    shadowOffset: { width: 0, height: -4 },
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  label: { fontSize: 11 },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginTop: -34,
    backgroundColor: color.primary,
    borderWidth: 4,
    borderColor: color.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
    shadowColor: color.primary,
    shadowOpacity: 0.35,
  },
});
