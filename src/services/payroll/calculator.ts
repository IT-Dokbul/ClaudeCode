import {
  addDays, eachDayOfInterval, getDay, getYear, parseISO, format,
  startOfISOWeek, endOfISOWeek,
} from 'date-fns';
import type { WorkEntry, WageRate, PayrollSettings, DailyResult, PayrollResult, WeeklyHolidayResult } from '../../types';
import { isNightMinute } from './rules/night';
import { getHolidayName } from './rules/publicHolidays';

// ─────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────

function parseTimeRange(startTime: string, endTime: string): { startMin: number; endMin: number } {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) endMin += 1440;
  return { startMin, endMin };
}

function resolveHourlyWage(year: number, wageRates: WageRate[]): number {
  const sorted = [...wageRates].sort((a, b) => b.year - a.year);
  const exact = sorted.find((r) => r.year === year);
  if (exact) return exact.hourlyWage;
  const prev = sorted.find((r) => r.year < year);
  return (prev ?? sorted[0]).hourlyWage;
}

/** DailyResult 기반으로 급여 재계산 (연장/야간/공휴일 보너스 스택 방식) */
function recalcPay(d: DailyResult, settings: PayrollSettings): number {
  const { overtimeBonusRate, nightBonusRate, holidayBonusRate, holidayPayEnabled } = settings;
  const totalWorked = d.regularMinutes + d.overtimeMinutes;
  const pay = (
    totalWorked
    + d.overtimeMinutes * overtimeBonusRate
    + d.nightMinutes * nightBonusRate
    + (holidayPayEnabled && d.isHoliday ? totalWorked * holidayBonusRate : 0)
  ) * d.hourlyWage / 60;
  return Math.round(pay);
}

/** 하루치 DailyResult 계산 (일간 8h 연장 + 야간 분류) */
function calcDay(
  date: string,
  startMin: number,
  endMin: number,
  breakMinutes: number,
  hourlyWage: number,
  settings: PayrollSettings,
  customHolidays: string[],
): DailyResult {
  const { nightStartHour, nightEndHour, dailyWorkLimit } = settings;
  const dailyLimitMin = dailyWorkLimit * 60;

  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let nightMinutes = 0;
  let accumulated = 0;

  const workedIntervalMin = endMin - startMin;
  const breakRatio = workedIntervalMin > 0 ? breakMinutes / workedIntervalMin : 0;
  let fractionalBreak = 0;

  for (let m = startMin; m < endMin; m++) {
    fractionalBreak += breakRatio;
    if (fractionalBreak >= 1) { fractionalBreak -= 1; continue; }

    accumulated++;
    const minuteOfDay = m % 1440;

    if (isNightMinute(minuteOfDay, nightStartHour, nightEndHour)) nightMinutes++;
    if (accumulated > dailyLimitMin) overtimeMinutes++;
    else regularMinutes++;
  }

  const holidayName = getHolidayName(date, customHolidays) ?? undefined;
  const isHoliday = holidayName !== undefined;

  const draft: DailyResult = {
    date, totalMinutes: regularMinutes + overtimeMinutes,
    regularMinutes, overtimeMinutes, nightMinutes,
    isHoliday, holidayName, hourlyWage, pay: 0,
  };
  draft.pay = recalcPay(draft, settings);
  return draft;
}

