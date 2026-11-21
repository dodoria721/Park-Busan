// UI-02 결과 목록 + UI-03 지도 + UI-05 후속 질의 (Figma 04·05·08)
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinutes, type Place, type SearchConditions } from '@parkbusan/shared';
import { api, errorMessage } from '../api';
import { runRecommend, session } from '../session';
import { Button, Card, Chip, Mascot, Notice, PlacePicker, s } from '../ui';
import { color, font, shadow } from '../theme';
import ResultMap from '../components/ResultMap';
import LotCard from '../components/LotCard';

const LABEL: Record<keyof SearchConditions, string> = { destination: '목적지', durationMinutes: '주차 시간', budget: '예산' };
const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function Results() {
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState(session.result);
  const [conditions, setConditions] = useState(session.conditions);
  const [place, setPlace] = useState(session.place);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [follow, setFollow] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'info' | 'warn' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState<{ c: SearchConditions; places: Place[] } | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  const top = result?.top[0];
  // FR-013: 목록을 먼저 보여 준 뒤 1순위 추천 이유를 따로 요청한다.
  useEffect(() => {
    setReason(null);
    if (!top || !place || !conditions?.durationMinutes) return;
    let alive = true;
    api
      .explain({ lotId: top.lot.id, destination: place, durationMinutes: conditions.durationMinutes, budget: conditions.budget })
      .then((r) => alive && setReason(r.text))
      .catch(() => alive && setReason('추천 이유를 불러오지 못했습니다.'));
    return () => {
      alive = false;
    };
  }, [top?.lot.id, place, conditions]);

  if (!result || !conditions || !place) {
    // UC-002 2a
    return (
      <View style={s.screen}>
        <Notice kind="warn" text="이전 검색 결과가 없습니다. 처음부터 다시 검색해 주세요." />
        <Button title="처음으로" onPress={() => router.replace('/')} />
      </View>
    );
  }

  async function apply(c: SearchConditions, p: Place, changed: (keyof SearchConditions)[]) {
    const r = await runRecommend(c, p);
    setResult(r);
    setConditions(c);
    setPlace(p);
    setSelected(null);
    setShowAll(false);
    setPending(null);
    setFollow('');
    setMsg({ kind: 'info', text: `반영된 조건: ${changed.map((k) => LABEL[k]).join(', ')}` });
  }

  // FR-019: 이전 조건을 유지하고 바뀐 항목만 반영
  async function followUp() {
    if (!follow.trim() || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const { conditions: c, changed } = await api.parse({ query: follow, previous: conditions });
      if (!c.durationMinutes) {
        setMsg({ kind: 'warn', text: '주차 시간이 없습니다. 조건 수정에서 입력해 주세요.' });
        return;
      }
      if (changed.includes('destination') && c.destination && c.destination !== conditions!.destination) {
        const found = (await api.places(c.destination)).places;
        if (found.length === 0) return setMsg({ kind: 'warn', text: '새 목적지를 찾지 못했습니다.' });
        if (found.length > 1) return setPending({ c, places: found });
        await apply(c, found[0], changed);
      } else {
        await apply(c, place!, changed);
      }
    } catch (e) {
      setMsg({ kind: 'error', text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  const feeLabel = `${formatMinutes(conditions.durationMinutes!)} 예상`;
  const budgetText = conditions.budget == null ? '예산 제한 없음' : `${conditions.budget.toLocaleString('ko-KR')}원 이하`;
  const list = showAll ? result.all : result.top;
  const mapItems = [...result.all, ...result.needsCheck];
  const sel = mapItems.find((c) => c.lot.id === selected);
  const empty = result.all.length === 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: `${place.name} 주변` }} />
      <ScrollView contentContainerStyle={s.screen} keyboardShouldPersistTaps="handled">
        <Text style={s.sub}>
          {formatMinutes(conditions.durationMinutes!)} · {budgetText} · 반경 2km
        </Text>
        <View style={s.wrap}>
          <Chip label="목록" selected={view === 'list'} onPress={() => setView('list')} />
          <Chip label="지도" selected={view === 'map'} onPress={() => setView('map')} />
          <Chip label="조건 수정" onPress={back} />
        </View>

        {result.liveWarning && <Notice kind="warn" text={result.liveWarning} />}

        {empty ? (
          // FR-016 (Figma 08)
          <View style={{ alignItems: 'center', gap: 10, paddingVertical: 16 }}>
            <Mascot pose="think" height={150} />
            <Text style={[font.heading, { color: color.navy, textAlign: 'center' }]}>검색 조건에 맞는 주차장이 없습니다</Text>
            <Text style={[s.sub, { textAlign: 'center' }]}>
              {result.excluded.overBudget > 0 ? '예산을 늘리면 더 많은 주차장을 볼 수 있어요.' : '목적지나 주차 시간을 바꿔 다시 찾아보세요.'}
            </Text>
            <Button title="검색 조건 직접 수정" chevron onPress={back} style={{ alignSelf: 'stretch', marginTop: 8 }} />
          </View>
        ) : (
          <Card style={st.found}>
            <Mascot pose="found" height={52} />
            <View style={{ flex: 1 }}>
              <Text style={[font.body15, { fontWeight: '700', color: color.navy }]}>조건에 맞는 {result.all.length}곳을 찾았어요!</Text>
              <Text style={s.sub}>
                만차 {result.excluded.full}곳 · 예산 초과 {result.excluded.overBudget}곳 제외
              </Text>
            </View>
          </Card>
        )}

        {view === 'list' ? (
          <>
            {list.map((c, i) => (
              <LotCard key={c.lot.id} c={c} rank={i + 1} feeLabel={feeLabel} reason={i === 0 ? reason : undefined} />
            ))}
            {result.all.length > result.top.length && (
              <Button
                title={showAll ? '상위 5개만 보기' : `전체 ${result.all.length}개 보기`}
                variant="outline"
                onPress={() => setShowAll(!showAll)}
              />
            )}
            {result.needsCheck.length > 0 && (
              <View style={{ gap: 10, marginTop: 6 }}>
                <Text style={s.h2}>요금 확인 필요 ({result.needsCheck.length})</Text>
                <Text style={s.sub}>요금 정보가 부족해 예산 충족 여부를 알 수 없는 주차장입니다.</Text>
                {result.needsCheck.map((c) => (
                  <LotCard key={c.lot.id} c={c} feeLabel={feeLabel} />
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <ResultMap dest={place} items={mapItems} selectedId={selected} onSelect={setSelected} />
            {sel ? <LotCard c={sel} feeLabel={feeLabel} /> : <Text style={s.sub}>마커를 누르면 요약 정보가 표시됩니다.</Text>}
          </>
        )}

        {msg && <Notice kind={msg.kind} text={msg.text} />}
        {pending && <PlacePicker places={pending.places} onPick={(p) => apply(pending.c, p, ['destination'])} />}
      </ScrollView>

      {/* UI-05: 후속 질의 */}
      <View style={[st.refine, { paddingBottom: 12 + insets.bottom }]}>
        <View style={st.refineInput}>
          <Text style={{ color: color.primary, fontWeight: '700' }}>✦</Text>
          <TextInput
            style={[font.body, { flex: 1, color: color.text, paddingVertical: 0 }]}
            value={follow}
            onChangeText={setFollow}
            placeholder="“더 싼 곳”처럼 다시 물어보세요"
            placeholderTextColor={color.disabled}
            onSubmitEditing={followUp}
            returnKeyType="send"
            accessibilityLabel="후속 질의 입력"
          />
        </View>
        <Pressable
          onPress={followUp}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="다시 찾기"
          style={[st.send, busy && { backgroundColor: color.disabled }]}
        >
          <Text style={{ color: color.surface, fontSize: 20, fontWeight: '700' }}>{busy ? '…' : '↑'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  found: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.bg, paddingVertical: 10 },
  refine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 16,
    backgroundColor: color.surface,
    borderTopWidth: 1,
    borderTopColor: color.line,
    ...shadow,
  },
  refineInput: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: color.bg, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
});
