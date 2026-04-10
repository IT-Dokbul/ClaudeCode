import { useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { calculatePayroll } from '../../services/payroll/calculator';
import { formatKRW, formatMinutes } from '../../utils/format';
import type { DailyResult } from '../../types';

function toCSV(daily: DailyResult[]): string {
  const header = '날짜,총근무(분),정규(분),연장(분),야간(분),시급,급여';
  const rows = daily.map((d) =>
    [d.date, d.totalMinutes, d.regularMinutes, d.overtimeMinutes, d.nightMinutes, d.hourlyWage, d.pay].join(','),
  );
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

export default function PayrollPage() {
  const { entries, wageRates, settings } = useAppStore();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);

  const result = useMemo(() => {
    if (!entries.length) return null;
    const filtered = entries.filter(
      (e) => e.endDate >= from && e.startDate <= to,
    );
    if (!filtered.length) return null;
    return calculatePayroll(filtered, wageRates, settings);
  }, [entries, wageRates, settings, from, to]);

  const filteredDaily = useMemo(
    () => result?.daily.filter((d) => d.date >= from && d.date <= to) ?? [],
    [result, from, to],
  );

  const inputCls = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">급여 결과</h1>

      {/* 기간 선택 */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
          <input type="date" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
          <input type="date" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {result && (
          <button
            onClick={() => downloadCSV(toCSV(filteredDaily), `급여_${from}_${to}.csv`)}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            CSV 다운로드
          </button>
        )}
      </div>

      {!result ? (
        <p className="text-center text-gray-400 py-12 text-sm">
          해당 기간에 근무 데이터가 없어요.
        </p>
      ) : (
        <>
          {/* 총합 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: '총 급여', value: formatKRW(filteredDaily.reduce((s, d) => s + d.pay, 0)) },
              { label: '총 근무시간', value: formatMinutes(filteredDaily.reduce((s, d) => s + d.totalMinutes, 0)) },
              { label: '근무일수', value: `${filteredDaily.length}일` },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">{label}</p>
                <p className="text-lg font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>

          {/* 월별 표 */}
          {result.monthly.length > 1 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">월별 집계</h2>
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2">월</th>
                      <th className="text-right px-4 py-2">근무시간</th>
                      <th className="text-right px-4 py-2">급여</th>
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
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
