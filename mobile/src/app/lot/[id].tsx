// UI-04 주차장 상세(FR-007, FR-010, FR-011) + 길찾기 확인 팝업·연동(FR-015) — Figma 06·12
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatDistance,
  formatFee,
  formatMinutes,
  formatTime,
  formatWon,
  NO_INFO,
  type FeePolicy,
  type LotDetailResponse,
  type ParkingLot,
} from '@parkbusan/shared';
import { api, errorMessage } from '../../api';
import { session } from '../../session';
import { useAutoRefresh } from '../../use-auto-refresh';
import { Badge, Button, Card, Mascot, Notice, liveBadge, s } from '../../ui';
import { color, font, radius } from '../../theme';
import LotLocation from '../../components/LotLocation';

function feeRows(f: FeePolicy | null): [string, string][] {
  if (!f) return [['요금 정책', NO_INFO]];
  if (f.isFree) return [['요금 정책', '무료']];
  const won = (n: number | null) => (n == null ? NO_INFO : formatWon(n));
  const min = (n: number | null) => (n == null ? NO_INFO : `${n}분`);
  return [
    ['기본 요금', `${min(f.baseMinutes)} ${won(f.baseFee)}`],
    ['추가 요금', `${min(f.unitMinutes)}당 ${won(f.unitFee)}`],
    ['1일 최대', f.dailyMax == null ? NO_INFO : formatWon(f.dailyMax)],
  ];
}

async function openDirections(lot: ParkingLot): Promise<string | null> {
  if (lot.lat == null || lot.lng == null) return '좌표 정보가 없어 길찾기를 제공할 수 없습니다.';
  if (Platform.OS !== 'web') {
    try {
      await Linking.openURL(`kakaomap://route?ep=${lot.lat},${lot.lng}&by=CAR`);
      return null;
    } catch {
      // 카카오맵 앱이 없으면 웹 길찾기로 대체
    }
  }
  try {
    await Linking.openURL(`https://map.kakao.com/link/to/${encodeURIComponent(lot.name)},${lot.lat},${lot.lng}`);
    return null;
  } catch {
    return '길찾기 연동에 실패했습니다.';
  }
}

