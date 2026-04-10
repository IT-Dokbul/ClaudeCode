import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatKRW } from '../../utils/format';

export default function WagesPage() {
  const { wageRates, saveWageRate, deleteWageRate } = useAppStore();
  const [newYear, setNewYear] = useState('');
  const [newWage, setNewWage] = useState('');
  const [editingYear, setEditingYear] = useState<number | null>(null);
  const [editWage, setEditWage] = useState('');
  const [error, setError] = useState('');

  const sorted = [...wageRates].sort((a, b) => b.year - a.year);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const year = Number(newYear);
    const wage = Number(newWage);
    if (!year || year < 2000 || year > 2100) { setError('연도를 올바르게 입력해주세요 (2000~2100)'); return; }
    if (!wage || wage < 1000) { setError('시급을 올바르게 입력해주세요 (1000원 이상)'); return; }
    saveWageRate({ year, hourlyWage: wage });
    setNewYear('');
    setNewWage('');
  }

  function handleEdit(year: number) {
    setEditingYear(year);
    setEditWage(String(wageRates.find((r) => r.year === year)?.hourlyWage ?? ''));
  }

  function handleEditSave(year: number) {
    const wage = Number(editWage);
    if (!wage || wage < 1000) return;
    saveWageRate({ year, hourlyWage: wage });
    setEditingYear(null);
  }

  const inputCls = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">시급 관리</h1>
      <p className="text-sm text-gray-500">연도별 최저시급을 관리합니다. 급여 계산 시 해당 연도의 시급이 자동 적용됩니다.</p>

      {/* 추가 폼 */}
      <div className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">시급 추가</h2>
        <form onSubmit={handleAdd} className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">연도</label>
            <input
              type="number" className={`${inputCls} w-28`} placeholder="2026"
              value={newYear} onChange={(e) => setNewYear(e.target.value)} min={2000} max={2100}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">시급 (원)</label>
            <input
              type="number" className={`${inputCls} w-36`} placeholder="10030"
              value={newWage} onChange={(e) => setNewWage(e.target.value)} min={1000}
            />
          </div>
          <button type="submit" className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">
            추가
          </button>
        </form>
        {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
      </div>

      {/* 시급 목록 */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">연도</th>
              <th className="text-right px-4 py-3">시급</th>
              <th className="text-right px-4 py-3">전년 대비</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((rate, i) => {
              const prev = sorted[i + 1];
              const diff = prev ? rate.hourlyWage - prev.hourlyWage : null;
              return (
                <tr key={rate.year} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{rate.year}년</td>
                  <td className="px-4 py-3 text-right">
                    {editingYear === rate.year ? (
                      <input
                        type="number" className={`${inputCls} w-32`}
                        value={editWage} onChange={(e) => setEditWage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEditSave(rate.year)}
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-gray-800">{formatKRW(rate.hourlyWage)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {diff !== null ? (
                      <span className={diff >= 0 ? 'text-green-600' : 'text-red-500'}>
                        {diff >= 0 ? '+' : ''}{diff.toLocaleString()}원
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex gap-2 justify-end">
                      {editingYear === rate.year ? (
                        <>
                          <button onClick={() => handleEditSave(rate.year)}
                            className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">저장</button>
                          <button onClick={() => setEditingYear(null)}
                            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">취소</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(rate.year)}
                            className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50">수정</button>
                          <button onClick={() => deleteWageRate(rate.year)}
                            className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50">삭제</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
