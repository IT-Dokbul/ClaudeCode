import { describe, it, expect } from 'vitest';
import { calculatePayroll } from '../services/payroll/calculator';
import type { WorkEntry, WageRate, PayrollSettings, DailyResult } from '../types';

// ─── 공통 픽스처 ───────────────────────────────────────────────────────────────

const wageRates: WageRate[] = [
  { year: 2022, hourlyWage: 9160 },
  { year: 2023, hourlyWage: 9620 },
  { year: 2024, hourlyWage: 9860 },
  { year: 2025, hourlyWage: 10030 },
];

const baseSettings: PayrollSettings = {
  nightBonusRate: 0.5,
  overtimeBonusRate: 0.5,
  weeklyHolidayPay: false,
  nightStartHour: 22,
  nightEndHour: 6,
  dailyWorkLimit: 8,
  currency: 'KRW',
  holidayPayEnabled: false,
  holidayBonusRate: 0.5,
  weeklyOvertimeEnabled: false,
};

function entry(overrides: Partial<WorkEntry> & Pick<WorkEntry, 'startDate' | 'endDate' | 'startTime' | 'endTime'>): WorkEntry {
  return {
    id: 'test',
    breakMinutes: 0,
    ...overrides,
  };
}

// ─── 테스트 케이스 ────────────────────────────────────────────────────────────

