import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { Stack } from 'expo-router';
import { color } from '../theme';

// 웹 미리보기는 휴대폰 화면 비율(390×844)로 가운데에 보여 준다. 네이티브는 그대로.
function PhoneFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: '#C9D1DE', alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: '100%',
          maxWidth: 390,
          height: '100%',
          maxHeight: 844,
          overflow: 'hidden',
          borderRadius: 28,
          backgroundColor: color.bg,
          boxShadow: '0 12px 40px rgba(23,43,94,0.25)',
        }}
      >
        {children}
      </View>
    </View>
  );
}

// 탭(홈·지도·최근·더보기) 위에 검색 흐름 화면(결과·상세)을 쌓는다. 흐름 화면에서는 하단바를 숨긴다(Figma 03~12).
export default function Layout() {
  return (
    <PhoneFrame>
      <Stack
        screenOptions={{
          headerBackTitle: '뒤로',
          headerStyle: { backgroundColor: color.bg },
          headerShadowVisible: false,
          headerTintColor: color.navy,
          headerTitleStyle: { fontWeight: '700', color: color.text },
          contentStyle: { backgroundColor: color.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: '파크부산' }} />
        <Stack.Screen name="results" options={{ title: '추천 결과' }} />
        <Stack.Screen name="lot/[id]" options={{ title: '주차장 상세' }} />
      </Stack>
    </PhoneFrame>
  );
}
