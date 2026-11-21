// Figma Card/ParkingResult: 순위·이름·상태 배지 / 거리·예상 요금·잔여 / (선택) AI 추천 이유 접기
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { formatDistance, formatFee, NO_INFO, type Candidate } from '@parkbusan/shared';
import { Badge, Card, liveBadge, liveTile } from '../ui';
import { color, font } from '../theme';

export default function LotCard({ c, rank, feeLabel, reason }: { c: Candidate; rank?: number; feeLabel: string; reason?: string | null }) {
  const [open, setOpen] = useState(true);
  const badge = liveBadge(c.live);
  const live = liveTile(c.live);
  const fee = formatFee(c.fee);
  return (
    <Card style={{ gap: 12 }}>
      {/* 상세로 가는 영역과 접기 버튼을 분리한다(버튼 안에 버튼을 두지 않음). */}
      <Pressable onPress={() => router.push(`/lot/${c.lot.id}`)} accessibilityRole="button" accessibilityLabel={`${c.lot.name} 상세 보기`} style={{ gap: 12 }}>
      <View style={st.head}>
        {rank != null && (
          <View style={st.rank}>
            <Text style={st.rankText}>{rank}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[font.heading, { color: color.text }]} numberOfLines={1}>
            {c.lot.name}
          </Text>
          <Text style={[font.caption, { color: color.sub }]} numberOfLines={1}>
            {c.lot.address ?? `주소 ${NO_INFO}`}
          </Text>
        </View>
        <Badge tone={badge.tone} label={badge.label} />
      </View>

      <View style={st.metrics}>
        <Tile label="거리" value={formatDistance(c.distanceM)} />
        <Tile label={feeLabel} value={fee} tint={c.fee.status === 'ok' ? color.text : color.disabled} />
        <Tile label={live.label} value={live.value} tint={live.tint} />
      </View>
      </Pressable>

      {reason != null && (
        <>
          {open && (
            <View style={st.reason}>
              <Text style={{ color: color.primary, fontWeight: '700' }}>✦</Text>
              <Text style={[font.label, { flex: 1, color: color.navy, fontWeight: '400', lineHeight: 19 }]}>{reason}</Text>
            </View>
          )}
          <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" style={{ alignItems: 'center' }}>
            <Text style={[font.label, { color: color.primary }]}>{open ? '접기 ⌃' : 'AI 추천 이유 보기 ⌄'}</Text>
          </Pressable>
        </>
      )}
    </Card>
  );
}

function Tile({ label, value, tint = color.text }: { label: string; value: string; tint?: string }) {
  return (
    <View style={st.tile}>
      <Text style={[font.caption, { color: color.sub }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[font.heading, { color: tint }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 30, height: 30, borderRadius: 10, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: color.surface, fontWeight: '700', fontSize: 14 },
  metrics: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, backgroundColor: '#F1F6FF', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, gap: 2 },
  reason: { flexDirection: 'row', gap: 8, backgroundColor: color.primary50, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14 },
});