describe('calculatePayroll', () => {

  // 1. 단일일, 정규 근무 (8시간)
  it('TC01: 단일일 8시간 정규 근무 - 급여 계산', () => {
    const e = entry({ startDate: '2025-01-02', endDate: '2025-01-02', startTime: '09:00', endTime: '17:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);

    expect(result.daily).toHaveLength(1);
    expect(result.daily[0].date).toBe('2025-01-02');
    expect(result.daily[0].regularMinutes).toBe(480);
    expect(result.daily[0].overtimeMinutes).toBe(0);
    expect(result.daily[0].nightMinutes).toBe(0);
    // pay = 480 * 10030 / 60 = 80240
    expect(result.daily[0].pay).toBe(Math.round(480 * 10030 / 60));
    expect(result.totalPay).toBe(result.daily[0].pay);
  });

  // 2. 단일일, 연장 근무 (10시간 → 2시간 연장)
  it('TC02: 단일일 10시간 - 2시간 연장 가산 포함', () => {
    const e = entry({ startDate: '2025-01-02', endDate: '2025-01-02', startTime: '09:00', endTime: '19:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);

    expect(result.daily[0].regularMinutes).toBe(480);
    expect(result.daily[0].overtimeMinutes).toBe(120);
    // pay = (600 + 120*0.5) * 10030 / 60  (total + overtime bonus)
    const expected = Math.round((600 + 120 * 0.5) * 10030 / 60);
    expect(result.daily[0].pay).toBe(expected);
  });

  // 3. 야간 근무 (23:00~01:00) → 자정을 넘어 두 날에 걸쳐 분리
  it('TC03: 야간 근무 (23:00~01:00) - 두 날짜로 분리, 합산 야간 120분', () => {
    const e = entry({ startDate: '2025-01-02', endDate: '2025-01-02', startTime: '23:00', endTime: '01:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);

    // 자정을 넘어 당일(23:00~00:00 = 60분)과 다음날(00:00~01:00 = 60분)로 분리
    expect(result.daily).toHaveLength(2);
    const totalNight = result.daily.reduce((s: number, d: DailyResult) => s + d.nightMinutes, 0);
    const totalMinutes = result.daily.reduce((s: number, d: DailyResult) => s + d.totalMinutes, 0);
    expect(totalNight).toBe(120);
    expect(totalMinutes).toBe(120);
    // 전 구간 야간이므로 pay = 120 * 1.5 * 10030 / 60
    expect(result.totalPay).toBe(Math.round(120 * (1 + 0.5) * 10030 / 60));
  });

  // 4. 휴게시간 차감
  it('TC04: 8시간 근무에 60분 휴게 → 7시간 실근무', () => {
    const e = entry({ startDate: '2025-01-02', endDate: '2025-01-02', startTime: '09:00', endTime: '17:00', breakMinutes: 60 });
    const result = calculatePayroll([e], wageRates, baseSettings);

    expect(result.daily[0].regularMinutes).toBe(420); // 7h
    expect(result.daily[0].overtimeMinutes).toBe(0);
  });

  // 5. 다일 근무 (3일)
  it('TC05: 3일 연속 근무 - 일자별 결과 생성', () => {
    const e = entry({ startDate: '2025-01-06', endDate: '2025-01-08', startTime: '09:00', endTime: '17:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);

    expect(result.daily).toHaveLength(3);
    expect(result.daily.map((d) => d.date)).toEqual(['2025-01-06', '2025-01-07', '2025-01-08']);
    expect(result.totalMinutes).toBe(480 * 3);
  });

  // 6. daysOfWeek 필터 (평일만)
  it('TC06: daysOfWeek [1,2,3,4,5] - 주말 제외', () => {
    // 2025-01-06(월)~2025-01-12(일) → 평일 5일만 집계
    const e = entry({
      startDate: '2025-01-06',
      endDate: '2025-01-12',
      startTime: '09:00',
      endTime: '17:00',
      daysOfWeek: [1, 2, 3, 4, 5],
    });
    const result = calculatePayroll([e], wageRates, baseSettings);

    expect(result.daily).toHaveLength(5);
    expect(result.daily.every((d) => !['2025-01-11', '2025-01-12'].includes(d.date))).toBe(true);
  });

  // 7. 연도 경계 (2024 → 2025)
  it('TC07: 연도 경계 - 2024년 시급 vs 2025년 시급 자동 적용', () => {
    const e = entry({ startDate: '2024-12-31', endDate: '2025-01-01', startTime: '09:00', endTime: '17:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);

    expect(result.daily).toHaveLength(2);
    const dec31 = result.daily.find((d) => d.date === '2024-12-31');
    const jan01 = result.daily.find((d) => d.date === '2025-01-01');
    expect(dec31?.hourlyWage).toBe(9860);  // 2024년 시급
    expect(jan01?.hourlyWage).toBe(10030); // 2025년 시급
  });

  // 8. 시급 없는 연도 → 가장 최근 연도 사용
  it('TC08: 등록되지 않은 연도(2026) → 가장 최근 시급(2025) 적용', () => {
    const e = entry({ startDate: '2026-03-01', endDate: '2026-03-01', startTime: '09:00', endTime: '17:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);

    expect(result.daily[0].hourlyWage).toBe(10030); // 2025년 시급
  });

  // 9. 야간 + 연장 동시 발생
  it('TC09: 야간 + 연장 동시 발생 - 각각 독립 집계', () => {
    // 14:00~23:00 = 9시간, 22:00~23:00 = 60분 야간, 22:00~23:00 = 연장
    const e = entry({ startDate: '2025-01-02', endDate: '2025-01-02', startTime: '14:00', endTime: '23:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);

    expect(result.daily[0].totalMinutes).toBe(540); // 9h
    expect(result.daily[0].overtimeMinutes).toBe(60); // 1h 연장
    expect(result.daily[0].nightMinutes).toBe(60);   // 22~23시 야간
  });

  // 10. 월별 집계
  it('TC10: 월별 집계가 올바르게 집계된다', () => {
    const e1 = entry({ id: 'e1', startDate: '2025-01-06', endDate: '2025-01-06', startTime: '09:00', endTime: '17:00' });
    const e2 = entry({ id: 'e2', startDate: '2025-02-03', endDate: '2025-02-03', startTime: '09:00', endTime: '17:00' });
    const result = calculatePayroll([e1, e2], wageRates, baseSettings);

    expect(result.monthly).toHaveLength(2);
    expect(result.monthly[0].yearMonth).toBe('2025-01');
    expect(result.monthly[1].yearMonth).toBe('2025-02');
    expect(result.totalPay).toBe(result.monthly[0].pay + result.monthly[1].pay);
  });

  // 11. 자정 넘어가는 근무 (당일+다음날 분리)
  it('TC11: 자정을 넘어가는 근무 (21:00~03:00) - 당일/다음날 분리', () => {
    const e = entry({ startDate: '2025-01-02', endDate: '2025-01-02', startTime: '21:00', endTime: '03:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);

    // 당일 21:00~00:00 = 180분, 다음날 00:00~03:00 = 180분
    expect(result.daily.some((d) => d.date === '2025-01-02')).toBe(true);
    expect(result.daily.some((d) => d.date === '2025-01-03')).toBe(true);
    expect(result.totalMinutes).toBe(360); // 6h 합계
  });

  // 12. 빈 entries → 결과 0
  it('TC12: 입력 없으면 결과가 0', () => {
    const result = calculatePayroll([], wageRates, baseSettings);
    expect(result.daily).toHaveLength(0);
    expect(result.totalPay).toBe(0);
    expect(result.totalMinutes).toBe(0);
  });

  // 13. 연장 없는 8시간 경계값 테스트
  it('TC13: 정확히 8시간 - 연장 없음', () => {
    const e = entry({ startDate: '2025-01-02', endDate: '2025-01-02', startTime: '08:00', endTime: '16:00' });
    const result = calculatePayroll([e], wageRates, baseSettings);
    expect(result.daily[0].overtimeMinutes).toBe(0);
    expect(result.daily[0].regularMinutes).toBe(480);
  });

  // 14. 주휴수당 비활성화 → weekly 배열 비어있어야 함
  it('TC14: weeklyHolidayPay=false → 주휴수당 없음', () => {
    // 2025-01-06(월)~2025-01-10(금) 5일, 8시간씩 = 주 40시간
    const e = entry({ startDate: '2025-01-06', endDate: '2025-01-10', startTime: '09:00', endTime: '17:00' });
    const result = calculatePayroll([e], wageRates, { ...baseSettings, weeklyHolidayPay: false });
    expect(result.weekly).toHaveLength(0);
    expect(result.totalHolidayPay).toBe(0);
    expect(result.totalPay).toBe(result.totalWorkPay);
  });

  // 15. 주휴수당 활성화, 주 40시간 → 8시간분 주휴수당
  it('TC15: weeklyHolidayPay=true, 주 40시간 → 8시간분 주휴수당', () => {
    // 2025-01-06(월)~2025-01-10(금) 5일, 8시간씩 = 40시간
    const e = entry({ startDate: '2025-01-06', endDate: '2025-01-10', startTime: '09:00', endTime: '17:00' });
    const result = calculatePayroll([e], wageRates, { ...baseSettings, weeklyHolidayPay: true });

    expect(result.weekly).toHaveLength(1);
    // 주휴수당 = (40/40) * 8 * 10030 = 80240
    expect(result.totalHolidayPay).toBe(Math.round(8 * 10030));
    expect(result.totalPay).toBe(result.totalWorkPay + result.totalHolidayPay);
  });

  // 16. 주 15시간 미만 → 주휴수당 없음
  it('TC16: 주 15시간 미만(10시간) → 주휴수당 없음', () => {
    // 2025-01-06(월)~2025-01-07(화) 2일, 5시간씩 = 10시간
    const e = entry({ startDate: '2025-01-06', endDate: '2025-01-07', startTime: '09:00', endTime: '14:00' });
    const result = calculatePayroll([e], wageRates, { ...baseSettings, weeklyHolidayPay: true });
    expect(result.weekly).toHaveLength(0);
    expect(result.totalHolidayPay).toBe(0);
  });

  // 17. 주 20시간 → 비례 주휴수당 (4시간분)
  it('TC17: 주 20시간 → 비례 주휴수당 4시간분', () => {
    // 2025-01-06(월)~2025-01-09(목) 4일, 5시간씩 = 20시간
    const e = entry({ startDate: '2025-01-06', endDate: '2025-01-09', startTime: '09:00', endTime: '14:00' });
    const result = calculatePayroll([e], wageRates, { ...baseSettings, weeklyHolidayPay: true });

    expect(result.weekly).toHaveLength(1);
    // 주휴수당 = (20/40) * 8 * 10030 = 4 * 10030 = 40120
    expect(result.totalHolidayPay).toBe(Math.round(4 * 10030));
  });

  // 18. 공휴일 가산수당 (법정 공휴일 근무 +50%)
  it('TC18: 공휴일(신정 2025-01-01) 8시간 근무 → holidayPayEnabled=true 시 +50% 가산', () => {
    // 2025-01-01 신정 (FIXED_ANNUAL '01-01')
    const e = entry({ startDate: '2025-01-01', endDate: '2025-01-01', startTime: '09:00', endTime: '17:00' });

    const withHoliday = calculatePayroll([e], wageRates, { ...baseSettings, holidayPayEnabled: true, holidayBonusRate: 0.5 });
    const withoutHoliday = calculatePayroll([e], wageRates, { ...baseSettings, holidayPayEnabled: false });

    const d = withHoliday.daily[0];
    expect(d.isHoliday).toBe(true);
    expect(d.holidayName).toBe('신정');
    // pay with holiday = (480 + 480*0.5) * 10030 / 60 = 720 * 10030 / 60
    expect(d.pay).toBe(Math.round(720 * 10030 / 60));
    // pay without = 480 * 10030 / 60
    expect(withoutHoliday.daily[0].pay).toBe(Math.round(480 * 10030 / 60));
    // holiday premium = 480 * 0.5 * 10030 / 60
    expect(d.pay - withoutHoliday.daily[0].pay).toBe(Math.round(240 * 10030 / 60));
  });

  // 19. 공휴일 아닌 날 → isHoliday false
  it('TC19: 일반 평일은 isHoliday=false', () => {
    const e = entry({ startDate: '2025-01-02', endDate: '2025-01-02', startTime: '09:00', endTime: '17:00' });
    const result = calculatePayroll([e], wageRates, { ...baseSettings, holidayPayEnabled: true });
    expect(result.daily[0].isHoliday).toBe(false);
    expect(result.daily[0].holidayName).toBeUndefined();
  });

  // 20. 주 40시간 초과 연장 (토요일 추가 근무)
  it('TC20: 주 40시간 초과(월~금 40h + 토 4h) → 토요일 4시간 연장 처리', () => {
    // 월~금 9~17 (8h/일 × 5 = 40h), 토 9~13 (4h)
    const weekdays = entry({
      id: 'weekdays', startDate: '2025-01-06', endDate: '2025-01-10',
      startTime: '09:00', endTime: '17:00',
    });
    const saturday = entry({
      id: 'saturday', startDate: '2025-01-11', endDate: '2025-01-11',
      startTime: '09:00', endTime: '13:00',
    });
    const result = calculatePayroll([weekdays, saturday], wageRates, { ...baseSettings, weeklyOvertimeEnabled: true });

    const sat = result.daily.find((d) => d.date === '2025-01-11')!;
    expect(sat).toBeDefined();
    // 토요일 4시간은 일간 기준으로는 정규(8h 한도 미달)지만 주간 40h 초과이므로 전부 연장
    expect(sat.overtimeMinutes).toBe(240);
    expect(sat.regularMinutes).toBe(0);
  });

  // 21. 주 40시간 초과 연장 비활성화 → 토요일 정규 처리
  it('TC21: weeklyOvertimeEnabled=false → 토요일 4시간은 정규 처리', () => {
    const weekdays = entry({
      id: 'weekdays', startDate: '2025-01-06', endDate: '2025-01-10',
      startTime: '09:00', endTime: '17:00',
    });
    const saturday = entry({
      id: 'saturday', startDate: '2025-01-11', endDate: '2025-01-11',
      startTime: '09:00', endTime: '13:00',
    });
    const result = calculatePayroll([weekdays, saturday], wageRates, { ...baseSettings, weeklyOvertimeEnabled: false });

    const sat = result.daily.find((d) => d.date === '2025-01-11')!;
    expect(sat.regularMinutes).toBe(240);
    expect(sat.overtimeMinutes).toBe(0);
  });
});
