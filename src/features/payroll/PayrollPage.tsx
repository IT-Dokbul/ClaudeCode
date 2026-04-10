import { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { calculatePayroll } from '../../services/payroll/calculator';
import { formatKRW, formatMinutes } from '../../utils/format';
import type { DailyResult, WeeklyHolidayResult } from '../../types';

function toCSV(daily: DailyResult[], holidayPay: number): string {
  const header = '날짜,총근무(분),정규(분),연장(분),야간(분),시급,급여';
  const rows = daily.map((d) =>
    [d.date, d.totalMinutes, d.regularMinutes, d.overtimeMinutes, d.nightMinutes, d.hourlyWage, d.pay].join(','),
  );
  if (holidayPay > 0) rows.push(`주휴수당,,,,,,${holidayPay}`);
  return [header, ...rows].join('\n');
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function getMonthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const from = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${ym}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

type Mode = 'month' | 'custom';

export default function PayrollPage() {
  const { entries, wageRates, settings } = useAppStore();

  const todayYM = new Date().toISOString().slice(0, 7);
  const [mode, setMode] = useState<Mode>('month');
  const [selectedMonth, setSelectedMonth] = useState(todayYM);
  const [customFrom, setCustomFrom] = useState(todayYM + '-01');
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));

  const { from, to } = mode === 'month' ? getMonthRange(selectedMonth) : { from: customFrom, to: customTo };

  function shiftMonth(delta: number) {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const result = useMemo(() => {
    if (!entries.length) return null;
    const filtered = entries.filter((e) => e.endDate >= from && e.startDate <= to);
    if (!filtered.length) return null;
    return calculatePayroll(filtered, wageRates, settings);
  }, [entries, wageRates, settings, from, to]);

  const filteredDaily = useMemo(
    (): DailyResult[] => result?.daily.filter((d) => d.date >= from && d.date <= to) ?? [],
    [result, from, to],
  );

  // 주휴수당: 기간 내 주(週) 기준으로 필터
  const filteredWeekly = useMemo(
    (): WeeklyHolidayResult[] => result?.weekly.filter((w) => w.weekEnd >= from && w.weekStart <= to) ?? [],
    [result, from, to],
  );

  const totals = useMemo(() => ({
    workPay: filteredDaily.reduce((s: number, d: DailyResult) => s + d.pay, 0),
    holidayPay: filteredWeekly.reduce((s: number, w: WeeklyHolidayResult) => s + w.holidayPay, 0),
    minutes: filteredDaily.reduce((s: number, d: DailyResult) => s + d.totalMinutes, 0),
    overtime: filteredDaily.reduce((s: number, d: DailyResult) => s + d.overtimeMinutes, 0),
    night: filteredDaily.reduce((s: number, d: DailyResult) => s + d.nightMinutes, 0),
  }), [filteredDaily, filteredWeekly]);

  const totalPay = totals.workPay + totals.holidayPay;

  const inputCls = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';
  const tabCls = (active: boolean) =>
    `px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">급여 결과</h1>

      {/* 기간 선택 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          <button className={tabCls(mode === 'month')} onClick={() => setMode('month')}>월 단위</button>
          <button className={tabCls(mode === 'custom')} onClick={() => setMode('custom')}>직접 설정</button>
        </div>

        {mode === 'month' ? (
          <div className="flex items-center gap-3">
            <button onClick={() => shiftMonth(-1)}
              className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 text-lg leading-none">‹</button>
            <input type="month" className={inputCls} value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)} />
            <button onClick={() => shiftMonth(1)}
              className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 text-lg leading-none">›</button>
            <button onClick={() => setSelectedMonth(todayYM)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">
              이번 달
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
              <input type="date" className={inputCls} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
              <input type="date" className={inputCls} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
        )}

        {filteredDaily.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() => downloadCSV(toCSV(filteredDaily, totals.holidayPay), `급여_${from}_${to}.csv`)}
              className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
            >
              CSV 다운로드
            </button>
          </div>
        )}
      </div>

      {filteredDaily.length === 0 ? (
        <p className="text-center text-gray-400 py-12 text-sm">
          해당 기간에 근무 데이터가 없어요.
        </p>
      ) : (
        <>
          {/* 총합 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '총 수령액', value: formatKRW(totalPay), color: 'text-blue-600' },
              { label: '총 근무시간', value: formatMinutes(totals.minutes), color: 'text-green-600' },
              { label: '연장 근무', value: totals.overtime > 0 ? formatMinutes(totals.overtime) : '-', color: 'text-orange-500' },
              { label: '야간 근무', value: totals.night > 0 ? formatMinutes(totals.night) : '-', color: 'text-indigo-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* 급여 분류 카드 */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">급여 구성</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">근로 급여</span>
                <span className="font-medium text-gray-800">{formatKRW(totals.workPay)}</span>
              </div>
              {settings.weeklyHolidayPay && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">주휴수당 ({filteredWeekly.length}주)</span>
                  <span className="font-medium text-green-700">{formatKRW(totals.holidayPay)}</span>
                </div>
              )}
              {!settings.weeklyHolidayPay && (
                <div className="flex justify-between text-sm text-gray-400">
                  <span>주휴수당</span>
                  <span>설정에서 활성화 가능</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold">
                <span className="text-gray-800">합계</span>
                <span className="text-blue-700">{formatKRW(totalPay)}</span>
              </div>
            </div>
          </div>

          {/* 주휴수당 주별 내역 */}
          {settings.weeklyHolidayPay && filteredWeekly.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">주휴수당 내역</h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2">기간</th>
                      <th className="text-right px-4 py-2">주간 근무시간</th>
                      <th className="text-right px-4 py-2">시급</th>
                      <th className="text-right px-4 py-2">주휴수당</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredWeekly.map((w) => (
                      <tr key={w.weekStart} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{w.weekStart} ~ {w.weekEnd}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatMinutes(w.workedMinutes)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{w.hourlyWage.toLocaleString()}원</td>
                        <td className="px-4 py-2 text-right font-medium text-green-700">{formatKRW(w.holidayPay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 월별 표 */}
          {result && result.monthly.length > 1 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">월별 집계</h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2">월</th>
                      <th className="text-right px-4 py-2">근무시간</th>
                      <th className="text-right px-4 py-2">근로급여</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.monthly.map((m) => (
                      <tr key={m.yearMonth}>
                        <td className="px-4 py-2 text-gray-700">{m.yearMonth}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{formatMinutes(m.minutes)}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-800">{formatKRW(m.pay)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 일자별 표 */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">일자별 상세</h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left px-4 py-2">날짜</th>
                    <th className="text-right px-4 py-2">정규</th>
                    <th className="text-right px-4 py-2">연장</th>
                    <th className="text-right px-4 py-2">야간</th>
                    <th className="text-right px-4 py-2">시급</th>
                    <th className="text-right px-4 py-2">급여</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredDaily.map((d) => (
                    <tr key={d.date} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700">{d.date}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{formatMinutes(d.regularMinutes)}</td>
                      <td className="px-4 py-2 text-right text-orange-500">{d.overtimeMinutes > 0 ? formatMinutes(d.overtimeMinutes) : '-'}</td>
                      <td className="px-4 py-2 text-right text-indigo-500">{d.nightMinutes > 0 ? formatMinutes(d.nightMinutes) : '-'}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{d.hourlyWage.toLocaleString()}원</td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-800">{formatKRW(d.pay)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td className="px-4 py-2 text-gray-700">합계</td>
                    <td className="px-4 py-2 text-right text-gray-600">{formatMinutes(totals.minutes)}</td>
                    <td className="px-4 py-2 text-right text-orange-500">{totals.overtime > 0 ? formatMinutes(totals.overtime) : '-'}</td>
                    <td className="px-4 py-2 text-right text-indigo-500">{totals.night > 0 ? formatMinutes(totals.night) : '-'}</td>
                    <td></td>
                    <td className="px-4 py-2 text-right text-blue-700">{formatKRW(totals.workPay)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
