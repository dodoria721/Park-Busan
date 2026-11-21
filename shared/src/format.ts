import type { FeeResult, LiveView } from './types.ts';

export const NO_INFO = '정보 없음';
export const UNAVAILABLE = '확인 불가';

export function formatDistance(m: number): string {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`;
}

export function formatWon(n: number): string {
  return n === 0 ? '무료' : `${n.toLocaleString('ko-KR')}원`;
}

export function formatFee(f: FeeResult | null): string {
  if (!f) return NO_INFO;
  return f.status === 'ok' ? formatWon(f.fee) : '요금 계산 불가';
}

export function formatTime(iso: string | null): string {
  if (!iso) return '갱신 시각 없음';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '갱신 시각 없음';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} 갱신`;
}

export function formatLive(v: LiveView): string {
  switch (v.state) {
    case 'unsupported':
      return `실시간 ${NO_INFO}`;
    case 'error':
      return `실시간 ${UNAVAILABLE}`;
    case 'stale':
      return `자리 확인 필요 (${formatTime(v.updatedAt)})`;
    case 'ok':
      return v.available == null
        ? `잔여 ${UNAVAILABLE} (${formatTime(v.updatedAt)})`
        : `잔여 ${v.available}면${v.total != null ? ` / ${v.total}면` : ''} (${formatTime(v.updatedAt)})`;
  }
}

export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h}시간` : '', m ? `${m}분` : ''].filter(Boolean).join(' ') || '0분';
}
