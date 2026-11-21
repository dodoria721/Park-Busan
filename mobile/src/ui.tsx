// Figma "UI Kit 컴포넌트" 페이지의 코드 버전. 화면은 여기 있는 조각만 조합한다.
import type { ReactNode } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { formatTime, type LiveView, type Place } from '@parkbusan/shared';
import { color, font, radius, shadow } from './theme';

export { color };

// ---- Mascot (배경 제거된 키트 포즈) ----
const POSES = {
  basic: require('../assets/mascot/basic.png'),
  wink: require('../assets/mascot/wink.png'),
  think: require('../assets/mascot/think.png'),
  search: require('../assets/mascot/search.png'),
  found: require('../assets/mascot/found.png'),
};
const RATIO = { basic: 130 / 153, wink: 142 / 153, think: 145 / 155, search: 128 / 153, found: 153 / 157 };
export type Pose = keyof typeof POSES;

export function Mascot({ pose, height }: { pose: Pose; height: number }) {
  return (
    <Image
      source={POSES[pose]}
      style={{ height, width: Math.round(height * RATIO[pose]) }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

export function Wordmark({ height = 40 }: { height?: number }) {
  return (
    <Image
      source={require('../assets/mascot/wordmark.png')}
      style={{ height, width: Math.round((height * 188) / 106) }}
      resizeMode="contain"
      accessibilityLabel="Park Busan"
    />
  );
}

// ---- Button: Primary / Confirm / Cancel / Outline ----
type ButtonVariant = 'primary' | 'confirm' | 'cancel' | 'outline';
export function Button(props: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  chevron?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = props.variant ?? 'primary';
  const fg = v === 'primary' ? color.surface : v === 'confirm' ? color.primary700 : v === 'cancel' ? color.sub : color.navy;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={props.onPress}
      disabled={props.disabled}
      style={({ pressed }) => [s.btn, btnStyle[v], props.disabled && s.btnDisabled, pressed && { opacity: 0.85 }, props.style]}
    >
      <Text style={[s.btnText, { color: props.disabled ? color.disabled : fg }]}>{props.title}</Text>
      {props.chevron && <Text style={[s.btnChevron, { color: fg }]}>›</Text>}
    </Pressable>
  );
}

// ---- Chip: Selected / Default ----
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[s.chip, selected ? s.chipOn : s.chipOff]}
    >
      <Text style={[font.label, { fontWeight: '700', color: selected ? color.surface : color.navy }]}>
        {label}
        {selected ? '  ✓' : ''}
      </Text>
    </Pressable>
  );
}

// ---- Badge (Size=S): 실시간 상태 ----
type BadgeTone = 'ok' | 'busy' | 'full' | 'none';
const BADGE: Record<BadgeTone, { bg: string; fg: string; line: string }> = {
  ok: { bg: color.successBg, fg: color.success, line: '#9ED9BE' },
  busy: { bg: color.warningBg, fg: color.warning, line: '#F3C590' },
  full: { bg: color.danger, fg: color.surface, line: '#C93A3F' },
  none: { bg: color.neutralBg, fg: color.sub, line: '#CDD3DD' },
};
export function Badge({ tone, label }: { tone: BadgeTone; label: string }) {
  const c = BADGE[tone];
  return (
    <View style={[s.badge, { backgroundColor: c.bg, borderColor: c.line }]}>
      <Text style={[font.caption, { fontWeight: '700', color: c.fg }]}>{label}</Text>
    </View>
  );
}

/** 실시간 상태 → 배지. 여유(30% 이상) / 혼잡 / 만차 / 확인 불가·정보 없음 */
export function liveBadge(v: LiveView): { tone: BadgeTone; label: string } {
  if (v.state === 'unsupported') return { tone: 'none', label: '정보 없음' };
  if (v.state === 'error') return { tone: 'none', label: '확인 불가' };
  if (v.state === 'stale' || v.available == null) return { tone: 'none', label: '자리 확인 필요' };
  if (v.available === 0) return { tone: 'full', label: '만차' };
  if (v.total && v.available / v.total < 0.3) return { tone: 'busy', label: '혼잡' };
  return { tone: 'ok', label: '여유' };
}

/** 실시간 칸에 쓸 값과 라벨 */
export function liveTile(v: LiveView): { value: string; label: string; tint: string } {
  if (v.state === 'unsupported') return { value: '정보 없음', label: '실시간', tint: color.disabled };
  if (v.state === 'error') return { value: '확인 불가', label: '실시간', tint: color.disabled };
  const value = v.available == null ? '확인 불가' : `${v.available}면`;
  const tint = liveBadge(v).tone === 'ok' ? color.success : liveBadge(v).tone === 'none' ? color.disabled : color.warning;
  return { value, label: `잔여 · ${formatTime(v.updatedAt).replace(' 갱신', '')}`, tint };
}

// ---- Card ----
export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.card, pressed && { opacity: 0.92 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[s.card, style]}>{children}</View>;
}