export default function LotDetail() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<{ id: string; value: LotDetailResponse } | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [navMsg, setNavMsg] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [showFee, setShowFee] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const c = session.conditions;
  const place = session.place;
  const mounted = useRef(true);
  const activeId = useRef(id);
  const dataRef = useRef<{ id: string; value: LotDetailResponse } | null>(null);
  const inFlight = useRef<{ id: string; promise: Promise<void> } | null>(null);

  useEffect(() => {
    activeId.current = id;
  }, [id]);

  const refreshDetail = useCallback((): Promise<void> => {
    if (inFlight.current?.id === id) return inFlight.current.promise;
    const requestedId = id;
    const task = api
      .lot(requestedId, { minutes: c?.durationMinutes ?? undefined, lat: place?.lat, lng: place?.lng })
      .then((next) => {
        if (!mounted.current || activeId.current !== requestedId) return;
        const current = { id: requestedId, value: next };
        dataRef.current = current;
        setLoaded(current);
        setError(null);
        setRefreshError(null);
      })
      .catch((reason: unknown) => {
        if (!mounted.current || activeId.current !== requestedId) return;
        const message = errorMessage(reason);
        if (dataRef.current?.id === requestedId) setRefreshError(`자동 갱신에 실패했습니다. 마지막 정상 정보를 표시합니다. ${message}`);
        else setError({ id: requestedId, message });
      })
      .finally(() => {
        if (inFlight.current?.promise === task) inFlight.current = null;
      });
    inFlight.current = { id: requestedId, promise: task };
    return task;
  }, [c?.durationMinutes, id, place?.lat, place?.lng]);

  useAutoRefresh(refreshDetail);

  useEffect(() => {
    mounted.current = true;
    void refreshDetail();
    if (place && c?.durationMinutes) {
      api
        .explain({ lotId: id, destination: place, durationMinutes: c.durationMinutes, budget: c.budget })
        .then((r) => setReason(r.text))
        .catch(() => setReason(null));
    }
    return () => {
      mounted.current = false;
    };
  }, [c?.budget, c?.durationMinutes, id, place, refreshDetail]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (error?.id === id) {
    return (
      <View style={s.screen}>
        <Notice kind="error" text={error.message} />
        <Button title="뒤로" variant="outline" onPress={back} />
      </View>
    );
  }
  if (loaded?.id !== id) return <Text style={[s.screen, s.sub]}>불러오는 중…</Text>;

  const data = loaded.value;
  const { lot, live } = data;
  const badge = liveBadge(live);
  const hasLive = (live.state === 'ok' || live.state === 'stale') && live.available != null;
  const ratio = hasLive && live.total ? Math.min(1, live.available! / live.total) : 0;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: '주차장 상세' }} />
      <ScrollView contentContainerStyle={[s.screen, { paddingBottom: 24 }]}>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[font.title, { flex: 1, color: color.navy }]}>{lot.name}</Text>
            <Badge tone={badge.tone} label={badge.label} />
          </View>
          <Text style={s.sub}>{lot.address ?? `주소 ${NO_INFO}`}</Text>
          <LotLocation lot={lot} />
          <View style={s.wrap}>
            {[lot.capacity == null ? null : `총 ${lot.capacity}면`, data.distanceM == null ? null : `목적지 ${formatDistance(data.distanceM)}`]
              .filter(Boolean)
              .map((t) => (
                <View key={t} style={st.tag}>
                  <Text style={[font.caption, { color: color.sub, fontWeight: '500' }]}>{t}</Text>
                </View>
              ))}
          </View>
        </Card>

        {data.liveWarning && <Notice kind="warn" text={data.liveWarning} />}
        {refreshError && <Notice kind="warn" text={refreshError} />}

        {/* FR-010: 실시간 면수 + 기관 갱신 시각 */}
        <Card>
          <Text style={[font.label, { color: color.sub }]}>실시간 주차 가능</Text>
          {hasLive ? (
            <>
              <Text style={{ color: color.success, ...font.display, fontSize: 34, lineHeight: 40 }}>
                {live.available}
                <Text style={[font.body15, { color: color.sub }]}> / {live.total ?? NO_INFO}면</Text>
              </Text>
              <View style={st.track}>
                <View style={[st.fill, { width: `${ratio * 100}%` }]} />
              </View>
              <Text style={s.sub}>기관 {formatTime(live.state === 'ok' || live.state === 'stale' ? live.updatedAt : null)}</Text>
            </>
          ) : (
            <Text style={[font.heading, { color: color.disabled }]}>{badge.label}</Text>
          )}
        </Card>

        {/* FR-008: 예상 요금 + 요금 기준 접기 */}
        <Card>
          <Text style={[font.label, { color: color.sub }]}>{c?.durationMinutes ? `${formatMinutes(c.durationMinutes)} 예상 요금` : '예상 요금'}</Text>
          <Text style={[font.title, { color: color.navy }]}>{c?.durationMinutes ? formatFee(data.fee) : NO_INFO}</Text>
          {showFee &&
            feeRows(lot.fee).map(([k, v]) => (
              <View key={k} style={st.row}>
                <Text style={s.sub}>{k}</Text>
                <Text style={[font.label, { color: color.text }]}>{v}</Text>
              </View>
            ))}
          <Pressable onPress={() => setShowFee(!showFee)} accessibilityRole="button">
            <Text style={[font.label, { color: color.primary }]}>{showFee ? '요금 기준 접기 ⌃' : '요금 기준 보기 ⌄'}</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={s.cardTitle}>운영 정보</Text>
          {[
            ['운영시간', lot.operatingHours ?? NO_INFO],
            ['데이터 출처', lot.source],
          ].map(([k, v]) => (
            <View key={k} style={st.row}>
              <Text style={s.sub}>{k}</Text>
              <Text style={[font.label, { color: v === NO_INFO ? color.disabled : color.text, flexShrink: 1, textAlign: 'right' }]}>{v}</Text>
            </View>
          ))}
        </Card>

        {reason && (
          <View style={st.reason}>
            <Text style={{ color: color.primary, fontWeight: '700' }}>✦</Text>
            <Text style={[font.label, { flex: 1, color: color.navy, fontWeight: '400', lineHeight: 19 }]}>{reason}</Text>
          </View>
        )}
        {navMsg && <Notice kind="error" text={navMsg} />}
      </ScrollView>

      <View style={[st.bottom, { paddingBottom: 12 + insets.bottom }]}>
        <Button title="카카오맵으로 길찾기" chevron onPress={() => setConfirm(true)} style={{ flex: 1 }} />
      </View>

      {/* Figma 12: 길안내 확인 팝업 */}
      <Modal visible={confirm} transparent animationType="fade" onRequestClose={() => setConfirm(false)}>
        <View style={st.dim}>
          <View style={st.popup}>
            <View style={st.popupMascot}>
              <Mascot pose="wink" height={110} />
            </View>
            <Text style={[font.heading, { color: color.navy, textAlign: 'center' }]}>이 주차장으로 안내할까요?</Text>
            <Text style={[s.sub, { textAlign: 'center' }]}>
              {lot.name}
              {'\n'}카카오맵 앱이 없으면 웹 길찾기로 연결돼요.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
              <Button title="취소" variant="cancel" onPress={() => setConfirm(false)} style={{ flex: 1 }} />
              <Button
                title="안내 시작"
                onPress={async () => {
                  setConfirm(false);
                  setNavMsg(await openDirections(lot));
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  tag: { backgroundColor: color.bg, borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 10 },
  track: { height: 8, borderRadius: 4, backgroundColor: color.line, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: color.success },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  reason: { flexDirection: 'row', gap: 8, backgroundColor: color.primary50, borderRadius: 16, padding: 14 },
  bottom: { flexDirection: 'row', paddingTop: 12, paddingHorizontal: 16, backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.line },
  dim: { flex: 1, backgroundColor: 'rgba(14,26,54,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  popup: { width: '100%', maxWidth: 340, backgroundColor: color.surface, borderRadius: 26, borderWidth: 2, borderColor: color.primary100, paddingTop: 70, padding: 22, gap: 12, alignItems: 'center' },
  popupMascot: { position: 'absolute', top: -56, alignSelf: 'center' },
});
