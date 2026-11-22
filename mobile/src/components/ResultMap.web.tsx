// UI-03 웹 지도: EXPO_PUBLIC_KAKAO_JS_KEY가 있으면 카카오 지도 JS SDK, 없거나 로드 실패면 좌표 미리보기.
// 카카오 JS 키는 브라우저 공개용 키다(콘솔 Web 플랫폼에 등록한 도메인에서만 동작). REST 키는 서버에만 둔다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { MapProps } from './map-props';
import { s } from '../ui';
import { color } from '../theme';

const JS_KEY = process.env.EXPO_PUBLIC_KAKAO_JS_KEY;

declare global {
  interface Window {
    kakao?: any;
  }
}

let sdk: Promise<any> | null = null;
function loadKakao(key: string): Promise<any> {
  sdk ??= new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
    el.onload = () => (window.kakao?.maps ? window.kakao.maps.load(() => resolve(window.kakao)) : reject(new Error('kakao sdk')));
    el.onerror = () => reject(new Error('kakao sdk'));
    document.head.appendChild(el);
  }).catch((e) => {
    sdk = null;
    throw e;
  });
  return sdk;
}

const pin = (label: string, bg: string, size: number) =>
  `<div style="min-width:${size}px;height:${size}px;padding:0 ${label.length > 2 ? 10 : 0}px;border-radius:999px;background:${bg};border:2px solid #fff;` +
  `box-shadow:0 2px 6px rgba(23,43,94,.3);color:#fff;font:700 12px system-ui;display:flex;align-items:center;justify-content:center;cursor:pointer;white-space:nowrap">${label}</div>`;

function KakaoMap({ dest, items, selectedId, onSelect, onFail }: MapProps & { onFail: () => void }) {
  const box = useRef<any>(null);
  const map = useRef<any>(null);
  const overlays = useRef<any[]>([]);

  useEffect(() => {
    let alive = true;
    loadKakao(JS_KEY!)
      .then((kakao) => {
        if (!alive || !box.current) return;
        const m = kakao.maps;
        map.current ??= new m.Map(box.current as HTMLElement, { center: new m.LatLng(dest.lat, dest.lng), level: 5 });
        overlays.current.forEach((o) => o.setMap(null));
        overlays.current = [];
        const bounds = new m.LatLngBounds();
        const add = (lat: number, lng: number, html: string, z: number, click?: () => void) => {
          const el = document.createElement('div');
          el.innerHTML = html;
          if (click) el.onclick = click;
          const o = new m.CustomOverlay({ position: new m.LatLng(lat, lng), content: el, yAnchor: 0.5, zIndex: z });
          o.setMap(map.current);
          overlays.current.push(o);
          bounds.extend(new m.LatLng(lat, lng));
        };
        add(dest.lat, dest.lng, pin(dest.name, color.navy, 30), 1);
        items.forEach((c, i) => {
          if (c.lot.lat == null || c.lot.lng == null) return;
          const on = c.lot.id === selectedId;
          add(c.lot.lat, c.lot.lng, pin(String(i + 1), on ? color.primary700 : color.primary, on ? 34 : 28), on ? 4 : 2, () => onSelect(c.lot.id));
        });
        if (!selectedId) map.current.setBounds(bounds);
      })
      .catch(() => alive && onFail());
    return () => {
      alive = false;
    };
  }, [dest, items, onFail, onSelect, selectedId]);

  return (
    <View style={{ gap: 8 }}>
      <View ref={box} style={{ height: 360, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: color.primary100 }} />
      <Text style={s.sub}>지도 데이터 © Kakao</Text>
    </View>
  );
}

export default function ResultMap(props: MapProps) {
  const [failed, setFailed] = useState(false);
  const onFail = useCallback(() => setFailed(true), []);
  if (JS_KEY && !failed) return <KakaoMap {...props} onFail={onFail} />;
  return <Preview {...props} note={JS_KEY ? '카카오 지도를 불러오지 못했습니다(도메인 등록·키 확인 필요).' : undefined} />;
}

// 키가 없을 때: 실제 지도 대신 목적지 기준 상대 위치를 점으로 그린다.
function Preview({ dest, items, selectedId, onSelect, note }: MapProps & { note?: string }) {
  const pts = items.filter((c) => c.lot.lat != null && c.lot.lng != null);
  const lats = [dest.lat, ...pts.map((c) => c.lot.lat!)];
  const lngs = [dest.lng, ...pts.map((c) => c.lot.lng!)];
  const pad = 0.002;
  const [minLat, maxLat] = [Math.min(...lats) - pad, Math.max(...lats) + pad];
  const [minLng, maxLng] = [Math.min(...lngs) - pad, Math.max(...lngs) + pad];
  const pos = (lat: number, lng: number) => ({
    left: `${((lng - minLng) / (maxLng - minLng)) * 100}%` as const,
    top: `${((maxLat - lat) / (maxLat - minLat)) * 100}%` as const,
  });

  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 360, borderWidth: 1.5, borderColor: color.primary100, borderRadius: 20, backgroundColor: '#EEF1EA', overflow: 'hidden' }}>
        <View style={{ position: 'absolute', ...pos(dest.lat, dest.lng), transform: [{ translateX: -18 }, { translateY: -14 }] }}>
          <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: color.navy }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>목적지</Text>
          </View>
        </View>
        {pts.map((c, i) => {
          const on = c.lot.id === selectedId;
          return (
            <Pressable
              key={c.lot.id}
              onPress={() => onSelect(c.lot.id)}
              accessibilityRole="button"
              accessibilityLabel={c.lot.name}
              style={{ position: 'absolute', ...pos(c.lot.lat!, c.lot.lng!), transform: [{ translateX: -14 }, { translateY: -14 }] }}
            >
              <View
                style={{
                  width: on ? 34 : 28,
                  height: on ? 34 : 28,
                  borderRadius: 17,
                  backgroundColor: on ? color.primary700 : color.primary,
                  borderWidth: 2,
                  borderColor: '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{i + 1}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Text style={s.sub}>{note ?? '웹 미리보기: 카카오 JS 키(EXPO_PUBLIC_KAKAO_JS_KEY)가 없어 상대 위치만 표시합니다.'}</Text>
    </View>
  );
}