/** 주 40시간 초과 연장: daily 목록을 순방향으로 순회하며 초과분을 overtime으로 재분류 */
function applyWeeklyOvertime(daily: DailyResult[], settings: PayrollSettings): DailyResult[] {
  if (!settings.weeklyOvertimeEnabled) return daily;

  const weeklyLimitMin = 40 * 60; // 2400분

  // ISO 주별 날짜 그룹 (월~일)
  const weekMap = new Map<string, string[]>();
  for (const d of daily) {
    const monday = format(startOfISOWeek(parseISO(d.date)), 'yyyy-MM-dd');
    const arr = weekMap.get(monday) ?? [];
    arr.push(d.date);
    weekMap.set(monday, arr);
  }

  const mutable = new Map(daily.map((d) => [d.date, { ...d }]));

  for (const [, dates] of weekMap) {
    const sortedDates = [...dates].sort();
    let weeklyAccBefore = 0;

    for (const date of sortedDates) {
      const d = mutable.get(date)!;
      const weeklyRemainingBefore = Math.max(0, weeklyLimitMin - weeklyAccBefore);

      // 이번 날에서 주간 한도를 초과하는 분수
      const weeklyOvertimeFromDay = Math.max(0, d.totalMinutes - weeklyRemainingBefore);

      if (weeklyOvertimeFromDay > 0) {
        // 이미 일간 OT로 처리된 분 제외 → 추가로 재분류해야 할 regular 분
        const additionalOT = Math.max(0, weeklyOvertimeFromDay - d.overtimeMinutes);
        if (additionalOT > 0) {
          const updated: DailyResult = {
            ...d,
            regularMinutes: d.regularMinutes - additionalOT,
            overtimeMinutes: d.overtimeMinutes + additionalOT,
          };
          updated.pay = recalcPay(updated, settings);
          mutable.set(date, updated);
        }
      }

      weeklyAccBefore += d.totalMinutes;
    }
  }

  return [...mutable.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** 주휴수당 계산 (주 15h 이상 근무 시, 비례 지급) */
function calcWeeklyHoliday(
  daily: DailyResult[],
  wageRates: WageRate[],
  settings: PayrollSettings,
): WeeklyHolidayResult[] {
  if (!settings.weeklyHolidayPay) return [];

  const weekMap = new Map<string, { minutes: number; wageSum: number; count: number; weekStart: Date }>();

  for (const d of daily) {
    const date = parseISO(d.date);
    const monday = startOfISOWeek(date);
    const weekKey = format(monday, 'yyyy-MM-dd');
    const prev = weekMap.get(weekKey) ?? { minutes: 0, wageSum: 0, count: 0, weekStart: monday };
    weekMap.set(weekKey, {
      minutes: prev.minutes + d.totalMinutes,
      wageSum: prev.wageSum + d.hourlyWage,
      count: prev.count + 1,
      weekStart: monday,
    });
  }

  const results: WeeklyHolidayResult[] = [];
  for (const [weekKey, data] of weekMap.entries()) {
    const workedHours = data.minutes / 60;
    if (workedHours < 15) continue;

    const avgWage = Math.round(data.wageSum / data.count);
    const fallbackWage = resolveHourlyWage(getYear(data.weekStart), wageRates);
    const wage = avgWage || fallbackWage;
    const holidayHours = Math.min(workedHours, 40) / 40 * 8;

    results.push({
      weekStart: weekKey,
      weekEnd: format(endOfISOWeek(data.weekStart), 'yyyy-MM-dd'),
      workedMinutes: data.minutes,
      hourlyWage: wage,
      holidayPay: Math.round(holidayHours * wage),
    });
  }

  return results.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

// ─────────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────────

export function calculatePayroll(
  entries: WorkEntry[],
  wageRates: WageRate[],
  settings: PayrollSettings,
  customHolidays: string[] = [],
): PayrollResult {
  const dailyMap = new Map<string, DailyResult>();

  for (const entry of entries) {
    const start = parseISO(entry.startDate);
    const end = parseISO(entry.endDate);
    if (end < start) continue; // 잘못된 날짜 범위 스킵
    const days = eachDayOfInterval({ start, end });
    const { startMin, endMin } = parseTimeRange(entry.startTime, entry.endTime);

    for (const day of days) {
      if (entry.daysOfWeek && entry.daysOfWeek.length > 0) {
        if (!entry.daysOfWeek.includes(getDay(day))) continue;
      }

      const dateStr = format(day, 'yyyy-MM-dd');

      if (endMin > 1440) {
        const todayEnd = 1440;
        const tomorrowStart = 0;
        const tomorrowEnd = endMin - 1440;
        const todayBreak = entry.breakMinutes > 0
          ? Math.round(entry.breakMinutes * (todayEnd - startMin) / (endMin - startMin))
          : 0;
        const tomorrowBreak = entry.breakMinutes - todayBreak;

        const wage = resolveHourlyWage(getYear(day), wageRates);
        accumulateDay(dailyMap, dateStr, startMin, todayEnd, todayBreak, wage, settings, customHolidays);

        const tomorrow = addDays(day, 1);
        const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
        const tomorrowWage = resolveHourlyWage(getYear(tomorrow), wageRates);
        accumulateDay(dailyMap, tomorrowStr, tomorrowStart, tomorrowEnd, tomorrowBreak, tomorrowWage, settings, customHolidays);
      } else {
        const wage = resolveHourlyWage(getYear(day), wageRates);
        accumulateDay(dailyMap, dateStr, startMin, endMin, entry.breakMinutes, wage, settings, customHolidays);
      }
    }
  }

  // 일간 결과 → 주 40h 연장 후처리
  const rawDaily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const daily = applyWeeklyOvertime(rawDaily, settings);

  // 주휴수당 계산
  const weekly = calcWeeklyHoliday(daily, wageRates, settings);
  const totalHolidayPay = weekly.reduce((s: number, w: WeeklyHolidayResult) => s + w.holidayPay, 0);

  // 월별 집계
  const monthMap = new Map<string, { pay: number; minutes: number }>();
  for (const d of daily) {
    const ym = d.date.slice(0, 7);
    const prev = monthMap.get(ym) ?? { pay: 0, minutes: 0 };
    monthMap.set(ym, { pay: prev.pay + d.pay, minutes: prev.minutes + d.totalMinutes });
  }
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, v]) => ({ yearMonth, ...v }));

  const totalWorkPay = daily.reduce((s: number, d: DailyResult) => s + d.pay, 0);
  const totalMinutes = daily.reduce((s: number, d: DailyResult) => s + d.totalMinutes, 0);

  return { daily, weekly, monthly, totalWorkPay, totalHolidayPay, totalPay: totalWorkPay + totalHolidayPay, totalMinutes };
}

function accumulateDay(
  map: Map<string, DailyResult>,
  dateStr: string,
  startMin: number,
  endMin: number,
  breakMinutes: number,
  hourlyWage: number,
  settings: PayrollSettings,
  customHolidays: string[],
): void {
  if (startMin >= endMin) return;
  const result = calcDay(dateStr, startMin, endMin, breakMinutes, hourlyWage, settings, customHolidays);
  if (result.totalMinutes === 0) return; // 휴게시간 초과 등으로 실근무 0분이면 스킵
  const prev = map.get(dateStr);
  if (!prev) {
    map.set(dateStr, result);
  } else {
    const merged: DailyResult = {
      date: dateStr,
      totalMinutes: prev.totalMinutes + result.totalMinutes,
      regularMinutes: prev.regularMinutes + result.regularMinutes,
      overtimeMinutes: prev.overtimeMinutes + result.overtimeMinutes,
      nightMinutes: prev.nightMinutes + result.nightMinutes,
      isHoliday: prev.isHoliday,
      holidayName: prev.holidayName,
      hourlyWage: prev.hourlyWage,
      pay: 0,
    };
    merged.pay = recalcPay(merged, settings);
    map.set(dateStr, merged);
  }
}
