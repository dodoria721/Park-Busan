import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/constants/theme';

export function FollowUpInput({ initialValue, onSubmit }: { initialValue: string; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState(initialValue);
  return <View style={styles.row}><TextInput value={value} onChangeText={setValue} onSubmitEditing={() => onSubmit(value.trim())} style={styles.input} placeholder="주차장 이름·지역명 검색" accessibilityLabel="후속 검색 조건" /><Pressable accessibilityRole="button" style={styles.button} onPress={() => onSubmit(value.trim())}><Text style={styles.text}>적용</Text></Pressable></View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 8 }, input: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, color: colors.ink }, button: { justifyContent: 'center', paddingHorizontal: 16, backgroundColor: colors.ink, borderRadius: 12 }, text: { color: 'white', fontWeight: '700' } });
