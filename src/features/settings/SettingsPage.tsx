import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { PayrollSettings } from '../../types';
import { getHolidayName } from '../../services/payroll/rules/publicHolidays';

function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: () => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-700">{label}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
      <div onClick={onChange}
        className={`w-12 h-6 rounded-full transition-colors cursor-pointer flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-300'}`}>
        <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${on ? 'translate-x-6' : 'translate-x-0.5'}`} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, saveSettings, customHolidays, addCustomHoliday, removeCustomHoliday } = useAppStore();
  const [form, setForm] = useState<PayrollSettings>({ ...settings });
  const [saved, setSaved] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [holidayError, setHolidayError] = useState('');

  function set<K extends keyof PayrollSettings>(key: K, value: PayrollSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    const defaults: PayrollSettings = {
      nightBonusRate: 0.5, overtimeBonusRate: 0.5, weeklyHolidayPay: false,
      nightStartHour: 22, nightEndHour: 6, dailyWorkLimit: 8, currency: 'KRW',
      holidayPayEnabled: true, holidayBonusRate: 0.5, weeklyOvertimeEnabled: true,
    };
    setForm(defaults);
  }

  function handleAddHoliday() {
    setHolidayError('');
    if (!newHolidayDate) { setHolidayError('날짜를 선택해주세요'); return; }
    const existing = getHolidayName(newHolidayDate);
    if (existing) { setHolidayError(`이미 법정 공휴일입니다: ${existing}`); return; }
    addCustomHoliday(newHolidayDate);
    setNewHolidayDate('');
  }

  const inputCls = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-28';
  const sectionCls = 'bg-white border border-gray-200 rounded-lg p-5 space-y-4';

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-800">설정</h1>

      <form onSubmit={handleSave} className="space-y-5 max-w-lg">

        {/* 연장근무 */}
        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-gray-700">연장 근무</h2>
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-700">일일 기본 근무시간</p><p className="text-xs text-gray-400">초과 시 일간 연장으로 처리</p></div>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.dailyWorkLimit} min={1} max={24}
                onChange={(e) => set('dailyWorkLimit', Number(e.target.value))} />
              <span className="text-sm text-gray-500">시간</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-700">연장 근무 가산율</p><p className="text-xs text-gray-400">법정 기준 50%</p></div>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.overtimeBonusRate * 100} min={0} max={200}
                onChange={(e) => set('overtimeBonusRate', Number(e.target.value) / 100)} />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          <Toggle on={form.weeklyOvertimeEnabled} onChange={() => set('weeklyOvertimeEnabled', !form.weeklyOvertimeEnabled)}
            label="주 40시간 초과 연장 추적"
            sub="토요일 등 주간 합계가 40h 넘으면 자동으로 연장 처리" />
        </div>

        {/* 야간근무 */}
        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-gray-700">야간 근무</h2>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">야간 시작 시각</p>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.nightStartHour} min={0} max={23}
                onChange={(e) => set('nightStartHour', Number(e.target.value))} />
              <span className="text-sm text-gray-500">시</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">야간 종료 시각</p>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.nightEndHour} min={0} max={23}
                onChange={(e) => set('nightEndHour', Number(e.target.value))} />
              <span className="text-sm text-gray-500">시</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div><p className="text-sm text-gray-700">야간 가산율</p><p className="text-xs text-gray-400">법정 기준 50%</p></div>
            <div className="flex items-center gap-2">
              <input type="number" className={inputCls} value={form.nightBonusRate * 100} min={0} max={200}
                onChange={(e) => set('nightBonusRate', Number(e.target.value) / 100)} />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </div>

        {/* 공휴일 근무 */}
        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-gray-700">공휴일 근무 가산수당</h2>
          <Toggle on={form.holidayPayEnabled} onChange={() => set('holidayPayEnabled', !form.holidayPayEnabled)}
            label="공휴일 가산수당 적용"
            sub="법정 공휴일 근무 시 +50% 가산 (8h 초과 시 연장과 중첩)" />
          {form.holidayPayEnabled && (
            <div className="flex items-center justify-between">
              <div><p className="text-sm text-gray-700">공휴일 가산율</p><p className="text-xs text-gray-400">법정 기준 50%</p></div>
              <div className="flex items-center gap-2">
                <input type="number" className={inputCls} value={form.holidayBonusRate * 100} min={0} max={200}
                  onChange={(e) => set('holidayBonusRate', Number(e.target.value) / 100)} />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          )}
        </div>

        {/* 주휴수당 */}
        <div className={sectionCls}>
          <h2 className="text-sm font-semibold text-gray-700">주휴수당</h2>
          <Toggle on={form.weeklyHolidayPay} onChange={() => set('weeklyHolidayPay', !form.weeklyHolidayPay)}
            label="주휴수당 적용"
            sub="주 15시간 이상 근무 시 유급 휴일 1일 지급" />
        </div>

        <div className="flex gap-3">
          <button type="submit" className="px-5 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">
            {saved ? '저장됨 ✓' : '저장'}
          </button>
          <button type="button" onClick={handleReset}
            className="px-5 py-2 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">
            기본값으로
          </button>
        </div>
      </form>

      {/* 사용자 지정 공휴일 */}
      <div className="max-w-lg space-y-3">
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">사용자 지정 공휴일</h2>
            <p className="text-xs text-gray-400 mt-1">
              법정 공휴일 DB에 없는 날짜(임시 공휴일, 회사 지정 휴일 등)를 추가합니다.
              2020-2027 외 연도도 이곳에서 추가하세요.
            </p>
          </div>
          <div className="flex gap-2">
            <input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 flex-1" />
            <button type="button" onClick={handleAddHoliday}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700">
              추가
            </button>
          </div>
          {holidayError && <p className="text-red-500 text-xs">{holidayError}</p>}

          {customHolidays.length > 0 && (
            <ul className="space-y-1">
              {customHolidays.map((date) => (
                <li key={date} className="flex items-center justify-between text-sm py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-700">{date}</span>
                  <button onClick={() => removeCustomHoliday(date)}
                    className="text-xs px-2 py-0.5 rounded border border-red-200 text-red-500 hover:bg-red-50">
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
          {customHolidays.length === 0 && (
            <p className="text-xs text-gray-400">추가된 사용자 지정 공휴일이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
