import { addDays, eachDayOfInterval, getDay, getYear, parseISO, format } from 'date-fns';
import type { WorkEntry, WageRate, PayrollSettings, DailyResult, PayrollResult } from '../../types';
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
  // 없으면 가장 최근 연도 (입력 연도보다 이전 중 가장 큰 것 → 없으면 전체 최신)
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

  // 실근무 구간 (break 제거: break 는 끝에서 단순 차감)
  const totalWorkedMin = Math.max(0, endMin - startMin - breakMinutes);

  let regularMinutes = 0;
  let overtimeMinutes = 0;
  let nightMinutes = 0;

  // 분 단위로 순회하며 regular/overtime/night 분류
  let accumulated = 0; // 오늘 누적 근무 분

  // break 를 균등하게 제거하기 위해, 실제 근무 분만 순회
  const workedIntervalMin = endMin - startMin;
  const breakRatio = workedIntervalMin > 0 ? breakMinutes / workedIntervalMin : 0;
  let fractionalBreak = 0;

  for (let m = startMin; m < endMin; m++) {
    // break 비율만큼 제거 (소수 누적)
    fractionalBreak += breakRatio;
    if (fractionalBreak >= 1) {
      fractionalBreak -= 1;
      continue; // 이 분은 break로 스킵
    }

    accumulated++;
    const minuteOfDay = m % 1440; // 자정 넘으면 다음날 기준 분으로 wrap

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

  // 합산 검증: totalWorkedMin 과 실제 집계가 일치해야 함 (부동소수점 오차 허용)
  // (내부 일관성용, 외부에 노출 안 함)

  // 급여 계산 (한국 노동법 기준: 보너스 가산 방식)
  // - 모든 실근무: base pay
  // - 연장 분: +overtimeBonusRate (중복 가산)
  // - 야간 분: +nightBonusRate   (중복 가산)
  // pay = (totalWorked + overtime*overtimeBonus + night*nightBonus) * wage / 60
  const totalWorked = regularMinutes + overtimeMinutes;
  const pay = (totalWorked + overtimeMinutes * overtimeBonusRate + nightMinutes * nightBonusRate) * hourlyWage / 60;

  return {
    date,
    totalMinutes: regularMinutes + overtimeMinutes,
    regularMinutes,
    overtimeMinutes,
    nightMinutes,
    hourlyWage,
    pay: Math.round(pay), // 원 단위 반올림
  };
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
      // daysOfWeek 필터 (0=일, 6=토)
      if (entry.daysOfWeek && entry.daysOfWeek.length > 0) {
        if (!entry.daysOfWeek.includes(getDay(day))) continue;
      }

      const dateStr = format(day, 'yyyy-MM-dd');

      // 시간이 다음날로 넘어가면 두 날짜에 걸쳐 처리
      if (endMin > 1440) {
        // 당일 부분: startMin ~ 1440 (자정)
        const todayEnd = 1440;
        const tomorrowStart = 0;
        const tomorrowEnd = endMin - 1440;

        const todayBreak = entry.breakMinutes > 0
          ? Math.round(entry.breakMinutes * (todayEnd - startMin) / (endMin - startMin))
          : 0;
        const tomorrowBreak = entry.breakMinutes - todayBreak;

        const year = getYear(day);
        const wage = resolveHourlyWage(year, wageRates);

        // 당일 결과 누적
        accumulateDay(dailyMap, dateStr, startMin, todayEnd, todayBreak, wage, settings);

        // 다음날 결과 누적
        const tomorrow = addDays(day, 1);
        if (entry.daysOfWeek && entry.daysOfWeek.length > 0) {
          // 다음날이 daysOfWeek에 포함되지 않아도 야간 연장은 포함 (현재 일자 근무의 연속)
        }
        const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
        const tomorrowYear = getYear(tomorrow);
        const tomorrowWage = resolveHourlyWage(tomorrowYear, wageRates);
        accumulateDay(dailyMap, tomorrowStr, tomorrowStart, tomorrowEnd, tomorrowBreak, tomorrowWage, settings);
      } else {
        const year = getYear(day);
        const wage = resolveHourlyWage(year, wageRates);
        accumulateDay(dailyMap, dateStr, startMin, endMin, entry.breakMinutes, wage, settings);
      }
    }
  }

  // daily 목록 정렬
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // 월별 집계
  const monthMap = new Map<string, { pay: number; minutes: number }>();
  for (const d of daily) {
    const ym = d.date.slice(0, 7); // 'YYYY-MM'
    const prev = monthMap.get(ym) ?? { pay: 0, minutes: 0 };
    monthMap.set(ym, { pay: prev.pay + d.pay, minutes: prev.minutes + d.totalMinutes });
  }
  const monthly = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([yearMonth, v]) => ({ yearMonth, ...v }));

  const totalPay = daily.reduce((s, d) => s + d.pay, 0);
  const totalMinutes = daily.reduce((s, d) => s + d.totalMinutes, 0);

  return { daily, monthly, totalPay, totalMinutes };
}

/** dailyMap 에 특정 날짜의 결과를 누적(더하기). 같은 날 여러 Entry가 있을 수 있음. */
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
    // 같은 날 여러 Entry 합산 (시급은 최초 것 유지 – 동일 날짜는 같은 연도이므로 동일)
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
