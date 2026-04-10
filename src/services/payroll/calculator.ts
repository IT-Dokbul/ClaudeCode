import { addDays, eachDayOfInterval, getDay, getYear, parseISO, format, startOfISOWeek, endOfISOWeek } from 'date-fns';
import type { WorkEntry, WageRate, PayrollSettings, DailyResult, PayrollResult, WeeklyHolidayResult } from '../../types';
import { isNightMinute } from './rules/night';

// ─────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────

/** WorkEntry 의 시작/종료 시각을 분(minuteOfDay, 0~1439+) 으로 변환.
 *  종료 < 시작이면 종료에 1440을 더해 다음날로 취급. */
function parseTimeRange(startTime: string, endTime: string): { startMin: number; endMin: number } {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  if (endMin <= startMin) {
    endMin += 1440; // 다음날
  }
  return { startMin, endMin };
}

/** 연도에 해당하는 시급 반환. 없으면 가장 최근 연도 시급 사용. */
function resolveHourlyWage(year: number, wageRates: WageRate[]): number {
  const sorted = [...wageRates].sort((a, b) => b.year - a.year);
  const exact = sorted.find((r) => r.year === year);
  if (exact) return exact.hourlyWage;
  const prev = sorted.find((r) => r.year < year);
  return (prev ?? sorted[0]).hourlyWage;
}

/** 특정 날짜(date string)에 대한 DailyResult 계산.
 *  startMin / endMin 은 해당 날 자정 기준 분. */
function calcDay(
  date: string,
  startMin: number,
  endMin: number,
  breakMinutes: number,
  hourlyWage: number,
  settings: PayrollSettings,
): DailyResult {
  const { nightBonusRate, overtimeBonusRate, nightStartHour, nightEndHour, dailyWorkLimit } = settings;
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
    if (fractionalBreak >= 1) {
      fractionalBreak -= 1;
      continue;
    }

    accumulated++;
    const minuteOfDay = m % 1440;

    const night = isNightMinute(minuteOfDay, nightStartHour, nightEndHour);
    const overtime = accumulated > dailyLimitMin;

    if (overtime) {
      overtimeMinutes++;
    } else {
      regularMinutes++;
    }
    if (night) {
      nightMinutes++;
    }
  }

  // 급여 계산 (한국 노동법: 보너스 가산 방식)
  // pay = (totalWorked + overtime*overtimeBonus + night*nightBonus) * wage / 60
  const totalWorked = regularMinutes + overtimeMinutes;
  const pay = (totalWorked + overtimeMinutes * overtimeBonusRate + nightMinutes * nightBonusRate) * hourlyWage / 60;

  return {
    date,
    totalMinutes: totalWorked,
    regularMinutes,
    overtimeMinutes,
    nightMinutes,
    hourlyWage,
    pay: Math.round(pay),
  };
}

/**
 * 주휴수당 계산 (근로기준법 제55조)
 * - 주 15시간 이상 근무 시 지급
 * - 주휴수당 = (주간 근무시간 / 40) × 8 × 시급  (최대 8시간분)
 */
function calcWeeklyHoliday(
  daily: DailyResult[],
  wageRates: WageRate[],
  settings: PayrollSettings,
): WeeklyHolidayResult[] {
  if (!settings.weeklyHolidayPay) return [];

  // 날짜 → 주(ISO week 월요일) 기준으로 그룹화
  const weekMap = new Map<string, { minutes: number; wageSum: number; count: number; weekStart: Date }>();

  for (const d of daily) {
    const date = parseISO(d.date);
    const monday = startOfISOWeek(date); // ISO week: 월요일 시작
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

    // 주 15시간 미만이면 주휴수당 없음
    if (workedHours < 15) continue;

    const avgWage = Math.round(data.wageSum / data.count);
    const hourlyWage = resolveHourlyWage(getYear(data.weekStart), wageRates);

    // 주휴수당 = min(주간근무시간, 40) / 40 × 8 × 시급
    const holidayHours = Math.min(workedHours, 40) / 40 * 8;
    const holidayPay = Math.round(holidayHours * (avgWage || hourlyWage));

    const sunday = endOfISOWeek(data.weekStart);

    results.push({
      weekStart: weekKey,
      weekEnd: format(sunday, 'yyyy-MM-dd'),
      workedMinutes: data.minutes,
      hourlyWage: avgWage || hourlyWage,
      holidayPay,
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
): PayrollResult {
  const dailyMap = new Map<string, DailyResult>();

  for (const entry of entries) {
    const start = parseISO(entry.startDate);
    const end = parseISO(entry.endDate);
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
        accumulateDay(dailyMap, dateStr, startMin, todayEnd, todayBreak, wage, settings);

        const tomorrow = addDays(day, 1);
        const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
        const tomorrowWage = resolveHourlyWage(getYear(tomorrow), wageRates);
        accumulateDay(dailyMap, tomorrowStr, tomorrowStart, tomorrowEnd, tomorrowBreak, tomorrowWage, settings);
      } else {
        const wage = resolveHourlyWage(getYear(day), wageRates);
        accumulateDay(dailyMap, dateStr, startMin, endMin, entry.breakMinutes, wage, settings);
      }
    }
  }

  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // 주휴수당 계산
  const weekly = calcWeeklyHoliday(daily, wageRates, settings);
  const totalHolidayPay = weekly.reduce((s, w) => s + w.holidayPay, 0);

  // 월별 집계 (근로급여만)
  const monthMap = new Map<string, { pay: number; minutes: number }>();
  for (const d of daily) {
    const ym = d.date.slice(0, 7);
    const prev = monthMap.get(ym) ?? { pay: 0, minutes: 0 };
    monthMap.set(ym, { pay: prev.pay + d.pay, minutes: prev.minutes + d.totalMinutes });
  }
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, v]) => ({ yearMonth, ...v }));

  const totalWorkPay = daily.reduce((s, d) => s + d.pay, 0);
  const totalMinutes = daily.reduce((s, d) => s + d.totalMinutes, 0);

  return {
    daily,
    weekly,
    monthly,
    totalWorkPay,
    totalHolidayPay,
    totalPay: totalWorkPay + totalHolidayPay,
    totalMinutes,
  };
}

function accumulateDay(
  map: Map<string, DailyResult>,
  dateStr: string,
  startMin: number,
  endMin: number,
  breakMinutes: number,
  hourlyWage: number,
  settings: PayrollSettings,
): void {
  if (startMin >= endMin) return;
  const result = calcDay(dateStr, startMin, endMin, breakMinutes, hourlyWage, settings);
  const prev = map.get(dateStr);
  if (!prev) {
    map.set(dateStr, result);
  } else {
    map.set(dateStr, {
      date: dateStr,
      totalMinutes: prev.totalMinutes + result.totalMinutes,
      regularMinutes: prev.regularMinutes + result.regularMinutes,
      overtimeMinutes: prev.overtimeMinutes + result.overtimeMinutes,
      nightMinutes: prev.nightMinutes + result.nightMinutes,
      hourlyWage: prev.hourlyWage,
      pay: prev.pay + result.pay,
    });
  }
}
