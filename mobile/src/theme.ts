// Figma "ParkBusan Tokens" / text styles 와 같은 값. 디자인을 바꾸면 여기만 고친다.
export const color = {
  primary: '#3B7BE8',
  primary700: '#2B68DC',
  primary50: '#EAF2FE',
  primary100: '#D6E4FA',
  navy: '#172B5E',
  bg: '#F2F5FC',
  surface: '#FFFFFF',
  text: '#18213A',
  sub: '#6B7689',
  disabled: '#9AA3B2',
  line: '#E2E8F2',
  success: '#13A06B',
  successBg: '#E6F7EE',
  warning: '#E8871E',
  warningBg: '#FDF1E2',
  warningText: '#8A4B0B',
  danger: '#E5484D',
  dangerBg: '#FDE8E8',
  neutralBg: '#EEF1F5',
} as const;

export const radius = { sm: 8, md: 12, lg: 18, card: 20, full: 999 } as const;

export const font = {
  display: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  title: { fontSize: 22, fontWeight: '700', lineHeight: 30 },
  heading: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  body15: { fontSize: 15, fontWeight: '500', lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '500', lineHeight: 18 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 17 },
} as const;

export const shadow = {
  shadowColor: '#172B5E',
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
} as const;
