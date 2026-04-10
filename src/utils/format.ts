export function formatKRW(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return '계산 오류';
  return Math.round(amount).toLocaleString('ko-KR') + '원';
}

export function formatMinutes(minutes: number): string {
  if (!isFinite(minutes) || isNaN(minutes) || minutes < 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}
