import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ParkingLot } from '@/types/parking';
import { getMapWebUrl } from '@/services/appUrls';
import { colors } from '@/constants/theme';

export interface ParkingMapProps { parking: ParkingLot | null; }

export function ParkingMap({ parking }: ParkingMapProps) {
  return <NativeMap key={parking?.id ?? 'empty'} parking={parking} />;
}

function NativeMap({ parking }: ParkingMapProps) {
  const webView = useRef<WebView<object>>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const base = getMapWebUrl();
  let url: URL | null = null;
  try {
    if (base) { url = new URL('/map-embed', base); if (parking) url.searchParams.set('id', parking.id); }
    if (url && !['http:', 'https:'].includes(url.protocol)) url = null;
  } catch { url = null; }
  if (!url) return <View style={styles.message}><Text>지도 서버 주소를 설정해 주세요.</Text><Text>app/.env의 EXPO_PUBLIC_MAP_WEB_URL에 휴대폰에서 접근 가능한 웹 앱 주소를 입력하고 카카오 JavaScript SDK 도메인에 등록해 주세요.</Text></View>;
  const origin = url.origin;
  return <View style={styles.container}>
    {failed ? <View style={styles.message}><Text>지도를 열 수 없습니다. 네트워크와 지도 서버 주소를 확인해 주세요.</Text><Pressable accessibilityRole="button" onPress={() => { setFailed(false); setAttempt((value) => value + 1); }}><Text style={styles.action}>지도 다시 시도</Text></Pressable></View> : <WebView<object>
      key={attempt}
      ref={webView}
      source={{ uri: url.toString() }}
      style={styles.webview}
      nestedScrollEnabled
      startInLoadingState
      renderLoading={() => <ActivityIndicator style={styles.loading} color={colors.primary} />}
      onError={() => setFailed(true)}
      onHttpError={() => setFailed(true)}
      onContentProcessDidTerminate={() => webView.current?.reload()}
      onShouldStartLoadWithRequest={(request) => {
        if (request.url === 'about:blank') return true;
        try {
          const target = new URL(request.url);
          if (target.origin === origin) return true;
          if (['map.kakao.com', 'm.map.kakao.com'].includes(target.hostname) && target.protocol === 'https:') void Linking.openURL(request.url).catch(() => setFailed(true));
        } catch { /* Reject unsupported navigation. */ }
        return false;
      }}
      onOpenWindow={(event) => {
        try {
          const target = new URL(event.nativeEvent.targetUrl);
          if (target.protocol === 'https:' && ['map.kakao.com', 'm.map.kakao.com'].includes(target.hostname)) void Linking.openURL(target.toString()).catch(() => setFailed(true));
        } catch { /* Ignore invalid external URLs. */ }
      }}
    />}
  </View>;
}
const styles = StyleSheet.create({ container: { height: 680, marginVertical: 8, borderRadius: 16, overflow: 'hidden', backgroundColor: '#d9edf2' }, webview: { flex: 1, backgroundColor: '#f5f8fa' }, loading: { position: 'absolute', alignSelf: 'center', top: 80 }, message: { padding: 20, gap: 12, backgroundColor: '#eaf2f5' }, action: { color: colors.primary, fontWeight: '700' } });
