import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '@/constants/theme';

export function SearchForm({ onSubmit }: { onSubmit: (query: string) => void }) {
  const [query, setQuery] = useState('');
  const submit = () => query.trim() && onSubmit(query.trim());
  return (
    <View style={styles.wrapper}>
      <TextInput value={query} onChangeText={setQuery} onSubmitEditing={submit} placeholder="예: 삼락, 해운대, 장산역" placeholderTextColor="#7a8b94" style={styles.input} accessibilityLabel="주차장 검색 조건" />
      <Pressable accessibilityRole="button" style={[styles.button, !query.trim() && styles.disabled]} onPress={submit} disabled={!query.trim()}><Text style={styles.buttonText}>주차장 찾기</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 10 }, input: { minHeight: 104, padding: 16, borderRadius: 16, backgroundColor: colors.surface, color: colors.ink, fontSize: 16, textAlignVertical: 'top' },
  button: { backgroundColor: colors.primary, padding: 16, borderRadius: 14, alignItems: 'center' }, disabled: { opacity: 0.45 }, buttonText: { color: 'white', fontWeight: '800', fontSize: 16 },
});