// ---- Notice: 안내 배너 (경고·오류·정보), 선택적으로 마스코트 ----
export function Notice({ kind, title, text, pose }: { kind: 'warn' | 'error' | 'info'; title?: string; text: string; pose?: Pose }) {
  const bg = kind === 'info' ? color.primary50 : kind === 'warn' ? color.warningBg : color.dangerBg;
  const fg = kind === 'info' ? color.navy : kind === 'warn' ? color.warningText : color.danger;
  return (
    <View style={[s.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      {pose ? <Mascot pose={pose} height={54} /> : <Text style={{ color: fg, fontWeight: '700' }}>{kind === 'info' ? '✦' : '!'}</Text>}
      <View style={{ flex: 1, gap: 2 }}>
        {title && <Text style={[font.label, { fontWeight: '700', color: fg }]}>{title}</Text>}
        <Text style={[font.caption, { color: fg }]}>{text}</Text>
      </View>
    </View>
  );
}

// ---- 입력 ----
export function Field({ label, required, ...input }: { label: string; required?: boolean } & TextInputProps) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[font.label, { fontWeight: '700', color: color.text }]}>
        {label} <Text style={{ color: required ? color.primary : color.disabled, fontWeight: '500' }}>{required ? '필수' : '선택'}</Text>
      </Text>
      <TextInput placeholderTextColor={color.disabled} style={s.input} {...input} />
    </View>
  );
}

// ---- Stepper: 조건 입력 → 주차장 추천 → 경로 안내 ----
export function Stepper({ step }: { step: 0 | 1 | 2 }) {
  const labels = ['조건 입력', '주차장 추천', '경로 안내'];
  return (
    <View style={{ gap: 6, paddingHorizontal: 16 }}>
      <View style={s.stepper}>
        {labels.map((l, i) => (
          <View key={l} style={[{ flexDirection: 'row', alignItems: 'center' }, i > 0 && { flex: 1 }]}>
            {i > 0 && <View style={[s.stepLine, { backgroundColor: i <= step ? color.primary : color.line }]} />}
            <View style={[s.stepDot, i <= step ? { backgroundColor: color.primary } : s.stepDotOff]}>
              <Text style={{ color: i <= step ? color.surface : color.disabled, fontWeight: '700', fontSize: 13 }}>{i < step ? '✓' : i + 1}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -16 }}>
        {labels.map((l, i) => (
          <Text
            key={l}
            style={[font.caption, { width: 72, textAlign: 'center', color: i <= step ? color.navy : color.disabled, fontWeight: i === step ? '700' : '400' }]}
          >
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** 목적지 후보가 2개 이상일 때 선택(FR-004, UC-001 4a) */
export function PlacePicker({ places, onPick }: { places: Place[]; onPick: (p: Place) => void }) {
  return (
    <Card>
      <Text style={s.cardTitle}>목적지 후보가 {places.length}곳이에요</Text>
      {places.map((p) => (
        <Pressable key={p.id} onPress={() => onPick(p)} style={s.pickRow} accessibilityRole="button">
          <View style={s.radio} />
          <View style={{ flex: 1 }}>
            <Text style={[font.body15, { fontWeight: '700', color: color.navy }]}>{p.name}</Text>
            <Text style={[font.caption, { color: color.sub }]}>{p.address}</Text>
          </View>
          <Text style={{ color: color.disabled, fontSize: 18 }}>›</Text>
        </Pressable>
      ))}
    </Card>
  );
}

/** 주차장을 찾는 동안 보여 주는 화면(Figma 11) */
export function Searching() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: color.surface }}>
      <Mascot pose="search" height={180} />
      <Text style={[font.title, { color: color.navy }]}>주차장을 찾고 있어요...</Text>
      <Text style={[font.body, { color: color.sub, textAlign: 'center' }]}>반경 2km 공영주차장의 요금과{'\n'}실시간 자리를 확인하고 있어요.</Text>
    </View>
  );
}

const btnStyle = StyleSheet.create({
  primary: { backgroundColor: color.primary, ...shadow, shadowColor: color.primary, shadowOpacity: 0.25 },
  confirm: { backgroundColor: color.primary50, borderWidth: 2, borderColor: color.primary },
  cancel: { backgroundColor: color.neutralBg },
  outline: { backgroundColor: color.surface, borderWidth: 2, borderColor: color.primary100 },
});

export const s = StyleSheet.create({
  screen: { padding: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h1: { ...font.title, color: color.navy },
  h2: { ...font.heading, color: color.text },
  cardTitle: { ...font.heading, color: color.text },
  sub: { ...font.caption, color: color.sub },
  section: { ...font.label, fontWeight: '700', color: color.sub },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderColor: color.primary100,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 10,
    ...shadow,
  },
  input: {
    borderWidth: 2,
    borderColor: color.primary100,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...font.body15,
    color: color.text,
    backgroundColor: color.surface,
  },
  btn: { minHeight: 54, borderRadius: radius.lg, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  btnDisabled: { backgroundColor: color.neutralBg, borderWidth: 0, shadowOpacity: 0, elevation: 0 },
  btnText: { ...font.heading, fontSize: 16, textAlign: 'center' },
  btnChevron: { fontSize: 22, fontWeight: '700', marginTop: -2 },
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.full, alignItems: 'center' },
  chipOn: { backgroundColor: color.primary },
  chipOff: { backgroundColor: color.surface, borderWidth: 2, borderColor: color.primary100 },
  badge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start' },
  notice: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 14, borderRadius: 16 },
  inline: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  stepLine: { flex: 1, height: 3, borderRadius: 2, marginHorizontal: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepDotOff: { backgroundColor: color.surface, borderWidth: 1.5, borderColor: '#C9D3E2' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: color.bg },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: color.disabled, backgroundColor: color.surface },
});
