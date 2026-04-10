export type ID = string;

export interface WorkEntry {
  id: ID;
  startDate: string;       // 'YYYY-MM-DD'
  endDate: string;
  startTime: string;       // 'HH:mm'
  endTime: string;         // 'HH:mm' (다음날로 넘어갈 수 있음)
  breakMinutes: number;    // 휴게시간(분)
  daysOfWeek?: number[];   // 0=일~6=토, 비어있으면 매일
  memo?: string;
  // jobId?: ID;           // 다중 직장 대비 (추후 확장)
}

export interface WageRate {
  year: number;            // e.g. 2025
  hourlyWage: number;      // KRW
}

export interface PayrollSettings {
  nightBonusRate: number;        // 0.5 = 50% 야간 가산
  overtimeBonusRate: number;     // 0.5 = 50% 연장 가산
  weeklyHolidayPay: boolean;     // 주휴수당 적용 여부
  nightStartHour: number;        // 22
  nightEndHour: number;          // 6
  dailyWorkLimit: number;        // 8 (시간)
  currency: string;              // 'KRW'
  holidayPayEnabled: boolean;    // 공휴일 가산수당 적용
  holidayBonusRate: number;      // 0.5 = 50%
  weeklyOvertimeEnabled: boolean; // 주 40시간 초과 연장 추적
}

export interface DailyResult {
  date: string;               // 'YYYY-MM-DD'
  totalMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;    // 일간 + 주간 연장 합산
  nightMinutes: number;
  isHoliday: boolean;         // 법정 공휴일 여부
  holidayName?: string;       // 공휴일 이름
  hourlyWage: number;
  pay: number;
}

export interface WeeklyHolidayResult {
  weekStart: string;      // 해당 주 월요일 'YYYY-MM-DD'
  weekEnd: string;        // 해당 주 일요일 'YYYY-MM-DD'
  workedMinutes: number;  // 주간 실근무 분
  hourlyWage: number;     // 적용 시급
  holidayPay: number;     // 주휴수당
}

export interface PayrollResult {
  daily: DailyResult[];
  weekly: WeeklyHolidayResult[];  // 주휴수당 내역
  monthly: { yearMonth: string; pay: number; minutes: number }[];
  totalPay: number;        // 근로급여 + 주휴수당 합산
  totalWorkPay: number;    // 근로급여만
  totalHolidayPay: number; // 주휴수당 합산
  totalMinutes: number;
}

export const DEFAULT_WAGE_RATES: WageRate[] = [
  { year: 2022, hourlyWage: 9160 },
  { year: 2023, hourlyWage: 9620 },
  { year: 2024, hourlyWage: 9860 },
  { year: 2025, hourlyWage: 10030 },
];

export const DEFAULT_SETTINGS: PayrollSettings = {
  nightBonusRate: 0.5,
  overtimeBonusRate: 0.5,
  weeklyHolidayPay: false,
  nightStartHour: 22,
  nightEndHour: 6,
  dailyWorkLimit: 8,
  currency: 'KRW',
  holidayPayEnabled: true,
  holidayBonusRate: 0.5,
  weeklyOvertimeEnabled: true,
};
