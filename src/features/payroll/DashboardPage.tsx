import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { calculatePayroll } from '../../services/payroll/calculator';
import { formatKRW, formatMinutes } from '../../utils/format';

export default function DashboardPage() {
  const { entries, wageRates, settings } = useAppStore();

  const thisMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const from = thisMonth + '-01';
  const to = new Date().toISOString().slice(0, 10);

  const result = useMemo(() => {
    const filtered = entries.filter((e) => e.endDate >= from && e.startDate <= to);
    if (!filtered.length) return null;
    return calculatePayroll(filtered, wageRates, settings);
  }, [entries, wageRates, settings, from, to]);

  const monthData = result?.monthly.find((m) => m.yearMonth === thisMonth);

  const cards = [
    {
      label: '이번 달 예상 급여',
      value: formatKRW(monthData?.pay ?? 0),
      color: 'text-blue-600',
    },
    {
      label: '이번 달 근무시간',
      value: formatMinutes(monthData?.minutes ?? 0),
      color: 'text-green-600',
    },
    {
      label: '이번 달 근무일수',
      value: `${result?.daily.filter((d) => d.date >= from && d.date <= to).length ?? 0}일`,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">대시보드</h1>
      <p className="text-sm text-gray-500">{thisMonth} 기준</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <p className="text-xs text-gray-500 mb-2">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {!entries.length && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 text-center">
          <p className="text-blue-700 font-medium mb-2">아직 근무 데이터가 없어요</p>
          <p className="text-sm text-blue-500 mb-4">근무 일정을 입력하면 급여가 자동으로 계산됩니다.</p>
          <Link
            to="/entries"
            className="inline-block px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
          >
            근무 입력하러 가기
          </Link>
        </div>
      )}
    </div>
  );
}
