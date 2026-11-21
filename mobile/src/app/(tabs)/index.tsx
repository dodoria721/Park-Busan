// UI-01 메인/질의 (Figma 02 홈): 말로 찾기(FR-001·002) ↔ 조건으로 찾기(FR-003, FR-018 직접 입력)
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMinutes, type Place, type SearchConditions } from '@parkbusan/shared';
import { ApiError, api, errorMessage } from '../../api';
import { runRecommend, session } from '../../session';
import { Button, Card, Chip, Field, Mascot, Notice, PlacePicker, Searching, Stepper, Wordmark, s } from '../../ui';
import { color, font, radius, shadow } from '../../theme';

type Msg = { kind: 'warn' | 'error' | 'info'; title?: string; text: string } | null;
const HOURS = [1, 2, 3, 4];
const BUDGETS: (number | null)[] = [null, 3000, 5000, 10000];

export default function Home() {
  const insets = useSafeAreaInsets();
  const prev = session.conditions;
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'talk' | 'form'>(prev ? 'form' : 'talk');
  const [dest, setDest] = useState(prev?.destination ?? '');
  const [hours, setHours] = useState(prev?.durationMinutes ? String(prev.durationMinutes / 60) : '');
  const [budget, setBudget] = useState(prev?.budget != null ? String(prev.budget) : '');
  const [msg, setMsg] = useState<Msg>(null);
  const [aiQuote, setAiQuote] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [busy, setBusy] = useState<'analyze' | 'search' | null>(null);

  // 결과 화면에서 후속 질의로 조건이 바뀐 뒤 돌아오면 폼을 최신 조건으로 맞춘다.
  useFocusEffect(
    useCallback(() => {
      const c = session.conditions;
      if (!c) return;
      setDest(c.destination ?? '');
      setHours(c.durationMinutes ? String(c.durationMinutes / 60) : '');
      setBudget(c.budget != null ? String(c.budget) : '');
    }, []),
  );

  async function analyze() {
    if (!query.trim()) return setMsg({ kind: 'warn', text: '검색 문장을 입력해 주세요.' });
    setBusy('analyze');
    setMsg(null);
    setPlaces([]);
    setAiQuote(null);
    try {
      const { conditions: c } = await api.parse({ query });
      setDest(c.destination ?? '');
      setHours(c.durationMinutes ? String(c.durationMinutes / 60) : '');
      setBudget(c.budget != null ? String(c.budget) : '');
      setAiQuote(query.trim());
      if (!c.destination) setMsg({ kind: 'warn', text: '목적지를 찾지 못했어요. 목적지를 입력해 주세요.' });
    } catch (e) {
      // FR-018: 분석 실패 시 직접 입력 폼으로 전환
      setMsg({ kind: 'error', title: 'AI가 문장을 분석하지 못했어요', text: `${errorMessage(e)} 아래에 조건을 직접 입력해 주세요.` });
    } finally {
      setMode('form');
      setBusy(null);
    }
  }

  function readForm(): SearchConditions | string {
    const h = Number(hours);
    if (!dest.trim()) return '목적지를 입력해 주세요.';
    if (!hours.trim() || !(h > 0) || h > 24 * 7) return '주차 시간을 0보다 큰 시간 단위로 입력해 주세요. 예: 2, 1.5';
    const b = budget.trim() === '' ? null : Number(budget.replace(/,/g, ''));
    if (b !== null && !(Number.isInteger(b) && b >= 0)) return '예산은 원 단위 숫자로 입력하거나 비워 두세요.';
    return { destination: dest.trim(), durationMinutes: Math.round(h * 60), budget: b };
  }

  async function search(c: SearchConditions, place?: Place) {
    setBusy('search');
    setMsg(null);
    try {
      if (!place) {
        const found = (await api.places(c.destination!)).places;
        if (found.length === 0) return setMsg({ kind: 'warn', text: '목적지를 찾지 못했어요. 다른 이름으로 입력해 주세요.' });
        if (found.length > 1) return setPlaces(found);
        place = found[0];
      }
      setPlaces([]);
      await runRecommend(c, place);
      router.push('/results');
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof ApiError ? e.message : errorMessage(e) });
    } finally {
      setBusy(null);
    }
  }

  function submit(place?: Place) {
    const c = readForm();
    if (typeof c === 'string') return setMsg({ kind: 'warn', text: c });
    void search(c, place);
  }

  if (busy === 'search') return <Searching />;

  const talk = mode === 'talk';
  const recent = session.result && session.place && session.conditions;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: color.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.screen, { paddingTop: insets.top + 12, gap: 16 }]} keyboardShouldPersistTaps="handled">
        <View style={st.header}>
          <Wordmark height={40} />
          <View style={st.tagline}>
            <Text style={[font.caption, { color: color.surface, fontWeight: '700' }]}>부산 스마트 주차 도우미</Text>
          </View>
        </View>

        <View style={st.hero}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[font.title, { color: color.surface }]}>어디로 가세요?</Text>
            <Text style={[font.caption, { color: '#DCE8FD' }]}>
              {talk ? '말하듯 적으면 알맞은\n주차장을 찾아 드려요' : '목적지와 시간만 고르면\n바로 비교해 드려요'}
            </Text>
          </View>
          <View style={st.heroTile}>
            <Mascot pose={talk ? 'wink' : 'basic'} height={84} />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Chip label="말로 찾기" selected={talk} onPress={() => setMode('talk')} />
          </View>
          <View style={{ flex: 1 }}>
            <Chip label="조건으로 찾기" selected={!talk} onPress={() => setMode('form')} />
          </View>
        </View>

        {talk ? (
          <View style={st.query}>
            <TextInput
              style={[font.body15, { minHeight: 52, color: color.text, textAlignVertical: 'top' }]}
              multiline
              placeholder="예) 서면역 근처 3시간, 5천 원 이하로 찾아줘"
              placeholderTextColor={color.disabled}
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="자연어 검색 입력"
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <Pressable
                onPress={analyze}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="AI로 조건 분석"
                style={[st.send, busy && { backgroundColor: color.disabled }]}
              >
                <Text style={{ color: color.surface, fontSize: 20, fontWeight: '700' }}>{busy ? '…' : '↑'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Stepper step={0} />
            {aiQuote && !msg && <Notice kind="info" title="AI가 이렇게 이해했어요" text={`“${aiQuote}”`} />}
            <Card style={{ gap: 14 }}>
              <Field label="목적지" required value={dest} onChangeText={setDest} placeholder="예: 서면역" />
              <Field label="주차 예정 시간 (시간)" required value={hours} onChangeText={setHours} placeholder="예: 2" keyboardType="decimal-pad" />
              <View style={s.wrap}>
                {HOURS.map((h) => (
                  <Chip key={h} label={`${h}시간`} selected={Number(hours) === h} onPress={() => setHours(String(h))} />
                ))}
              </View>
              <Field label="최대 예산 (원)" value={budget} onChangeText={setBudget} placeholder="비우면 제한 없음" keyboardType="number-pad" />
              <View style={s.wrap}>
                {BUDGETS.map((b) => (
                  <Chip
                    key={String(b)}
                    label={b == null ? '제한 없음' : `${b.toLocaleString('ko-KR')}원`}
                    selected={b == null ? budget.trim() === '' : Number(budget) === b}
                    onPress={() => setBudget(b == null ? '' : String(b))}
                  />
                ))}
              </View>
            </Card>
          </>
        )}

        {msg && <Notice kind={msg.kind} title={msg.title} text={msg.text} pose={msg.kind === 'error' ? 'think' : undefined} />}
        {places.length > 1 && <PlacePicker places={places} onPick={(p) => submit(p)} />}

        {!talk && <Button title="주차장 검색" chevron onPress={() => submit()} disabled={busy !== null} />}

        {talk && recent && (
          <View style={{ gap: 10 }}>
            <Text style={s.section}>최근 목적지</Text>
            <Card onPress={() => router.push('/results')} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[font.heading, { color: color.text }]}>{session.place!.name}</Text>
                <Text style={s.sub}>
                  {formatMinutes(session.conditions!.durationMinutes!)} ·{' '}
                  {session.conditions!.budget == null ? '예산 제한 없음' : `${session.conditions!.budget.toLocaleString('ko-KR')}원 이하`}
                </Text>
              </View>
              <Text style={{ color: color.navy, fontSize: 22 }}>›</Text>
            </Card>
          </View>
        )}

        <Text style={[s.sub, { textAlign: 'center' }]}>현재 가상(Mock) 데이터로 동작합니다.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tagline: { backgroundColor: color.primary, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 12 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: color.primary, borderRadius: 26, padding: 18, ...shadow, shadowColor: color.primary, shadowOpacity: 0.25 },
  heroTile: { width: 92, height: 92, borderRadius: 26, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  query: { backgroundColor: color.surface, borderRadius: 22, borderWidth: 2, borderColor: color.primary, padding: 18, gap: 12, ...shadow },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center' },
});
