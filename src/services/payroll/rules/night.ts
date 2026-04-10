/**
 * 특정 분(0~1439)이 야간 시간대인지 판별한다.
 * nightStart=22, nightEnd=6 → 22:00 이후 또는 06:00 이전
 */
export function isNightMinute(minuteOfDay: number, nightStartHour: number, nightEndHour: number): boolean {
  const nightStart = nightStartHour * 60;
  const nightEnd = nightEndHour * 60;

  if (nightStart > nightEnd) {
    // 자정을 걸치는 경우 (예: 22:00 ~ 06:00)
    return minuteOfDay >= nightStart || minuteOfDay < nightEnd;
  }
  // 자정을 걸치지 않는 경우
  return minuteOfDay >= nightStart && minuteOfDay < nightEnd;
}
